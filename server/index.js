import "dotenv/config";
import express from "express";
import cors from "cors";
import Stripe from "stripe";

const app = express();
app.use(cors());
app.use(express.json());

const { STRIPE_SECRET_KEY } = process.env;
if (!STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY in server/.env");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// quick health check
app.get("/health", (req, res) => res.json({ ok: true }));

// Stripe Terminal SDK requires a short-lived connection token from your server
app.post("/terminal/connection_token", async (req, res) => {
  try {
    const token = await stripe.terminal.connectionTokens.create();
    res.json({ secret: token.secret });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Create a card_present PaymentIntent (used for Terminal payments)
app.post("/terminal/create_intent", async (req, res) => {
  try {
    const { amount, currency = "gbp", orderId } = req.body;

    if (!amount || !currency || !orderId) {
      return res
        .status(400)
        .json({ error: "amount, currency, orderId required" });
    }

    const pi = await stripe.paymentIntents.create({
      amount: Number(amount), // minor units
      currency: String(currency).toLowerCase(),
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      metadata: { orderId: String(orderId || "") },
    });

    res.json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// DEV helper: simulate a tap on a SIMULATED reader (server-driven)
app.post("/terminal/simulate_tap", async (req, res) => {
  try {
    const { readerId } = req.body;
    if (!readerId) return res.status(400).json({ error: "readerId required" });

    const reader =
      await stripe.testHelpers.terminal.readers.presentPaymentMethod(readerId, {
        card: { number: "4242424242424242", exp_month: 12, exp_year: 2030 },
      });

    res.json({ ok: true, reader });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.listen(4242, "0.0.0.0", () => {
  console.log("Kiosk backend-lite running on http://0.0.0.0:4242");
});
