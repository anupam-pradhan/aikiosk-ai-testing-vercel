// Item lookup and resolution utilities

import {
  normalize,
  isPluralMatch,
  buildSemanticSearchName,
  calculateFuzzySimilarity,
} from "./text";

export const findItemExactInCategory = (cat: any, phrase: string) => {
  const q = normalize(phrase);
  if (!q || !cat?.itemlist?.length) return null;
  for (const item of cat.itemlist) {
    if (normalize(item.name) === q) return item;
  }
  return null;
};

export const findItemContainsInCategory = (cat: any, phrase: string) => {
  const q = normalize(phrase);
  if (!q || !cat?.itemlist?.length) return null;

  const matches: any[] = [];

  for (const item of cat.itemlist) {
    const n = normalize(item.name);
    if (
      n.includes(q) ||
      q.includes(n) ||
      isPluralMatch(q, n) ||
      isPluralMatch(n, q)
    ) {
      matches.push(item);
    }
  }

  // High Accuracy Rule:
  // If we match multiple items (e.g. "Burger" matches "Amigo Burger" and "Chicken Burger"),
  // DO NOT return just the first one. That causes "Mix Ups".
  // Return null so the system treats it as ambiguous or falls back to category level.
  if (matches.length === 1) return matches[0];

  return null;
};

export const findItemExactGlobal = (ctx: any, phrase: string) => {
  const cats = ctx.menu?.categorylist || [];
  for (const cat of cats) {
    const item = findItemExactInCategory(cat, phrase);
    if (item) return { item, category: cat };
  }
  return null;
};

export const findItemContainsGlobal = (ctx: any, phrase: string) => {
  const cats = ctx.menu?.categorylist || [];
  for (const cat of cats) {
    const item = findItemContainsInCategory(cat, phrase);
    if (item) return { item, category: cat };
  }
  return null;
};

// Fuzzy matching threshold for item lookup (lowered to 0.5 for better flexibility)
const FUZZY_MATCH_THRESHOLD = 0.5;

// Find best fuzzy match in a category
export const findItemFuzzyInCategory = (
  cat: any,
  phrase: string,
  threshold: number = FUZZY_MATCH_THRESHOLD
) => {
  if (!cat?.itemlist?.length || !phrase) return null;

  let bestMatch: any = null;
  let bestScore = 0;

  for (const item of cat.itemlist) {
    const score = calculateFuzzySimilarity(phrase, item.name);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = { item, score };
    }
  }

  return bestMatch;
};

// Find best fuzzy match globally across all categories
export const findItemFuzzyGlobal = (
  ctx: any,
  phrase: string,
  threshold: number = FUZZY_MATCH_THRESHOLD
) => {
  const cats = ctx.menu?.categorylist || [];
  let bestMatch: any = null;
  let bestScore = 0;

  for (const cat of cats) {
    const result = findItemFuzzyInCategory(cat, phrase, threshold);
    if (result && result.score > bestScore) {
      bestScore = result.score;
      bestMatch = { item: result.item, category: cat, score: result.score };
    }
  }

  return bestMatch;
};

export const coerceItemInfo = (anyShape: any) => {
  if (!anyShape) return null;

  if (anyShape.item) {
    return {
      item: anyShape.item,
      category: anyShape.category || null,
    };
  }

  if (anyShape.name && anyShape.variantlist) {
    return { item: anyShape, category: null };
  }

  return null;
};

export const resolveItemInfo = (
  ctx: any,
  rawName: string,
  dlog: (...args: any[]) => void
) => {
  const semanticName = buildSemanticSearchName(rawName);
  const selected = ctx.selectedCategory;

  dlog("Resolve item:", {
    rawName,
    semanticName,
    selected: selected?.name || "(none)",
  });

  // EARLY CHECK: Handle direct UK/US term mapping before any fuzzy logic
  // This prevents "fries" from being confused with prices or other items
  const ukUSMappings: Record<string, string> = {
    fries: "chips",
    soda: "fizzy drink",
    cookie: "biscuit",
    cookies: "biscuits",
  };

  const normalizedRaw = normalize(rawName);
  const directMapping = ukUSMappings[normalizedRaw];

  if (directMapping) {
    dlog("UK/US term detected, trying mapped term:", directMapping);

    // Try exact match with mapped term first
    const mappedExact =
      findItemExactInCategory(selected, directMapping) ||
      findItemExactGlobal(ctx, directMapping);
    if (mappedExact) {
      return typeof mappedExact === "object" && "item" in mappedExact
        ? mappedExact
        : { item: mappedExact, category: selected };
    }

    // Try contains match with mapped term
    const mappedContains =
      findItemContainsInCategory(selected, directMapping) ||
      findItemContainsGlobal(ctx, directMapping);
    if (mappedContains) {
      return typeof mappedContains === "object" && "item" in mappedContains
        ? mappedContains
        : { item: mappedContains, category: selected };
    }
  }

  const a = findItemExactInCategory(selected, rawName);
  if (a) return { item: a, category: selected };

  const b = findItemExactGlobal(ctx, rawName);
  if (b) return b;

  const c = findItemContainsInCategory(selected, rawName);
  if (c) return { item: c, category: selected };

  const d = findItemContainsGlobal(ctx, rawName);
  if (d) return d;

  const e = findItemExactInCategory(selected, semanticName);
  if (e) return { item: e, category: selected };

  const f = findItemExactGlobal(ctx, semanticName);
  if (f) return f;

  const g = findItemContainsInCategory(selected, semanticName);
  if (g) return { item: g, category: selected };

  const h = findItemContainsGlobal(ctx, semanticName);
  if (h) return h;

  if (typeof ctx.findItemByName === "function") {
    const x = coerceItemInfo(ctx.findItemByName(rawName));
    if (x) return x;
    const y = coerceItemInfo(ctx.findItemByName(semanticName));
    if (y) return y;
  }

  // Final fallback: fuzzy matching with HIGHER threshold to reduce false matches
  dlog("Trying fuzzy match...");

  // Increased threshold from 0.5 to 0.6 for better precision
  const STRICTER_THRESHOLD = 0.75;

  // Try fuzzy match in selected category first
  if (selected) {
    const fuzzyInCategory = findItemFuzzyInCategory(
      selected,
      rawName,
      STRICTER_THRESHOLD
    );
    if (fuzzyInCategory) {
      dlog("Fuzzy match found in category:", {
        item: fuzzyInCategory.item.name,
        score: fuzzyInCategory.score,
      });
      return { item: fuzzyInCategory.item, category: selected };
    }
  }

  // Try fuzzy match globally
  const fuzzyGlobal = findItemFuzzyGlobal(ctx, rawName, STRICTER_THRESHOLD);
  if (fuzzyGlobal) {
    dlog("Fuzzy match found globally:", {
      item: fuzzyGlobal.item.name,
      category: fuzzyGlobal.category.name,
      score: fuzzyGlobal.score,
    });
    return { item: fuzzyGlobal.item, category: fuzzyGlobal.category };
  }

  return null;
};

export const getSafeVariantId = (item: any, targetVariant: any) => {
  if (targetVariant?.id) return targetVariant.id;
  if (item?.variantlist?.length && item.variantlist[0]?.id) {
    return item.variantlist[0].id;
  }
  return undefined;
};
