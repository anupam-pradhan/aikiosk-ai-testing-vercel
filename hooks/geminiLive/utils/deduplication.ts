// Deduplication utilities

import { normalize } from "./text";

export const buildAddBaseKey = (args: any) => {
  const item = normalize(args?.itemName || "");
  const variant = normalize(args?.variantName || "");
  const qty = args?.quantity ? String(args.quantity) : "1";
  return `${item}__${variant}__${qty}`;
};

export const createDeduplicationTracker = (windowMs: number) => {
  const recentAddKeyTimes = new Map<string, number>();

  const isDuplicateAddWithinWindow = (baseKey: string): boolean => {
    const now = Date.now();
    const last = recentAddKeyTimes.get(baseKey);
    if (last && now - last < windowMs) {
      return true;
    }
    recentAddKeyTimes.set(baseKey, now);

    if (recentAddKeyTimes.size > 200) {
      for (const [k, t] of recentAddKeyTimes.entries()) {
        if (now - t > windowMs * 5) {
          recentAddKeyTimes.delete(k);
        }
      }
    }

    return false;
  };

  const clear = () => {
    recentAddKeyTimes.clear();
  };

  return { isDuplicateAddWithinWindow, clear };
};
