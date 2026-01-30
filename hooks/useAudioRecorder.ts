// hooks/useAudioRecorder.js
import { useRef, useCallback, useState } from "react";
import {
  float32ToInt16,
  resampleFloat32,
  PCM_SAMPLE_RATE_INPUT,
} from "../utils/audioUtils";

const FRAME_MS = 20;
const BATCH_MS = 20; // Ultra-fast

const FRAME_SAMPLES = Math.round((PCM_SAMPLE_RATE_INPUT * FRAME_MS) / 1000); // 320
const BATCH_SAMPLES = Math.round((PCM_SAMPLE_RATE_INPUT * BATCH_MS) / 1000); // 960

const ACCUM_SIZE = 48000 * 2;

const WORKLET_PROCESSOR_SRC = `
class MicProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (input && input.length) {
      const copy = new Float32Array(input.length);
      copy.set(input);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor("mic-processor", MicProcessor);
`;

export const useAudioRecorder = (onDataAvailable) => {
  const [isRecording, setIsRecording] = useState(false);

  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);

  const inputSampleRateRef = useRef(48000);

  const ringBufferRef = useRef(new Float32Array(ACCUM_SIZE));
  const writePtrRef = useRef(0);
  const availableRef = useRef(0);

  const resampleCarryRef = useRef(new Float32Array(0));

  const outBatchRef = useRef(new Int16Array(BATCH_SAMPLES));
  const outBatchFillRef = useRef(0);

  const runningRef = useRef(false);
  const flushTimerRef = useRef(null);

  // ✅ NEW: throttle partial flush based on activity
  const lastInputAtRef = useRef(0);
  const lastFlushAtRef = useRef(0);

  const resetBuffers = () => {
    availableRef.current = 0;
    writePtrRef.current = 0;
    resampleCarryRef.current = new Float32Array(0);
    outBatchFillRef.current = 0;

    lastInputAtRef.current = 0;
    lastFlushAtRef.current = 0;
  };

  const pushSamples = (chunk) => {
    const buf = ringBufferRef.current;
    let wp = writePtrRef.current;

    if (chunk.length >= ACCUM_SIZE) {
      const tail = chunk.subarray(chunk.length - ACCUM_SIZE);
      buf.set(tail, 0);
      writePtrRef.current = 0;
      availableRef.current = ACCUM_SIZE;
      return;
    }

    const first = Math.min(chunk.length, ACCUM_SIZE - wp);
    buf.set(chunk.subarray(0, first), wp);
    if (first < chunk.length) buf.set(chunk.subarray(first), 0);

    writePtrRef.current = (wp + chunk.length) % ACCUM_SIZE;
    availableRef.current = Math.min(
      availableRef.current + chunk.length,
      ACCUM_SIZE
    );

    // ✅ mark activity
    lastInputAtRef.current = performance.now();
  };

  const neededInputSamplesForOneFrame = () => {
    const inRate = inputSampleRateRef.current;
    return Math.ceil((FRAME_SAMPLES * inRate) / PCM_SAMPLE_RATE_INPUT);
  };

  const emitPayload = (len) => {
    if (len <= 0) return;
    const payload = outBatchRef.current.slice(0, len);
    outBatchFillRef.current = 0;
    onDataAvailable(payload);
  };

  const flushBatchIfFull = () => {
    if (outBatchFillRef.current >= BATCH_SAMPLES) {
      emitPayload(BATCH_SAMPLES);
    }
  };

  // ✅ UPDATED: partial flush only when idle + enough samples
  const flushPartialSmart = () => {
    if (!runningRef.current) return;

    const filled = outBatchFillRef.current;
    if (filled <= 0) return;

    const now = performance.now();
    const idleMs = now - (lastInputAtRef.current || now);

    // Only flush partial when we are idle (speech pause/end)
    // This reduces constant silence flooding.
    if (idleMs < 40) return;

    // Avoid flushing tiny fragments repeatedly
    // Require at least one frame worth of samples, OR if stale flush anyway.
    const isStale = now - (lastFlushAtRef.current || 0) > 100;
    if (filled < FRAME_SAMPLES && !isStale) return;

    lastFlushAtRef.current = now;
    emitPayload(filled);
  };

  const appendToBatch = (int16Frame) => {
    let offset = 0;
    while (offset < int16Frame.length) {
      const space = BATCH_SAMPLES - outBatchFillRef.current;
      const take = Math.min(space, int16Frame.length - offset);

      outBatchRef.current.set(
        int16Frame.subarray(offset, offset + take),
        outBatchFillRef.current
      );
      outBatchFillRef.current += take;
      offset += take;

      flushBatchIfFull();
    }
  };

  const emitOneFrame = () => {
    const needed = neededInputSamplesForOneFrame();
    if (availableRef.current < needed) return false;

    const temp = new Float32Array(needed);
    const buf = ringBufferRef.current;

    let rp =
      (writePtrRef.current - availableRef.current + ACCUM_SIZE) % ACCUM_SIZE;

    const first = Math.min(needed, ACCUM_SIZE - rp);
    temp.set(buf.subarray(rp, rp + first), 0);
    if (first < needed) temp.set(buf.subarray(0, needed - first), first);

    availableRef.current -= needed;

    const resampled = resampleFloat32(
      temp,
      inputSampleRateRef.current,
      PCM_SAMPLE_RATE_INPUT
    );

    const carry = resampleCarryRef.current;
    const merged = carry.length
      ? (() => {
          const out = new Float32Array(carry.length + resampled.length);
          out.set(carry, 0);
          out.set(resampled, carry.length);
          return out;
        })()
      : resampled;

    let offset = 0;
    while (offset + FRAME_SAMPLES <= merged.length) {
      appendToBatch(
        float32ToInt16(merged.subarray(offset, offset + FRAME_SAMPLES))
      );
      offset += FRAME_SAMPLES;
    }

    resampleCarryRef.current = merged.subarray(offset);
    return true;
  };

  const startRecording = useCallback(async () => {
    if (runningRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });
    streamRef.current = stream;

    const ctx = new (window.AudioContext || window.AudioContext)();
    audioContextRef.current = ctx;
    inputSampleRateRef.current = ctx.sampleRate;

    const blob = new Blob([WORKLET_PROCESSOR_SRC], {
      type: "application/javascript",
    });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;

    const node = new AudioWorkletNode(ctx, "mic-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
    });
    workletNodeRef.current = node;

    resetBuffers();
    runningRef.current = true;

    // ✅ Timer stays, but smart flush prevents constant silence flooding
    flushTimerRef.current = window.setInterval(() => {
      flushPartialSmart();
    }, 100);

    const MAX_FRAMES_PER_TICK = 6;

    const drain = () => {
      if (!runningRef.current) return;

      let emitted = 0;
      while (emitted < MAX_FRAMES_PER_TICK) {
        const ok = emitOneFrame();
        if (!ok) break;
        emitted++;
      }

      if (availableRef.current >= neededInputSamplesForOneFrame()) {
        setTimeout(drain, 0);
      }
    };

    node.port.onmessage = (e) => {
      if (!runningRef.current) return;
      pushSamples(new Float32Array(e.data));
      drain();
    };

    node.port.onmessageerror = () => stopRecording();

    source.connect(node);
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    runningRef.current = false;

    // ✅ final flush (force) so server sees last audio
    try {
      const filled = outBatchFillRef.current;
      if (filled > 0) {
        const payload = outBatchRef.current.slice(0, filled);
        outBatchFillRef.current = 0;
        onDataAvailable(payload);
      }
    } catch (_) {}

    if (flushTimerRef.current) {
      try {
        window.clearInterval(flushTimerRef.current);
      } catch (_) {}
      flushTimerRef.current = null;
    }

    try {
      if (workletNodeRef.current?.port)
        workletNodeRef.current.port.onmessage = null;
    } catch (_) {}

    try {
      sourceRef.current?.disconnect();
    } catch (_) {}
    try {
      workletNodeRef.current?.disconnect();
    } catch (_) {}

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (_) {}
    }

    workletNodeRef.current = null;
    audioContextRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;

    resetBuffers();
    setIsRecording(false);
  }, []);

  const forceFlush = useCallback(() => {
    // force flush whatever is present
    const filled = outBatchFillRef.current;
    if (filled > 0) {
      const payload = outBatchRef.current.slice(0, filled);
      outBatchFillRef.current = 0;
      onDataAvailable(payload);
    }
  }, []);

  return { isRecording, startRecording, stopRecording, forceFlush };
};
