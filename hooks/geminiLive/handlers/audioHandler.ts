import { MutableRefObject } from "react";
import {
  PCM_SAMPLE_RATE_OUTPUT,
  base64ToUint8Array,
  decodeAudioData,
} from "../../../utils/audioUtils";

// Tune these - ABSOLUTE MAXIMUM SPEED
const MIN_BUFFER_MS = 8; // Instant audio playback
const FLUSH_INTERVAL_MS = 10; // Fastest possible flush
const MAX_BUFFER_MS = 150; // Lower cap for responsiveness

// Helpers
const concatUint8 = (chunks: Uint8Array[]) => {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
};

// PCM16 @ 24kHz => bytes per ms = sampleRate * 2 / 1000
const bytesForMs = (ms: number) =>
  Math.ceil((PCM_SAMPLE_RATE_OUTPUT * 2 * ms) / 1000);

export const createAudioHandler = (
  outputContextRef: MutableRefObject<AudioContext | null>,
  nextStartTimeRef: MutableRefObject<number>,
  sourcesRef: MutableRefObject<Set<AudioBufferSourceNode>>,
  isSpeakingRef: MutableRefObject<boolean>,
  setIsSpeaking: (v: boolean) => void,
  derr: (...args: any[]) => void
) => {
  // Jitter buffer state
  const pendingRef: MutableRefObject<Uint8Array[]> = { current: [] };
  const pendingBytesRef: MutableRefObject<number> = { current: 0 };
  const startedRef: MutableRefObject<boolean> = { current: false };
  const flushTimerRef: MutableRefObject<number | null> = { current: null };

  const scheduleBuffer = (bytes: Uint8Array) => {
    const ctx = outputContextRef.current;
    if (!ctx) return;

    const buffer = decodeAudioData(bytes, ctx, PCM_SAMPLE_RATE_OUTPUT);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    // Keep scheduling tight and continuous
    const now = ctx.currentTime;
    const start = Math.max(now + 0.005, nextStartTimeRef.current || now);
    src.start(start);
    nextStartTimeRef.current = start + buffer.duration;

    sourcesRef.current.add(src);
    if (!isSpeakingRef.current) {
      isSpeakingRef.current = true;
      setIsSpeaking(true);
    }

    src.onended = () => {
      sourcesRef.current.delete(src);
      if (!sourcesRef.current.size) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);

        // When speech ends, reset cursor close to now to avoid drift
        const c = outputContextRef.current;
        if (c) nextStartTimeRef.current = c.currentTime;
        startedRef.current = false;
      }
    };
  };

  const flush = () => {
    const ctx = outputContextRef.current;
    if (!ctx) return;

    if (!pendingBytesRef.current) return;

    // If not started yet, wait until we have enough buffered audio
    const minBytes = bytesForMs(MIN_BUFFER_MS);
    if (!startedRef.current && pendingBytesRef.current < minBytes) return;

    // If buffer gets too large, flush even if not started
    const maxBytes = bytesForMs(MAX_BUFFER_MS);
    const shouldForce = pendingBytesRef.current >= maxBytes;

    if (!startedRef.current && !shouldForce) return;

    startedRef.current = true;

    const merged = concatUint8(pendingRef.current);
    pendingRef.current = [];
    pendingBytesRef.current = 0;

    scheduleBuffer(merged);
  };

  const ensureFlushTimer = () => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setInterval(() => {
      try {
        flush();
      } catch {}
    }, FLUSH_INTERVAL_MS);
  };

  const clearFlushTimer = () => {
    if (flushTimerRef.current != null) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  };

  const playAudioChunk = (base64Audio: string) => {
    try {
      const bytes = base64ToUint8Array(base64Audio);

      pendingRef.current.push(bytes);
      pendingBytesRef.current += bytes.length;

      ensureFlushTimer();
      flush(); // attempt immediate flush if threshold met
    } catch (e) {
      derr("Audio playback failed", e);
    }
  };

  const stopAllAudio = () => {
    clearFlushTimer();

    // stop scheduled audio
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    sourcesRef.current.clear();

    // clear jitter buffer
    pendingRef.current = [];
    pendingBytesRef.current = 0;
    startedRef.current = false;

    const ctx = outputContextRef.current;
    if (ctx) nextStartTimeRef.current = ctx.currentTime;

    if (isSpeakingRef.current) {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }
  };

  return { playAudioChunk, stopAllAudio };
};
