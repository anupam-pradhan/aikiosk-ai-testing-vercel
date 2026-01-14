// src/components/SendMenuModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVendor } from "../vendor/VendorContext";
import { useOrder } from "../context/OrderContext";
import { sendSmsMessage } from "../services/smsMessage";
import { normalizeUkPhone } from "../services/phoneUk";

function buildDefaultStoreUrl(apiUrlRaw?: string) {
  const apiUrl = (apiUrlRaw || "").trim();
  if (!apiUrl) return "";

  // If already has scheme, keep it; else add https://
  const hasScheme = /^https?:\/\//i.test(apiUrl);
  const withScheme = hasScheme ? apiUrl : `https://${apiUrl}`;

  // match your Flutter: apiUrl.replaceAll("site", "store")
  return withScheme.replaceAll("site", "store");
}

export default function SendMenuModal(props: {
  open: boolean;
  onClose: () => void;
}) {
  const { open, onClose } = props;

  const { vendor } = useVendor();
  const { config, checkout } = useOrder();

  const storeLabel = config?.storeName || vendor?.vendorName || "MegaPOS";

  const defaultUrl = useMemo(
    () => buildDefaultStoreUrl(vendor?.apiUrl),
    [vendor?.apiUrl]
  );

  const [phone, setPhone] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const [centerAlert, setCenterAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const timerRef = useRef<number | null>(null);

  const showCenterAlert = (type: "success" | "error", message: string) => {
    setCenterAlert({ type, message });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setCenterAlert(null);
      timerRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setBusy(false);
    setCooldown(false);
    setCenterAlert(null);

    // Prefill phone from checkout if available, else blank
    setPhone(checkout?.phone || "");
    setUrl(defaultUrl || "");
  }, [open, checkout?.phone, defaultUrl]);

  if (!open) return null;

  const onSend = async () => {
    const phoneE164 = normalizeUkPhone(phone);

    if (!phoneE164) {
      showCenterAlert(
        "error",
        "Please enter a valid UK phone number (+44... or 07...)"
      );
      return;
    }
    if (!url.trim()) {
      showCenterAlert("error", "Please enter a valid URL");
      return;
    }

    setBusy(true);
    setCooldown(true);
    window.setTimeout(() => setCooldown(false), 5000);

    try {
      await sendSmsMessage({
        phoneE164,
        domain: storeLabel,
        message: `Welcome to ${storeLabel} \nPlease order using : ${url.trim()}`,
      });

      showCenterAlert("success", "Link sent successfully");
    } catch (e: any) {
      showCenterAlert("error", e?.message || "Failed to send link");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "w-full h-12 px-4 rounded-2xl border-2 border-black outline-none bg-white";

  return (
    <div className="fixed inset-0 z-[210] bg-black/50 flex items-center justify-center p-4">
      {/* Center Alert */}
      {centerAlert && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center pointer-events-none">
          <div
            className={`pointer-events-auto max-w-[90vw] rounded-2xl px-6 py-4 border-2 border-black shadow-[0_6px_0_#000] text-white font-extrabold text-center text-lg
              ${
                centerAlert.type === "success" ? "bg-green-600" : "bg-red-600"
              }`}
          >
            {centerAlert.message}
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl bg-white rounded-3xl border-2 border-black shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#c2410c] text-white">
          <div className="font-black text-xl">Send Menu</div>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-white text-[#c2410c] font-extrabold border-2 border-white/30"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <label className="block text-sm font-bold mb-1">Number (UK)</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            placeholder="+44.... or 07...."
            disabled={busy}
            inputMode="tel"
          />

          <div className="h-4" />

          <label className="block text-sm font-bold mb-1">Url</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={inputClass}
            placeholder="https://...."
            disabled={busy}
            inputMode="url"
          />

          <div className="h-6" />

          <div className="flex gap-3">
            <button
              onClick={onSend}
              disabled={busy || cooldown}
              className={`h-12 px-5 rounded-2xl font-extrabold border-2 border-black shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-[0_1px_0_#000]
                ${
                  busy || cooldown
                    ? "opacity-60 bg-[#e5e5e5]"
                    : "bg-[#c2410c] text-white"
                }`}
            >
              {busy ? "Please wait..." : "Send Menu"}
            </button>

            <button
              onClick={onClose}
              disabled={busy}
              className={`h-12 px-5 rounded-2xl font-extrabold border-2 border-black bg-white shadow-[0_3px_0_#000]
                ${busy ? "opacity-60" : ""}`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
