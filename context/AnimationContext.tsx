import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  useRef,
} from "react";

interface AnimationContextType {
  animatedItemId: string | null;
  triggerAnimation: (itemId: string | number) => void;
}

const AnimationContext = createContext<AnimationContextType | undefined>(
  undefined
);

export const AnimationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [animatedItemId, setAnimatedItemId] = useState<string | null>(null);

  // ✅ Track and cancel previous timeout safely
  const clearTimerRef = useRef<number | null>(null);

  const triggerAnimation = useCallback((itemId: string | number) => {
    const stringId = String(itemId);

    // Clear previous timeout to avoid race conditions
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    setAnimatedItemId(stringId);

    clearTimerRef.current = window.setTimeout(() => {
      setAnimatedItemId(null);
      clearTimerRef.current = null;
    }, 10);
  }, []);

  return (
    <AnimationContext.Provider value={{ animatedItemId, triggerAnimation }}>
      {children}
    </AnimationContext.Provider>
  );
};

export const useAnimation = (): AnimationContextType => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error("useAnimation must be used within an AnimationProvider");
  }
  return context;
};
