declare global {
  interface Window {
    flutter_inappwebview?: {
      callHandler: (name: string, payload: any) => Promise<any>;
    };
    PayBridge?: {
      postMessage: (payload: string) => void;
    };
  }
}

export async function startTapToPay(payload: {
  amountMinor: number;
  currency: "gbp";
  orderId: string;
  locationId?: string;
}) {
  const terminalBaseUrl =
    (import.meta as any).env?.VITE_TERMINAL_BASE_URL ??
    "http://192.168.1.161:4242";
  const terminalLocationId =
    payload.locationId ||
    (import.meta as any).env?.VITE_TERMINAL_LOCATION_ID ||
    "";

  if (!terminalLocationId) {
    throw new Error("TERMINAL_LOCATION_ID_MISSING");
  }

  const intentRes = await fetch(`${terminalBaseUrl}/terminal/create_intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      amount: payload.amountMinor,
      currency: payload.currency,
      orderId: payload.orderId,
    }),
  });

  if (!intentRes.ok) {
    const msg = await intentRes.text();
    throw new Error(msg || "TERMINAL_CREATE_INTENT_FAILED");
  }

  const intent = await intentRes.json();

  const bridgePayload = {
    type: "START_TAP_TO_PAY",
    amount: payload.amountMinor,
    currency: payload.currency,
    orderId: payload.orderId,
    paymentIntentId: intent.paymentIntentId,
    clientSecret: intent.clientSecret,
    terminalBaseUrl,
    locationId: terminalLocationId,
  };

  if (window.flutter_inappwebview?.callHandler) {
    return window.flutter_inappwebview.callHandler(
      "kioskBridge",
      bridgePayload,
    );
  }

  if (window.PayBridge?.postMessage) {
    window.PayBridge.postMessage(JSON.stringify(bridgePayload));
    return { ok: true };
  }

  throw new Error("Flutter bridge not available (open inside Flutter app).");
}
