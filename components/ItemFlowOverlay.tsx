import React from "react";
import { useOrder } from "../context/OrderContext";
import VariantSelector from "./VariantSelector";
import ModifierSelector from "./ModifierSelector";

const ItemFlowOverlay: React.FC = () => {
  const { wizardStep } = useOrder();

  const isOpen = wizardStep === "VARIANT" || wizardStep === "MODIFIER";
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-end">
      {/* Enhanced backdrop with gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/60 backdrop-blur-[2px]" />

      {/* Bottom Sheet Container */}
      <div className="relative w-full h-[95%] flex flex-col overflow-hidden will-change-contents">
        {/* Main Sheet with glassmorphism and modern styling */}
        <div className="relative flex flex-col h-full bg-gradient-to-br from-white via-gray-50 to-gray-100 rounded-t-[40px] shadow-2xl animate-sheetIn will-change-transform overflow-hidden">
          {/* Decorative gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-blue-500/5 via-purple-500/5 to-transparent pointer-events-none" />

          {/* Subtle glow effect */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

          {/* Handle area with enhanced design */}
          <div className="relative shrink-0 flex justify-center pt-4 pb-5">
            <div className="relative">
              {/* Glowing background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-xl rounded-full" />
              {/* Main handle */}
              <div className="relative w-16 h-1.5 rounded-full bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 shadow-sm" />
            </div>
          </div>

          {/* Frosted divider line */}
          <div className="relative shrink-0 mx-6 h-px bg-gradient-to-r from-transparent via-gray-300/50 to-transparent" />

          {wizardStep === "VARIANT" && <VariantSelector />}
          {wizardStep === "MODIFIER" && <ModifierSelector />}

          {/* Subtle bottom fade effect */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white/80 to-transparent pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default ItemFlowOverlay;
