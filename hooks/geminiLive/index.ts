import { useEffect, useRef, useState, useCallback } from "react";
import { useOrder } from "../../context/OrderContext";
import { useAudioRecorder } from "../useAudioRecorder";
import { GoogleGenAI, Modality } from "@google/genai";
import { MODEL, ADD_DEDUPE_WINDOW_MS, TURBO_MODE } from "./constants";
import { tools } from "./tools/declarations";
import {
  buildSystemInstructions,
  buildTurboPrompt,
} from "./config/systemInstructions";
import { createDeduplicationTracker } from "./utils";
import { useLogger, useLatencyTracking, useScreenTracker } from "./hooks";
import { useAnimation } from "../../context/AnimationContext";
import { createAudioHandler, createToolHandler } from "./handlers";
import { int16ToBase64Async } from "@/utils/audioUtils";

// ---- Audio batching (keep small; coalesce downstream) ----
const AUDIO_BATCH_MS = 20; // Maximum speed

// ---- Helpers ----
const rmsSqInt16 = (pcm) => {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const s = pcm[i];
    sum += s * s;
  }
  return sum / Math.max(1, pcm.length);
};

export const useGeminiLive = () => {
  const orderContext = useOrder();
  const { triggerAnimation } = useAnimation();

  const orderContextRef = useRef(orderContext);
  const menuContextRef = useRef(null);

  useEffect(() => {
    orderContextRef.current = orderContext;
  }, [orderContext]);

  // Build menu catalog once it exists (keep it compact)
  useEffect(() => {
    const menu = orderContext.menu;
    if (!menu?.categorylist?.length) return;

    const names = menu.categorylist.map((c) => c.name).join(", ");
    const summary = menu.categorylist
      .map((c) => {
        const items = (c.itemlist || []).map((i) => i.name).join(", ");
        return `${c.name}: ${items}`;
      })
      .join("\n");

    menuContextRef.current = { names, summary };
  }, [orderContext.menu]);

  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isSpeakingRef = useRef(false);
  const outputContextRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef(new Set());

  const activeSessionPromiseRef = useRef(null);
  const sessionRef = useRef(null); // resolved session cached
  const isSessionActive = useRef(false);
  const connectingRef = useRef(false);

  const processedToolIds = useRef(new Set());
  const dedupeTracker = useRef(
    createDeduplicationTracker(ADD_DEDUPE_WINDOW_MS),
  );

  // Screen context gating
  const hasSentAudioRef = useRef(false);
  const pendingScreenTextRef = useRef(null);

  // Audio queue (never drop frames)
  const audioQueueRef = useRef([]);
  const drainingRef = useRef(false);

  const { logs, clearLogs, dlog, dwarn, derr } = useLogger();
  const { lastLatencyMs, markUserAudioActivity, resetLatency } =
    useLatencyTracking();

  useEffect(() => {
    const ctx = new AudioContext();
    outputContextRef.current = ctx;
    return () => ctx.close();
  }, []);

  const { playAudioChunk } = createAudioHandler(
    outputContextRef,
    nextStartTimeRef,
    sourcesRef,
    isSpeakingRef,
    setIsSpeaking,
    derr,
  );

  const disconnect = useCallback(async () => {
    try {
      stopRecording();
    } catch {}

    isSessionActive.current = false;
    setIsConnected(false);
    connectingRef.current = false;

    if (activeSessionPromiseRef.current) {
      try {
        const s = await activeSessionPromiseRef.current;
        s?.close?.();
      } catch {}
    }

    sessionRef.current = null;

    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    processedToolIds.current.clear();
    dedupeTracker.current.clear();
    resetLatency();

    // reset gating + queues
    hasSentAudioRef.current = false;
    pendingScreenTextRef.current = null;
    audioQueueRef.current = [];
    drainingRef.current = false;
  }, [resetLatency]);

  const { handleToolCall } = createToolHandler(
    orderContextRef,
    processedToolIds,
    dedupeTracker.current.isDuplicateAddWithinWindow,
    activeSessionPromiseRef,
    isSessionActive,
    disconnect,
    triggerAnimation,
    dlog,
    dwarn,
    derr,
  );

  /**
   * Drain audio queue without dropping frames.
   * Coalesce up to 4 chunks per send to reduce base64 overhead.
   * IMPORTANT: We rely on Google's AAD for turn-finalization.
   * Do NOT send audioStreamEnd manually (removes double turn logic).
   */
  const drainAudioQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;

    try {
      while (audioQueueRef.current.length && isSessionActive.current) {
        const session = sessionRef.current;
        if (!session) break;

        const batch = audioQueueRef.current.splice(0, 4);

        // Merge into one Int16Array
        const mergedLen = batch.reduce((a, b) => a + b.length, 0);
        const merged = new Int16Array(mergedLen);
        let off = 0;
        for (const chunk of batch) {
          merged.set(chunk, off);
          off += chunk.length;
        }

        // (Optional) You can keep this for debugging / UX,
        // but we DO NOT end streams manually here.
        rmsSqInt16(merged);

        const b64 = await int16ToBase64Async(merged);

        session.sendRealtimeInput({
          media: { mimeType: "audio/pcm;rate=16000", data: b64 },
        });

        markUserAudioActivity();

        // Gate screen context until at least 1 audio packet is sent
        if (!hasSentAudioRef.current) {
          hasSentAudioRef.current = true;
          if (pendingScreenTextRef.current) {
            try {
              session.sendRealtimeInput([
                { text: pendingScreenTextRef.current },
              ]);
            } catch {}
            pendingScreenTextRef.current = null;
          }
        }
      }
    } catch (e) {
      dwarn("Audio drain failed", e);
    } finally {
      drainingRef.current = false;
    }
  }, [markUserAudioActivity, dwarn]);

  const onAudioInput = useCallback(
    (pcm) => {
      if (!isSessionActive.current) return;
      if (!sessionRef.current) return;

      audioQueueRef.current.push(pcm);
      drainAudioQueue();
    },
    [drainAudioQueue],
  );

  // recorder returns forceFlush (kept, but not used for stream ending now)
  const { startRecording, stopRecording, isRecording } = useAudioRecorder(
    async (pcm) => onAudioInput(pcm),
  );

  /**
   * Screen tracker: ENABLED but throttled for speed
   * Uses 800ms interval to reduce overhead while maintaining awareness
   */
  useScreenTracker(
    isConnected, // RE-ENABLED
    (text) => {
      const session = sessionRef.current;
      if (!session || !isSessionActive.current) return;
      if (!hasSentAudioRef.current) {
        pendingScreenTextRef.current = text;
        return;
      }
      session.sendRealtimeInput([{ text }]);
    },
    { minIntervalMs: 800, sendInitialSnapshot: true },
  );

  const connect = useCallback(async () => {
    if (isConnected || connectingRef.current) return;

    const ctxData = menuContextRef.current;
    if (!ctxData) return derr("Menu not ready");

    connectingRef.current = true;
    resetLatency();

    try {
      // Use your environment strategy; adjust as needed for your build tool
      const apiKey =
        (import.meta &&
          import.meta.env &&
          import.meta.env.VITE_GEMINI_API_KEY) ||
        process.env.API_KEY;

      if (!apiKey) {
        connectingRef.current = false;
        return derr("Missing API key (VITE_GEMINI_API_KEY / API_KEY)");
      }

      const ai = new GoogleGenAI({ apiKey });

      const sessionPromise = ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: TURBO_MODE
            ? buildTurboPrompt(ctxData.names, ctxData.summary)
            : buildSystemInstructions(ctxData.names, ctxData.summary),

          tools: [{ functionDeclarations: tools }],
          temperature: 0.3, // Even more deterministic = faster
          realtimeInputConfig: {
            automaticActivityDetection: {
              silenceDurationMs: 80,
              prefixPaddingMs: 20,
            },
          },
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Kore", // Sweet, energetic, youthful female voice
              },
            },
          },
        },
        callbacks: {
          onopen: async () => {
            // Resolve session once
            sessionRef.current = await activeSessionPromiseRef.current;

            // Send catalog ONCE (lightweight)
            try {
              sessionRef.current?.sendRealtimeInput([
                {
                  text:
                    "CATALOG_READY\n" +
                    "Use this catalog as the single source of truth.\n" +
                    ctxData.summary,
                },
              ]);
            } catch {}

            // Start mic
            await startRecording();

            setIsConnected(true);
            isSessionActive.current = true;
            connectingRef.current = false;

            // Small "ready" ping (optional)
            try {
              sessionRef.current?.sendRealtimeInput([{ text: "ready" }]);
            } catch {}
          },

          onmessage: (msg) => {
            // Play audio immediately - never block on tool execution
            const audio =
              msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) playAudioChunk(audio);

            // Fire-and-forget tool calls (don't await - allows audio to play)
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                handleToolCall(fc).catch(() => {});
              }
            }
          },

          onclose: disconnect,
          onerror: disconnect,
        },
      });

      // Assign immediately so callbacks can resolve it safely
      activeSessionPromiseRef.current = sessionPromise;

      await sessionPromise;
    } catch (e) {
      derr("Connect failed", e);
      disconnect();
    }
  }, [
    isConnected,
    resetLatency,
    startRecording,
    disconnect,
    derr,
    playAudioChunk,
    handleToolCall,
  ]);

  return {
    isConnected,
    isSpeaking,
    isRecording,
    connect,
    disconnect,
    lastLatencyMs,
    logs,
    clearLogs,
  };
};
