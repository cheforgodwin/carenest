# CareNest

React + Vite home services app for customers, providers, and operations teams.

## Scripts

```bash
npm install
npm run dev
npm run build
```

## Environment Variables

Copy `.env.example` to `.env` locally and add your Firebase values. In Vercel, add the same `VITE_FIREBASE_*` variables in Project Settings.

For manual Mobile Money receiving numbers:

```bash
VITE_PAYMENT_MTN_NUMBER="+237 6XX XXX XXX"
VITE_PAYMENT_MTN_NAME="CareNest"
VITE_PAYMENT_ORANGE_NUMBER="+237 6XX XXX XXX"
VITE_PAYMENT_ORANGE_NAME="CareNest"
```

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
