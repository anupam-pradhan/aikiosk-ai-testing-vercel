// Type definitions for Gemini Live hook

export type KioskLogLevel = "log" | "warn" | "error";

export interface KioskLogEntry {
  ts: number;
  level: KioskLogLevel;
  message: string;
  data?: any;
}
