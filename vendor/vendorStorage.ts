export type VendorModel = {
  apiUrl?: string;
  terminal?: string;
  cardPayment?: string; // "1"/"0" or "true"/"false" depending on your data
  vendorName?: string;
};

const KEY = "kiosk_vendor_v1";

export const getLocalVendor = (): VendorModel | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed ?? null;
  } catch {
    return null;
  }
};

export const saveLocalVendor = (vendor: VendorModel) => {
  localStorage.setItem(KEY, JSON.stringify(vendor));
};

export const clearLocalVendor = () => {
  localStorage.removeItem(KEY);
};