import React, { useEffect, useMemo, useRef, useState } from "react";
import CategorySidebar from "./CategorySidebar";
import ItemGrid from "./ItemGrid";
import CartSidebar from "./CartSidebar";
import { useGeminiLive } from "../hooks/useGeminiLive";
import { useOrder } from "../context/OrderContext";
import ManualPaymentModal from "./ManualPaymentModal";
import SendMenuModal from "./SendMenuModal";
import { APP_MODE } from "../config/mode";
import ItemFlowOverlay from "./ItemFlowOverlay";
import OrdersModal from "./Orders/OrdersModal";
import FlutterBridgeTest from "./Flutter/FlutterBridgeTest";

const SHOW_VOICE_DEBUG = false;

type MobileView = "categories" | "items" | "cart";

const INACTIVITY_MS = 2000_000;

const KioskLayout: React.FC = () => {
  const { isConnected, isSpeaking, connect, disconnect, logs } =
    useGeminiLive();

  const {
    wizardStep,
    orderResult,
    closeOrderResult,
    categories,
    selectCategory,
    selectedCategory,
    cart,
    welcomeMessage,
    resturantNumber,
    clearCart,
    cancelFlow,
    resetCheckout,
    cartViewSignal,
  } = useOrder();

  // ✅ Watch for AI cart signal to open drawer on mobile
  useEffect(() => {
    if (cartViewSignal > 0) {
      setMobileView("cart");
    }
  }, [cartViewSignal]);

  // ✅ Backup event listener
  useEffect(() => {
    const handleOpen = () => setMobileView("cart");
    const handleClose = () => setMobileView("items"); // Switch back to items

    window.addEventListener("open-cart-mobile", handleOpen);
    window.addEventListener("close-cart-mobile", handleClose);

    return () => {
      window.removeEventListener("open-cart-mobile", handleOpen);
      window.removeEventListener("close-cart-mobile", handleClose);
    };
  }, []);

  const [mobileView, setMobileView] = useState<MobileView>("categories");
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<
    string | number | null
  >(null);

  const activeCategory = useMemo(() => {
    return categories?.find((c: any) => c.id === activeCategoryId) ?? null;
  }, [categories, activeCategoryId]);

  const phoneHref = useMemo(() => {
    if (!resturantNumber) return null;
    const cleaned = String(resturantNumber).replace(/[^0-9+]/g, "");
    return cleaned ? `tel:${cleaned}` : null;
  }, [resturantNumber]);

  const prevCategoryIdRef = useRef<string | number | null>(null);
  useEffect(() => {
    const currentId = selectedCategory?.id;
    if (
      currentId &&
      prevCategoryIdRef.current &&
      currentId !== prevCategoryIdRef.current
    ) {
      // If user is viewing cart, switch to items view
      if (mobileView === "cart") {
        setMobileView("items");
      }
    }
    prevCategoryIdRef.current = currentId;
  }, [selectedCategory, mobileView]);

  // ✅ fix old iOS viewport height issues
  useEffect(() => {
    const setAppHeight = () => {
      document.documentElement.style.setProperty(
        "--app-height",
        `${window.innerHeight}px`
      );
    };
    setAppHeight();
    window.addEventListener("resize", setAppHeight);
    return () => window.removeEventListener("resize", setAppHeight);
  }, []);

  const handleVoiceToggle = () => {
    if (isConnected) disconnect();
    else connect();
  };
  const [showSendMenu, setShowSendMenu] = useState(false);

  const handleMobileCategoryClick = (categoryId: string | number) => {
    selectCategory?.(categoryId);
    setActiveCategoryId(categoryId);
    setMobileView("items");
  };

  const handleMobileBack = () => {
    if (mobileView === "cart") setMobileView("items");
    else if (mobileView === "items") setMobileView("categories");
  };

  const resetToWelcome = () => {
    try {
      disconnect();
    } catch {}
    try {
      closeOrderResult();
    } catch {}
    try {
      clearCart();
    } catch {}
    try {
      cancelFlow();
    } catch {}
    try {
      resetCheckout();
    } catch {}

    setMobileView("categories");
    setActiveCategoryId(null);
    setShowWelcome(true);

    if (categories?.length) selectCategory(categories[0].id);
  };

  const handleStartKiosk = () => {
    setShowWelcome(false);
    if (!isConnected) {
      handleVoiceToggle();
    }
  };

  // ✅ Inactivity timer (20s)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivityTimer = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  };

  const armInactivityTimer = () => {
    clearInactivityTimer();
    inactivityTimerRef.current = setTimeout(
      () => resetToWelcome(),
      INACTIVITY_MS
    );
  };

  useEffect(() => {
    if (showWelcome || orderResult) {
      clearInactivityTimer();
      return;
    }

    armInactivityTimer();
    const onActivity = () => armInactivityTimer();

    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("wheel", onActivity, { passive: true });

    return () => {
      clearInactivityTimer();
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("wheel", onActivity);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWelcome, orderResult, categories]);

  const [showManualPayment, setShowManualPayment] = useState(false);
  const [showOrders, setShowOrders] = useState(false);

  const isPOS = APP_MODE === "pos";

  const showManualPaymentBtn =
    isPOS && !showWelcome && mobileView !== "cart" && wizardStep === "BROWSE";
  // const showManualPaymentBtn = true;
  // Existing order-result auto reset
  const showSendMenuBtn = isPOS && !showWelcome && wizardStep === "BROWSE";
  useEffect(() => {
    let disconnectTimer: NodeJS.Timeout;
    let closeTimer: NodeJS.Timeout;
    let resetTimer: NodeJS.Timeout;

    if (orderResult) {
      disconnectTimer = setTimeout(() => disconnect(), 4000);
      closeTimer = setTimeout(() => closeOrderResult(), 8000);
      resetTimer = setTimeout(() => {
        setMobileView("categories");
        setActiveCategoryId(null);
        setShowWelcome(true);
      }, 8500);

      setMobileView("categories");
    }

    return () => {
      if (disconnectTimer) clearTimeout(disconnectTimer);
      if (closeTimer) clearTimeout(closeTimer);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [orderResult, disconnect, closeOrderResult]);

  const showDesktopCategorySidebar = wizardStep === "BROWSE";
  useMemo(() => logs.slice(-200), [logs]);

  const mobilePillBtn =
    "h-11 px-5 rounded-full bg-[#e5e5e5] border-2 border-black text-black font-semibold text-sm shadow-sm active:scale-95 transition-transform flex items-center justify-center";

  const showMobileHeaderCart = mobileView !== "cart" && wizardStep;

  return (
    <div
      className="flex flex-col w-screen bg-white relative overscroll-none"
      style={{ height: "var(--app-height)" }}
    >
      {/* Welcome overlay */}

      {showWelcome && (
        <div
          onClick={handleStartKiosk}
          className="fixed inset-0 z-[100] bg-[#c2410c] flex flex-col items-center justify-center cursor-pointer animate-fade-in safe-top safe-bottom active:opacity-95 transition-opacity"
        >
          {/* Subtle corner accents */}
          <div className="absolute top-8 left-8 w-16 h-16 border-l-4 border-t-4 border-white/50 rounded-tl-xl"></div>
          <div className="absolute top-8 right-8 w-16 h-16 border-r-4 border-t-4 border-white/50 rounded-tr-xl"></div>
          <div className="absolute bottom-8 left-8 w-16 h-16 border-l-4 border-b-4 border-white/50 rounded-bl-xl"></div>
          <div className="absolute bottom-8 right-8 w-16 h-16 border-r-4 border-b-4 border-white/50 rounded-br-xl"></div>

          <div className="relative mb-8">
            {/* Orbiting dots */}
            <div className="absolute inset-0 w-64 h-64 animate-spin-slow">
              <div className="absolute -top-1 left-1/2 w-3 h-3 bg-white rounded-full -ml-1.5 shadow-lg"></div>
              <div className="absolute -bottom-1 left-1/2 w-3 h-3 bg-white/70 rounded-full -ml-1.5 shadow-lg"></div>
            </div>
            <div className="absolute inset-0 w-64 h-64 animate-spin-reverse">
              <div className="absolute top-1/2 left-0 w-2 h-2 bg-white/60 rounded-full -ml-1 -mt-1 shadow-lg"></div>
              <div className="absolute top-1/2 right-0 w-2 h-2 bg-white/60 rounded-full -mr-1 -mt-1 shadow-lg"></div>
            </div>

            {/* Main circles with gradient glow */}
            <div className="relative bg-white/10 w-64 h-64 rounded-full flex items-center justify-center shadow-2xl border-2 border-white/20 animate-glow">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-white/5 animate-rotate-gradient"></div>

              <div className="relative bg-white/20 w-48 h-48 rounded-full flex items-center justify-center shadow-xl border border-white/30 overflow-hidden">
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent animate-pulse-slow"></div>

                {/* Icon with scale animation */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="relative h-24 w-24 text-white drop-shadow-2xl animate-icon-pulse"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2M7 7h10v10H7V7zM10 10h4v4h-4v-4z"
                  />
                </svg>
              </div>
            </div>

            {/* Expanding ripple rings */}
            <div className="absolute inset-0 w-64 h-64 rounded-full border-2 border-white/20 animate-ripple-1"></div>
            <div className="absolute inset-0 w-64 h-64 rounded-full border-2 border-white/15 animate-ripple-2"></div>
          </div>

          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-2 drop-shadow-2xl text-center">
            ORDER HERE
          </h1>

          {/* Simple divider line */}
          <div className="w-36 h-1 bg-white/40 rounded-full mb-5"></div>

          <p className="text-white text-xl md:text-3xl font-bold tracking-widest uppercase opacity-90 mt-4 drop-shadow-lg px-8 text-center">
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "0ms" }}
            >
              T
            </span>
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "100ms" }}
            >
              a
            </span>
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "200ms" }}
            >
              p
            </span>
            <span className="inline-block mx-2"></span>
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "300ms" }}
            >
              t
            </span>
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "400ms" }}
            >
              o
            </span>
            <span className="inline-block mx-2"></span>
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "500ms" }}
            >
              s
            </span>
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "600ms" }}
            >
              t
            </span>
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "700ms" }}
            >
              a
            </span>
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "800ms" }}
            >
              r
            </span>
            <span
              className="inline-block animate-bounce"
              style={{ animationDelay: "900ms" }}
            >
              t
            </span>
          </p>

          <div className="absolute bottom-10 flex items-center gap-3 safe-bottom">
            <div className="w-2 h-2 bg-white/60 rounded-full"></div>
            <div className="text-white/60 text-sm font-medium tracking-wide">
              MEGAPOS KIOSK
            </div>
            <div className="w-2 h-2 bg-white/60 rounded-full"></div>
          </div>
        </div>
      )}

      {/* Top Header Bar */}

      <div className="h-[73px] bg-gradient-to-r from-[#c2410c] via-[#d45113] to-[#c2410c] flex items-center justify-between px-4 md:px-6 shadow-lg z-10 shrink-0 safe-top pt-[env(safe-area-inset-top)] relative overflow-hidden">
        {/* Decorative animated gradient overlay */}
        <div className="absolute inset-0 z-50 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer pointer-events-none"></div>
        {/* Left side - Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-white text-lg md:text-2xl font-black tracking-tight truncate drop-shadow-md">
              MEGAPOS
              <span className="hidden md:inline ml-2 font-light opacity-90 text-xl">
                KIOSK
              </span>
            </h1>
          </div>
        </div>
        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2 relative z-10">
          {/* DESKTOP: Manual payment */}
          {showManualPaymentBtn && (
            <button
              onClick={() => setShowManualPayment(true)}
              className="hidden md:flex items-center gap-2 h-10 px-4 rounded-xl font-semibold text-sm shadow-md shadow-white/20 active:scale-95 transition-all bg-[#a93c10]/40 backdrop-blur-sm text-white border border-white/40"
              aria-label="Payment"
            >
              Payment
            </button>
          )}

          {/* ORDERS BUTTON (Desktop) */}
          {isPOS && (
            <button
              onClick={() => setShowOrders(true)}
              className="hidden md:flex items-center gap-2 h-10 px-4 rounded-xl font-semibold text-sm shadow-md shadow-white/20 active:scale-95 transition-all bg-[#a93c10]/40 backdrop-blur-sm text-white border border-white/40"
            >
              Orders
            </button>
          )}

          {showSendMenuBtn && (
            <button
              onClick={() => setShowSendMenu(true)}
              className={`
      h-10 px-4 rounded-xl font-semibold text-sm shadow-md shadow-white/20 active:scale-95 transition-all flex items-center gap-2
      bg-[#a93c10]/40 backdrop-blur-sm text-white border border-white/40
    `}
              aria-label="Send Menu"
            >
              Send Menu
            </button>
          )}

          {/* MOBILE: Compact button row */}
          <div className="md:hidden flex items-center gap-2">
            {showManualPaymentBtn && (
              <button
                onClick={() => setShowManualPayment(true)}
                className={
                  "h-10 px-4 rounded-xl font-semibold text-sm shadow-md shadow-white/20 active:scale-95 transition-all flex items-center gap-2 bg-[#a93c10]/40 backdrop-blur-sm text-white border border-white/40"
                }
                aria-label="Payment"
              >
                Payment
              </button>
            )}

            {/* ORDERS BUTTON (Mobile) */}
            {isPOS && (
              <button
                onClick={() => setShowOrders(true)}
                className={
                  "h-10 px-4 rounded-xl font-semibold text-sm shadow-md shadow-white/20 active:scale-95 transition-all flex items-center gap-2 bg-[#a93c10]/40 backdrop-blur-sm text-white border border-white/40"
                }
              >
                Orders
              </button>
            )}
            {/* Speak button - primary action */}
            <button
              onClick={handleVoiceToggle}
              className={`
                h-10 px-4 rounded-xl font-semibold text-sm shadow-md shadow-white/20 active:scale-95 transition-all flex items-center gap-2
                ${
                  isConnected
                    ? "bg-white text-[#a93c10] border border-white"
                    : "bg-[#a93c10]/40 backdrop-blur-sm text-white border border-white/40"
                }
              `}
              aria-label={isConnected ? "Stop speaking" : "Speak"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              {isConnected ? "Stop" : "Speak"}
            </button>

            {/* Call button */}
            <a
              href={phoneHref ?? undefined}
              className={`
                h-10 w-10 rounded-xl bg-[#a93c10]/40 backdrop-blur-sm border border-white/40 text-white shadow-md shadow-white/20 active:scale-95 transition-all flex items-center justify-center
                ${phoneHref ? "" : "opacity-40 pointer-events-none"}
              `}
              aria-label="Call restaurant"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </a>

            {/* Cart button - only show when not on cart view */}
            {showMobileHeaderCart && (
              <button
                onClick={() => setMobileView("cart")}
                className="h-10 w-10 rounded-xl bg-[#a93c10]/40 backdrop-blur-sm border border-white/40 text-white shadow-md shadow-white/20 active:scale-95 transition-all flex items-center justify-center relative"
                aria-label="Open cart"
              >
                <svg
                  viewBox="0 0 48 48"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 8h4l4 20h20l4-12H14" />
                  <circle cx="18" cy="36" r="2.5" />
                  <circle cx="30" cy="36" r="2.5" />
                </svg>

                {cart?.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-[#c2410c] text-xs font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {cart.length}
                  </span>
                )}
              </button>
            )}

            {/* Refresh button */}

            <button
              onClick={resetToWelcome}
              className="h-10 w-10 rounded-xl bg-[#a93c10]/40 backdrop-blur-sm border border-white/40 text-white shadow-md shadow-white/20 active:scale-95 transition-all flex items-center justify-center"
              aria-label="Refresh kiosk"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
          {/* DESKTOP: Enhanced voice button */}

          <button
            onClick={handleVoiceToggle}
            className={`
              hidden md:flex relative items-center gap-3 px-6 py-2.5 rounded-2xl font-bold text-white transition-all shadow-xl border-2 text-base overflow-hidden
              ${
                isConnected
                  ? "bg-red-600 border-red-300 hover:bg-red-500"
                  : "bg-green-600 border-green-400 hover:bg-green-500"
              }
            `}
          >
            {isConnected && (
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            )}

            <div className="relative flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${isSpeaking ? "animate-bounce" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>

              {isConnected ? (
                <span className="flex items-center gap-2">
                  {isSpeaking && (
                    <span className="flex gap-1">
                      <span
                        className="h-1 w-1 bg-white rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      ></span>
                      <span
                        className="h-1 w-1 bg-white rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      ></span>
                      <span
                        className="h-1 w-1 bg-white rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      ></span>
                    </span>
                  )}
                  Listening... (Tap to Stop)
                </span>
              ) : (
                <span>Tap to Order</span>
              )}
            </div>
          </button>
          {APP_MODE === "kiosk" && (
            <div className="hidden md:block">
              <button
                className="flex-1 px-6 py-2.5 bg-white/30 backdrop-blur-sm text-white rounded-xl font-bold hover:bg-white/40 transition-all duration-300 ease-in-out shadow-lg border border-white/40 active:scale-95 flex items-center justify-center"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="flex flex-row flex-1 min-h-0">
        {showDesktopCategorySidebar && <CategorySidebar />}

        <div className="flex-1 overflow-y-auto">
          <ItemGrid />
          {/* <ItemFlowOverlay /> */}
        </div>

        <div className="desktop-cart-only h-full">
          <CartSidebar />
        </div>
      </div>

      {/* MOBILE CART OVERLAY */}
      {mobileView === "cart" && (
        <div className="mobile-cart-only fixed left-0 right-0 bottom-0 top-[73px] z-40 bg-white overflow-y-auto">
          <CartSidebar onBack={() => setMobileView("items")} />
        </div>
      )}

      {/* MOBILE CART FAB */}
      {mobileView !== "cart" && wizardStep === "BROWSE" && (
        <button
          onClick={() => setMobileView("cart")}
          aria-label="Open cart"
          className="
      mobile-cart-only  /* This is controlled by our new CSS */
      fixed right-5 bottom-6 z-50
      h-16 w-16 rounded-full
      bg-[#e5e5e5]
      border-2 border-black
      shadow-[0_3px_0_#000]
      items-center justify-center /* Removed 'flex' here, handled by CSS, or leave it and CSS !important overrides it */
      transition-all duration-200
      active:translate-y-1 active:shadow-[0_4px_0_#000]
      group
    "
        >
          {/* ... inside content remains the same ... */}
          <span className="absolute inset-1 rounded-full bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
          <svg
            viewBox="0 0 48 48"
            className="relative h-9 w-9 text-black transition-transform duration-300 group-active:scale-110"
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
          {cart?.length > 0 && (
            <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-yellow-400 text-black text-xs font-extrabold flex items-center justify-center border-2 border-black shadow-[0_3px_0_#000] transition-transform group-active:scale-90">
              {cart.length}
            </span>
          )}
        </button>
      )}

      <ManualPaymentModal
        open={showManualPayment}
        onClose={() => setShowManualPayment(false)}
      />
      <SendMenuModal
        open={showSendMenu}
        onClose={() => setShowSendMenu(false)}
      />

      <OrdersModal isOpen={showOrders} onClose={() => setShowOrders(false)} />
      {SHOW_VOICE_DEBUG && (
        <div className="shrink-0 border-t bg-gray-50 hidden md:block">
          {/* Debug content */}
        </div>
      )}

      <FlutterBridgeTest />
    </div>
  );
};

export default KioskLayout;
