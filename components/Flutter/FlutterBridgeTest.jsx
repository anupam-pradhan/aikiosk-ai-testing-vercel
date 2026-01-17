import React, { useEffect, useState } from "react";

export default function FlutterBridgeTest() {
  const [out, setOut] = useState("");
  const [status, setStatus] = useState("IDLE");
  const [statusPayload, setStatusPayload] = useState("");

  useEffect(() => {
    const handler = (json) => {
      try {
        const data = typeof json === "string" ? JSON.parse(json) : json;
        setStatus(String(data?.status || "UNKNOWN"));
        setStatusPayload(JSON.stringify(data, null, 2));
      } catch {
        setStatus("STATUS_PARSE_ERROR");
        setStatusPayload(String(json));
      }
    };

    window.onNativePaymentStatus = handler;

    return () => {
      if (window.onNativePaymentStatus === handler) {
        delete window.onNativePaymentStatus;
      }
    };
  }, []);

  const call = async (payload) => {
    try {
      if (payload?.type === "START_TAP_TO_PAY") {
        setStatus("REQUESTED");
      }

      if (window.flutter_inappwebview?.callHandler) {
        const res = await window.flutter_inappwebview.callHandler(
          "kioskBridge",
          payload
        );
        setOut(JSON.stringify(res, null, 2));
        return;
      }

      if (window.PayBridge?.postMessage) {
        window.PayBridge.postMessage(JSON.stringify(payload));
        setOut("PayBridge message sent.");
        return;
      }

      setOut("Bridge not available. Open this inside the Flutter app.");
    } catch (e) {
      setOut(String(e));
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h3>Flutter Bridge Test</h3>

      <div style={{ marginBottom: 12 }}>
        <b>Status:</b> {status}
      </div>

      <button
        onClick={() => call({ type: "PING" })}
        style={{ padding: 12, marginRight: 10 }}
      >
        PING
      </button>

      <button
        onClick={() =>
          call({
            type: "START_TAP_TO_PAY",
            amount: 250,
            currency: "gbp",
            orderId: String(Date.now()),
          })
        }
        style={{ padding: 12 }}
      >
        FAKE PAY
      </button>

      {statusPayload ? (
        <pre
          style={{
            marginTop: 16,
            background: "#1b1b1b",
            color: "#c8f7c5",
            padding: 12,
          }}
        >
          {statusPayload}
        </pre>
      ) : null}

      <pre
        style={{
          marginTop: 16,
          background: "#111",
          color: "#0f0",
          padding: 12,
        }}
      >
        {out}
      </pre>
    </div>
  );
}
