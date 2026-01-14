import React, { useEffect, useMemo, useState } from "react";
import { useOrder } from "../context/OrderContext";
import { getAddressList } from "../services/addressUk";
import { REQUIRES_OTP } from "../config/mode";
import {
  MdKeyboardArrowDown,
  MdKeyboardArrowLeft,
  MdKeyboardArrowRight,
} from "react-icons/md";
import CategorySidebar from "./CategorySidebar";
// import { sendSmsOtp } from "../services/otp";

type Step = "service" | "details";

const canFetchAddressList = (v: string) => v.trim().length >= 6;

const isValidPhone = (phone: string) =>
  /^(?:\+44\d{10}|0\d{10}|\d{10})$/.test(phone.trim());

function toE164Uk(phone: string) {
  const p = phone.trim();
  if (p.startsWith("+44")) return p;
  if (p.startsWith("0") && p.length === 11) return `+44${p.substring(1)}`;
  if (/^\d{10}$/.test(p)) return `+44${p}`;
  return p;
}

function buildOneLineAddressFromSuggestion(
  suggestion: string,
  postCode: string
) {
  const parts = suggestion
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length > 0) parts[parts.length - 1] = postCode.trim().toUpperCase();
  return parts.join(", ");
}

const PillButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 py-1.5 rounded-full font-bold border-2 transition-all flex items-center justify-center gap-2 text-xs ${
      active
        ? "bg-[#c2410c] text-white border-[#c2410c]"
        : "bg-white text-[#c2410c] border-[#c2410c]"
    }`}
  >
    {children}
    {active && (
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6L9 17l-5-5" />
      </svg>
    )}
  </button>
);

const UnderlineInput = ({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  disabled?: boolean;
}) => (
  <input
    type={type}
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`w-full bg-transparent outline-none text-sm py-2 border-b ${
      disabled ? "opacity-60" : ""
    } border-gray-400/40 focus:border-[#c2410c40]`}
  />
);

export default function CheckoutFlow({ onClose }: { onClose: () => void }) {
  const {
    cartTotal,
    paymentMethod,
    setPaymentMethod,
    placeOrder,
    isOrdering,
    checkout,
    setService,
    setCheckoutField,
  } = useOrder();

  useEffect(() => {
    if (cartTotal <= 0) {
      onClose();
    }
  }, [cartTotal, onClose]);

  // if (cartTotal <= 0) return <CategorySidebar />;

  const [step, setStep] = useState<Step>("service");

  const [addrHits, setAddrHits] = useState<Array<{ suggestion: string }>>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [otpLocal, setOtpLocal] = useState("");
  const [otpInput, setOtpInput] = useState("");

  const [confirmDetails, setConfirmDetails] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    if (checkout.service !== "delivery") {
      setAddrHits([]);
      setSelectedSuggestion("");
      setAddrLoading(false);
      return;
    }

    const pc = checkout.postCode.trim().toUpperCase();

    if (!canFetchAddressList(pc)) {
      setAddrHits([]);
      setSelectedSuggestion("");
      setAddrLoading(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setAddrLoading(true);
        const hits = await getAddressList(pc);
        if (!alive) return;
        setAddrHits(hits);

        if (hits.length === 1) {
          setSelectedSuggestion(hits[0].suggestion);
          setCheckoutField(
            "address",
            buildOneLineAddressFromSuggestion(hits[0].suggestion, pc)
          );
        }
      } catch {
        if (!alive) return;
        setAddrHits([]);
      } finally {
        if (alive) setAddrLoading(false);
      }
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [checkout.postCode, checkout.service, setCheckoutField]);

  const totalWithFee = useMemo(() => cartTotal, [cartTotal]);

  // change here for in-store

  const isInStore = checkout.service === "in-store";

  const canPlace = useMemo(() => {
    const nameOk = checkout.name.trim().length > 0;

    // Phone: Optional for In Store, Mandatory for others
    const phoneOk = isInStore
      ? checkout.phone.trim() === "" || isValidPhone(checkout.phone)
      : isValidPhone(checkout.phone);

    const deliveryOk =
      checkout.service !== "delivery" ||
      (canFetchAddressList(checkout.postCode) &&
        checkout.address.trim().length > 0);

    // OTP: Skip for In Store
    const otpOk = isInStore ? true : !REQUIRES_OTP || checkout.phoneVerified;

    // Confirm Details: Skip for In Store
    const detailsConfirmed = isInStore ? true : confirmDetails;

    return nameOk && phoneOk && deliveryOk && otpOk && detailsConfirmed;
  }, [checkout, checkout.phoneVerified, confirmDetails, isInStore]);
  // --- CHANGE END ---

  const handleServiceSelect = (service) => {
    setService(service);
    setTimeout(() => {
      setStep("details");
    }, 300);
  };

  async function sendOtp() {
    setErr("");
    if (!isValidPhone(checkout.phone)) {
      setErr("Invalid UK phone number");
      return;
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    setOtpLocal(otp);
    alert("test otp: " + otp);

    try {
      const phoneE164 = toE164Uk(checkout.phone);
      const domain = (import.meta as any).env?.VITE_SMS_DOMAIN ?? "test";
      // await sendSmsOtp({ phoneE164, domain, otp });
      setOtpSent(true);
    } catch (e: any) {
      setErr(e?.message || "OTP send failed");
    }
  }

  function verifyOtp() {
    if (otpInput.trim() === otpLocal && otpLocal) {
      setCheckoutField("phoneVerified", true);
      setErr("");
      return;
    }
    setErr("Incorrect code");
  }

  async function onPlace() {
    setErr("");
    if (!canPlace) return;
    const res = await placeOrder(paymentMethod);
    if (!res) setErr("Order failed");
  }

  // ---------------- UI ----------------

  if (step === "service") {
    const isDelivery = checkout.service === "delivery";
    const isCollection = checkout.service === "collection";

    return (
      <div className="absolute inset-0 z-50 bg-gradient-to-br from-[#fef3f1] via-[#f8ebe8] to-[#f3ddd8]">
        {/* Decorative top bar with pattern */}

        <div className="h-[calc(100%-18px)] flex flex-col items-center justify-center p-4 px-6 gap-8">
          <div className="relative w-full max-w-md">
            {/* Main card */}
            <div className="bg-white/98 backdrop-blur-sm rounded-[18px] shadow-2xl p-6 border-2 border-[#c2410c]/20">
              {/* Header section */}
              <div className="text-center mb-8">
                <div className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-[#c2410c] to-[#ea580c] text-white text-xs font-black mb-3 shadow-lg">
                  STEP 1 OF 2
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-1">
                  Choose Your Service
                </h2>
                <p className="text-sm text-gray-600 font-medium">
                  How would you like to receive your order?
                </p>
              </div>

              {/* Service options with enhanced design */}
              <div className="space-y-4 mb-6">
                {/* --- CHANGE START: Add In Store Button --- */}
                <button
                  onClick={() => handleServiceSelect("in-store")}
                  className="group w-full rounded-2xl border-3 border-[#c2410c] px-4 py-3.5 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl bg-gradient-to-br from-white to-[#fff5f3] relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#c2410c]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#92400e] to-[#c2410c] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-black text-[20px] text-gray-900">
                        IN STORE
                      </div>
                    </div>
                     <div className="text-[#c2410c] group-hover:translate-x-1 transition-transform">
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              {/* --- CHANGE END --- */}

                {/* Delivery Option */}
                <button
                  onClick={() => handleServiceSelect("delivery")}
                  className="group w-full rounded-2xl border-3 border-[#c2410c] px-4 py-3.5 transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl bg-gradient-to-br from-white to-[#fff5f3] relative overflow-hidden"
                >
                  {/* Background decoration */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#c2410c]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative flex items-center gap-4">
                    {/* Icon circle */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c2410c] to-[#ea580c] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <svg
                        className="w-4 h-4 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
                        <path d="M15 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
                        <path d="M10 17h5" />
                        <path d="M3 17h1" />
                        <path d="M5 17l1-5h8l2 5" />
                        <path d="M14 12V7h3" />
                      </svg>
                    </div>

                    {/* Text content */}
                    <div className="flex-1 text-left">
                      <div className="font-black text-[20px] text-gray-900">
                        DELIVERY
                      </div>
                    </div>

                    {/* Arrow indicator */}
                    <div className="text-[#c2410c] group-hover:translate-x-1 transition-transform">
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Collection Option */}
                <button
                  onClick={() => handleServiceSelect("collection")}
                  className="group w-full rounded-2xl border-3 border-[#c2410c] px-4 py-3.5 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl bg-gradient-to-br from-white to-[#fff5f3] relative overflow-hidden"
                >
                  {/* Background decoration */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#c2410c]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative flex items-center gap-4">
                    {/* Icon circle */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7a2c1a] to-[#c2410c] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <svg
                        className="w-4 h-4 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 21h18" />
                        <path d="M6 21V7l6-4 6 4v14" />
                        <path d="M9 9h.01" />
                        <path d="M9 12h.01" />
                        <path d="M9 15h.01" />
                        <path d="M15 9h.01" />
                        <path d="M15 12h.01" />
                        <path d="M15 15h.01" />
                      </svg>
                    </div>

                    {/* Text content */}
                    <div className="flex-1 text-left">
                      <div className="font-black text-xl text-gray-900">
                        COLLECTION
                      </div>
                    </div>

                    {/* Arrow indicator */}
                    <div className="text-[#c2410c] group-hover:translate-x-1 transition-transform">
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              </div>

              {/* Footer note */}
              <div className="text-center pt-2">
                <p className="text-xs text-gray-500 font-medium">
                  💡 Select an option to continue with your order
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="group relative w-full max-w-md rounded-xl px-10 py-3 text-[20px] bg-gradient-to-br from-[#c2410c] to-[#dc2626] text-white shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] hover:scale-[1.02] active:scale-[0.98]"
            aria-label="Close"
          >
            {/* Animated shine effect */}
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>

            {/* Glow effect on hover */}
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-orange-400/0 to-red-500/0 group-hover:from-orange-400/30 group-hover:to-red-500/30 transition-all duration-300"></span>

            {/* Button text */}
            <span className="relative z-10 font-semibold tracking-wide group-hover:tracking-wider transition-all duration-300">
              Back
            </span>

            {/* Subtle border glow */}
            <span className="absolute inset-0 rounded-xl border-2 border-white/0 group-hover:border-white/30 transition-all duration-300"></span>
          </button>
        </div>
      </div>
    );
  }

  // details (compact + no scroll by default)
  return (
    <div className="absolute inset-0 z-50 bg-gradient-to-br from-orange-50 via-white to-red-50 flex flex-col h-full overflow-y-auto ">
      <div className="flex-1 w-full min-h-full flex justify-center items-center p-4">
        <div className="w-full h-auto max-w-md bg-white/95 backdrop-blur-sm rounded-3xl shadow-[0_20px_60px_rgba(194,65,12,0.15)] p-5 relative overflow-hidden">
          {/* Decorative corner accent */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-100/70 to-transparent rounded-bl-[100px] -z-10" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-red-10/70 to-transparent rounded-tr-[80px] -z-10" />

          {/* Header */}
          <div className="flex items-center justify-between mb-3 pb-4 border-b-2 border-dashed border-orange-200">
            <div className="flex items-center gap-3">
              {/* --- CHANGE START: Dynamic Header Icon/Text --- */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c2410c] to-[#ea580c] flex items-center justify-center shadow-lg">
                <span className="text-lg">
                  {checkout.service === "delivery" ? "🚚" : checkout.service === "collection" ? "🏪" : "🏢"}
                </span>
              </div>
              <div>
                <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                  Service Type
                </div>
                <div className="text-sm font-black text-gray-800">
                  {checkout.service === "delivery" ? "Delivery" : checkout.service === "collection" ? "Collection" : "In Store"}
                </div>
              </div>
             {/* --- CHANGE END --- */}
            </div>
            <button
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#c2410c] to-[#ea580c] shadow-md hover:shadow-xl transition-all hover:scale-105 active:scale-95"
              onClick={() => setStep("service")}
            >
              Change
            </button>
          </div>

          <div className="space-y-3">
            {/* Input fields with modern styling */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <UnderlineInput
                  placeholder="Name"
                  value={checkout.name}
                  onChange={(v) => setCheckoutField("name", v)}
                />
                <UnderlineInput
                  placeholder={isInStore ? "Phone (Optional)" : "Phone"}
                  value={checkout.phone}
                  onChange={(v) => {
                    setCheckoutField("phone", v);
                    setCheckoutField("phoneVerified", false);
                    setOtpSent(false);
                    setOtpLocal("");
                    setOtpInput("");
                  }}
                />
              </div>

              {checkout.service === "delivery" && (
                <>
                  <UnderlineInput
                    placeholder="Post Code"
                    value={checkout.postCode}
                    onChange={(v) => {
                      const up = v.toUpperCase();
                      setCheckoutField("postCode", up);
                      setCheckoutField("address", "");
                      setSelectedSuggestion("");
                      setAddrHits([]);
                    }}
                  />

                  <div className="relative">
                    <select
                      className="w-full bg-gradient-to-r from-gray-50 to-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 outline-none text-sm font-medium text-gray-700 appearance-none cursor-pointer hover:border-orange-300 transition-colors"
                      value={selectedSuggestion}
                      disabled={
                        !canFetchAddressList(checkout.postCode) || addrLoading
                      }
                      onChange={(e) => {
                        const suggestion = e.target.value;
                        setSelectedSuggestion(suggestion);
                        if (!suggestion) return;
                        setCheckoutField(
                          "address",
                          buildOneLineAddressFromSuggestion(
                            suggestion,
                            checkout.postCode
                          )
                        );
                      }}
                    >
                      <option value="">
                        {addrLoading
                          ? "Loading..."
                          : canFetchAddressList(checkout.postCode)
                          ? addrHits.length
                            ? "Select Address"
                            : "No addresses"
                          : "Enter postcode (6+)"}
                      </option>
                      {addrHits.map((h, idx) => (
                        <option key={idx} value={h.suggestion}>
                          {h.suggestion}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-orange-600">
                      <MdKeyboardArrowDown />
                    </div>
                  </div>

                  {/* <UnderlineInput
                    placeholder="Address"
                    value={checkout.address}
                    onChange={(v) => setCheckoutField("address", v)}
                  /> */}
                </>
              )}
            </div>

            {/* OTP Section */}
            {/* {REQUIRES_OTP && (
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-4 border border-orange-200">
                {!checkout.phoneVerified ? (
                  !otpSent ? (
                    <button
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-[#c2410c] to-[#ea580c] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                      onClick={sendOtp}
                    >
                      <span>📱</span> Send Verification Code
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-xs text-gray-600 font-semibold text-center">
                        Enter the code sent to your phone
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-white border-2 border-orange-200 rounded-xl px-4 py-3 outline-none text-sm font-semibold focus:border-[#c2410c] transition-colors"
                          placeholder="Enter Code"
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                        />
                        <button
                          className="px-6 rounded-xl bg-gradient-to-r from-[#c2410c] to-[#ea580c] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                          onClick={verifyOtp}
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <span className="text-white font-bold">✓</span>
                    </div>
                    <span className="text-green-700 font-bold text-sm">
                      Phone Verified Successfully
                    </span>
                  </div>
                )}
              </div>
            )} */}

            {/* Time Selection */}
            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">⏰</span>
                <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                  Delivery Time
                </span>
              </div>
              <div className="flex gap-4 mb-1">
                <PillButton
                  active={checkout.timeMode === "pick"}
                  onClick={() => setCheckoutField("timeMode", "pick")}
                >
                  Pick Time
                </PillButton>
                <PillButton
                  active={checkout.timeMode === "asap"}
                  onClick={() => setCheckoutField("timeMode", "asap")}
                >
                  ASAP
                </PillButton>
              </div>

              {checkout.timeMode === "pick" && (
                <input
                  type="time"
                  className="w-full bg-white border-2 border-gray-200 rounded-xl px-4 py-3 outline-none text-sm font-semibold focus:border-[#c2410c] transition-colors"
                  value={checkout.time}
                  onChange={(e) => setCheckoutField("time", e.target.value)}
                />
              )}
            </div>

            {/* Payment Type */}
            <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">💳</span>
                <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                  Payment Method
                </span>
              </div>
              <div className="flex gap-4">
                <PillButton
                  active={paymentMethod === "cash"}
                  onClick={() => setPaymentMethod("cash")}
                >
                  💵 Cash
                </PillButton>
                <PillButton
                  active={paymentMethod === "card"}
                  onClick={() => setPaymentMethod("card")}
                >
                  💳 Card
                </PillButton>
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-gradient-to-br from-[#c2410c] to-[#ea580c] rounded-2xl p-4 py-3 shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full translate-y-12 -translate-x-12" />

              <div className="relative space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold opacity-90">
                    Order Value
                  </span>
                  <span className="text-lg font-black">
                    £{cartTotal.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-white/30 pt-3 flex justify-between items-center">
                  <span className="text-sm font-bold">Total Amount</span>
                  <span className="text-2xl font-black">
                    £{totalWithFee.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm Details */}
           {/* --- CHANGE START: Hide Confirm Details for In Store --- */}
            {!isInStore && (
              <label className="flex items-center gap-3 cursor-pointer ml-2 pt-0.5">
                <input
                  type="checkbox"
                  className="w-5 h-5 accent-[#c2410c] cursor-pointer"
                  checked={confirmDetails}
                  onChange={(e) => setConfirmDetails(e.target.checked)}
                />
                <span className="text-sm font-bold text-gray-700">
                  I confirm all details are correct
                </span>
              </label>
            )}
            {/* --- CHANGE END --- */}

            {err && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-red-500 font-bold">⚠️</span>
                  <span className="text-red-700 font-bold text-sm">{err}</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-3">
            <button
              className="flex-1 py-3.5 rounded-xl font-black text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-[0.98] shadow-md flex justify-center items-center"
              onClick={() => setStep("service")}
            >
              <span className="flex items-center gap-1">
                <MdKeyboardArrowLeft />
                Back
              </span>
            </button>

            <button
              className="flex-1 py-3.5 rounded-xl font-black text-sm 
  bg-gradient-to-r from-[#c2410c] to-[#ea580c] text-white
  disabled:opacity-50 disabled:cursor-not-allowed
  shadow-lg hover:shadow-xl transition-all
  active:scale-[0.98]
  disabled:hover:scale-100 disabled:hover:shadow-lg
  flex justify-center items-center"
              disabled={!canPlace || isOrdering}
              onClick={onPlace}
            >
              <span className="flex items-center gap-1">
                {isOrdering ? "Processing..." : "Place Order"}
                <MdKeyboardArrowRight />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
