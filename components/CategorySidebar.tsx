import React from "react";
import { useOrder } from "../context/OrderContext";
import { useAnimation } from "../context/AnimationContext";

const CategorySidebar: React.FC = () => {
  const { menu, selectedCategory, setSelectedCategory } = useOrder();
  const { animatedItemId } = useAnimation();

  if (!menu) {
    return <div className="h-16 lg:h-full bg-gray-200/50 animate-pulse" />;
  }

  return (
    <div className="h-auto lg:overflow-x-hidden md:w-1/4 md:border-r md:flex md:flex-col md:min-h-0 no-scrollbar">
      {/* MOBILE */}
      <div className="md:hidden bg-gray-200/50 pl-3 pr-1 pt-2 h-full">
        <div
          className="
      flex flex-col gap-2
      max-h-[90vh]
      overflow-y-auto
      no-scrollbar
    "
        >
          {menu.categorylist.map((category) => {
            const active = String(selectedCategory?.id) === String(category.id);
            const isAnimating = String(animatedItemId) === String(category.id);

            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-2.5 rounded-lg transition-all duration-300 transform active:scale-95 shadow-md relative
            ${
              active
                ? "bg-green-600 text-white"
                : "bg-[#c2410c] text-white"
            }
            ${isAnimating ? 'animate-ai-trigger' : ''}
          `}
              >
                {isAnimating && (
                   <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                      <div className="shimmer-effect" />
                   </div>
                )}
                <span className="text-[12px] font-bold whitespace-nowrap relative z-10">
                  {category.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden md:flex md:flex-col bg-gray-200/50 gap-2 p-2 md:flex-1 md:overflow-y-auto no-scrollbar">
        {menu.categorylist.map((category) => {
          const active = String(selectedCategory?.id) === String(category.id);
          const isAnimating = String(animatedItemId) === String(category.id);

          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category)}
              className={`
                whitespace-nowrap
                px-5 py-4 rounded-xl
                text-lg font-bold
                transition-all duration-200
                shadow-sm relative
                ${
                  active
                    ? "bg-green-600 text-white ring-2 ring-green-400 ring-offset-2 ring-offset-gray-100"
                    : "bg-[#c2410c] text-white hover:bg-[#a1360a]"
                }
                ${isAnimating ? 'animate-ai-trigger' : ''}
              `}
            >
              {isAnimating && (
                 <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                    <div className="shimmer-effect" />
                 </div>
              )}
              <span className="relative z-10">{category.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategorySidebar;
