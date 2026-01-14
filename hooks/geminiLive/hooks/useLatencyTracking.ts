// Latency tracking hook

import { useState, useRef } from "react";

export const useLatencyTracking = () => {
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const lastUserAudioStartAtRef = useRef<number | null>(null);

  const markUserAudioActivity = () => {
    if (lastUserAudioStartAtRef.current == null) {
      lastUserAudioStartAtRef.current = Date.now();
    }
  };

  const markModelFirstResponse = () => {
    const start = lastUserAudioStartAtRef.current;
    if (start != null) {
      setLastLatencyMs(Date.now() - start);
      lastUserAudioStartAtRef.current = null;
    }
  };

  const resetLatency = () => {
    lastUserAudioStartAtRef.current = null;
    setLastLatencyMs(null);
  };

  return { lastLatencyMs, markUserAudioActivity, markModelFirstResponse, resetLatency };
};
