import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AnimationProvider } from "./context/AnimationContext";
import { OrderProvider } from "./context/OrderContext";
import { VendorProvider } from "./vendor/VendorContext";
import VendorGate from "./vendor/VendorGate";

import KioskLayout from "./components/KioskLayout";
import PaymentProcessingPage from "./components/PaymentProcessingPage";
import PaymentFailedPage from "./components/PaymentFailedPage";
import { CashPaymentPopup } from "./components/CashPaymentPopup";

const App: React.FC = () => {
  return (
    <VendorProvider>
      <OrderProvider>
        <AnimationProvider>
          <BrowserRouter>
            <VendorGate>
              <Routes>
                <Route path="/" element={<KioskLayout />} />
                <Route
                  path="/payment/processing"
                  element={<PaymentProcessingPage />}
                />
                <Route path="/payment/failed" element={<PaymentFailedPage />} />
              </Routes>
              <CashPaymentPopup />
            </VendorGate>
          </BrowserRouter>
        </AnimationProvider>
      </OrderProvider>
    </VendorProvider>
  );
};

export default App;
