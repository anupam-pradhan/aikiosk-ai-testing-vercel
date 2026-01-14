// src/components/ManualPaymentModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useVendor } from "../vendor/VendorContext";
import {
  useOrder,
  PAYMENT_BASE_URL,
  toPenceString,
  calcDeductFeesPence,
} from "../context/OrderContext";
import { sendSmsMessage } from "../services/smsMessage";
import { sendOrder as apiSendOrder } from "../services/api";
import { normalizeUkPhone } from "../services/phoneUk";

type Tab = "terminal" | "paylink";

function formatGBP(n: number) {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

function clamp2DecimalsFromString(s: string) {
  const cleaned = s.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  const left = parts[0] ?? "0";
  const right = (parts[1] ?? "").slice(0, 2);
  const joined = right.length ? `${left}.${right}` : left;
  const num = Number(joined || "0");
  return Number.isFinite(num) ? num : 0;
}

export default function ManualPaymentModal(props: {
  open: boolean;
  onClose: () => void;
}) {
  const { open, onClose } = props;

  const { vendor } = useVendor();
  const { config } = useOrder();

  const storeLabel = config?.storeName || vendor?.vendorName || "MegaPOS";

  const [tab, setTab] = useState<Tab>("terminal");

  // ✅ Terminal amount via keypad (PENCE-FIRST)
  const [terminalPenceStr, setTerminalPenceStr] = useState("0");

  const terminalPence = useMemo(() => {
    const n = parseInt(terminalPenceStr || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }, [terminalPenceStr]);

  const terminalAmount = useMemo(() => terminalPence / 100, [terminalPence]);

  // Paylink form
  const [phone, setPhone] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const paylinkAmount = useMemo(
    () => clamp2DecimalsFromString(priceStr),
    [priceStr]
  );

  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const [statusText, setStatusText] = useState<string | null>(null);
  const [paylinkUrl, setPaylinkUrl] = useState<string | null>(null);

  // ✅ Center alert
  const [centerAlert, setCenterAlert] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const alertTimerRef = useRef<number | null>(null);

  const showCenterAlert = (type: "success" | "error", message: string) => {
    setCenterAlert({ type, message });

    if (alertTimerRef.current) window.clearTimeout(alertTimerRef.current);
    alertTimerRef.current = window.setTimeout(() => {
      setCenterAlert(null);
      alertTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) window.clearTimeout(alertTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    setStatusText(null);
    setPaylinkUrl(null);
    setBusy(false);
    setCooldown(false);
    setTab("terminal");

    setTerminalPenceStr("0");
    setPhone("");
    setPriceStr("");

    setCenterAlert(null);
  }, [open]);

  if (!open) return null;

  const requireVendor = () => {
    const terminal2 = vendor?.terminal;
    // const terminal2 = "tmr_FwlIwJe25NgsKb";
    const apiUrl = vendor?.apiUrl;
    const merchantId = config?.vendorId;

    if (!terminal2 || !apiUrl || !merchantId) {
      throw new Error("VENDOR_CONFIG_MISSING");
    }
    return { terminal2, apiUrl, merchantId };
  };

  // ✅ cents-first keypad behavior
  const MAX_PENCE_DIGITS = 9; // up to £9,999,999.99

  const keypadPress = (k: string) => {
    setStatusText(null);

    if (k === "C") return setTerminalPenceStr("0");

    if (k === "⌫") {
      return setTerminalPenceStr((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
    }

    // "." not needed in pence-first mode
    if (k === ".") return;

    // digit
    if (!/^\d$/.test(k)) return;

    setTerminalPenceStr((p) => {
      const next = p === "0" ? k : `${p}${k}`;
      return next.slice(0, MAX_PENCE_DIGITS);
    });
  };

  const collectTerminalPayment = async () => {
    setStatusText(null);
    setPaylinkUrl(null);

    if (terminalAmount < 0.3) {
      const msg = "Amount must be at least £0.30";
      setStatusText(msg);
      showCenterAlert("error", msg);
      return;
    }

    setBusy(true);
    try {
      const { terminal2, apiUrl, merchantId } = requireVendor();

      const orderPayload = {
        name: "",
        payment: "terminal",
        phone: "",
        service: "instore",
        time: "",
        total: terminalAmount,
        chargeId: "",
        address: "",
        order_type: "pos_manual",
        genral_note: "Manual POS payment",
        delivery_charge: 0,
        post_code: "",
        total_with_delivery: terminalAmount,
        order_service_fee: 0,
        discount_percentage: 0,
        discount_price: 0,
        storeId: "12345",
        deviceId: "POS-01",
        foodHubOrderId: "",
        listitem: [],
      };

      const deducted = calcDeductFeesPence(
        terminalAmount,
        config?.stripeFeesPents,
        config?.stripeFeesPercent
      );

      const body = {
        amount: toPenceString(terminalAmount),
        terminal: terminal2,
        apiUrl,
        merchantId,
        order: JSON.stringify(orderPayload),
        deducted_amount: deducted,
      };

      const res = await fetch(`${PAYMENT_BASE_URL}/payment_flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify(body),
      });

      const raw = await res.text();
      if (!res.ok) throw new Error(raw || "PAYMENT_FLOW_FAILED");

      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }

      const ok =
        parsed?.status === "successfull" ||
        parsed?.status === "successful" ||
        parsed?.status === "success";

      const msg = ok
        ? `Payment successful${
            parsed?.orderNo ? ` (Order: ${parsed.orderNo})` : ""
          }`
        : "Payment failed";

      setStatusText(msg);
      showCenterAlert(ok ? "success" : "error", msg);

      if (ok) setTerminalPenceStr("0");
    } catch (e: any) {
      const msg = e?.message || "Payment error";
      setStatusText(msg);
      showCenterAlert("error", msg);
    } finally {
      setBusy(false);
    }
  };

  const sendPaylink = async () => {
    setStatusText(null);
    setPaylinkUrl(null);

    const phoneE164 = normalizeUkPhone(phone);
    if (!phoneE164) {
      const msg = "Please enter a valid UK phone number (+44... or 07...)";
      setStatusText(msg);
      showCenterAlert("error", msg);
      return;
    }

    if (paylinkAmount < 0.3) {
      const msg = "Amount must be at least £0.30";
      setStatusText(msg);
      showCenterAlert("error", msg);
      return;
    }

    setBusy(true);
    setCooldown(true);
    window.setTimeout(() => setCooldown(false), 5000);

    try {
      const orderForPaylink: any = {
        total: paylinkAmount,
        totalWithDelivery: paylinkAmount,
        discount: 0,
        discountedPrice: 0,
        service: "instore",
        name: "",
        phone: phoneE164,
        payment: "sms",
        listitem: [],
        genralNote: "Manual POS paylink",
      };

      const baseUrl = vendor?.apiUrl?.trim() || "";
      const result = await (apiSendOrder as any)(orderForPaylink, baseUrl);

      const url = result?.checkhosturl;
      if (!url) throw new Error("CHECKOUT_URL_MISSING");

      setPaylinkUrl(url);

      await sendSmsMessage({
        phoneE164,
        domain: storeLabel,
        message: `${storeLabel}\nThanks for your order of £${formatGBP(
          paylinkAmount
        )}, Pay Now: ${url}`,
      });

      const msg = "Paylink sent successfully";
      setStatusText(msg);
      showCenterAlert("success", msg);

      setPhone("");
      setPriceStr("");
    } catch (e: any) {
      const msg = e?.message || "Paylink error";
      setStatusText(msg);
      showCenterAlert("error", msg);
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (active: boolean) =>
    `px-5 py-2 rounded-full font-bold border-2 ${
      active
        ? "bg-[#c2410c] text-white border-[#c2410c]"
        : "bg-white text-black border-black"
    }`;

  const keypadBtn =
    "h-16 rounded-2xl border-2 border-black bg-white text-2xl font-extrabold shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-[0_1px_0_#000]";

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
      {/* ✅ Center Alert */}
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

      <div className="w-full max-w-4xl bg-white rounded-3xl border-2 border-black shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#c2410c] text-white">
          <div className="font-black text-xl">Manual Payment</div>
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-xl bg-white text-[#c2410c] font-extrabold border-2 border-white/30"
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="p-4 flex gap-3 items-center justify-center">
          <button
            className={tabBtn(tab === "terminal")}
            onClick={() => setTab("terminal")}
          >
            Terminal
          </button>
          <button
            className={tabBtn(tab === "paylink")}
            onClick={() => setTab("paylink")}
          >
            Paylink
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {tab === "terminal" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Display */}
              <div className="border-2 border-black rounded-3xl p-5 bg-[#f3f4f6]">
                <div className="text-sm font-bold mb-2">Total</div>
                <div className="text-6xl font-black tracking-tight">
                  £{formatGBP(terminalAmount)}
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    disabled={busy}
                    onClick={collectTerminalPayment}
                    className={`h-14 px-6 rounded-2xl font-extrabold border-2 border-black shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-[0_1px_0_#000]
                      ${busy ? "opacity-60" : "bg-green-500 text-white"}`}
                  >
                    {busy ? "Processing..." : "Collect Payment"}
                  </button>

                  <button
                    disabled={busy}
                    onClick={() => setTerminalPenceStr("0")}
                    className={`h-14 px-6 rounded-2xl font-extrabold border-2 border-black bg-white shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-[0_1px_0_#000]
                      ${busy ? "opacity-60" : ""}`}
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-3 text-xs font-semibold text-black/60">
                  Tip: keypad is cents-first (e.g. 1001 → £10.01)
                </div>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  ".",
                  "0",
                  "⌫",
                ].map((k) => (
                  <button
                    key={k}
                    className={keypadBtn}
                    onClick={() => keypadPress(k)}
                    disabled={busy}
                  >
                    {k}
                  </button>
                ))}

                <button
                  className={`${keypadBtn} col-span-3 bg-[#fff7ed]`}
                  onClick={() => keypadPress("C")}
                  disabled={busy}
                >
                  C
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-xl mx-auto border-2 border-black rounded-3xl p-5">
              <div className="text-lg font-black mb-4">Send Paylink</div>

              <label className="block text-sm font-bold mb-1">Phone (UK)</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl border-2 border-black outline-none"
                placeholder="+44.... or 07...."
                disabled={busy}
              />

              <div className="h-4" />

              <label className="block text-sm font-bold mb-1">Amount (£)</label>
              <input
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl border-2 border-black outline-none"
                placeholder="0.00"
                inputMode="decimal"
                disabled={busy}
              />

              <div className="mt-5 flex gap-3">
                <button
                  onClick={sendPaylink}
                  disabled={busy || cooldown}
                  className={`h-12 px-5 rounded-2xl font-extrabold border-2 border-black shadow-[0_3px_0_#000] active:translate-y-[2px] active:shadow-[0_1px_0_#000]
                    ${
                      busy || cooldown
                        ? "opacity-60 bg-[#e5e5e5]"
                        : "bg-[#c2410c] text-white"
                    }`}
                >
                  {busy ? "Please wait..." : "Send Link"}
                </button>

                {paylinkUrl && (
                  <a
                    href={paylinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-12 px-5 rounded-2xl font-extrabold border-2 border-black bg-white flex items-center shadow-[0_3px_0_#000]"
                  >
                    Open Link
                  </a>
                )}
              </div>
            </div>
          )}

          {/* optional bottom status (keep or remove) */}
          {statusText && (
            <div className="mt-5 text-center font-bold">{statusText}</div>
          )}
        </div>
      </div>
    </div>
  );
}
