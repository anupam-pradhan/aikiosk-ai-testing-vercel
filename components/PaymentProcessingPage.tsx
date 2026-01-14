import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useOrder } from "../context/OrderContext";

const PaymentProcessingPage: React.FC = () => {
  const navigate = useNavigate();
  const { cart, cartTotal, placeOrder, isOrdering, cancelPayment } = useOrder();

  // Make sure we only trigger placeOrder("card") once
  const ranRef = useRef(false);
  // Used to stop navigation after a user-initiated cancel
  const abortedRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (!cart.length) {
      navigate("/", { replace: true });
      return;
    }

    (async () => {
      try {
        console.log("trying card order");
        const res = await placeOrder("card");

        // If user cancelled in the meantime, don't override that navigation
        if (abortedRef.current) return;

        navigate(res ? "/" : "/payment/failed", { replace: true });
      } catch (e) {
        if (abortedRef.current) return;
        navigate("/payment/failed", { replace: true });
      }
    })();
  }, [cart.length, navigate, placeOrder]);

  const handleCancel = async () => {
    // Mark as aborted so the effect won't redirect afterwards
    abortedRef.current = true;

    try {
      await cancelPayment();
    } catch (e) {
      console.error("cancel payment failed", e);
      // Even if cancel endpoint fails, still return to cart
    }

    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-orange-50 flex items-center justify-center mb-6">
          <span className="text-4xl">💳</span>
        </div>

        <h1 className="text-2xl font-black text-gray-800 mb-2">
          Payment Processing
        </h1>
        <p className="text-gray-500 mb-6">
          Please tap, insert, or swipe your card on the terminal.
        </p>

        <div className="bg-gray-100 rounded-xl p-4 mb-6">
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">
            Amount
          </div>
          <div className="text-4xl font-black text-[#c2410c]">
            £{cartTotal.toFixed(2)}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-gray-600">
          <span className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
          <span className="w-3 h-3 rounded-full bg-gray-400 animate-pulse [animation-delay:150ms]" />
          <span className="w-3 h-3 rounded-full bg-gray-400 animate-pulse [animation-delay:300ms]" />
        </div>

        <div className="mt-6 text-xs text-gray-400">
          {isOrdering ? "Processing..." : "Starting terminal session..."}
        </div>

        <button
          onClick={handleCancel}
          className="mt-6 w-full bg-gray-100 text-gray-800 py-3 rounded-full font-semibold text-sm shadow hover:bg-gray-200 transition-all"
        >
          Cancel Payment
        </button>
      </div>
    </div>
  );
};

export default PaymentProcessingPage;
