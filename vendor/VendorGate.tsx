import React from "react";
import SetupVendorPage from "./SetupVendorPage";
import { useVendor } from "./VendorContext";

const VendorGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { vendor, isVendorReady } = useVendor();

  if (!isVendorReady) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  // Equivalent to your:
  // return vendor.apiUrl != null ? HomePage() : Setup screen
  if (!vendor?.apiUrl) {
    return <SetupVendorPage />;
  }

  return <>{children}</>;
};

export default VendorGate;