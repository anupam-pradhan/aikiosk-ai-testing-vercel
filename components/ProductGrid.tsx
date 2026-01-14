import React, { useEffect } from "react";
import { useOrder } from "../context/OrderContext";
import { useAnimation } from "../context/AnimationContext";
import { buildFallbackSvgDataUrl } from "../utils/fallbackImage";
import { ImageWithLoader } from "./ImageWithLoader";

const ProductGrid: React.FC = () => {
  const { selectedCategory, startItemFlow, highlightedItemId } = useOrder();
  const { animatedItemId } = useAnimation();

  useEffect(() => {
    if (highlightedItemId) {
      const element = document.getElementById(`product-${highlightedItemId}`);
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [highlightedItemId]);

  if (!selectedCategory) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-lg md:text-xl animate-pulse font-medium tracking-wide">
        Select a category to start
      </div>
    );
  }

  return (
    <div className="flex-1 h-full bg-gray-200/50 p-2 md:p-6 overflow-y-auto">
      {/* 🔹 Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 pb-20">
        {selectedCategory.itemlist.map((item) => {
          const isHighlighted = String(highlightedItemId) === String(item.id);
          const isAnimating = String(animatedItemId) === String(item.id);

          return (
            <button
              id={`product-${item.id}`}
              key={item.id}
              onClick={() => startItemFlow(item)}
              // 🔹 STRUCTURE & INTERACTION
              className={`
                relative group
                /* MOBILE: Fixed h-32 */
                h-[120px] md:h-auto
                w-full
                rounded-[1.5rem]
                transition-all duration-300 ease-out
                flex flex-row md:flex-col
                text-left
                /* 🔹 INTERACTIVE STATES (Button Feel) */
                hover:-translate-y-1 hover:shadow-xl
                active:scale-[0.98] active:shadow-sm
                cursor-pointer
                overflow-hidden
                border
                backdrop-blur-xl
                ${
                  isHighlighted
                    ? "border-orange-400/50 z-10 shadow-[0_0_30px_rgba(249,115,22,0.4)] ring-2 ring-orange-300/60"
                    : "border-white/40 hover:border-white/80 shadow-lg"
                }
                ${
                  isAnimating
                    ? "animate-ai-trigger ring-4 ring-blue-400/50"
                    : ""
                }
              `}
              // 🔹 GLOSSY "GLASS" STYLES
              style={{
                background: isHighlighted
                  ? "linear-gradient(135deg, rgba(255, 247, 237, 0.9) 0%, rgba(255, 237, 213, 0.6) 100%)"
                  : "linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.2) 100%)",
                boxShadow: isHighlighted
                  ? "inset 0 2px 0 rgba(255,255,255,1), inset 0 -2px 0 rgba(251, 146, 60, 0.3), 0 8px 20px rgba(249,115,22,0.2)"
                  : "inset 0 1px 1px rgba(255,255,255, 0.9), inset 0 -2px 10px rgba(0,0,0,0.05), 0 10px 20px -5px rgba(0,0,0,0.1)",
              }}
            >
              {/* 🔹 LAYER 1: The "Sheen" (Top reflection) */}
              <div
                className="absolute inset-0 pointer-events-none opacity-50 rounded-[1.5rem]"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 40%)",
                }}
              />

              {/* 🔹 LAYER 2: The "Glow" (Hover effect) */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/40 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

              {/* 🔹 LAYER 3: Existing Animation Logic */}
              {isAnimating && (
                <div className="absolute inset-0 overflow-hidden rounded-[1.5rem] pointer-events-none z-20 mix-blend-overlay">
                  <div className="shimmer-effect" />
                </div>
              )}

              {/* 🔹 CONTENT CONTAINER */}
              <div className="relative z-10 flex flex-row md:flex-col gap-3 p-3 h-full w-full items-center md:items-start">
                {/* IMAGE CONTAINER */}
                <div
                  className="
                    /* MOBILE: Square */
                    h-full aspect-square w-26
                    /* DESKTOP: Rectangular */
                    md:w-full md:h-44 md:aspect-[4/3]
                    rounded-2xl
                    flex items-center justify-center
                    overflow-hidden
                    flex-shrink-0
                    relative
                    shadow-inner
                    border border-white/50
                  "
                  style={{
                    background: "rgba(255, 255, 255, 0.5)",
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,0.1)",
                  }}
                >
                  <ImageWithLoader
                    src={
                      item.photo && item.photo.startsWith("http")
                        ? item.photo
                        : buildFallbackSvgDataUrl(item.name)
                    }
                    fallback={buildFallbackSvgDataUrl(item.name)}
                    alt={item.name}
                    className="w-full h-full object-cover transform transition-transform duration-500 group-hover:scale-110 mix-blend-multiply"
                  />
                </div>

                {/* DETAILS */}
                <div className="flex flex-col flex-1 h-full justify-center md:justify-between py-1 md:py-2 min-w-0 text-left md:w-full">
                  <div>
                    <h3 className="font-bold text-gray-800 text-[15px] md:text-[16px] leading-tight line-clamp-2 drop-shadow-sm">
                      {item.name}
                    </h3>
                    <p className="text-[12px] md:text-[13px] text-gray-600 leading-snug line-clamp-2 mt-1 font-medium opacity-80">
                      {item.description || "Fresh & delicious"}
                    </p>
                  </div>

                  {/* Price Tag with Glossy Pill Effect */}
                  <div className="mt-2 md:mt-3">
                    <span
                      className={`
                        inline-block px-3 py-1 rounded-full text-[14px] font-bold shadow-sm border
                        ${
                          isHighlighted
                            ? "bg-orange-500 text-white border-orange-400"
                            : "bg-white/60 text-orange-700 border-white/50"
                        }
                      `}
                    >
                      £{item.variantlist[0]?.price.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProductGrid;
