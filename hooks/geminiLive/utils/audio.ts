// Audio utility functions

import { base64ToUint8Array } from "../../../utils/audioUtils";

export const getLoudness = (base64Data: string): number => {
  try {
    const uint8Array = base64ToUint8Array(base64Data);
    const int16Array = new Int16Array(uint8Array.buffer);
    if (int16Array.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < int16Array.length; i++) {
      sum += int16Array[i] * int16Array[i];
    }
    const mean = sum / int16Array.length;
    return Math.sqrt(mean);
  } catch (e) {
    return 0;
  }
};
