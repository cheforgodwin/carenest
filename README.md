# CareNest

React + Vite home services app for customers, providers, and operations teams.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run test:release
npm run test:load
```

The load test uses isolated Firebase Auth and Firestore emulators to perform concurrent signup, profile creation, booking creation, and login. The numbers are total users and concurrency. Never point synthetic load at production.

Review `docs/operations-runbook.md` and `docs/e2e-checklist.md` before launch.

## Environment Variables

Copy `.env.example` to `.env` locally and add your Firebase values. In Vercel, add the same `VITE_FIREBASE_*` variables in Project Settings.

For manual Mobile Money receiving numbers:

```bash
VITE_PAYMENT_MTN_NUMBER="+237 6XX XXX XXX"
VITE_PAYMENT_MTN_NAME="CareNest"
VITE_PAYMENT_ORANGE_NUMBER="+237 6XX XXX XXX"
VITE_PAYMENT_ORANGE_NAME="CareNest"
```

For secure Fapshi integration with Vercel, use server-side env vars and the sandbox mode before going live:

```bash
FAPSHI_MODE="sandbox"
FAPSHI_PAYMENT_FLOW="direct"
FAPSHI_SANDBOX_API_URL="https://sandbox.fapshi.com/initiate-pay"
FAPSHI_SANDBOX_API_USER="your-sandbox-user-id"
FAPSHI_SANDBOX_SECRET_KEY="your-sandbox-secret"
FAPSHI_LIVE_API_URL="https://live.fapshi.com/initiate-pay"
FAPSHI_LIVE_API_USER="your-live-user-id"
FAPSHI_LIVE_SECRET_KEY="your-live-secret"
```

Keep the `FAPSHI_*_SECRET_KEY` values in your Vercel project settings, not in `VITE_*`.

`FAPSHI_PAYMENT_FLOW="direct"` sends the Mobile Money approval prompt to the Mobile Money number entered at checkout (or the saved profile number when no override is entered), so CareNest does not redirect the customer to Fapshi checkout. Direct Pay must be enabled by Fapshi before using it in live mode.

### Fapshi payment verification

Set your Fapshi service webhook URL to `https://carenest237.com/api/fapshi-webhook`. Store `FIREBASE_SERVICE_ACCOUNT_JSON` only in server-side environment settings. Each webhook independently queries Fapshi with server credentials and matches transaction ID, order ID, customer ID, amount and environment before updating payment status. A callback body or secret header alone is never proof of payment.

### Payment prompt diagnostics

`node --env-file=<server-env-file> scripts/production-payment-smoke.mjs` is read-only by default: it checks configuration and balance authentication without creating an order or requesting money. Never treat a successful balance check as proof that Direct Pay is enabled or that a phone prompt arrived.

Production must use `FAPSHI_MODE=live`, `FAPSHI_PAYMENT_FLOW=direct`, the approved collections service credentials, and `https://live.fapshi.com/initiate-pay`. CareNest rejects hosted/unknown flow settings before contacting Fapshi because its checkout does not follow a hosted payment URL.

A successful `/api/payments` response is HTTP 202 with `accepted: true`; the transaction reference is stored on the order. It does not mean the customer approved payment. Use server verification to distinguish PENDING, FAILED and SUCCESSFUL. Do not reset an unknown payment lock just to trigger another prompt.

The optional live diagnostic requires `CARENEST_ALLOW_LIVE_PAYMENT_TEST=1`, `CARENEST_PAYMENT_TEST_PHONE`, and a unique `CARENEST_PAYMENT_TEST_ID`. It sends exactly one 100 XAF request for that test ID, to an explicitly authorized phone, through the real `/api/payments` endpoint. It retains the order and transaction evidence, prevents dispatching the same test twice, and never fabricates a successful callback. Run it only after the phone owner approves the test.

For credential-safe build diagnostics, set `CARENEST_PAYMENT_DIAGNOSTICS=1` for a single deployment build. Only safe configuration metadata, masked phone suffixes and recent order/payment statuses are logged. Sensitive Vercel variables export as `[SENSITIVE]`; an exported placeholder is not evidence of a broken runtime setting.

New checkouts require the customer to select MTN MoMo or Orange Money. The current validated `paymentNetwork` takes priority over the saved network and controls Fapshi's explicit `medium` (`mobile money` / `orange money`). Existing orders without a network retain Fapshi automatic detection. `customerPhone` remains the customer's contact number; `paymentPhone` stores the normalized payer number for the current attempt. The server validates payment overrides and falls back to the saved payer number, then the contact number for older orders.

Before retrying an order with a transaction reference, the server independently reconciles that transaction with Fapshi. Only a confirmed FAILED or EXPIRED result permits an atomic replacement with a new attempt. Pending, successful, and unknown outcomes block retries. Retired references remain recorded so late callbacks or recovery searches cannot bind an old transaction to the new attempt. Only verified status polling or webhooks can mark an order Paid.

For an authorized 100 XAF live diagnostic, `CARENEST_PAYMENT_TEST_NETWORK=mtn` or `orange` selects the intended network. Sandbox success verifies integration behavior, not live operator delivery. A live Orange test still requires an authorized Orange phone and confirmation from its owner.
