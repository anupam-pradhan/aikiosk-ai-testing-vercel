import { parsePhoneNumber } from "libphonenumber-js";

export function normalizeUkPhone(input: string): string | null {
  const trimmed = input.trim();
  try {
    // Accept "07..." or "+44..."
    const pn = trimmed.startsWith("+")
      ? parsePhoneNumber(trimmed)
      : parsePhoneNumber(trimmed, "GB");

    if (!pn?.isValid() || pn.country !== "GB") return null;
    return pn.number; // E.164
  } catch {
    return null;
  }
}