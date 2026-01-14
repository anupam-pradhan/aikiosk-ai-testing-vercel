// Dynamic Prompt Builder – State Aware & Token Optimized

import {
  coreLayer,
  operationalLogicLayer,
  browsingLayer,
  orderingLayer,
  cartLayer,
  checkoutLayer,
  examplesLayer,
} from "./promptLayers";

export type AppState = "BROWSING" | "ORDERING" | "CART" | "CHECKOUT";
export type WizardStep = "BROWSE" | "VARIANT" | "MODIFIER";

export interface PromptContext {
  wizardStep: WizardStep;
  cartLength: number;
  cashPopupState: string;
}

/* ---------------- App State Detector ---------------- */

export function detectAppState(context: PromptContext): AppState {
  if (context.cashPopupState !== "idle") return "CHECKOUT";

  if (context.wizardStep === "VARIANT" || context.wizardStep === "MODIFIER")
    return "ORDERING";

  if (context.cartLength > 0 && context.wizardStep === "BROWSE") return "CART";

  return "BROWSING";
}

/* ---------------- Prompt Builder ---------------- */

export function buildOptimizedPrompt(
  categoryNames: string,
  menuSummary: string,
  context: PromptContext,
  includeExamples: boolean = false
): string {
  const state = detectAppState(context);
  const layers: string[] = [];

  // Core layer is always present
  layers.push(coreLayer());
  // Operational Logic is always present (Multi-item, Queues, Smart Tools)
  layers.push(operationalLogicLayer());

  // Context header
  layers.push(`
Context:
- Valid Categories: [${categoryNames}]
- Menu Snapshot: [${menuSummary}]
`);

  // Load only relevant behavior layer
  switch (state) {
    case "BROWSING":
      layers.push(browsingLayer());
      break;

    case "ORDERING":
      layers.push(orderingLayer());
      break;

    case "CART":
      layers.push(cartLayer());
      break;

    case "CHECKOUT":
      layers.push(checkoutLayer());
      break;
  }

  // Optional examples
  if (includeExamples) {
    layers.push(examplesLayer());
  }

  return layers.join("\n");
}

/* ---------------- Default Boot Prompt ---------------- */

export function buildSystemInstructions(
  categoryNames: string,
  menuSummary: string
): string {
  return buildOptimizedPrompt(
    categoryNames,
    menuSummary,
    {
      wizardStep: "BROWSE",
      cartLength: 0,
      cashPopupState: "idle",
    },
    false
  );
}

/* ---------------- TURBO MODE: Minimal Prompt for Speed ---------------- */

export function buildTurboPrompt(
  categoryNames: string,
  menuSummary: string
): string {
  return `You are a UK restaurant kiosk assistant. Be brief and efficient.

RULES:
- British English only (chips not fries, pounds and pence)
- Keep responses to 1-2 sentences max
- Use contractions (I've, it's, can't)
- Wait for tool responses before confirming

CATEGORIES: ${categoryNames}

MENU:
${menuSummary}

TOOLS:
- addToCart: Add items. Returns SELECT_VARIANT or SELECT_MODIFIERS if choices needed
- selectVariant: Pick size/meal option when prompted
- toggleModifier: Add/remove toppings
- checkout: Complete order (ask cash/card first)
- stopListening: When user says "stop"

FLOW:
1. User orders → addToCart
2. If SELECT_VARIANT → ask "Meal or no meal?" / "What size?"
3. If SELECT_MODIFIERS → ask "Any toppings?"
4. When done → "Cash or card?"
5. checkout with payment method

Be quick. Be helpful. Done.`;
}
