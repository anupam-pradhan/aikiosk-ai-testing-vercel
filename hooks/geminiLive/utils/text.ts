// Text manipulation and
/**
 * Normalize text for fuzzy matching
 * Removes spaces, special chars, converts to lowercase
 * This allows "amigoburger" to match "Amigo Burger"
 */
export function normalize(str: string): string {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and") // Keep this specific replacement for '&'
    .replace(/\s+/g, '') // Remove ALL spaces for better matching
    .replace(/[^\w]/g, ''); // Keep only alphanumeric
}

export const isPluralMatch = (a: string, b: string) =>
  a === b || a === `${b}s` || `${a}s` === b;

export const tokenSet = (s: string) =>
  new Set(normalize(s).split(" ").filter(Boolean));

export const hasStrongTokenOverlap = (phrase: string, categoryName: string) => {
  const p = tokenSet(phrase);
  const c = tokenSet(categoryName);
  if (!p.size || !c.size) return false;

  let all = true;
  for (const t of c) {
    const singular = t.replace(/s$/, "");
    const plural = `${t}s`;
    if (!p.has(t) && !p.has(plural) && !p.has(singular)) {
      all = false;
      break;
    }
  }
  if (all) return true;

  for (const t of c) {
    const singular = t.replace(/s$/, "");
    const plural = `${t}s`;
    if (p.has(t) || p.has(plural) || p.has(singular)) return true;
  }
  return false;
};

export const buildSemanticSearchName = (rawName: string) => {
  const lowerName = normalize(rawName);

  const genericSuffixes = [
    "pizza",
    "pizzas",
    "burger",
    "burgers",
    "wrap",
    "wraps",
    "sub",
    "subs",
    "sandwich",
    "sandwiches",
    "meal",
    "meals",
    "combo",
    "combos",
    "box",
    "boxes",
    "milkshake",
    "milkshakes",
    "shake",
    "shakes",
    "drink",
    "drinks",
  ];

  let semanticLower = lowerName;
  for (const word of genericSuffixes) {
    const suffix = " " + word;
    if (semanticLower.endsWith(suffix)) {
      semanticLower = semanticLower.slice(0, -suffix.length).trim();
      break;
    }
  }

  return semanticLower || lowerName;
};

// UK English normalization - maps UK terms to common variants
export const normalizeUKEnglish = (text: string): string => {
  const ukToStandard: Record<string, string> = {
    chips: "fries",
    crisps: "chips",
    biscuit: "cookie",
    biscuits: "cookies",
    fizzy: "soda",
    fizzy_drink: "soda",
    courgette: "zucchini",
    aubergine: "eggplant",
    rocket: "arugula",
  };

  let normalized = text.toLowerCase();
  for (const [uk, standard] of Object.entries(ukToStandard)) {
    const regex = new RegExp(`\\b${uk}\\b`, "gi");
    normalized = normalized.replace(regex, standard);
  }
  return normalized;
};

// Filler words to ignore in token matching
const FILLER_WORDS = new Set([
  "in",
  "with",
  "and",
  "or",
  "the",
  "a",
  "an",
  "of",
  "on",
  "for",
]);

// Get meaningful tokens (excluding filler words)
export const getMeaningfulTokens = (text: string): string[] => {
  return normalize(text)
    .split(" ")
    .filter((token) => token && !FILLER_WORDS.has(token));
};

// Calculate token overlap similarity (0-1) with sequential matching
export const calculateTokenSimilarity = (text1: string, text2: string): number => {
  const tokens1 = getMeaningfulTokens(text1);
  const tokens2 = getMeaningfulTokens(text2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  let matches = 0;
  for (const token of set1) {
    if (set2.has(token)) {
      matches++;
    } else {
      // Check for plural variations
      if (set2.has(token + "s") || set2.has(token.replace(/s$/, ""))) {
        matches++;
      }
    }
  }

  // Calculate base score using max of tokens (better for asymmetric matches)
  // This helps when user says fewer words than the full item name
  const maxTokens = Math.max(tokens1.length, tokens2.length);
  const baseScore = matches / maxTokens;

  // Bonus for sequential token matching (e.g., "donner pita" matches "donner in pita")
  let sequentialMatches = 0;
  let token1Index = 0;
  
  for (const token2 of tokens2) {
    if (token1Index < tokens1.length) {
      const token1 = tokens1[token1Index];
      if (token1 === token2 || token1 + "s" === token2 || token1 === token2 + "s") {
        sequentialMatches++;
        token1Index++;
      }
    }
  }

  const sequentialBonus = sequentialMatches / Math.max(tokens1.length, 1);
  
  // Return weighted combination: 70% base score + 30% sequential bonus
  return baseScore * 0.7 + sequentialBonus * 0.3;
};

// Levenshtein distance algorithm
export const levenshteinDistance = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
};

// Calculate normalized Levenshtein similarity (0-1)
export const calculateLevenshteinSimilarity = (str1: string, str2: string): number => {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
};

// Combined fuzzy similarity score (0-1)
// Combines token overlap and Levenshtein distance
export const calculateFuzzySimilarity = (
  userInput: string,
  itemName: string
): number => {
  // Normalize both inputs
  const normalizedInput = normalize(normalizeUKEnglish(userInput));
  const normalizedItem = normalize(itemName);

  // Check for exact match after normalization
  if (normalizedInput === normalizedItem) return 1.0;

  // Check if one contains the other (helps with compound words like "cheeseburger")
  if (normalizedInput.replace(/\s/g, "") === normalizedItem.replace(/\s/g, "")) {
    return 0.95; // "cheese burger" vs "cheeseburger"
  }

  // Token-based similarity (weighted higher for word-level matches)
  const tokenScore = calculateTokenSimilarity(normalizedInput, normalizedItem);

  // Character-level Levenshtein similarity
  const levenScore = calculateLevenshteinSimilarity(normalizedInput, normalizedItem);

  // Weighted combination: 80% token overlap, 20% character similarity
  // Token overlap is more important for menu items with multiple words
  const combined = tokenScore * 0.8 + levenScore * 0.2;

  return combined;
};
