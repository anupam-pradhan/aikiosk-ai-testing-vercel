import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from "react";

import {
  MainCategory,
  CartItem,
  Order,
  Categorylist,
  Itemlist,
  Variantlist,
  Modifierlist,
  ListElement,
  SelectedModifier,
  OrderResult,
} from "../types";

import {
  fetchMenu,
  sendOrder as apiSendOrder,
  sendOrderUpdate as apiSendOrderUpdate,
} from "../services/api";
import { useVendor } from "../vendor/VendorContext";
// ... imports ...

// ...
// ... imports ...

// ...

// Edit Mode State - Moved inside provider
// Cart Signal - Moved inside provider
import { IS_MOBILEKIOSK } from "../config/mode";

type WizardStep = "BROWSE" | "VARIANT" | "MODIFIER";
export type PaymentMethod = "card" | "cash";
export type CardStatus = "idle" | "processing" | "failed";
type OrderConfig = {
  cashOnly?: boolean;
  stripeFeesPents?: string;
  stripeFeesPercent?: string;
  storeName?: string;
  welcomeMessage?: string;
  resturantNumber?: string;
  // vendor-linked (helpful for debugging/UI)
  terminal2?: string;
  apiUrl?: string;
  vendorId?: string;
};
export type OrderService = "collection" | "delivery" | "in-store";
type TimeMode = "asap" | "pick";

type CheckoutDetails = {
  service: OrderService;
  name: string;
  phone: string; // normalized E.164 if possible
  phoneVerified: boolean;

  timeMode: TimeMode;
  time: string; // "18:39" etc (only when timeMode === "pick")

  postCode: string;
  address: string;

  generalNote: string;
};

type AddressHit = { suggestion: string; url: string };
interface OrderContextType {
  menu: MainCategory | null;
  isLoading: boolean;
  selectedCategory: Categorylist | null;
  categories: Categorylist[];
  selectCategory: (categoryId: string | number) => void;
  cart: CartItem[];
  cartTotal: number;
  welcomeMessage: string;
  resturantNumber: string;
  isOrdering: boolean;
  orderResult: OrderResult | null;
  closeOrderResult: () => void;

  // Payment
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  config: OrderConfig | null;

  // cash → sends order directly
  // card → terminal payment flow → then sends order
  placeOrder: (
    paymentOverride?: PaymentMethod,
    options?: { skipTerminal?: boolean; chargeId?: string },
  ) => Promise<OrderResult | null>;
  cardStatus: CardStatus;
  setCardStatus: (s: CardStatus) => void;
  cancelPayment: () => Promise<string>;

  // Actions
  setSelectedCategory: (cat: Categorylist | null) => void;
  addToCart: (
    item: Itemlist,
    variantId: string | number,
    modifiers?: SelectedModifier[],
    quantity?: number,
  ) => void;
  removeFromCart: (cartId: string) => void;
  clearCart: () => void;
  updateCartItemQty: (cartId: string, delta: number) => void;
  updateCartItemNote: (cartId: string, note: string) => void;
  updateCartItemModifiers: (
    cartId: string,
    modifiers: SelectedModifier[],
  ) => void;
  updateCartItemVariant: (
    cartId: string,
    variantId: string | number,
    variantName: string,
    newBasePrice: number,
  ) => void;

  findItemByName: (
    name: string,
  ) => { item: Itemlist; category: Categorylist } | null;

  // Wizard State
  wizardStep: WizardStep;
  activeItem: Itemlist | null;
  activeVariant: Variantlist | null;
  activeModifiers: SelectedModifier[];
  activeNote: string;
  setActiveNote: (note: string) => void;
  highlightedItemId: string | number | null;
  setHighlightedItemId: (id: string | number | null) => void;

  checkout: CheckoutDetails;
  setService: (service: OrderService) => void;
  setCheckoutField: <K extends keyof CheckoutDetails>(
    k: K,
    v: CheckoutDetails[K],
  ) => void;
  resetCheckout: () => void;
  // Wizard Actions
  highlightItem: (item: Itemlist) => void;
  startItemFlow: (
    item: Itemlist,
    initialModifiers?: SelectedModifier[],
  ) => void;
  selectVariant: (variant: Variantlist) => void;
  toggleModifier: (mod: ListElement, group: Modifierlist) => void;
  updateModifierQty: (modId: string | number, delta: number) => void;
  confirmItem: () => void;
  cancelFlow: () => void;
  goBack: () => void;

  // New State for Cash Popup
  cashPopupState: "idle" | "confirming" | "completed";
  completedOrderNumber: string | null;
  setCashPopupState: (state: "idle" | "confirming" | "completed") => void;
  cartViewSignal: number;
  showCartScreen: () => void;
  // Signal to force-show item screen (grid/variant/modifier)
  itemScreenSignal: number;

  // Edit Mode
  loadOrderIntoCart: (order: any) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

/**
 * Payment servers (match your Dart naming)
 * Dart:
 *  test  -> https://serverrestu-test.onrender.com
 *  live  -> https://stripe-payment-mb2j.onrender.com
 */
export const PAYMENT_MODE =
  (import.meta as any).env?.VITE_PAYMENT_MODE ?? "live";

// ✅ FIXED mapping
export const PAYMENT_BASE_URL =
  PAYMENT_MODE === "live"
    ? "https://server-tan-phi-77.vercel.app/"
    : ((import.meta as any).env?.VITE_TERMINAL_BASE_URL ??
      "http://192.168.1.161:4242");

// Fallback version URL if vendor is missing
const FALLBACK_VERSION_URL =
  (import.meta as any).env?.VITE_VERSION_URL ??
  "https://test.megapos.site/api/version";

// ---------------- Fee helpers (Dart-matching) ----------------

export const toPenceString = (amount: number) =>
  Math.round(amount * 100).toString();

/**
 * Dart:
 * deductFees = stripeFeesPents + (price * stripeFeesPercent)
 * both rounded.
 */

export const calcDeductFeesPence = (
  total: number,
  stripeFeesPents?: string,
  stripeFeesPercent?: string,
) => {
  const fp = parseInt(stripeFeesPents || "0", 10);
  const pct = parseFloat(stripeFeesPercent || "0");
  return Math.round(fp + total * pct).toString();
};

// ---------------- Provider ----------------

export const OrderProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // ✅ Hook only here
  const { vendor } = useVendor();

  // ✅ vendor base url (already expected to include https://)
  const baseUrl = useMemo(() => {
    return vendor?.apiUrl?.trim() || "";
  }, [vendor?.apiUrl]);

  // ✅ version url derived from vendor
  const versionUrl = useMemo(() => {
    if (!baseUrl) return FALLBACK_VERSION_URL;
    return `https://${baseUrl}/api/version`;
  }, [baseUrl]);

  const [menu, setMenu] = useState<MainCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, _setSelectedCategory] =
    useState<Categorylist | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [cashPopupState, setCashPopupState] = useState<
    "idle" | "confirming" | "completed"
  >("idle");
  const [completedOrderNumber, setCompletedOrderNumber] = useState<
    string | null
  >(null);
  const [isCashApiDone, setIsCashApiDone] = useState(true);

  // Payment state
  const [paymentMethod, _setPaymentMethod] = useState<PaymentMethod>("card");
  const [config, setConfig] = useState<OrderConfig | null>(null);
  const [cardStatus, setCardStatus] = useState<CardStatus>("idle");

  const [checkout, setCheckout] = useState<CheckoutDetails>({
    service: "collection",
    name: "",
    phone: "",
    phoneVerified: false,
    timeMode: "asap",
    time: "",
    postCode: "",
    address: "",

    generalNote: "",
  });

  const setService = (service: OrderService) =>
    setCheckout((p) => ({ ...p, service }));

  const setCheckoutField = <K extends keyof CheckoutDetails>(
    k: K,
    v: CheckoutDetails[K],
  ) => setCheckout((p) => ({ ...p, [k]: v }));

  const resetCheckout = () =>
    setCheckout({
      service: "collection",
      name: "",
      phone: "",
      phoneVerified: false,
      timeMode: "asap",
      time: "",
      postCode: "",
      address: "",
      generalNote: "",
    });
  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>("BROWSE");
  const [activeItem, setActiveItem] = useState<Itemlist | null>(null);
  const [activeVariant, setActiveVariant] = useState<Variantlist | null>(null);
  const [activeModifiers, setActiveModifiers] = useState<SelectedModifier[]>(
    [],
  );
  const [activeNote, setActiveNote] = useState("");
  const [highlightedItemId, setHighlightedItemId] = useState<
    string | number | null
  >(null);

  // Edit Mode State
  const [editingOrderId, setEditingOrderId] = useState<string | number | null>(
    null,
  );

  // Cart Signal
  const [cartViewSignal, setCartViewSignal] = useState(0);
  const [itemScreenSignal, setItemScreenSignal] = useState(0);

  // ---------------- Load Menu ----------------
  // Uses vendor baseUrl if your API supports it.
  // If your fetchMenu signature doesn't accept params yet,
  // this still works via "as any".

  useEffect(() => {
    setIsLoading(true);

    (fetchMenu as any)(baseUrl)
      .then((data: MainCategory) => {
        setMenu(data);
        if (data.categorylist.length > 0) {
          _setSelectedCategory(data.categorylist[0]);
        }
        setIsLoading(false);
      })
      .catch((err: any) => {
        setIsLoading(false);
      });
  }, [baseUrl]);

  // ---------------- Load Version Config ----------------
  // Mirrors your Dart ApiVersion usage, but vendor-aware.

  useEffect(() => {
    if (!versionUrl) return;

    fetch(versionUrl)
      .then((r) => r.json())
      .then((v) => {
        const next: OrderConfig = {
          cashOnly: Number(v.cash_only) === 1,
          stripeFeesPents: String(v.stripe_fee_in_pents ?? "0"),
          stripeFeesPercent: String(v.stripe_fee_in_percentage ?? "0"),
          storeName: v.store_name,
          welcomeMessage: v.announcement,
          resturantNumber: v.restaurant_no,
          // attach vendor info for UI/use
          terminal2: vendor?.terminal,
          apiUrl: baseUrl || undefined,
          vendorId: v.connected_id,
        };

        setConfig(next);

        if (next.cashOnly) {
          _setPaymentMethod("cash");
        }
      })
      .catch((e) => {});
  }, [versionUrl, baseUrl, vendor?.terminal, vendor?.vendorName]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.total, 0),
    [cart],
  );

  // ---------------- Wizard reset on category change ----------------

  const setSelectedCategory = (cat: Categorylist | null) => {
    setWizardStep("BROWSE");
    setActiveItem(null);
    setActiveVariant(null);
    setActiveModifiers([]);
    setActiveNote("");
    _setSelectedCategory(cat);
  };
  const categories = useMemo(() => menu?.categorylist ?? [], [menu]);

  const selectCategory = useCallback(
    (categoryId: string | number) => {
      const cat = categories.find((c) => c.id == categoryId) ?? null;
      setSelectedCategory(cat); // uses your reset + _setSelectedCategory
    },
    [categories],
  );

  // Ensure selected category stays in sync with freshly loaded menus
  useEffect(() => {
    if (!menu?.categorylist?.length) {
      setSelectedCategory(null);
      return;
    }

    const currentId = selectedCategory?.id;
    const exists =
      currentId != null &&
      menu.categorylist.some((c: any) => String(c.id) === String(currentId));

    if (!exists) {
      setSelectedCategory(menu.categorylist[0]);
    }
  }, [menu, selectedCategory?.id]);
  // ---------------- Cart ops ----------------

  const addToCart = (
    item: Itemlist,
    variantId: string | number,
    modifiers: SelectedModifier[] = [],
    quantity: number = 1,
    note: string = "",
  ) => {
    const variant =
      item.variantlist.find((v) => v.id == variantId) || item.variantlist[0];
    if (!variant) {
      return;
    }

    const modifiersTotal = modifiers.reduce(
      (sum, m) => sum + m.price * m.modqty,
      0,
    );

    const singleItemTotal = variant.price + modifiersTotal;

    const newItem: CartItem = {
      cartId: Date.now().toString() + Math.random().toString(),
      id: item.id,
      name: item.name,
      nameVariant: variant.name,
      variantId: variant.id,
      basePrice: variant.price,
      price: variant.price,
      qty: quantity,
      total: singleItemTotal * quantity,
      modifiers,
      note,
    };

    setCart((prev) => {
      const updated = [...prev, newItem];
      return updated;
    });
  };

  const removeFromCart = (cartId: string) => {
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  };
  const updateCartItemQty = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartId !== cartId) return item;

          const newQty = item.qty + delta;
          if (newQty <= 0) {
            // we'll filter it out below
            return { ...item, qty: 0, total: 0 };
          }

          const modifiersTotal =
            item.modifiers?.reduce((sum, m) => sum + m.price * m.modqty, 0) ??
            0;

          const singleItemTotal = item.basePrice + modifiersTotal;

          return {
            ...item,
            qty: newQty,
            total: singleItemTotal * newQty,
          };
        })
        .filter((item) => item.qty > 0),
    );
  };
  const updateCartItemNote = (cartId: string, note: string) => {
    setCart((prev) =>
      prev.map((item) =>
        item.cartId === cartId ? { ...item, note: note } : item,
      ),
    );
  };

  const updateCartItemModifiers = (
    cartId: string,
    modifiers: SelectedModifier[],
  ) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartId !== cartId) return item;

        const modifiersTotal = modifiers.reduce(
          (sum, m) => sum + m.price * m.modqty,
          0,
        );

        return {
          ...item,
          modifiers,
          total: (item.basePrice + modifiersTotal) * item.qty,
        };
      }),
    );
  };

  const updateCartItemVariant = (
    cartId: string,
    variantId: string | number,
    variantName: string,
    newBasePrice: number,
  ) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartId !== cartId) return item;

        // Recalculate based on new base price
        // NOTE: We assume existing modifiers are compatible. If not, logic would be complex.
        // For now, we keep modifiers but update the total.
        const modifiersTotal =
          item.modifiers?.reduce((sum, m) => sum + m.price * m.modqty, 0) ?? 0;

        const singleItemTotal = newBasePrice + modifiersTotal;

        return {
          ...item,
          variantId: variantId,
          nameVariant: variantName,
          basePrice: newBasePrice,
          price: newBasePrice, // Keep price/basePrice in sync
          total: singleItemTotal * item.qty,
        };
      }),
    );
  };

  const clearCart = useCallback(() => setCart([]), []);
  // ---------------- Payment method setter with cashOnly guard ----------------

  const setPaymentMethod = (m: PaymentMethod) => {
    if (config?.cashOnly && m === "card") return;
    _setPaymentMethod(m);
  };

  // ---------------- Helpers: build order payload ----------------

  const buildOrderFromCart = useCallback(
    (totalOverride?: number): Order => {
      const total =
        typeof totalOverride === "number" ? totalOverride : cartTotal;

      return {
        total,
        listitem: cart,
        discount: 0,
        discountedPrice: 0,
        totalWithDelivery: total,

        service: checkout.service,
        name: checkout.name,
        phone: checkout.phone,
        time: checkout.timeMode === "pick" ? checkout.time : "",
        address: checkout.service === "delivery" ? checkout.address : "",
        postCode: checkout.service === "delivery" ? checkout.postCode : "",
        genralNote: checkout.generalNote || "",
      } as any;
    },
    [cart, cartTotal, checkout],
  );
  // ---------------- Terminal payment flow (Dart-equivalent) ----------------

  const processTerminalPayment = useCallback(
    async (order: Order) => {
      const payload = {
        name: order.name || "",
        payment: "terminal",
        phone: "",
        service: "collection",
        time: order.time || "",
        total: order.total,
        chargeId: order.chargeId || "",
        address: order.address || "",
        order_type: "kiosk",
        genral_note: order.genralNote || "",
        delivery_charge: order.deliveryCharge || 0,
        post_code: order.postCode || "",
        total_with_delivery: order.totalWithDelivery || order.total,
        order_service_fee: order.orderServiceFee || 0,
        discount_percentage: order.discountPercentage || 0,
        discount_price: order.discountedPrice || 0,
        storeId: order.storeId || "12345",
        deviceId: order.deviceId || "KIOSK-01",
        foodHubOrderId: order.foodHubOrderId || "",

        listitem: order.listitem.map((item) => ({
          id: item.id,
          name: item.name,
          name_variant: item.nameVariant,
          variant_id: item.variantId,
          variant_desc: "",
          base_price: item.basePrice,
          price: item.price,
          qty: item.qty,
          total: item.total,
          note: item.note || "",

          modifier: item.modifiers
            ? item.modifiers.map((mod) => ({
                id: mod.id,
                group_id: mod.groupId,
                group_name: mod.groupName,
                name: mod.name,
                price: mod.price,
                modqty: mod.modqty,
              }))
            : [],
        })),
      };

      const total = Number(order.total || 0);

      const finalPrice = toPenceString(total);
      const deductFees = calcDeductFeesPence(
        total,
        config?.stripeFeesPents,
        config?.stripeFeesPercent,
      );

      // ✅ Always prefer vendor
      const terminal2 = vendor?.terminal;
      //const terminal2 = 'tmr_FwlIwJe25NgsKb';
      const apiUrl = vendor?.apiUrl;

      const vendorId = config?.vendorId;

      if (!terminal2 || !apiUrl || !vendorId) {
        throw new Error("VENDOR_CONFIG_MISSING");
      }

      const body = {
        amount: finalPrice,
        terminal: terminal2,
        apiUrl,
        merchantId: vendorId,
        order: JSON.stringify(payload),
        deducted_amount: deductFees,
      };

      const res = await fetch(`${PAYMENT_BASE_URL}/payment_flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify(body),
      });

      const raw = await res.text();

      if (!res.ok) {
        throw new Error("PAYMENT_FLOW_FAILED");
      }

      try {
        return JSON.parse(raw);
      } catch {
        return raw as any;
      }
    },
    [config, vendor],
  );

  // ---------------- Place Order (cash/card) ----------------

  const placeOrder = useCallback(
    async (
      paymentOverride?: PaymentMethod,
      options?: { skipTerminal?: boolean; chargeId?: string },
    ): Promise<OrderResult | null> => {
      if (cart.length === 0) return null;

      const method: PaymentMethod = paymentOverride ?? paymentMethod ?? "cash";

      const effectiveMethod = config?.cashOnly ? "cash" : method;

      setIsOrdering(true);

      try {
        const order = buildOrderFromCart();
        if (options?.chargeId) {
          order.chargeId = options.chargeId;
        }

        // ✅ Tap-to-Pay already handled via Flutter bridge; just send paid order
        if (effectiveMethod === "card" && options?.skipTerminal) {
          const orderForTap = {
            ...order,
            payment: "terminal",
          } as any;

          const result = await (apiSendOrder as any)(orderForTap, baseUrl);
          const normalizedResult =
            result && !result.order_number
              ? {
                  ...result,
                  order_number:
                    result.orderNo || result.order_id || result.orderId,
                }
              : result;

          setOrderResult(normalizedResult);
          if (normalizedResult?.order_number) {
            setCompletedOrderNumber(normalizedResult.order_number);
          }
          setCashPopupState("completed");
          clearCart();
          setEditingOrderId(null);

          return normalizedResult;
        }

        // ✅ MOBILEKIOSK + CARD: send order, payment=terminal, then redirect to checkhosturl
        if (effectiveMethod === "card" && IS_MOBILEKIOSK) {
          const orderForMobile = {
            ...order,
            payment: "terminal", // ✅ important
          } as any;

          const result = await (apiSendOrder as any)(orderForMobile, baseUrl);
          const normalizedResult =
            result && !result.order_number
              ? {
                  ...result,
                  order_number:
                    result.orderNo || result.order_id || result.orderId,
                }
              : result;

          // optional: keep a result in state (helps debugging)
          setOrderResult(normalizedResult);

          // ✅ Redirect user to payment URL
          if (normalizedResult?.checkhosturl) {
            window.location.href = normalizedResult.checkhosturl;
          }

          // you can decide when to clear cart (often AFTER payment callback)
          clearCart();

          return normalizedResult;
        }

        // ✅ NORMAL KIOSK (largekiosk/kiosk) + CARD: existing terminal flow (works)
        if (effectiveMethod === "card" && !IS_MOBILEKIOSK) {
          const paymentRes = await processTerminalPayment(order);

          const ok =
            paymentRes?.status === "successfull" ||
            paymentRes?.status === "successful" ||
            paymentRes?.status === "success";

          if (!ok) return null;

          const resultLikeOrder: OrderResult = {
            ...(paymentRes ?? {}),
            order_number: paymentRes.orderNo,
          } as any;

          setOrderResult(resultLikeOrder);
          clearCart();
          setEditingOrderId(null); // Clear edit mode if successful

          return resultLikeOrder;
        }

        setIsCashApiDone(false);
        setCashPopupState("confirming");

        // Wait 3 seconds to match AI speech "confirming in 3 seconds"
        await new Promise((resolve) => setTimeout(resolve, 3000));

        let result;
        if (editingOrderId) {
          // Use Update API
          // Add ID to order object
          const orderWithId = { ...order, id: editingOrderId };
          result = await (apiSendOrderUpdate as any)(orderWithId, baseUrl);
        } else {
          // Standard Create API
          result = await (apiSendOrder as any)(order, baseUrl);
        }

        setIsCashApiDone(true);

        if (result?.order_number || result?.status === "success") {
          setCompletedOrderNumber(result.order_number || result.orderNo);
          setCashPopupState("completed");
          clearCart();
          setEditingOrderId(null); // Clear edit mode

          // setTimeout(() => {
          //   setCashPopupState("idle");
          //   setOrderResult(result);
          // }, 5000);
        } else {
          setCashPopupState("idle");
          setOrderResult(result);
          clearCart();
          setEditingOrderId(null);
        }
        return result;
      } catch (e) {
        setCashPopupState("idle");
        return null;
      } finally {
        setIsOrdering(false);
      }
    },
    [
      cart.length,
      paymentMethod,
      config?.cashOnly,
      buildOrderFromCart,
      processTerminalPayment,
      baseUrl,
      clearCart,
      setCashPopupState,
      setCompletedOrderNumber,
      editingOrderId, // Dependency
    ],
  );

  // ---------------- Load Order Into Cart (Edit Mode) ----------------
  const loadOrderIntoCart = useCallback((order: any) => {
    // 1. Set Editing ID
    setEditingOrderId(order.id);

    // 2. Map Items
    const validItems = (order.row || []).map((r: any) => {
      // parsing helpers
      const parseNum = (v: any) => {
        if (!v) return 0;
        const clean = String(v).replace(/[^0-9.-]/g, "");
        const p = parseFloat(clean);
        return isNaN(p) ? 0 : p;
      };

      const mappedModifiers = (r.rowDetail || []).map((m: any) => ({
        id: m.id,
        groupId: m.group_id || m.groupId || "0",
        groupName: m.group_name || m.groupName || "",
        name: m.modName || m.name || "",
        price: parseNum(m.price || m.modPrice),
        modqty: parseInt(m.modqty || "1"),
      }));

      return {
        cartId: Date.now().toString() + Math.random(),
        id: r.id,
        name: r.name,
        nameVariant: r.name_variant || r.variantName || r.name,
        variantId: r.variant_id || r.variantId || "0",
        basePrice: parseNum(r.base_price || r.basePrice || r.price),
        price: parseNum(r.base_price || r.basePrice || r.price),
        qty: parseInt(r.qty || "1"),
        total: parseNum(r.total),
        note: r.note || "",
        modifiers: mappedModifiers,
      };
    });

    setCart(validItems);

    // 3. Map Checkout Details
    setCheckout({
      service: (order.service?.toLowerCase() || "collection") as any,
      name: order.name || "",
      phone: order.phone || "",
      phoneVerified: true, // Assume verified if loading existing
      timeMode: order.delivery ? "pick" : "asap",
      time: order.delivery || "",
      postCode: order.postCode || "",
      address: order.pickup || order.address || "",
      generalNote: order.genral_note || order.review || "",
    });
  }, []);

  const closeOrderResult = useCallback(() => {
    setOrderResult(null);
    setCashPopupState("idle");
    setCompletedOrderNumber(null);
    setCardStatus("idle");
    setIsOrdering(false);
  }, []);

  // ---------------- Find item by name ----------------

  const findItemByName = (name: string) => {
    if (!menu) return null;
    const lowerName = name.toLowerCase();

    for (const cat of menu.categorylist) {
      const item = cat.itemlist.find((i) =>
        i.name.toLowerCase().includes(lowerName),
      );
      if (item) return { item, category: cat };
    }
    return null;
  };

  // ---------------- Wizard flow ----------------

  // Only highlight item on grid without opening detail view
  const highlightItem = (item: Itemlist) => {
    // Clear any existing highlight first
    setHighlightedItemId(null);

    // Set new highlight after brief delay (allows clear to take effect)
    setTimeout(() => {
      setHighlightedItemId(item.id);

      // Also set the item as active (but don't change wizard step yet)
      // This prepares for opening detail view when user confirms
      setActiveItem(item);
      setActiveModifiers([]);

      // Auto-clear after 10 seconds if user doesn't respond
      setTimeout(() => {
        setHighlightedItemId((current) =>
          current === item.id ? null : current,
        );
      }, 10000);
    }, 100);
  };

  const startItemFlow = (
    item: Itemlist,
    initialModifiers?: SelectedModifier[],
  ) => {
    // Clear any existing highlight
    setHighlightedItemId(null);

    // Trigger screen switch
    setItemScreenSignal((prev) => prev + 1);

    // Start the actual item flow
    setActiveItem(item);
    setActiveModifiers([]);
    setActiveNote("");

    if (item.variantlist.length > 1) {
      setWizardStep("VARIANT");
    } else if (item.variantlist.length === 1) {
      const variant = item.variantlist[0];
      setActiveVariant(variant);

      // Robust check for modifiers (handle casing inconsistencies)
      const modGroups =
        (variant as any).modifierlist || (variant as any).modifierList || [];
      const hasModifiers = modGroups.some(
        (g: any) => g.list && g.list.length > 0,
      );

      if (hasModifiers) {
        setWizardStep("MODIFIER");
      } else {
        addToCart(item, variant.id, [], 1);
        setWizardStep("BROWSE");
        setActiveItem(null);
        setActiveVariant(null);
        setHighlightedItemId(null);
      }
    }
  };

  const selectVariant = (variant: Variantlist) => {
    setActiveVariant(variant);

    // Robust check for modifiers
    const modGroups =
      (variant as any).modifierlist || (variant as any).modifierList || [];
    const hasModifiers = modGroups.some(
      (g: any) => g.list && g.list.length > 0,
    );

    if (hasModifiers) {
      setWizardStep("MODIFIER");
    } else {
      if (activeItem) {
        addToCart(activeItem, variant.id, [], 1);
        setWizardStep("BROWSE");
        setActiveItem(null);
        setActiveVariant(null);
      }
    }
  };

  const toggleModifier = (
    mod: ListElement,
    group: Modifierlist,
    forceRemove = false,
  ) => {
    setActiveModifiers((prev) => {
      const isMultiple = !!group.is_multiple;
      const existingMod = prev.find((m) => m.id === mod.id);

      if (existingMod) {
        // ✅ If forceRemove OR not multiple, remove it
        if (forceRemove || !isMultiple) {
          return prev.filter((m) => m.id !== mod.id);
        }

        // Otherwise increment
        return prev.map((m) =>
          m.id === mod.id ? { ...m, modqty: m.modqty + 1 } : m,
        );
      }

      const newMod: SelectedModifier = {
        id: mod.id,
        groupId: group.id,
        groupName: group.group_name || group.name,
        name: mod.name,
        price: mod.price,
        modqty: 1,
      };

      if (isMultiple) {
        return [...prev, newMod];
      } else {
        const others = prev.filter((m) => m.groupId !== group.id);
        return [...others, newMod];
      }
    });
  };
  // ---------------- Cancel terminal payment (Dart-equivalent) ----------------

  const cancelPayment = useCallback(async (): Promise<string | null> => {
    // Always prefer vendor terminal
    const terminal2 = vendor?.terminal;

    if (!terminal2) {
      throw new Error("VENDOR_CONFIG_MISSING");
    }

    try {
      const res = await fetch(`${PAYMENT_BASE_URL}/cancel_payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({ terminal: terminal2 }),
      });

      const raw = await res.text();

      if (!res.ok) {
        throw new Error("CANCEL_PAYMENT_FAILED");
      }

      return raw;
    } catch (e) {
      throw e;
    }
  }, [vendor]);
  const updateModifierQty = (modId: string | number, delta: number) => {
    setActiveModifiers((prev) =>
      prev
        .map((m) => {
          if (m.id === modId) {
            const newQty = m.modqty + delta;
            return { ...m, modqty: newQty };
          }
          return m;
        })
        .filter((m) => m.modqty > 0),
    );
  };

  const confirmItem = () => {
    if (!activeItem || !activeVariant) {
      return;
    }

    const finalNote = activeNote.trim();

    // ✅ Add to cart with all selected modifiers and note
    try {
      addToCart(activeItem, activeVariant.id, activeModifiers, 1, finalNote);
    } catch (error) {}

    // ✅ Reset wizard state
    setWizardStep("BROWSE");
    setActiveItem(null);
    setActiveVariant(null);
    setActiveModifiers([]);
    setActiveNote("");
    setHighlightedItemId(null);
  };

  const cancelFlow = () => {
    setWizardStep("BROWSE");
    setActiveItem(null);
    setActiveVariant(null);
    setActiveModifiers([]);
    setActiveNote("");
  };

  const goBack = () => {
    if (wizardStep === "MODIFIER") {
      if (activeItem && activeItem.variantlist.length > 1) {
        setWizardStep("VARIANT");
      } else {
        setWizardStep("BROWSE");
      }
    } else if (wizardStep === "VARIANT") {
      setWizardStep("BROWSE");
    }
  };

  return (
    <OrderContext.Provider
      value={{
        menu,
        isLoading,
        selectedCategory,
        cart,
        cartTotal,
        isOrdering,
        orderResult,
        closeOrderResult,

        paymentMethod,
        setPaymentMethod,
        config,
        cardStatus,
        setCardStatus,
        cancelPayment,

        wizardStep,
        activeItem,
        activeVariant,
        activeModifiers,
        highlightedItemId,
        setHighlightedItemId,

        setSelectedCategory,
        addToCart,
        removeFromCart,
        clearCart,

        updateCartItemQty,
        updateCartItemNote,
        updateCartItemModifiers,
        updateCartItemVariant,

        placeOrder,
        // 🔹 add this

        findItemByName,
        selectCategory,
        highlightItem,
        startItemFlow,
        selectVariant,
        toggleModifier,
        updateModifierQty,
        confirmItem,
        cancelFlow,
        goBack,
        activeNote,
        setActiveNote,
        cashPopupState,
        setCashPopupState,
        completedOrderNumber,
        cartViewSignal,
        showCartScreen: () => setCartViewSignal((s) => s + 1),
        itemScreenSignal,

        welcomeMessage: config?.welcomeMessage || "",
        resturantNumber: config?.resturantNumber || "",
        checkout,
        setService,
        setCheckoutField,
        resetCheckout,
        // ...
        loadOrderIntoCart,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (!context) throw new Error("useOrder must be used within OrderProvider");
  return context;
};
