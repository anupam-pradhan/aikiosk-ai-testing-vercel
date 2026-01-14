import React, { useEffect, useState } from "react";
import { useOrder } from "../context/OrderContext";

export const CashPaymentPopup = () => {
  const {
    cashPopupState,
    completedOrderNumber,
    setCashPopupState,
    setPaymentMethod,
    config,
    closeOrderResult,
  } = useOrder();

  const [countdown, setCountdown] = useState(3);
  const [showLoader, setShowLoader] = useState(false);
  const [progress, setProgress] = useState(0);

  const countdownDuration = 3000;

  useEffect(() => {
    if (cashPopupState !== "confirming") {
      setCountdown(3);
      setShowLoader(false);
      setProgress(0);
      return;
    }

    const totalSeconds = Math.ceil(countdownDuration / 1000);
    setCountdown(totalSeconds);
    setShowLoader(false);
    setProgress(0);

    let startTime = Date.now();
    const totalDuration = countdownDuration;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const currentProgress = Math.min((elapsed / totalDuration) * 100, 100);

      setProgress(currentProgress);

      const timePerNumber = 100 / totalSeconds;
      const currentNumber =
        totalSeconds - Math.floor(currentProgress / timePerNumber);

      if (currentNumber > 0) {
        setCountdown(currentNumber);
      } else {
        setCountdown(0);
        setShowLoader(true);
        return;
      }

      if (currentProgress < 100) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [cashPopupState]);

  const handleClose = () => {
    if (setCashPopupState) setCashPopupState("idle");
    if (closeOrderResult) closeOrderResult();
    if (!config?.cashOnly && setPaymentMethod) {
      setPaymentMethod("card");
    }
  };

  if (cashPopupState === "idle") return null;

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-gradient-to-br from-white to-slate-50 shadow-[0_20px_80px_rgba(0,0,0,0.3)]">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-pink-500/10 to-purple-500/10 animate-pulse" />

        <div className="relative p-12">
          {cashPopupState === "confirming" && (
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 border border-orange-200 mb-8">
                <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                  {!showLoader ? "Processing" : "Finalizing"}
                </span>
              </div>

              <div className="relative flex flex-col items-center justify-center mb-10">
                {!showLoader ? (
                  <>
                    <svg
                      className="absolute h-44 w-44 -rotate-90"
                      viewBox="0 0 160 160"
                    >
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        className="text-slate-200"
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r="70"
                        stroke="currentColor"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="text-orange-500"
                        style={{
                          strokeDashoffset: strokeDashoffset,
                          transition: "none",
                        }}
                      />
                    </svg>
                    <div className="relative z-10 flex items-center justify-center h-44 w-44">
                      <div
                        key={countdown}
                        className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-600 to-orange-500"
                      >
                        {countdown}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="relative h-44 w-44 flex flex-col items-center justify-center gap-3">
                    <div className="relative">
                      <svg
                        className="h-20 w-20 animate-spin"
                        style={{ animationDuration: "1s" }}
                        viewBox="0 0 100 100"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="transparent"
                          strokeDasharray="70 200"
                          strokeLinecap="round"
                          className="text-orange-500"
                        />
                      </svg>
                    </div>
                    <div className="text-xs font-bold text-orange-600 uppercase tracking-wider text-center leading-tight">
                      Confirming
                      <br />
                      Order
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-50 border border-amber-200">
                <svg
                  className="h-5 w-5 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="text-sm font-semibold text-amber-800">
                  Please keep this window open
                </span>
              </div>
            </div>
          )}

          {cashPopupState === "completed" && (
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-24 w-24 rounded-full bg-green-500/20 animate-ping" />
                </div>
                <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-500/30 animate-[bounce_0.6s_ease-in-out]">
                  <svg
                    className="h-12 w-12 text-white animate-[scale_0.6s_ease-in-out]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>

              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 mb-3">
                Order Complete!
              </h2>
              <p className="text-slate-500 font-medium text-lg mb-10">
                Your order has been sent to the kitchen
              </p>

              <div className="w-full rounded-3xl bg-gradient-to-br from-orange-50 to-pink-50 border-2 border-orange-200/50 p-10 shadow-lg">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <svg
                    className="h-5 w-5 text-orange-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <span className="text-xs font-black uppercase tracking-[0.15em] text-orange-600">
                    Order Number
                  </span>
                </div>

                <div className="text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-orange-600 via-pink-600 to-purple-600">
                  #{completedOrderNumber || "00"}
                </div>

                <p className="mt-4 text-sm text-slate-500 font-medium">
                  Please wait for your number to be called
                </p>
              </div>
              <button
                onClick={handleClose}
                className="w-full mt-8 px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashPaymentPopup;
