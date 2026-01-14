// Tool declarations for Gemini AI

import { Type, FunctionDeclaration } from "@google/genai";

export const tools: FunctionDeclaration[] = [
  {
    name: "stopListening",
    description:
      "Stop the microphone and end the voice interaction when the user says 'stop', 'stop listening', 'turn off mic', or similar commands.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "getMenuDetails",
    description:
      "Look up the exact price and details of a specific item when the user asks 'How much is X?', 'Price of X', or 'What is in X?'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: {
          type: Type.STRING,
          description: "The name of the item to look up.",
        },
      },
      required: ["itemName"],
    },
  },
  {
    name: "getModifierDetails",
    description:
      "Look up the price and details of a specific modifier/topping for an item. Use when user asks about modifier pricing like 'How much is extra cheese?', 'Is the drink free?', or 'How much for extra toppings?'",
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: {
          type: Type.STRING,
          description: "The name of the item that has the modifier.",
        },
        modifierName: {
          type: Type.STRING,
          description: "The name of the modifier/topping to look up (e.g., 'Extra Cheese', 'Drink', 'Onion').",
        },
      },
      required: ["itemName", "modifierName"],
    },
  },
  {
    name: "editCartItem",
    description:
      "Edit an existing item in the cart. Use this to add, remove, or update modifiers/notes on an item ALREADY in the cart. Supports setting specific quantities for modifiers.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: {
          type: Type.STRING,
          description: "Name of the item in cart to edit. Can be partial (e.g., 'burger' matches 'Amigo Burger').",
        },
        variantName: {
          type: Type.STRING,
          description: "New variant to switch to (e.g. 'With Meal', 'Large'). Leave empty if not changing variant.",
        },
        modifiersToAdd: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Deprecated: Use modifierUpdates for more control. Simple list of modifiers to add.",
        },
        modifierUpdates: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Name of modifier" },
                    quantity: { type: Type.INTEGER, description: "Target quantity (0 to remove, 1 for single, 2 for double, etc.)" }
                }
            },
            description: "List of specific updates to apply. Example: [{name: 'Cucumber', quantity: 1}, {name: 'Onions', quantity: 0}]"
        },
        note: {
          type: Type.STRING,
          description: "Special instruction/note to update.",
        },
      },
      required: ["itemName"],
    },
  },
  {
      name: "confirmSelection",
      description: "Finalize the current item customization and add it to cart. Use when user says 'that's it', 'add it', 'done', 'looks good', or 'next'. Mimics the 'Add to Cart' / 'Next' button.",
      parameters: {
          type: Type.OBJECT,
          properties: {},
      }
  },
  {
    name: "addToCart",
    description:
      "Add a specific item to the cart. If the user is actually asking for a category, the system will switch category instead of adding.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: {
          type: Type.STRING,
          description: "Name of the item (e.g., Margherita Pizza)",
        },
        variantName: {
          type: Type.STRING,
          description: `
Size or variant label exactly as shown in the menu.

Examples:
- Pizza sizes: "9 Inch", "12 Inch"
- Burger / box / sub: "With Meal", "No Meal", "With fries", "Without meal"
- Drinks / milkshakes: "Small", "Regular", "Large"

If the guest does NOT clearly specify this, leave variantName empty
and let the kiosk ask them on screen.
`,
        },
        quantity: {
          type: Type.INTEGER,
          description: "Quantity of items to add. Default is 1.",
        },
        modifiers: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'List of modifiers/toppings requested. Pass empty array if user explicitly says "no toppings". Omit this field if the user does not mention toppings at all.',
        },
        note: {
          type: Type.STRING,
          description:
            "Special instructions like 'no onion', 'extra spicy', or 'well done'.",
        },
        mode: {
          type: Type.STRING,
          enum: ["add", "show"],
          description:
            "Set to 'show' if the user just wants to see/highlight the item (e.g., 'Show me X'). Set to 'add' if they intent to buy it (default).",
        },
        allowDuplicate: {
            type: Type.BOOLEAN,
            description: "Set to true if the user explicitly confirms adding a duplicate item (e.g., 'Yes, add another', 'I want two'). Default is false, which triggers a check.",
        }
      },
      required: ["itemName"],
    },
  },
  {
    name: "setPaymentMethod",
    description: 'Set the payment method for the order to "cash" or "card".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        paymentMethod: {
          type: Type.STRING,
          enum: ["cash", "card"],
        },
      },
      required: ["paymentMethod"],
    },
  },
  {
    name: "clearCart",
    description: "Remove all items from the cart.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "showCart",
    description: "Get a text summary of the current cart contents and total price.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "checkout",
    description:
      "Finish the order and submit it. If paymentMethod is provided, use that method.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        paymentMethod: {
          type: Type.STRING,
          description: 'Payment method: "cash" or "card".',
          enum: ["cash", "card"],
        },
      },
    },
  },
  {
    name: "showPaymentOptions",
    description: `
Show the payment method selection screen (cash/card options).
CRITICAL: Call this BEFORE asking "Cash or card?" to ensure payment UI is visible.

MANDATORY USE CASES:
1. User says "no" / "that's all" / "I'm done" after being asked about more items
2. User says "checkout" / "pay now" / "I'm ready to pay"
3. Before EVER asking "Would you like to pay by card or cash?"

FLOW:
1. Call showPaymentOptions() 
2. Wait for response "PAYMENT_OPTIONS_SHOWN"
3. ONLY THEN ask about payment method

This prevents the screen desync where AI asks about payment but screen shows items.
`,
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "startItemFlow",
    description: `
Start the product customization wizard for a specific item. Use this when:
1) User wants to customize an item ("customize my burger", "I want to add toppings to pizza")
2) You need to guide them through variant/modifier selection step-by-step
3) An item has multiple options and you want to show them interactively

This opens the selection screen for the item, allowing the user to choose variants and modifiers.
DO NOT use addToCart if the user clearly wants to customize - use this instead.
`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: {
          type: Type.STRING,
          description: "Name of the item to start customizing (e.g., 'Amigo Burger', 'Margherita Pizza')",
        },
      },
      required: ["itemName"],
    },
  },
  {
    name: "selectVariant",
    description: `
Select a specific variant (size/meal option) for the currently active item in the wizard.
Use this ONLY when:
1) The variant selection screen is currently active (you'll know from previous tool responses)
2) User specifies their choice ("Large", "With Meal", "12 Inch", etc.)

Examples:
- After showing burger options, user says "with meal" → selectVariant({ variantName: "With Meal" })
- After showing pizza sizes, user says "large" → selectVariant({ variantName: "12 Inch" })

PREREQUISITE: An item wizard must be active. If not, use startItemFlow first.
`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        variantName: {
          type: Type.STRING,
          description: "Exact name of the variant to select (e.g., 'With Meal', 'No Meal', 'Small', 'Large', '9 Inch', '12 Inch')",
        },
      },
      required: ["variantName"],
    },
  },
  {
    name: "toggleModifier",
    description: `
Add or remove a specific modifier/topping for the currently active item in the wizard.
Use this when:
1) The modifier selection screen is currently active (you'll know from previous tool responses)
2) User wants to add/remove specific toppings or extras during customization
3) User says "add extra cheese", "no onions", "with olives", etc. while customizing

Examples:
- User customizing burger says "add extra cheese" → toggleModifier({ modifierName: "Extra Cheese" })
- User says "remove onions" → toggleModifier({ modifierName: "Onions" })
- User says "add pepperoni" → toggleModifier({ modifierName: "Pepperoni" })

PREREQUISITE: The modifier screen must be active. If not active, this will fail.
`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        modifierName: {
          type: Type.STRING,
          description: "Name of the modifier/topping to toggle (e.g., 'Extra Cheese', 'Onions', 'Pepperoni', 'Bacon')",
        },
        quantity: {
          type: Type.INTEGER,
          description: "Optional quantity to set (e.g., 2 for double, 0 to remove). If omitted, defaults to 1 for add or 0 for remove (toggle logic).",
        },
      },
      required: ["modifierName"],
    },
  },
  {
    name: "updateModifierQuantity",
    description: `
Update the quantity of an already-selected modifier during customization.
Use this when user wants multiple of the same modifier:
- "Two extra cheese"
- "Double bacon"
- "Make that 3 shots"

PREREQUISITES:
1) Modifier screen must be active
2) The modifier must already be selected/toggled on

This increases or decreases the quantity of a selected modifier.
`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        modifierName: {
          type: Type.STRING,
          description: "Name of the modifier to update quantity for",
        },
        quantity: {
          type: Type.INTEGER,
          description: "New total quantity for this modifier (e.g., 2 for double, 3 for triple)",
        },
      },
      required: ["modifierName", "quantity"],
    },
  },
  {
    name: "changeCategory",
    description: `
Switch the menu category view.

Use this tool in two cases:
1) When the guest explicitly asks to see a category
   (e.g. "show drinks", "open pizzas", "go to burgers").
2) When a requested item is not found, but the item name
   clearly contains a food type that matches a category
   (e.g. "xyz cake" → show the Cake category).
`,
    parameters: {
      type: Type.OBJECT,
      properties: {
        categoryName: {
          type: Type.STRING,
          description: `
Name of category to switch to (e.g. "Pizza", "Burger", "Wraps", "Drinks", "Cake").
Use the closest matching category from the menu.
`,
        },
      },
      required: ["categoryName"],
    },
  },
  {
    name: "removeFromCart",
    description: "Remove a specific item from the cart. Use when user says 'remove the burger', 'delete the pizza', 'I don't want the coke'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: {
          type: Type.STRING,
          description: "Name of the item to remove (e.g. 'margherita', 'burger').",
        },
      },
      required: ["itemName"],
    },
  },
  {
    name: "updateCartItemQuantity",
    description: "Update the quantity of an item already in the cart. Use when user says 'make that 2 burgers', 'add another coke', 'remove one pizza'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemName: {
          type: Type.STRING,
          description: "Name of the item to update.",
        },
        quantity: {
          type: Type.INTEGER,
          description: "The NEW total quantity desired (e.g. 2, 3). If user says 'add another', calculate current + 1. If 0, removes item.",
        },
      },
      required: ["itemName", "quantity"],
    },
  },
  {
    name: "showModifierShowcase",
    description: `
Smooth auto-scroll through all available modifiers to show the user all topping options.
Use this when:
1) Modifier screen is active
2) User asks to see all options ("show me everything", "what toppings do you have?", "let me see all")
3) You want to help user see all available choices before they decide

Best Practice:
- Ask first: "We have lots of toppings, want to see them all?"
- If user says yes, call this tool
- After calling, wait 3-4 seconds, then say: "That's everything! What would you like?"

DO NOT use randomly or constantly - only when it adds value.
`,
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
];
