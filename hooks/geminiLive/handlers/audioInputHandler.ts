import { MutableRefObject } from "react";
import { int16ToBase64Async } from "../../../utils/audioUtils";

// batching - ULTRA FAST
const BATCH_FRAMES = 2; // 40ms (2 * 20ms) - faster batching
const FRAME_SAMPLES = 320; // 20ms @ 16kHz
const BATCH_SAMPLES = FRAME_SAMPLES * BATCH_FRAMES;
const BATCH_MS = 40;

// silence commit - faster detection
const SILENCE_COMMIT_MS = 280; // ~7 batches at 40ms = faster commit
const SILENCE_RMS_THRESHOLD = 180; // tune 120–250
const SILENCE_RMS_SQ = SILENCE_RMS_THRESHOLD * SILENCE_RMS_THRESHOLD;

// speech confirm for interruption (prevents noise-triggered cutoffs)
const SPEECH_RMS_THRESHOLD = 260; // higher than silence threshold
const SPEECH_RMS_SQ = SPEECH_RMS_THRESHOLD * SPEECH_RMS_THRESHOLD;
const SPEECH_CONFIRM_BATCHES = 1; // Faster interruption

// partial flush cadence (critical) - faster
const PARTIAL_FLUSH_MS = 60;

export const createAudioInputHandler = (
  isSessionActive: MutableRefObject<boolean>,
  activeSessionPromiseRef: MutableRefObject<Promise<any> | null>,
  sourcesRef: MutableRefObject<Set<AudioBufferSourceNode>>,
  isSpeakingRef: MutableRefObject<boolean>,
  setIsSpeaking: (val: boolean) => void,
  markUserAudioActivity: () => void,
  disconnect: () => void,
  dlog: (...args: any[]) => void,
  dwarn: (...args: any[]) => void
) => {
  const sessionRef: MutableRefObject<any | null> = { current: null };

  let batch = new Int16Array(BATCH_SAMPLES);
  let batchFill = 0;

  // state
  let silentMs = 0;
  let audioEnded = false;
  let speechConfirm = 0;

  // timer for partial flush
  let flushTimer: number | null = null;

  const ensureSession = async () => {
    if (sessionRef.current) return sessionRef.current;
    if (!activeSessionPromiseRef.current) return null;
    try {
      sessionRef.current = await activeSessionPromiseRef.current;
      return sessionRef.current;
    } catch {
      return null;
    }
  };

  const rmsSqInt16 = (pcm: Int16Array) => {
    let sum = 0;
    for (let i = 0; i < pcm.length; i++) {
      const s = pcm[i];
      sum += s * s;
    }
    return sum / pcm.length;
  };

  const sendAudioStreamEndOnce = async () => {
    if (audioEnded) return;
    const session = await ensureSession();
    if (!session || !isSessionActive.current) return;

    audioEnded = true;

    try {
      session.sendRealtimeInput({ audioStreamEnd: true });
      // optional logging:
      // dlog("[AUDIO] audioStreamEnd sent");
    } catch (e: any) {
      if (e?.message?.includes("CLOSING") || e?.message?.includes("CLOSED")) {
        disconnect();
      } else {
        dwarn("audioStreamEnd failed", e);
      }
    }
  };

  const sendAudio = async (payload: Int16Array) => {
    const session = await ensureSession();
    if (!session || !isSessionActive.current) return;

    try {
      const base64Audio = await int16ToBase64Async(payload);

      session.sendRealtimeInput({
        media: { mimeType: "audio/pcm;rate=16000", data: base64Audio },
      });
    } catch (e: any) {
      if (e?.message?.includes("CLOSING") || e?.message?.includes("CLOSED")) {
        disconnect();
      } else {
        dwarn("sendRealtimeInput failed", e);
      }
    }
  };

  const flushBatch = async (force = false) => {
    if (batchFill === 0) return;

    // Only flush partial batches when forced (timer / stop)
    if (!force && batchFill < BATCH_SAMPLES) return;

    const payload = batch.subarray(0, batchFill);
    batchFill = 0;

    const meanSq = rmsSqInt16(payload);

    // Confirm speech (used only for interruption gating)
    if (meanSq > SPEECH_RMS_SQ) speechConfirm++;
    else speechConfirm = 0;

    // Silence commit logic
    if (meanSq <= SILENCE_RMS_SQ) {
      silentMs += BATCH_MS;

      if (silentMs >= SILENCE_COMMIT_MS) {
        await sendAudioStreamEndOnce();
        return;
      }
    } else {
      silentMs = 0;
      audioEnded = false;
    }

    // If stream already ended, do not send more silence
    if (audioEnded) return;

    await sendAudio(payload);
  };

  const startPartialFlushTimer = () => {
    if (flushTimer != null) return;
    flushTimer = window.setInterval(() => {
      // flush partial buffer so silence reaches server quickly
      flushBatch(true).catch(() => {});
    }, PARTIAL_FLUSH_MS);
  };

  const stopPartialFlushTimer = () => {
    if (flushTimer != null) {
      window.clearInterval(flushTimer);
      flushTimer = null;
    }
  };

  const onAudioInput = async (pcm: Int16Array) => {
    if (!isSessionActive.current || !activeSessionPromiseRef.current) return;

    markUserAudioActivity();
    startPartialFlushTimer();

    // Add to batch
    if (batchFill + pcm.length > batch.length) {
      // flush what we have (force) then continue
      await flushBatch(true);
    }

    batch.set(pcm, batchFill);
    batchFill += pcm.length;

    // When we collected a full batch, process normally
    if (batchFill >= BATCH_SAMPLES) {
      await flushBatch(false);
    }

    // ✅ Interrupt AI only when speech is confirmed (not on noise)
    if (sourcesRef.current.size && speechConfirm >= SPEECH_CONFIRM_BATCHES) {
      sourcesRef.current.forEach((s) => {
        try {
          s.stop();
        } catch {}
      });
      sourcesRef.current.clear();

      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        dlog("🛑 User interrupted AI");
      }
    }
  };

  const reset = () => {
    batchFill = 0;
    sessionRef.current = null;

    silentMs = 0;
    audioEnded = false;
    speechConfirm = 0;

    stopPartialFlushTimer();
  };

  return {
    onAudioInput,
    flushBatch: () => flushBatch(true),
    reset,
  };
};
