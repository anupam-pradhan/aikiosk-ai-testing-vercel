import React, { useMemo, useState, useEffect, useRef } from "react";
import { useOrder } from "../context/OrderContext";
import { useAnimation } from "../context/AnimationContext";
import CheckoutFlow from "./CheckoutFlow";
import { APP_MODE, NEEDS_CHECKOUT_FLOW } from "../config/mode";
import CashPaymentPopup from "./CashPaymentPopup";
import { startTapToPay } from "../utils/flutterBridge";

interface CartSidebarProps {
  onBack?: () => void;
}

const TAP_TO_PAY_SUCCESS_STATUSES = new Set([
  "NATIVE_FAKE_PAID",
  "PAID",
  "paid",
  "SUCCESS",
  "success",
  "successful",
]);

const TAP_TO_PAY_PENDING_STATUSES = new Set([
  "READY",
  "PROCESSING",
  "REQUESTED",
  "PENDING",
  "IN_PROGRESS",
]);

const TAP_TO_PAY_FAILURE_STATUSES = new Set([
  "FAILED",
  "FAILURE",
  "CANCELED",
  "CANCELLED",
  "COLLECT_FAILED",
  "collect_failed",
  "ERROR",
  "error",
]);

const LOCATION_SERVICES_DISABLED_CODE = "LOCATION_SERVICES_DISABLED";
const LOCATION_SERVICES_DISABLED_MESSAGE =
  "Location must be enabled to use terminal.";
const TAP_TO_PAY_CANCELLED_CODES = new Set([
  "CANCELED",
  "CANCELLED",
  "COLLECT_FAILED",
  "collect_failed",
]);
const TAP_TO_PAY_CANCELLED_MESSAGE = "Payment cancelled on terminal.";
const CONTACTLESS_CANCELLED_MESSAGE = "Contactless payment was cancelled.";

const CartSidebar: React.FC<CartSidebarProps> = ({ onBack }) => {
  const [showCheckout, setShowCheckout] = useState(false);
  const { animatedItemId } = useAnimation();
  // Track number of clicks
  const [refreshCount, setRefreshCount] = useState(0);
  const toMinor = (v: number) => Math.round((Number(v) || 0) * 100);

  // Logic: Reset the count if the user stops clicking for 2 seconds
  useEffect(() => {
    if (refreshCount === 0) return;

    const timer = setTimeout(() => {
      setRefreshCount(0); // Reset counter
    }, 2000); // 2 seconds timeout

    return () => clearTimeout(timer);
  }, [refreshCount]);

  // The Click Handler
  const handleSafeRefresh = () => {
    const targetClicks = 3;
    const newCount = refreshCount + 1;
    setRefreshCount(newCount);

    if (newCount >= targetClicks) {
      window.location.reload();
    }
  };

  const [selectedEditCartId, setSelectedEditCartId] = useState<string | null>(
    null
  );
  const activeCardSession = useRef<string | null>(null);
  const pendingTapSession = useRef<string | null>(null);
  const tapOrderSubmitted = useRef<string | null>(null);

  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [tempNote, setTempNote] = useState("");
  const [cardErrorMessage, setCardErrorMessage] = useState("");
  const [cardErrorCode, setCardErrorCode] = useState("");
  const [nativeStatusLog, setNativeStatusLog] = useState("");
  const [isTapToPayAvailable, setIsTapToPayAvailable] = useState(true);
  const [tapSuccess, setTapSuccess] = useState<{
    paymentIntentId?: string;
    amountMinor?: number;
    currency?: string;
  } | null>(null);
  const shouldFallbackAfterTapError = (payload: any, statusOverride?: string) => {
    const code = getTapToPayErrorCode(payload);
    const status = statusOverride ?? getTapToPayStatus(payload);
    return (
      !TAP_TO_PAY_CANCELLED_CODES.has(code) &&
      !TAP_TO_PAY_CANCELLED_CODES.has(status)
    );
  };
  const getTapToPayStatus = (payload: any) =>
    String(payload?.data?.status || payload?.status || "");
  const getTapToPayErrorCode = (payload: any) => {
    const code =
      payload?.data?.code ||
      payload?.code ||
      payload?.data?.errorCode ||
      payload?.errorCode ||
      payload?.data?.reason ||
      payload?.reason ||
      "";
    if (code) return String(code);
    const rawMessage = String(
      payload?.data?.message || payload?.message || ""
    ).toLowerCase();
    if (rawMessage.includes("location") && rawMessage.includes("service")) {
      return LOCATION_SERVICES_DISABLED_CODE;
    }
    const status = getTapToPayStatus(payload);
    return TAP_TO_PAY_CANCELLED_CODES.has(status) ? status : "";
  };
  const getTapToPayErrorMessage = (payload: any, fallback: string) => {
    const code = getTapToPayErrorCode(payload);
    const status = getTapToPayStatus(payload);
    const rawMessage = payload?.data?.message || payload?.message || "";
    const messageLower = String(rawMessage).toLowerCase();

    if (code === LOCATION_SERVICES_DISABLED_CODE) {
      return rawMessage || LOCATION_SERVICES_DISABLED_MESSAGE;
    }

    if (messageLower.includes("location") && messageLower.includes("service")) {
      return rawMessage || LOCATION_SERVICES_DISABLED_MESSAGE;
    }

    if (code === "COLLECT_FAILED" || status === "COLLECT_FAILED") {
      return rawMessage || CONTACTLESS_CANCELLED_MESSAGE;
    }

    if (
      TAP_TO_PAY_CANCELLED_CODES.has(code) ||
      TAP_TO_PAY_CANCELLED_CODES.has(status)
    ) {
      return rawMessage || TAP_TO_PAY_CANCELLED_MESSAGE;
    }

    return rawMessage || fallback;
  };

  const {
    cart,
    cartTotal,
    removeFromCart,
    clearCart,
    placeOrder,
    isOrdering,
    orderResult,
    closeOrderResult,
    paymentMethod,
    setPaymentMethod,
    setCashPopupState,
    cashPopupState,
    config,
    cancelPayment,
    cardStatus,
    setCardStatus,
    updateCartItemQty,
    updateCartItemNote,
  } = useOrder();

  // Helper to detect if we are in mobile view
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // ✅ Match Dart behaviour: show latest added on top
  const cartReversed = useMemo(() => [...cart].reverse(), [cart]);

  const resetSystem = () => {
    if (closeOrderResult) closeOrderResult();
    if (setCashPopupState) setCashPopupState("idle");
    if (setCardStatus) setCardStatus("idle");
    setCardErrorMessage("");
    setCardErrorCode("");
    activeCardSession.current = null;
    pendingTapSession.current = null;
    tapOrderSubmitted.current = null;
    setTapSuccess(null);

    if (!config?.cashOnly) {
      setPaymentMethod("card");
    }
  };
  useEffect(() => {
    resetSystem();
  }, []);
  useEffect(() => {
    let timer: any;
    if (cashPopupState === "completed" || orderResult) {
      timer = setTimeout(() => {
        resetSystem();
      }, 45000);
    }
    return () => clearTimeout(timer);
  }, [cashPopupState, orderResult]);

  const handleCashConfirm = async () => {
    await placeOrder("cash");
  };
  const handleSwitchToCash = async () => {
    activeCardSession.current = null;
    pendingTapSession.current = null;
    setCardStatus("idle");
    setCardErrorMessage("");
    setCardErrorCode("");
    cancelPayment().catch((err) => console.error("Cancel failed", err));
    setPaymentMethod("cash");
    await placeOrder("cash");
  };

  useEffect(() => {
    let timer: any;
    if (cashPopupState === "completed" || orderResult) {
      timer = setTimeout(() => {
        resetSystem();
      }, 45000);
    }
    return () => clearTimeout(timer);
  }, [cashPopupState, orderResult]);

  const handleDoneClick = () => {
    resetSystem();
  };

  const runLegacyCardFlow = async () => {
    activeCardSession.current = null;
    pendingTapSession.current = null;
    tapOrderSubmitted.current = null;
    setTapSuccess(null);
    setCardErrorMessage("");
    setCardErrorCode("");
    setCardStatus("processing");

    try {
      const res = await placeOrder("card");
      if (res) {
        setCardStatus("idle");
        return true;
      }
      setCardErrorMessage("Card payment failed. Please try again.");
      setCardStatus("failed");
      return false;
    } catch (e) {
      setCardErrorMessage("Card payment failed. Please try again.");
      setCardStatus("failed");
      return false;
    }
  };

  const handleFinish = async () => {
    if (cart.length === 0) return;
    if (isOrdering) return;

    if (NEEDS_CHECKOUT_FLOW) {
      setShowCheckout(true);
      return;
    }

    if (paymentMethod === "cash") {
      handleCashConfirm();
      return;
    }
    if (!isTapToPayAvailable) {
      await runLegacyCardFlow();
      return;
    }
    setCardErrorMessage("");
    setCardErrorCode("");
    const mySessionId = `session-${Date.now()}`;
    activeCardSession.current = mySessionId;
    pendingTapSession.current = mySessionId;
    tapOrderSubmitted.current = null;
    setCardStatus("processing");

    try {
      const orderId = `order-${Date.now()}`;
      const amountMinor = toMinor(cartTotal);

      const bridgeRes = await startTapToPay({
        amountMinor,
        currency: "gbp",
        orderId,
      });

      if (activeCardSession.current !== mySessionId) return;

      const status = String(bridgeRes?.data?.status || "");
      const paymentIntentId = bridgeRes?.data?.paymentIntentId;
      const isSuccess =
        bridgeRes?.ok && TAP_TO_PAY_SUCCESS_STATUSES.has(String(status));

      if (!isSuccess) {
        if (!status || TAP_TO_PAY_PENDING_STATUSES.has(String(status))) {
          return;
        }
        if (!bridgeRes?.ok || TAP_TO_PAY_FAILURE_STATUSES.has(String(status))) {
          pendingTapSession.current = null;
          if (shouldFallbackAfterTapError(bridgeRes, status)) {
            await runLegacyCardFlow();
            return;
          }
          setCardErrorCode(getTapToPayErrorCode(bridgeRes));
          setCardErrorMessage(
            getTapToPayErrorMessage(
              bridgeRes,
              "Tap-to-pay failed. Please try again."
            )
          );
          setCardStatus("failed");
          return;
        }

        if (shouldFallbackAfterTapError(bridgeRes, status)) {
          pendingTapSession.current = null;
          await runLegacyCardFlow();
          return;
        }
        setCardErrorCode(getTapToPayErrorCode(bridgeRes));
        setCardErrorMessage(
          getTapToPayErrorMessage(
            bridgeRes,
            "Tap-to-pay failed. Please try again."
          )
        );
        setCardStatus("failed");
        return;
      }

      // ✅ Flutter tap-to-pay succeeded; submit paid order without terminal flow
      pendingTapSession.current = null;
      if (tapOrderSubmitted.current === mySessionId) return;
      tapOrderSubmitted.current = mySessionId;
      setTapSuccess({
        paymentIntentId,
        amountMinor,
        currency: "gbp",
      });
      setCardStatus("idle");
      await placeOrder("card", {
        skipTerminal: true,
        chargeId: paymentIntentId,
      });
    } catch (e) {
      if (activeCardSession.current !== mySessionId) return;
      if (shouldFallbackAfterTapError(e)) {
        await runLegacyCardFlow();
        return;
      }
      setCardErrorCode(getTapToPayErrorCode(e));
      setCardErrorMessage(
        getTapToPayErrorMessage(e, "Tap-to-pay error. Please try again.")
      );
      setCardStatus("failed");
    }
  };

  const handleCardCancel = async () => {
    activeCardSession.current = null;
    pendingTapSession.current = null;
    try {
      await cancelPayment();
    } catch (e) {
      console.error(e);
    }
    setCardStatus("idle");
    setCardErrorMessage("");
    setCardErrorCode("");
  };

  const handleCardTryAgain = async () => {
    if (!cart.length) {
      setCardStatus("idle");
      return;
    }
    if (!isTapToPayAvailable) {
      await runLegacyCardFlow();
      return;
    }
    setCardErrorMessage("");
    setCardErrorCode("");
    const mySessionId = `session-${Date.now()}`;
    activeCardSession.current = mySessionId;
    pendingTapSession.current = mySessionId;
    tapOrderSubmitted.current = null;

    setCardStatus("processing");

    try {
      const orderId = `order-${Date.now()}`;
      const amountMinor = toMinor(cartTotal);

      const bridgeRes = await startTapToPay({
        amountMinor,
        currency: "gbp",
        orderId,
      });

      if (activeCardSession.current !== mySessionId) return;

      const status = String(bridgeRes?.data?.status || "");
      const paymentIntentId = bridgeRes?.data?.paymentIntentId;
      const isSuccess =
        bridgeRes?.ok && TAP_TO_PAY_SUCCESS_STATUSES.has(String(status));

      if (!isSuccess) {
        if (!status || TAP_TO_PAY_PENDING_STATUSES.has(String(status))) {
          return;
        }
        if (!bridgeRes?.ok || TAP_TO_PAY_FAILURE_STATUSES.has(String(status))) {
          pendingTapSession.current = null;
          if (shouldFallbackAfterTapError(bridgeRes, status)) {
            await runLegacyCardFlow();
            return;
          }
          setCardErrorCode(getTapToPayErrorCode(bridgeRes));
          setCardErrorMessage(
            getTapToPayErrorMessage(
              bridgeRes,
              "Tap-to-pay failed. Please try again."
            )
          );
          setCardStatus("failed");
          return;
        }

        if (shouldFallbackAfterTapError(bridgeRes, status)) {
          pendingTapSession.current = null;
          await runLegacyCardFlow();
          return;
        }
        console.error("Tap-to-Pay failed:", bridgeRes);
        setCardErrorCode(getTapToPayErrorCode(bridgeRes));
        setCardErrorMessage(
          getTapToPayErrorMessage(
            bridgeRes,
            "Tap-to-pay failed. Please try again."
          )
        );
        setCardStatus("failed");
        return;
      }

      // ✅ Flutter tap-to-pay succeeded; submit paid order without terminal flow
      pendingTapSession.current = null;
      if (tapOrderSubmitted.current === mySessionId) return;
      tapOrderSubmitted.current = mySessionId;
      setTapSuccess({
        paymentIntentId,
        amountMinor,
        currency: "gbp",
      });
      const res = await placeOrder("card", {
        skipTerminal: true,
        chargeId: paymentIntentId,
      });

      if (activeCardSession.current !== mySessionId) return;

      if (res) setCardStatus("idle");
      else setCardStatus("failed");
    } catch (e) {
      if (activeCardSession.current !== mySessionId) return;
      console.error("Tap-to-Pay error:", e);
      if (shouldFallbackAfterTapError(e)) {
        await runLegacyCardFlow();
        return;
      }
      setCardErrorCode(getTapToPayErrorCode(e));
      setCardErrorMessage(
        getTapToPayErrorMessage(e, "Tap-to-pay error. Please try again.")
      );
      setCardStatus("failed");
    }
  };

  useEffect(() => {
    const handler = async (json: any) => {
      let data: any;
      try {
        data = typeof json === "string" ? JSON.parse(json) : json;
      } catch {
        return;
      }

      console.log("native status", data);
      setNativeStatusLog(JSON.stringify(data, null, 2));

      const status = String(data?.status || data?.data?.status || "");
      const ok = data?.ok ?? data?.data?.ok;
      const paymentIntentId =
        data?.paymentIntentId || data?.data?.paymentIntentId;
      const errorCode = getTapToPayErrorCode(data);
      const message = getTapToPayErrorMessage(
        data,
        "Tap-to-pay failed. Please try again."
      );
      const amountMinor = data?.amount ?? data?.data?.amount;
      const currency = data?.currency || data?.data?.currency;

      if (errorCode === "NFC_UNSUPPORTED") {
        setIsTapToPayAvailable(false);
        return;
      }

      const sessionId = pendingTapSession.current;
      if (!sessionId || activeCardSession.current !== sessionId) return;

      if (ok === false) {
        pendingTapSession.current = null;
        setTapSuccess(null);
        setCardErrorCode(errorCode || getTapToPayStatus(data));
        setCardErrorMessage(message);
        setCardStatus("failed");
        return;
      }

      if (TAP_TO_PAY_SUCCESS_STATUSES.has(status)) {
        pendingTapSession.current = null;
        if (tapOrderSubmitted.current === sessionId) return;
        tapOrderSubmitted.current = sessionId;
        setTapSuccess({
          paymentIntentId,
          amountMinor,
          currency,
        });
        setCardStatus("idle");
        try {
          await placeOrder("card", {
            skipTerminal: true,
            chargeId: paymentIntentId,
          });
        } catch (e) {
          setCardErrorCode(getTapToPayErrorCode(e));
          setCardErrorMessage(
            getTapToPayErrorMessage(e, "Tap-to-pay error. Please try again.")
          );
          setCardStatus("failed");
        }
        return;
      }

      if (TAP_TO_PAY_FAILURE_STATUSES.has(status)) {
        pendingTapSession.current = null;
        setTapSuccess(null);
        if (shouldFallbackAfterTapError(data, status)) {
          await runLegacyCardFlow();
          return;
        }
        setCardErrorCode(errorCode);
        setCardErrorMessage(message);
        setCardStatus("failed");
        return;
      }

      if (TAP_TO_PAY_PENDING_STATUSES.has(status)) {
        setCardStatus("processing");
      }
    };

    (window as any).onNativePaymentStatus = handler;

    return () => {
      if ((window as any).onNativePaymentStatus === handler) {
        delete (window as any).onNativePaymentStatus;
      }
    };
  }, [placeOrder, setCardStatus, setCardErrorMessage]);

  // ✅ HANDLER: Click "Edit" (Quantity Only)
  const handleEditQtyClick = (item: any) => {
    if (selectedEditCartId === item.cartId && !isNoteOpen) {
      // If clicking same button, close it
      setSelectedEditCartId(null);
    } else {
      // Open Quantity Mode, Ensure Note Mode is OFF
      setSelectedEditCartId(item.cartId);
      setIsNoteOpen(false);
    }
  };

  // ✅ HANDLER: Click "Add Note"
  const handleEditNoteClick = (item: any) => {
    setSelectedEditCartId(item.cartId);
    setTempNote(item.note || "");
    setIsNoteOpen(true); // Turn Note Mode ON
  };

  // ✅ HANDLER: Save Note & Close
  const handleSaveAndClose = () => {
    if (selectedEditCartId && updateCartItemNote) {
      updateCartItemNote(selectedEditCartId, tempNote);
    }
    setSelectedEditCartId(null);
    setTempNote("");
    setIsNoteOpen(false);
  };

  // ✅ HANDLER: Close everything
  const handleCloseAll = () => {
    setSelectedEditCartId(null);
    setIsNoteOpen(false);
  };

  // Identify the item currently being edited for the Global Modal
  const editingItem = useMemo(
    () => cart.find((i) => i.cartId === selectedEditCartId),
    [cart, selectedEditCartId]
  );

  const handleMobileBack = () => {
    if (onBack) onBack();
    else window.dispatchEvent(new CustomEvent("close-cart-mobile"));
  };

  return (
      <div className="w-full md:w-full lg:min-w-[380px] h-full bg-gray-100 border-l border-gray-300 flex flex-col relative overflow-hidden">
      {showCheckout && <CheckoutFlow onClose={() => setShowCheckout(false)} />}
      <CashPaymentPopup />

      {/* 1. Order Success Modal */}
      {orderResult && paymentMethod !== "cash" && cashPopupState === "idle" && (
        <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              Order Placed!
            </h3>

            <div className="bg-gray-100 p-4 rounded-xl w-full mb-6">
              <div className="text-4xl font-black text-[#c2410c]">
                {orderResult.order_number}
              </div>
            </div>

            {orderResult.qrcode && (
              <div className="mb-6 border-2 border-dashed border-gray-300 p-2 rounded-lg bg-white">
                <img
                  src={`data:image/png;base64,${orderResult.qrcode}`}
                  alt="Order QR"
                  className="w-32 h-32 object-contain"
                />
              </div>
            )}

            <button
              onClick={closeOrderResult}
              className="w-full bg-[#c2410c] text-white py-3 rounded-full font-bold text-lg shadow-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 2. Card Payment Overlays */}
      {/* 2. Card Payment Overlays */}
      {(cardStatus === "processing" || cardStatus === "failed") &&
        !orderResult && (
          <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
              <div className="relative flex justify-center items-center mb-6 w-full">
                {/* --- 1. MAIN STATUS ICON (Green Theme) --- */}
                <div
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                    cardStatus === "failed"
                      ? "bg-red-50 text-red-600"
                      : "bg-green-50 text-green-600" // Changed to Green
                  }`}
                >
                  <span className="text-4xl">
                    {cardStatus === "failed"
                      ? cardErrorCode === LOCATION_SERVICES_DISABLED_CODE
                        ? "📍"
                        : "❌"
                      : "💳"}
                  </span>
                </div>

                {/* --- 2. HIGHLIGHTED PROCESSING ARROW (Green + Right Motion) --- */}
                {cardStatus === "processing" && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {/* Container: Green Background, Green Border, Green Glow */}

                    {/* The Icon: Moving Right Animation */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={3}
                      stroke="currentColor"
                      className="w-14 h-14 text-green-600"
                      style={{
                        animation: "moveRight 1s ease-in-out infinite",
                      }} // Inline animation
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>

                    {/* Required Style for the Horizontal Animation */}
                  </div>
                )}
              </div>

              <h1 className="text-2xl font-black text-gray-800 mb-2">
                {cardStatus === "failed"
                  ? cardErrorCode === LOCATION_SERVICES_DISABLED_CODE
                    ? "Location Services Required"
                    : TAP_TO_PAY_CANCELLED_CODES.has(cardErrorCode)
                    ? "Payment Cancelled"
                    : "Payment Failed"
                  : "Payment Processing"}
              </h1>
              {cardStatus === "failed" && cardErrorMessage && (
                <p
                  className={`text-sm mb-4 ${
                    cardErrorCode === LOCATION_SERVICES_DISABLED_CODE
                      ? "text-amber-700"
                      : "text-red-600"
                  }`}
                >
                  {cardErrorMessage}
                </p>
              )}
              {cardStatus === "failed" &&
                cardErrorCode === LOCATION_SERVICES_DISABLED_CODE && (
                  <p className="text-xs text-gray-500 mb-4">
                    Please enable location services to use the terminal, then
                    tap Try Again.
                  </p>
              )}
              {cardStatus === "processing" && (
                <p className="text-gray-500 mb-6">
                  Please tap, insert, or swipe your card on the terminal.
                </p>
              )}

              <div className="bg-gray-100 rounded-xl p-4 mb-6">
                <div className="text-4xl font-black text-[#c2410c]">
                  £{cartTotal.toFixed(2)}
                </div>
              </div>
              {cardStatus === "processing" && (
                <div className="mt-3 mb-3">
                  <div className="flex items-center justify-center gap-2 text-gray-600 ">
                    <span className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
                    <span className="w-3 h-3 rounded-full bg-gray-400 animate-pulse [animation-delay:150ms]" />
                    <span className="w-3 h-3 rounded-full bg-gray-400 animate-pulse [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {cardStatus === "failed" ? (
                  <>
                    <button
                      onClick={handleCardTryAgain}
                      className="w-full bg-[#c2410c] text-white py-3 rounded-full font-bold shadow-lg shadow-orange-200"
                    >
                      {cardErrorCode === LOCATION_SERVICES_DISABLED_CODE
                        ? "I've Enabled Location"
                        : "Try Again"}
                    </button>

                    <button
                      onClick={handleSwitchToCash}
                      className="w-full bg-emerald-600 text-white py-3 rounded-full font-bold shadow-lg shadow-emerald-200"
                    >
                      Pay with Cash 💵
                    </button>

                    <button
                      onClick={() => setCardStatus("idle")}
                      className="w-full bg-gray-100 py-3 rounded-full font-bold"
                    >
                      Back to Cart
                    </button>
                  </>
                ) : (
                  /* CARD PROCESSING View */
                  <>
                    <button
                      onClick={handleCardCancel}
                      className="w-full bg-gray-100 py-3 rounded-full font-semibold"
                    >
                      Cancel Payment
                    </button>

                    <button
                      onClick={handleSwitchToCash}
                      className="w-full bg-emerald-600 text-white py-3 rounded-full font-bold shadow-lg shadow-emerald-200 mt-2"
                    >
                      Pay with Cash 💵
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

      {/* 2b. Tap-to-pay success (before order result arrives) */}
      {tapSuccess && !orderResult && cardStatus !== "processing" && (
        <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center text-green-600 text-4xl mb-5">
              ✅
            </div>
            <h1 className="text-2xl font-black text-gray-800 mb-2">
              Payment Successful
            </h1>
            <p className="text-gray-500 mb-6">
              Your payment is approved. Finishing your order...
            </p>
            <div className="bg-gray-100 rounded-xl p-4 mb-6">
              <div className="text-4xl font-black text-[#16a34a]">
                £{cartTotal.toFixed(2)}
              </div>
              {tapSuccess.paymentIntentId ? (
                <div className="text-xs text-gray-500 mt-2 break-all">
                  {tapSuccess.paymentIntentId}
                </div>
              ) : null}
            </div>
            <button
              onClick={handleDoneClick}
              className="w-full bg-[#c2410c] text-white py-3 rounded-full font-bold text-lg shadow-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* 3. Header */}
      {/* <div className="bg-[#c2410c] text-white p-4 flex justify-between items-center shadow-md shrink-0">
        <h2 className="text-xl font-bold">Your Order</h2>
        <button
          onClick={clearCart}
          className="text-xs bg-red-800 px-3 py-1 rounded-full hover:bg-red-900 transition-colors"
        >
          Clear
        </button>
      </div> */}

      {/* 4. Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar ">
        {cartReversed.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <span className="text-6xl mb-4">🛒</span>
            <p className="text-xl">Cart is Empty</p>
          </div>
        ) : (
          cartReversed.map((item) => {
            const isEditingQty =
              selectedEditCartId === item.cartId && !isNoteOpen;
            const isAnimating = String(animatedItemId) === String(item.id);

            return (
              <div
                key={item.cartId}
                className={`bg-white rounded-lg shadow-sm border relative transition-all duration-300 ${
                  isAnimating
                    ? "border-orange-500 border-2 shadow-lg shadow-orange-200"
                    : "border-gray-200"
                }`}
              >
                {/* Shimmer Animation Layer - z-10 */}
                {isAnimating && (
                  <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none z-10">
                    <div className="shimmer-effect" />
                  </div>
                )}

                {/* Main row - z-0 (base) */}
                <div className="p-3 flex gap-3">
                  {/* Left content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 truncate">
                      {item.name}
                    </h4>
                    <p className="text-xs text-gray-500">{item.nameVariant}</p>

                    {item.modifiers?.length > 0 && (
                      <div className="text-xs text-gray-400 mt-2 pl-2 border-l-2 border-orange-200">
                        <span className="line-clamp-7 break-words">
                          {item.modifiers
                            .map(
                              (m) =>
                                `${m.name}${
                                  m.modqty > 1 ? ` (x${m.modqty})` : ""
                                }`
                            )
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    {item.note && (
                      <div className="text-xs text-gray-500 mt-2 pl-2 border-l-2 border-blue-200 italic">
                        Note: {item.note}
                      </div>
                    )}
                  </div>

                  {/* Right column (Dart-style) */}
                  {/* Right column (Dart-style) */}
                  <div className="flex flex-col items-end shrink-0 w-[92px]">
                    {/* Price at top (50px -> ~38px) */}
                    <div className="pt-1 h-[38px] flex items-start justify-end">
                      <div className="font-semibold text-[#c2410c]">
                        £{item.total.toFixed(2)}
                      </div>
                    </div>

                    {/* Edit button (h-9 -> h-7) */}
                    <button
                      onClick={() =>
                        setSelectedEditCartId((prev) =>
                          prev === item.cartId ? null : item.cartId
                        )
                      }
                      className="w-[92px] h-7 rounded-full bg-[#c2410c] text-white text-[11px] font-bold shadow-md mt-2.5"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleEditNoteClick(item)}
                      className="w-[92px] h-7 rounded-full bg-[#c2410c] text-white text-[11px] font-bold shadow-md mt-2.5"
                    >
                      {item.note ? "Edit Note" : "Add Note"}
                    </button>

                    {/* Delete button (h-9 -> h-7) */}
                    <button
                      onClick={() => removeFromCart(item.cartId)}
                      className="w-[92px] h-7 rounded-full bg-[#c2410c] text-white text-[11px] font-bold shadow-md mt-2"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Edit overlay (qty control like Dart) - z-20 to be above shimmer but below global modal */}
                {isEditingQty && (
                  <div
                    className="absolute inset-0 bg-gray-500/50 backdrop-blur-sm flex items-center justify-center rounded-lg z-20"
                    onClick={() => setSelectedEditCartId(null)}
                  >
                    <div
                      className="flex items-center gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => updateCartItemQty(item.cartId, -1)}
                        className="w-11 h-11 rounded-full bg-white border border-gray-300 text-xl font-bold flex items-center justify-center active:scale-95"
                      >
                        –
                      </button>

                      <div className="w-16 h-11 rounded-lg bg-white flex items-center justify-center font-bold text-lg border border-gray-300">
                        {item.qty}
                      </div>

                      <button
                        onClick={() => updateCartItemQty(item.cartId, 1)}
                        className="w-11 h-11 rounded-full bg-white border border-gray-300 text-xl font-bold flex items-center justify-center active:scale-95"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Note Modal - z-50 for global overlay, highest priority */}
                {editingItem && isNoteOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                      {/* Header */}
                      <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                        <h3 className="font-bold text-gray-800 text-lg truncate pr-4">
                          {item.note ? "Edit Note" : "Add Note"}
                        </h3>
                        <button
                          onClick={handleSaveAndClose}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      <div className="p-5 space-y-6">
                        {/* 2. Note Input */}
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            Note / Instructions
                          </label>
                          <textarea
                            value={tempNote}
                            onChange={(e) => setTempNote(e.target.value)}
                            placeholder="e.g. No onions, extra sauce..."
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#c2410c] resize-none h-24"
                          />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="p-4 border-t border-gray-100 bg-gray-50">
                        <button
                          onClick={handleSaveAndClose}
                          className="w-full bg-[#c2410c] text-white py-3.5 rounded-xl font-bold text-lg shadow-lg hover:bg-orange-700 active:scale-95 transition-all"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. Footer */}
      <div className="bg-[#c2410c] text-white p-6 shadow-inner shrink-0 border-t">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
              backgroundSize: "50px 50px",
            }}
          ></div>
        </div>

        {/* Cart Summary Card with unique design */}
        <div className="relative bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-md rounded-[18px] p-5 mb-4 border border-white/30 shadow-xl">
          {/* Decorative corner elements */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/40 rounded-tl-[18px]"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/40 rounded-br-[18px]"></div>

          <div className="flex items-center justify-between">
            {/* Item count with icon */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="bg-gradient-to-br from-white/30 to-white/10 rounded-xl px-4 py-2 backdrop-blur-sm border border-white/30 shadow-lg">
                  <div className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 48 48"
                      className="
        relative h-6 w-6 text-white
        transition-transform duration-300
        group-active:scale-110
      "
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 8h4l4 20h20l4-12H14" />
                      <circle cx="18" cy="36" r="2.6" />
                      <circle cx="30" cy="36" r="2.6" />
                    </svg>
                    <span className="text-base font-black">{cart.length}</span>
                  </div>
                </div>
              </div>
              <span className="text-sm font-semibold text-white/90">
                {cart.length === 1 ? "Item" : "Items"}
              </span>
            </div>

            {/* Total amount */}
            <div className="text-right">
              <div className="text-[10px] text-white/70 uppercase tracking-widest font-bold mb-1 flex items-center justify-end gap-1">
                Total
              </div>
              <div className="text-3xl font-black tracking-tighter bg-gradient-to-r from-white to-orange-100 bg-clip-text text-transparent">
                £{cartTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method Toggle */}
        <div className="hidden bg-white/10 rounded-2xl p-1.5 gap-2 mb-4">
          <button
            onClick={() => setPaymentMethod("cash")}
            className={`flex-1 py-2 rounded-full font-bold transition-all ${
              paymentMethod === "cash"
                ? "bg-white text-[#c2410c]"
                : "text-white"
            }`}
          >
            Cash
          </button>

          <button
            onClick={() => setPaymentMethod("card")}
            disabled={!!config?.cashOnly}
            className={`flex-1 py-2 rounded-full font-bold transition-all ${
              paymentMethod === "card"
                ? "bg-white text-[#c2410c]"
                : "text-white opacity-50"
            }`}
          >
            Card
          </button>
        </div>

        <div className="flex gap-3">
          {isMobile ? (
            <button
              className="flex-1 h-[50px] bg-white text-[#c2410c] px-6 rounded-xl font-bold shadow-lg text-sm text-center active:scale-95 transition-all hover:shadow-xl border border-white/20 flex items-center justify-center whitespace-nowrap"
              onClick={handleMobileBack}
            >
              Continue Shopping
            </button>
          ) : (
            APP_MODE === "pos" && (
              <button
                className={`flex-1 h-[50px] backdrop-blur-sm text-white rounded-xl font-bold transition-all shadow-lg border border-white/20 active:scale-95 flex items-center justify-center
                  ${
                    refreshCount > 0
                      ? "bg-red-500/40"
                      : "bg-white/20 hover:bg-white/30"
                  } 
                `}
                onClick={handleSafeRefresh}
              >
                {/* Logic Change Here: Only show count if it is greater than 0 AND less than 3 */}
                {refreshCount > 0 && refreshCount < 3
                  ? `Tap ${3 - refreshCount}`
                  : "Refresh"}
              </button>
            )
          )}

          <button
            onClick={handleFinish}
            disabled={isOrdering || cart.length === 0}
            className={`flex-[2] h-[52px] text-white rounded-xl font-bold shadow-lg transition-all 
    border ${
      cart.length === 0
        ? "opacity-50 bg-green-600 border-green-700 cursor-not-allowed"
        : "active:scale-95 finish-button-active border-green-400/30"
    } hover:brightness-110 flex items-center justify-center`}
          >
            {isOrdering ? "Processing..." : "Finish Order"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartSidebar;
