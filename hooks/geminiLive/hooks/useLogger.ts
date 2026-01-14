// Logging hook

import { useState, useCallback } from "react";
import { KioskLogEntry, KioskLogLevel } from "../types";
import { DEBUG_KIOSK } from "../constants";

export const useLogger = () => {
  const [logs, setLogs] = useState<KioskLogEntry[]>([]);

  const clearLogs = useCallback(() => setLogs([]), []);

  const pushLog = useCallback(
    (level: KioskLogLevel, message: string, data?: any) => {
      const entry: KioskLogEntry = { ts: Date.now(), level, message, data };

      setLogs((prev) => {
        const trimmed =
          prev.length >= 200 ? prev.slice(prev.length - 199) : prev;
        return [...trimmed, entry];
      });

      if (DEBUG_KIOSK) {
        const fn =
          level === "log"
            ? console.log
            : level === "warn"
            ? console.warn
            : console.error;
        if (data !== undefined) fn("[KIOSK]", message, data);
        else fn("[KIOSK]", message);
      }
    },
    []
  );

  // Logging wrappers
  const dlog = (...args: any[]) => {
    const [first, ...rest] = args;
    pushLog("log", String(first ?? ""), rest.length ? rest : undefined);
  };
  const dwarn = (...args: any[]) => {
    const [first, ...rest] = args;
    pushLog("warn", String(first ?? ""), rest.length ? rest : undefined);
  };
  const derr = (...args: any[]) => {
    const [first, ...rest] = args;
    pushLog("error", String(first ?? ""), rest.length ? rest : undefined);
  };

  return { logs, clearLogs, pushLog, dlog, dwarn, derr };
};
