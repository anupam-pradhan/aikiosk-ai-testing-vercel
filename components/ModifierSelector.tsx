import React, { useEffect, useRef } from "react";
import { useOrder } from "../context/OrderContext";
import { useAnimation } from "../context/AnimationContext";

const ModifierSelector: React.FC = () => {
  const {
    activeItem,
    activeVariant,
    activeModifiers,
    toggleModifier,
    updateModifierQty,
    confirmItem,
    goBack,
    activeNote,
    setActiveNote,
  } = useOrder();
  const { animatedItemId } = useAnimation();
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {  
    const scrollAllModifiers = () => {
      const container = scrollContainerRef.current;
      if (!container || !activeVariant?.modifierlist?.length) return;
      
      const totalHeight = container.scrollHeight;
      const visibleHeight = container.clientHeight;
      const scrollDistance = totalHeight - visibleHeight;
      
      if (scrollDistance <= 0) return; 
      
      const duration = 3000;
      const startTime = Date.now();
      const startScroll = container.scrollTop;
      
      const animateScroll = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
        const easedProgress = easeOutCubic(progress);
        
        container.scrollTop = startScroll + (scrollDistance * easedProgress);
        
        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        }
      };
      
      requestAnimationFrame(animateScroll);
    };
    
    (window as any).scrollModifiersForAI = scrollAllModifiers;
    
    return () => {
      delete (window as any).scrollModifiersForAI;
    };
  }, [activeVariant]);

  if (!activeVariant || !activeItem) return null;

  return (
    <div className="flex-1 bg-[#e5e5e5] flex flex-col h-full overflow-hidden">
      {/* Header: Responsive text scaling */}
      {/* <div className="bg-[#c2410c] text-white p-3 md:p-4 flex justify-between items-center shadow-md z-10">
        <span className="text-lg md:text-xl font-bold truncate max-w-[60%]">{activeItem.name}</span>
        <span className="text-lg md:text-xl font-bold whitespace-nowrap">
            £{(activeVariant.price + activeModifiers.reduce((sum, m) => sum + (m.price * (m.modqty || 1)), 0)).toFixed(2)}
        </span>
      </div>
       */}
      <div className="bg-gray-200 py-2 text-center font-bold text-sm md:text-lg border-b border-gray-300 text-gray-800">
        Would you like any extra topping?
      </div>

      {/* Special Instructions / Smart Notes Display */}
      {activeNote && (
        <div className="bg-amber-50 px-4 py-2 border-b border-amber-100 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="shrink-0 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">Note</span>
            <span className="text-amber-900 text-xs md:text-sm font-medium italic truncate">"{activeNote}"</span>
          </div>
          <button 
            onClick={() => setActiveNote("")}
            className="shrink-0 ml-2 text-amber-400 hover:text-amber-600 transition-colors p-1"
            title="Clear note"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* drinks part */}

      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 no-scrollbar">
        {activeVariant.modifierlist.map((group) => (
          <div key={group.id} className="mb-6">
            {activeVariant.modifierlist.length > 1 && (
              <h3 className="text-md md:text-lg font-bold mb-3 text-gray-700 ml-1">
                {/* {group.group_name || group.name} */}
              </h3>
            )}

            {/* Responsive Grid: 2 cols on mobile, 4 on tablet, 5-6 on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {group.list.map((mod) => {
                const selectedMod = activeModifiers.find(
                  (m) => m.id === mod.id
                );
                const isSelected = !!selectedMod;
                const hasImage = mod.photo && mod.photo.length > 5;
                const isAnimating = String(animatedItemId) === String(mod.id);

                return (
                  <div
                    key={mod.id}
                    className={`
                                    relative flex flex-col items-center justify-between rounded-xl p-2 shadow-sm border transition-all duration-200
                                    ${
                                      isSelected
                                        ? "bg-green-700 border-green-800 ring-2 ring-green-500/50"
                                        : "bg-[#c2410c] border-orange-800 hover:bg-[#a1360a]"
                                    }
                                    ${isAnimating ? 'animate-ai-trigger' : ''}
                                    min-h-[140px] md:h-44
                                `}
                  >
                    {isAnimating && (
                       <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                          <div className="shimmer-effect" />
                       </div>
                    )}
                    {/* Main Click Area */}
                    <button
                      onClick={() => toggleModifier(mod, group)}
                      className="absolute inset-0 z-0 w-full h-full cursor-pointer"
                    />

                    {/* Image & Name Container */}
                    <div className="z-10 flex-1 flex flex-col items-center justify-start w-full pointer-events-none">
                      <div
                        className={`w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-1 overflow-hidden bg-white shadow-inner ${
                          isSelected ? "ring-2 ring-white" : ""
                        }`}
                      >
                        {hasImage ? (
                          <img
                            src={mod.photo}
                            alt={mod.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              e.currentTarget.parentElement!.innerText =
                                mod.name.charAt(0);
                            }}
                          />
                        ) : (
                          <span className="text-xl md:text-2xl font-bold text-gray-500">
                            {mod.name.charAt(0)}
                          </span>
                        )}
                      </div>

                      <span className="text-center font-bold text-white text-[10px] md:text-xs leading-tight line-clamp-2 px-1 mb-1 drop-shadow-md">
                        {mod.name}
                      </span>
                    </div>

                    {/* Price Tag */}
                    <div className="z-10 w-full flex items-center justify-center pointer-events-none">
                      <span className="text-[10px] md:text-xs font-bold bg-black/30 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                        £ {mod.price.toFixed(2)}
                      </span>
                    </div>

                    {/* Quantity Controls: Repositioned to be more accessible */}
                    {isSelected && group.is_multiple ? (
                      <div className="z-20 absolute inset-0 bg-green-900/90 flex flex-col items-center justify-center rounded-xl p-2">
                        <span className="text-white text-xs font-bold mb-2">
                          {mod.name}
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateModifierQty(mod.id, -1);
                            }}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-600 text-white font-bold flex items-center justify-center shadow-lg active:scale-90"
                          >
                            -
                          </button>
                          <span className="font-bold text-white text-xl min-w-[20px] text-center">
                            {selectedMod.modqty}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateModifierQty(mod.id, 1);
                            }}
                            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-green-500 text-white font-bold flex items-center justify-center shadow-lg active:scale-90"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleModifier(mod, group, true); // forceRemove=true
                          }}
                          className="mt-2 text-[10px] text-white/70 underline"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}

                    {/* Single Select Checkmark */}
                    {isSelected && !group.is_multiple && (
                      <div className="z-20 absolute top-1 right-1 bg-white text-green-700 rounded-full p-0.5 shadow-md">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 md:h-4 md:w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 relative bg-gradient-to-b from-gray-50 to-white border-t border-gray-200">
        {/* Content */}
        <div className="relative px-4 py-4 md:px-8 md:py-6 flex items-center justify-center gap-4 md:gap-6 max-w-4xl mx-auto">
          {/* Previous Button - Outlined Style */}
          <button
            onClick={goBack}
            className="w-full md:w-80 group relative bg-white py-2 md:py-3.5 rounded-full text-[14px] md:text-lg font-bold transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 overflow-hidden border-2 border-[#c2410c] shadow-md hover:shadow-lg"
          >
            {/* Arrow icon */}
            <div className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 text-[#c2410c] opacity-70 group-hover:opacity-100 group-hover:-translate-x-1 transition-all duration-300">
              <svg
                className="w-4 h-4 md:w-6 md:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </div>

            <span className="relative text-[#c2410c] transition-colors duration-300">
              Previous
            </span>
          </button>

          {/* Next Button - Solid Style */}
          <button
            onClick={confirmItem}
            className="w-full md:w-80 group relative bg-gradient-to-r from-[#dc2626] to-[#c2410c] py-2 border-2 border-[#c2410c] md:py-4 rounded-full text-[14px] md:text-lg font-bold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(194,65,12,0.4)] active:translate-y-0 overflow-hidden shadow-md"
          >
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>

            {/* Arrow icon */}
            <div className="absolute right-8 md:right-10 top-1/2 -translate-y-1/2 text-white opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-300">
              <svg
                className="w-4 h-4 md:w-6 md:h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>

            <span className="relative text-white font-semibold">Next</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModifierSelector;
