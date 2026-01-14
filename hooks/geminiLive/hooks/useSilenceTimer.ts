// Silence timer hook

import { useRef, useEffect, useCallback } from "react";
import { SILENCE_TIMEOUT_MS } from "../constants";

export const useSilenceTimer = (
  isSpeaking: boolean,
  isConnected: boolean,
  onTimeout: () => void,
  dlog: (...args: any[]) => void
) => {
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSpeakingRef = useRef(isSpeaking);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (!isSpeakingRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        dlog("Silence timeout reached - Disconnecting");
        onTimeout();
      }, SILENCE_TIMEOUT_MS);
    }
  }, [onTimeout, dlog]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;

    if (isSpeaking) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else {
      if (isConnected) resetSilenceTimer();
    }
  }, [isSpeaking, isConnected, resetSilenceTimer]);

  const clearTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  return { resetSilenceTimer, clearTimer, silenceTimerRef };
};
