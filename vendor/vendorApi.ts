import { VendorModel } from "./vendorStorage";

/**
 * Replace with your Firebase DB URL.
 * Example:
 * https://your-project-default-rtdb.firebaseio.com
 */
const FIREBASE_DB_URL =
  (import.meta as any).env?.VITE_FIREBASE_DB_URL;

export const getVendorById = async (vendorId: string): Promise<VendorModel | null> => {
  if (!FIREBASE_DB_URL) {
    throw new Error("Missing VITE_FIREBASE_DB_URL");
  }

  const clean = vendorId.trim();
  if (!clean) return null;

  const url = `${FIREBASE_DB_URL}/vendors/${encodeURIComponent(clean)}.json`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data) return null;

  const vendor: VendorModel = {
    apiUrl: data.apiUrl,
    terminal: data.terminal,
    cardPayment: data.cardPayment,
    vendorName: clean,
  };

  return vendor.apiUrl ? vendor : null;
};