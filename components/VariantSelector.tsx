import React from "react";
import { useOrder } from "../context/OrderContext";
import { useAnimation } from "../context/AnimationContext";

const VariantSelector: React.FC = () => {
  const { activeItem, selectVariant, goBack } = useOrder();
  const { animatedItemId } = useAnimation();

  if (!activeItem) return null;

  return (
    // FIX: Removed 'fixed inset-0'. Used 'h-full' to fill the middle column ONLY.
    // 'flex-1' ensures it expands to fill available width.
    <div className="flex-1 flex flex-col h-full bg-[#e5e5e5] relative overflow-hidden">
      {/* Header */}
      <div className="shrink-0  text-black p-3 md:p-4 text-center font-bold text-lg md:text-2xl ">
        Pick the Variant for {activeItem.name}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 no-scrollbar">
        <div className="flex items-start justify-center min-h-full">
    
      <div className="flex flex-wrap justify-center gap-3 md:gap-5 w-full max-w-5xl">
        {activeItem.variantlist.map((variant) => {
          const isAnimating = String(animatedItemId) === String(variant.id);
          return (
            <button
              key={variant.id}
              onClick={() => selectVariant(variant)}
              className={`
                w-[calc(50%-6px)] md:w-[calc(33.33%-14px)] 
                bg-[#c2410c] hover:bg-[#a1360a] text-white rounded-xl p-3 md:p-4 shadow-lg transition-all active:scale-95 flex flex-col items-center justify-center gap-2 min-h-[130px] md:min-h-[200px] h-auto relative ${isAnimating ? 'animate-ai-trigger' : ''}
              `}
            >
              {isAnimating && (
                <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                  <div className="shimmer-effect" />
                </div>
              )}
              <div className="w-14 h-14 md:w-24 md:h-24 flex-shrink-0 rounded-full bg-white shadow-md overflow-hidden p-1">
                <img
                  src={
                    activeItem.photo && activeItem.photo.startsWith("http")
                      ? activeItem.photo
                      : `https://placehold.co/200x200/f3f4f6/a3a3a3?text=${encodeURIComponent(
                          activeItem.name
                        )}`
                  }
                  alt={variant.name}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    (
                      e.target as HTMLImageElement
                    ).src = `https://placehold.co/200x200/f3f4f6/a3a3a3?text=${encodeURIComponent(
                      activeItem.name
                    )}`;
                  }}
                />
              </div>

              <div className="flex flex-col items-center justify-center w-full">
                <span className="text-sm md:text-xl font-bold text-center leading-tight mb-1">
                  {variant.name}
                </span>
                <span className="text-xs md:text-lg opacity-90 bg-black/20 px-3 py-1 rounded-full">
                  £ {variant.price.toFixed(2)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
      </div>

      {/* Sticky Footer */}
      <div className="shrink-0 p-4 bg-[#e5e5e5] border-t border-gray-300 flex justify-center pb-6 md:pb-8 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <button
          onClick={goBack}
          className="bg-[#c2410c] text-white px-10 md:px-16 py-3 rounded-full text-lg md:text-xl font-bold shadow-lg active:scale-95 transition-transform"
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default VariantSelector;
