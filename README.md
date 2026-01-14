


## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Project Documentation

### 1. Overview

AI Kiosk Assistant is a voice-enabled self-service ordering kiosk for restaurants and fast-food outlets.

It combines:

- A React + Vite TypeScript frontend
- Live multimodal interaction powered by the **Gemini Live API** (`@google/genai`)
- A **MegaPOS**-compatible backend (vendor-specific `/api/fetch`, `/api/order`, `/api/version` endpoints)
- Optional **Stripe Terminal** card payments
- Optional **Capacitor** wrapper for an Android kiosk app

End users interact with the kiosk by:

1. Selecting items visually on a touch screen, **or**
2. Speaking to the kiosk using a microphone

The app turns speech into structured orders, handles menu browsing, builds the cart, and submits the order to a vendor-specific backend, supporting both cash and card flows and different device modes (`kiosk`, `largekiosk`, `pos`, `mobilekiosk`).

### 2. Tech Stack

**Frontend**

- React 19 (`react`, `react-dom`)
- React Router (`react-router-dom`)
- TypeScript
- Vite for dev/build (`vite`, `@vitejs/plugin-react`)
- TailwindCSS via CDN (see `index.html`)
- Global styles in `global.css`

**AI & Voice**

- `@google/genai` – Gemini Live API client
- Custom mic capture & streaming pipeline (`hooks/useAudioRecorder.ts`, `utils/audioUtils.ts`)
- Custom Live session hook (`hooks/useGeminiLive.ts`)

**Backend Integration**

- Vendor menu & order API (`services/api.ts`)
- UK address autocomplete via Ideal Postcodes (`services/addressUk.ts`)
- UK phone normalization (`services/phoneUk.ts`)
- Optional SMS OTP via Twilio-like service (`services/otp.ts`)

**Runtime & Packaging**

- Node.js (for local dev & builds)
- Vite dev server and bundler
- Capacitor (`capacitor.config.ts`) + `android/` for Android packaging

### 3. High-Level Architecture

#### 3.1 Entry Points

- `index.html`
  - Includes TailwindCSS CDN and import maps for React and `@google/genai`
  - Mounts React app at `<div id="root" />`
- `index.tsx`
  - Creates React root and renders `<App />` inside `React.StrictMode`.
- `App.tsx`
  - Wraps the app with:
    - `<VendorProvider>` – manages vendor configuration (API URL, terminal, etc.)
    - `<OrderProvider>` – manages menu, cart, checkout, and payment logic
  - Configures React Router routes:
    - `/` → `KioskLayout`
    - `/payment/processing` → `PaymentProcessingPage`
    - `/payment/failed` → `PaymentFailedPage`
  - All routes are gated by `<VendorGate>` (redirects to vendor setup if not configured).

#### 3.2 Contexts

**VendorContext** (`vendor/VendorContext.tsx`)

- State:
  - `vendor: VendorModel | null` (includes `apiUrl`, `terminal`, `cardPayment`, `vendorName`)
  - `isVendorReady: boolean`
- Persistence: local storage (`vendor/vendorStorage.ts`)
- API:
  - `setVendor(vendor)` – sets and persists vendor
  - `resetVendor()` – clears vendor and local storage
  - `useVendor()` – hook for accessing vendor state

**OrderContext** (`context/OrderContext.tsx`)

- Manages:
  - Menu data (`MainCategory`, `Categorylist`, `Itemlist`, `Variantlist`, `Modifierlist` from `types.ts`)
  - Cart (`CartItem[]`)
  - Checkout details (service, name, phone, address, timing, etc.)
  - Payment method and status
  - Order submission and terminal payment
- Exposes helpers such as:
  - `addToCart`, `removeFromCart`, `updateCartItemQty`, `clearCart`
  - `startItemFlow`, `selectVariant`, `toggleModifier`, `updateModifierQty`, `confirmItem`, `cancelFlow`, `goBack`
  - `setService`, `setCheckoutField`, `resetCheckout`
  - `placeOrder(paymentOverride?)`, `cancelPayment`, `setPaymentMethod`
- Integrates with:
  - `services/api.ts` (`fetchMenu`, `sendOrder`)
  - `config/mode.ts` (APP_MODE flags and payment behavior)
  - Vendor config (terminal, apiUrl, fees) via `/api/version`.

### 4. Voice, Audio, and Gemini Live

#### 4.1 Audio Capture Pipeline (`hooks/useAudioRecorder.ts`)

- Captures microphone audio and emits base64-encoded Int16 PCM frames to a callback.
- Two modes:
  - Preferred: `AudioWorklet` (`MicProcessor`) capturing Float32 frames.
  - Fallback: `ScriptProcessorNode` for environments without AudioWorklet.
- Uses helpers from `utils/audioUtils.ts`:
  - `float32ToInt16`, `int16ToBase64`
  - `resampleFloat32` – resamples to 16kHz input
  - `decodeAudioData` / `base64ToUint8Array` – for audio playback of model responses.

#### 4.2 Gemini Live Hook (`hooks/useGeminiLive.ts`)

- Wraps the Gemini Live API and exposes:
  - `isConnected`, `isSpeaking`, `logs`
  - `connect()`, `disconnect()`
- Integrates with `useOrder` via tools:

  - `addToCart(itemName, variantName?, quantity?, modifiers?)`
  - `setPaymentMethod(paymentMethod)`
  - `clearCart()`
  - `checkout(paymentMethod?)`
  - `changeCategory(categoryName)`

- Handles:
  - Audio output playback in an `AudioContext`
  - Deduplication of tool calls (especially `addToCart`)
  - Simple latency tracking between user speech and model response.

### 5. UI & Component Structure

- `components/KioskLayout.tsx`
  - Main kiosk UI for `/` route.
  - Desktop layout:
    - `CategorySidebar` (left)
    - `ItemGrid` (center)
    - `CartSidebar` (right)
  - Mobile layout:
    - Top bar with MEGAPOS branding and pill buttons (Speak, Call, Cart, Refresh)
    - Views: categories, items, cart
  - Integrates voice toggle via `useGeminiLive`.
  - Manages welcome overlay and inactivity timer (20s) that resets back to welcome.

- `components/CartSidebar.tsx`
  - Displays cart items, edit/delete actions, and quantity overlay.
  - Shows order success modal with order number and optional QR.
  - Shows card payment overlays for `processing` and `failed` states.
  - Footer:
    - Total
    - Payment method toggle (Cash/Card) respecting `config.cashOnly`
    - Finish button that triggers checkout or card flow depending on mode.

- `components/CheckoutFlow.tsx`
  - Used when `NEEDS_CHECKOUT_FLOW` is true (`APP_MODE` is `pos` or `mobilekiosk`).
  - Two-step flow: service selection (Delivery/Collection) then details.
  - UK-specific validation:
    - Phone number validation
    - Postcode-driven address suggestions via `getAddressList`.
  - Optional OTP flow when `REQUIRES_OTP` is true (`mobilekiosk` mode).
  - Lets customer pick time, payment type, and confirm details before sending order.

- `components/ProductGrid.tsx`
  - Displays items in the selected category as cards with image, description, and price.
  - Clicking an item calls `startItemFlow`.

- `components/VariantSelector.tsx`
  - Lets user pick a variant for the active item.
  - Shows variant name and price.

- `components/ModifierSelector.tsx`
  - Lists modifier groups for the active variant.
  - Supports single-select and multi-select modifiers with quantity controls.
  - `Previous` / `Next` buttons for navigating the item flow.

- `components/PaymentProcessingPage.tsx`
  - Route `/payment/processing`.
  - Triggers `placeOrder("card")` once on mount and redirects to `/` or `/payment/failed`.
  - Shows amount and cancel payment button.

- `components/PaymentFailedPage.tsx`
  - Route `/payment/failed`.
  - Shows failure message, amount, and actions:
    - Try Again (restarts processing)
    - Back to Cart
    - Clear Cart.

### 6. Menu & Order API Integration

- `services/api.ts`
  - `fetchMenu(baseUrl?)` → `https://${baseUrl}/api/fetch`
  - `sendOrder(order, baseUrl?)` → `https://${baseUrl}/api/order/`
  - Payload shape matches MegaPOS backend expectations, including `listitem` with modifiers.

### 7. UK Address, Phone & OTP

- `services/addressUk.ts`
  - `getAddressList(q)` → Ideal Postcodes autocomplete API.
- `services/phoneUk.ts`
  - `normalizeUkPhone(input)` → E.164 normalization using `libphonenumber-js`.
- `services/otp.ts`
  - `sendSmsOtp({ phoneE164, domain, otp })` → Twilio-like SMS endpoint using `VITE_MEGAPOS_SMS_BEARER`.

### 8. App Modes & Configuration (`config/mode.ts`)

- `APP_MODE: "kiosk" | "largekiosk" | "pos" | "mobilekiosk"` from `VITE_MODE`.
- Flags:
  - `IS_KIOSK_LIKE` – regular kiosk/largekiosk
  - `NEEDS_CHECKOUT_FLOW` – POS and mobile kiosk
  - `REQUIRES_OTP` – mobile kiosk only
  - `IS_MOBILEKIOSK` – mobile kiosk only

- Payment server mode in `OrderContext.tsx`:
  - `VITE_PAYMENT_MODE` → `PAYMENT_BASE_URL`
  - `live` → hosted Stripe payment server
  - otherwise → local dev (`http://localhost:4242`).

### 9. Vendor Onboarding

- `vendor/SetupVendorPage.tsx`
  - Prompts for Vendor ID.
  - Uses `getVendorById(vendorId)` in `vendor/vendorApi.ts` to look up vendor from Firebase Realtime Database (`VITE_FIREBASE_DB_URL`).
  - On success, saves vendor via `setVendor` and reloads UI.

- `vendor/VendorGate.tsx`
  - If vendor not ready → shows loading.
  - If vendor without `apiUrl` → shows setup page.
  - Otherwise renders the kiosk children.

### 10. Environment Variables

Typical `.env.local` variables:

- `GEMINI_API_KEY` – Gemini Live API key
- `VITE_FIREBASE_DB_URL` – Firebase Realtime Database base URL
- `VITE_IDEAL_POSTCODES_KEY` – Ideal Postcodes API key
- `VITE_MEGAPOS_SMS_BEARER` – bearer token for SMS endpoint
- `VITE_MODE` – `kiosk | largekiosk | pos | mobilekiosk`
- `VITE_PAYMENT_MODE` – `live` or other (for local Stripe server)
- `VITE_VERSION_URL` – optional override for version endpoint

### 11. Running & Building (Summary)

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`

For Android:

1. Build web: `npm run build`
2. Sync: `npx cap sync android`
3. Open project in Android Studio: `npx cap open android`
