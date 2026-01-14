export type AppMode = "kiosk" | "largekiosk" | "pos" | "mobilekiosk";

export const APP_MODE: AppMode =
  ((import.meta as any).env?.VITE_MODE as AppMode) ?? "kiosk";

export const IS_KIOSK_LIKE = APP_MODE === "kiosk" || APP_MODE === "largekiosk";
export const NEEDS_CHECKOUT_FLOW =
  APP_MODE === "pos" || APP_MODE === "mobilekiosk";
export const REQUIRES_OTP = APP_MODE === null;
export const IS_MOBILEKIOSK = APP_MODE === "mobilekiosk";
