// Category matching and inference utilities

import { normalize, isPluralMatch, hasStrongTokenOverlap, tokenSet } from "./text";

export const findCategoryByNameLoose = (ctx: any, phrase: string) => {
  const lower = normalize(phrase);
  const cats = ctx.menu?.categorylist || [];
  if (!cats.length) return null;

  const direct =
    cats.find((c: any) => isPluralMatch(lower, normalize(c.name))) || null;
  if (direct) return direct;

  const contains =
    cats.find((c: any) => {
      const cLower = normalize(c.name);
      return lower.includes(cLower) || cLower.includes(lower);
    }) || null;
  if (contains) return contains;

  const tokenMatch =
    cats.find((c: any) => hasStrongTokenOverlap(lower, c.name)) || null;

  return tokenMatch;
};

export const isLikelyPureCategoryRequest = (
  phrase: string,
  categoryName: string
) => {
  const p = normalize(phrase);
  const c = normalize(categoryName);

  if (isPluralMatch(p, c)) return true;

  const pTokens = p.split(" ").filter(Boolean);
  const cTokens = c.split(" ").filter(Boolean);

  if (pTokens.length === cTokens.length && p === c) return true;

  const browseVerbs = new Set([
    "show",
    "open",
    "go",
    "see",
    "browse",
    "view",
  ]);
  if (
    pTokens.length === cTokens.length + 1 &&
    browseVerbs.has(pTokens[0]) &&
    isPluralMatch(pTokens.slice(1).join(" "), c)
  ) {
    return true;
  }

  return false;
};

export const inferCategoryFromItemPhrase = (ctx: any, phrase: string) => {
  const lower = normalize(phrase);
  const cats = ctx.menu?.categorylist || [];
  if (!cats.length) return null;

  const strong =
    cats.find((c: any) => hasStrongTokenOverlap(lower, c.name)) || null;
  if (strong) return strong;

  return cats.find((c: any) => lower.includes(normalize(c.name))) || null;
};

export const scoreCategoryMatch = (phrase: string, categoryName: string) => {
  const p = normalize(phrase);
  const c = normalize(categoryName);
  if (!p || !c) return 0;

  if (isPluralMatch(p, c)) return 100;
  if (p.includes(c) || c.includes(p)) return 60;

  const pTokens = new Set(p.split(" ").filter(Boolean));
  const cTokens = c.split(" ").filter(Boolean);

  let hits = 0;
  for (const t of cTokens) {
    const singular = t.replace(/s$/, "");
    const plural = `${t}s`;
    if (pTokens.has(t) || pTokens.has(singular) || pTokens.has(plural)) {
      hits++;
    }
  }

  if (hits === 0) return 0;
  return 10 + hits * 10;
};

export const inferClosestCategoryFromAnyPhrase = (ctx: any, phrase: string) => {
  const cats = ctx.menu?.categorylist || [];
  if (!cats.length) return null;

  let best: any = null;
  let bestScore = 0;

  for (const c of cats) {
    const s = scoreCategoryMatch(phrase, c.name);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  return bestScore > 0 ? best : null;
};
