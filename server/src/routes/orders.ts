import { Router, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import { authorizeCheckout, CheckoutError, startCheckout } from "../orders/checkout.js";
import type { PayPalClient } from "../paypal/client.js";

// Checkout endpoints. The PayPal Buttons in the client call these: POST /
// from createOrder, POST /:id/authorize from onApprove. PayPal itself is only
// ever called from the server.

/** `getPayPal` is resolved per request so the API starts without PayPal configured. */
export function createOrdersRouter(getPayPal: () => PayPalClient) {
  const router = Router();
  router.use(requireAuth);

  async function handle(res: Response, run: (paypal: PayPalClient) => Promise<unknown>, status = 200) {
    let paypal: PayPalClient;
    try {
      paypal = getPayPal();
    } catch (err) {
      console.error((err as Error).message);
      res.status(503).json({ error: "Payments aren't available right now", code: "PAYPAL_NOT_CONFIGURED" });
      return;
    }
    try {
      res.status(status).json(await run(paypal));
    } catch (err) {
      if (err instanceof CheckoutError) {
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  }

  // POST /api/orders  { listingId }  (buyer) — starts checkout, returns { orderId, paypalOrderId }.
  router.post("/", (req, res) => handle(res, (paypal) => startCheckout(paypal, req.user!.id, req.body?.listingId), 201));

  // POST /api/orders/:id/authorize  (the order's buyer) — after PayPal approval. Returns { order }.
  router.post("/:id/authorize", (req, res) =>
    handle(res, async (paypal) => ({ order: await authorizeCheckout(paypal, req.user!.id, req.params.id) })),
  );

  return router;
}
