export const PCM_SAMPLE_RATE_INPUT = 16000;
export const PCM_SAMPLE_RATE_OUTPUT = 24000;

/* ---------------- BASE64 ENCODE (INPUT) ---------------- */

export function int16ToBase64Async(int16: Int16Array): Promise<string> {
  const u8 = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
  return uint8ToBase64Async(u8);
}

export function uint8ToBase64Async(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // ✅ Force ArrayBuffer (never SharedArrayBuffer) for BlobPart typings
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const ab: ArrayBuffer = copy.buffer;

      const blob = new Blob([ab], { type: "application/octet-stream" });
      const reader = new FileReader();

      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("FileReader result is not a string"));
          return;
        }
        const idx = result.indexOf("base64,");
        resolve(idx >= 0 ? result.slice(idx + 7) : "");
      };

      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Sync fallback (avoid on hot path; keep for non-stream usage).
 */
export function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x4000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, i + CHUNK);
    let s = "";
    for (let j = 0; j < sub.length; j++) s += String.fromCharCode(sub[j]);
    parts.push(s);
  }
  return btoa(parts.join(""));
}

export function int16ToBase64(int16: Int16Array): string {
  return uint8ToBase64(
    new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength)
  );
}

/* ---------------- BASE64 DECODE (OUTPUT) ---------------- */

/**
 * Faster base64 decode than atob+loop on large volumes.
 * Still uses atob (browser-native), but reduces per-char overhead.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64);
  const len = bin.length;

  // Use Uint8Array + charCodeAt (fast enough, minimal overhead)
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------------- FLOAT32 → INT16 ---------------- */

export function float32ToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    let s = input[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    out[i] = s < 0 ? (s * 0x8000) | 0 : (s * 0x7fff) | 0;
  }
  return out;
}

/* ---------------- RESAMPLER (LINEAR) ---------------- */

export function resampleFloat32(
  input: Float32Array,
  inRate: number,
  outRate: number
): Float32Array {
  if (inRate === outRate) return input;

  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);

  let pos = 0;
  for (let i = 0; i < outLen; i++) {
    const p = pos | 0;
    const frac = pos - p;
    const a = input[p] || 0;
    const b = input[p + 1] || a;
    out[i] = a + (b - a) * frac;
    pos += ratio;
  }
  return out;
}

/* ---------------- PCM16LE → AUDIO BUFFER (OPTIMIZED) ---------------- */

let scratchF32: Float32Array | null = null;

export function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  rate: number = PCM_SAMPLE_RATE_OUTPUT
): AudioBuffer {
  const samples = data.length >> 1;

  if (!scratchF32 || scratchF32.length < samples) {
    scratchF32 = new Float32Array(samples);
  }
  const ch = scratchF32.subarray(0, samples);

  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < samples; i++) {
    ch[i] = dv.getInt16(i * 2, true) / 32768;
  }

  const buffer = ctx.createBuffer(1, samples, rate);

  // ✅ TS-safe and fast: avoids copyToChannel typing issue
  buffer.getChannelData(0).set(ch);

  return buffer;
}
