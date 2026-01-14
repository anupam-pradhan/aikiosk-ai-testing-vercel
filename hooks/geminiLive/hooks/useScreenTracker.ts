import { useEffect, useRef, useCallback } from "react";
import { useOrder } from "../../../context/OrderContext";

interface ScreenTrackerOptions {
  minIntervalMs?: number;
  sendInitialSnapshot?: boolean;
  includeCatalogHints?: boolean;
}

/**
 * Production-focused screen tracker:
 * - Sends ONLY meaningful deltas (category/item/variant/step/cart/checkout)
 * - Throttled (default 250ms) with a hard anti-spam gate
 * - No heavy strings (keeps Gemini reasoning fast + accurate)
 *
 * Expected usage:
 * useScreenTracker(isConnected, (text) => session.sendRealtimeInput([{ text }]), {
 *   minIntervalMs: 250,
 *   sendInitialSnapshot: true,
 * });
 */
export const useScreenTracker = (
  isConnected: boolean,
  sendTextContext: (text: string) => void,
  options: ScreenTrackerOptions = {}
) => {
  const {
    selectedCategory,
    activeItem,
    activeVariant,
    wizardStep,
    cartViewSignal,
    cart,
    checkout,
  } = useOrder();

  const {
    minIntervalMs = 600, // Throttled for speed
    sendInitialSnapshot = true,
    includeCatalogHints = false, // keep false for speed
  } = options;

  const prevRef = useRef({
    categoryId: null,
    itemId: null,
    itemName: null,
    variantId: null,
    variantName: null,
    step: null,
    cartViewSignal: 0,
    cartCount: 0,
    checkoutStage: null,
    hasSentInitial: false,
    lastSentAt: 0,
    lastPayload: "",
  });

  const safeSend = useCallback(
    (payload) => {
      if (!isConnected) return;

      const now = Date.now();
      // Reduced throttle for faster updates
      if (now - prevRef.current.lastSentAt < 300) return;

      // De-dup identical payloads (prevents useless repeats)
      if (payload === prevRef.current.lastPayload) return;

      prevRef.current.lastSentAt = now;
      prevRef.current.lastPayload = payload;

      // Fire and forget - don't block
      try {
        sendTextContext(payload);
      } catch {}
    },
    [isConnected, sendTextContext]
  );

  const buildSnapshot = useCallback(() => {
    const cat = selectedCategory
      ? { id: selectedCategory.id, name: selectedCategory.name }
      : null;

    const item = activeItem
      ? {
          id: activeItem.id,
          name: activeItem.name,
          variants: Array.isArray(activeItem.variantlist)
            ? activeItem.variantlist.map((v) => v?.name).filter(Boolean)
            : [],
        }
      : null;

    const variant = activeVariant
      ? { id: activeVariant.id, name: activeVariant.name }
      : null;

    const cartCount = Array.isArray(cart) ? cart.length : 0;
    const cartTotal = Array.isArray(cart)
      ? cart.reduce((sum, i) => sum + (i?.total || 0), 0) / 100
      : 0;

    // keep checkout stage lightweight; adapt if your checkout object has a real stage field
    const checkoutStage =
      checkout?.stage ||
      checkout?.step ||
      checkout?.status ||
      (checkout ? "active" : null);

    return {
      cat,
      item,
      variant,
      step: wizardStep || null,
      cartCount,
      cartTotal,
      checkoutStage,
    };
  }, [selectedCategory, activeItem, activeVariant, wizardStep, cart, checkout]);

  // 1) Initial snapshot (sent once, after connect)
  useEffect(() => {
    if (!isConnected) {
      prevRef.current.hasSentInitial = false;
      prevRef.current.lastPayload = "";
      return;
    }
    if (!sendInitialSnapshot) return;
    if (prevRef.current.hasSentInitial) return;

    const snap = buildSnapshot();

    // Ultra-compact for speed
    const parts = [];
    if (snap.cat) parts.push(`C:${snap.cat.name}`);
    if (snap.item) parts.push(`I:${snap.item.name}`);
    if (snap.step) parts.push(`S:${snap.step}`);
    if (snap.cartCount) parts.push(`#${snap.cartCount}`);

    safeSend(`[${parts.join("|")}]`);
    prevRef.current.hasSentInitial = true;

    // prime prevs so we only send deltas later
    prevRef.current.categoryId = snap.cat?.id ?? null;
    prevRef.current.itemId = snap.item?.id ?? null;
    prevRef.current.itemName = snap.item?.name ?? null;
    prevRef.current.variantId = snap.variant?.id ?? null;
    prevRef.current.variantName = snap.variant?.name ?? null;
    prevRef.current.step = snap.step ?? null;
    prevRef.current.cartCount = snap.cartCount ?? 0;
    prevRef.current.checkoutStage = snap.checkoutStage ?? null;
  }, [isConnected, sendInitialSnapshot, buildSnapshot, safeSend]);

  // 2) Category change
  useEffect(() => {
    if (!isConnected) return;
    if (!selectedCategory) return;

    const prevCategoryId = prevRef.current.categoryId;
    const nextCategoryId = selectedCategory.id;

    if (prevCategoryId !== nextCategoryId) {
      // Compact
      safeSend(`[C:${selectedCategory.name}]`);
      prevRef.current.categoryId = nextCategoryId;
    }
  }, [isConnected, selectedCategory, safeSend]);

  // 3) Item open + step/variant transitions
  useEffect(() => {
    if (!isConnected) return;

    const nextItemId = activeItem?.id ?? null;
    const nextItemName = activeItem?.name ?? null;
    const nextStep = wizardStep || null;

    const prevItemId = prevRef.current.itemId;
    const prevStep = prevRef.current.step;

    // Item open - compact
    if (nextItemId && nextItemId !== prevItemId) {
      safeSend(`[I:${nextItemName}]`);
      prevRef.current.itemId = nextItemId;
      prevRef.current.itemName = nextItemName;
    }

    // Step transition - compact
    if (nextItemId && nextStep && nextStep !== prevStep) {
      safeSend(`[I:${nextItemName}|S:${nextStep}]`);
      prevRef.current.step = nextStep;
    }
  }, [isConnected, activeItem, wizardStep, includeCatalogHints, safeSend]);

  // 4) Variant selection (only if it truly changed)
  useEffect(() => {
    if (!isConnected) return;
    if (!activeItem?.id) return;

    const nextVariantId = activeVariant?.id ?? null;
    const nextVariantName = activeVariant?.name ?? null;

    const prevVariantId = prevRef.current.variantId;

    if (nextVariantId && nextVariantId !== prevVariantId) {
      safeSend(`[V:${nextVariantName}]`);
      prevRef.current.variantId = nextVariantId;
      prevRef.current.variantName = nextVariantName;
    }
  }, [isConnected, activeVariant, activeItem, safeSend]);

  // 5) Cart open signal + cart count changes
  useEffect(() => {
    if (!isConnected) return;

    const prevSignal = prevRef.current.cartViewSignal || 0;
    if (cartViewSignal > prevSignal) {
      const cartCount = Array.isArray(cart) ? cart.length : 0;
      const cartTotal = Array.isArray(cart)
        ? cart.reduce((sum, i) => sum + (i?.total || 0), 0) / 100
        : 0;

      safeSend(`[CART:${cartCount}]`);

      prevRef.current.cartViewSignal = cartViewSignal;
      prevRef.current.cartCount = cartCount;
    } else {
      // If cart changes silently (add/remove), send a lightweight delta
      const cartCount = Array.isArray(cart) ? cart.length : 0;
      if (cartCount !== prevRef.current.cartCount) {
        safeSend(`[#${cartCount}]`);
        prevRef.current.cartCount = cartCount;
      }
    }
  }, [isConnected, cartViewSignal, cart, safeSend]);

  // 6) Checkout stage changes (adapt field names if needed)
  useEffect(() => {
    if (!isConnected) return;

    const stage =
      checkout?.stage ||
      checkout?.step ||
      checkout?.status ||
      (checkout ? "active" : null);

    if (stage !== prevRef.current.checkoutStage) {
      safeSend(`[PAY:${stage || "-"}]`);
      prevRef.current.checkoutStage = stage;
    }
  }, [isConnected, checkout, safeSend]);
};
