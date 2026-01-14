import React from "react";
import { useNavigate } from "react-router-dom";
import { useOrder } from "../context/OrderContext";

const PaymentFailedPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartTotal, cart, clearCart } = useOrder();

  const handleTryAgain = () => {
    if (!cart.length) {
      navigate("/", { replace: true });
      return;
    }
    navigate("/payment/processing", { replace: true });
  };

  const handleBackToCart = () => {
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-6">
          <span className="text-4xl">❌</span>
        </div>

        <h1 className="text-2xl font-black text-gray-800 mb-2">
          Payment Failed
        </h1>
        <p className="text-gray-500 mb-6">
          Your card payment couldn’t be completed. Please try again or pay by cash.
        </p>

        <div className="bg-gray-100 rounded-xl p-4 mb-6">
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-1">
            Amount
          </div>
          <div className="text-4xl font-black text-[#c2410c]">
            £{cartTotal.toFixed(2)}
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleTryAgain}
            className="w-full bg-[#c2410c] text-white py-3 rounded-full font-bold text-lg shadow-lg hover:bg-[#a1360a] transition-all"
          >
            Try Again
          </button>

          <button
            onClick={handleBackToCart}
            className="w-full bg-gray-100 text-gray-800 py-3 rounded-full font-bold text-lg shadow hover:bg-gray-200 transition-all"
          >
            Back to Cart
          </button>

          <button
            onClick={() => {
              clearCart();
              navigate("/", { replace: true });
            }}
            className="w-full text-sm text-red-600 hover:text-red-700"
          >
            Clear Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailedPage;