import React, { createContext, useContext, useMemo, useState } from "react";
import {
  VendorModel,
  getLocalVendor,
  saveLocalVendor,
  clearLocalVendor,
} from "./vendorStorage";

type VendorContextType = {
  vendor: VendorModel | null;
  isVendorReady: boolean;
  setVendor: (v: VendorModel) => void;
  resetVendor: () => void;
};

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export const VendorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ✅ Read from storage BEFORE first render (client-side)
  const [vendor, setVendorState] = useState<VendorModel | null>(() => getLocalVendor());
  const [isVendorReady, setIsVendorReady] = useState(true); // ✅ immediately ready on client

  const setVendor = (v: VendorModel) => {
    saveLocalVendor(v);
    setVendorState(v);
  };

  const resetVendor = () => {
    clearLocalVendor();
    setVendorState(null);
  };

  const value = useMemo(
    () => ({ vendor, isVendorReady, setVendor, resetVendor }),
    [vendor]
  );

  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>;
};

export const useVendor = () => {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error("useVendor must be used within VendorProvider");
  return ctx;
};
