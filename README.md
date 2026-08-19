# CareNest

React + Vite home services app for customers, providers, and operations teams.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run test:release
npm run test:load -- 100 20
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
FAPSHI_LIVE_API_URL="https://api.fapshi.com/initiate-pay"
FAPSHI_LIVE_API_USER="your-live-user-id"
FAPSHI_LIVE_SECRET_KEY="your-live-secret"
```

Keep the `FAPSHI_*_SECRET_KEY` values in your Vercel project settings, not in `VITE_*`.

`FAPSHI_PAYMENT_FLOW="direct"` sends the Mobile Money approval prompt to the phone number saved on the customer account, so CareNest does not redirect the customer to Fapshi checkout. Direct Pay must be enabled by Fapshi before using it in live mode.

### Fapshi payment verification

Set your Fapshi service webhook URL to `https://your-domain.vercel.app/api/fapshi-webhook`. Generate a webhook secret, set it in Fapshi, and store the same value as `FAPSHI_WEBHOOK_SECRET` in Vercel. Add `FIREBASE_SERVICE_ACCOUNT_JSON` in Vercel as a single-line Firebase service-account JSON value. The webhook checks Fapshi's `x-wh-secret` header, then verifies every callback by querying Fapshi with server-side credentials and matching its transaction ID, order ID, and amount before marking a CareNest order as `Paid` (or `Failed`).

## SMS Payment Verifier

CareNest includes a no-billing private Android owner app skeleton. It reads MTN/Orange payment SMS messages from your phone, signs in with the CareNest admin account, and uses Firestore directly under admin security rules.

The verifier stores each SMS in `paymentSmsReceipts` and marks an order `Paid` only when it finds one clear matching submitted order. If the SMS is ambiguous, it stores the receipt as `needs_review` for admin follow-up.

### Private Android Verifier

The `android-verifier/` folder contains a private Android app skeleton for the owner phone. It requests SMS permission, watches incoming payment SMS messages, parses amount/reference/sender details, and writes to Firestore through the signed-in admin account.

Before building the APK in Android Studio:

1. Install Android Studio and a JDK.
2. Open the `android-verifier/` folder.
3. Copy `android-verifier/local.properties.example` to `android-verifier/local.properties`.
4. Set `firebase.projectId` and `firebase.apiKey` from your web app Firebase config.
5. Build and install the APK only on the owner phone.
6. Open the app and sign in with the CareNest admin account.

Do not publish this app publicly unless you redesign it around Play Store SMS permission rules. It is intended as a private owner-phone tool.
