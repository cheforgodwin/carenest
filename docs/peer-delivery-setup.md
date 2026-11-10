# Peer-to-peer delivery setup

Peer deliveries use authenticated API routes and the Firebase Admin SDK. The browser does not read or write `peerDeliveries`, invitation hashes, audit records, or payment state directly; the Firestore rules deny client access to those collections.

## Required deployment configuration

Set these server-side environment variables in the deployment environment before enabling requests:

- `GOOGLE_MAPS_SERVER_API_KEY`: a server key restricted to the Places API (New). Keep it separate from `VITE_GOOGLE_MAPS_API_KEY`; never prefix this key with `VITE_`.
- `PEER_DELIVERY_BASE_FEE_XAF`: positive whole-XAF base fee.
- `PEER_DELIVERY_PER_KM_XAF`: whole-XAF fee per estimated kilometre.
- `PEER_DELIVERY_PER_KG_XAF`: whole-XAF fee per kilogram.
- `PEER_DELIVERY_PHONE_HASH_SECRET`: private random secret of at least 32 characters, used to HMAC recipient phone numbers. Do not reuse a public key or commit this value.
- Existing Firebase Admin credentials: `FIREBASE_SERVICE_ACCOUNT_JSON`.
- Existing Fapshi credentials and mode: `FAPSHI_MODE`, the matching `FAPSHI_SANDBOX_*` or `FAPSHI_LIVE_*` credentials, and `FAPSHI_PAYMENT_FLOW=direct`.

Optional pricing settings are `PEER_DELIVERY_STRAIGHT_LINE_FACTOR` (1–3, default `1.35`) and `PEER_DELIVERY_ESTIMATED_SPEED_KMH` (5–80, default `20`). The quoted route distance is an estimate based on straight-line distance, not road routing.

## Firebase Authentication

Enable the Firebase Phone sign-in provider and SMS delivery for Cameroon. A sender must link and verify the phone number on their CareNest account before creating a request. The recipient must sign in to a customer account and link the invited phone number before accepting. A phone number merely entered in a profile is not treated as verified.

The browser also needs the existing `VITE_GOOGLE_MAPS_API_KEY` for address suggestions; restrict it to the deployed web origins and the Maps/Places APIs used by the app. The separate `GOOGLE_MAPS_SERVER_API_KEY` is used only by the API to verify selected place IDs.

## Invitations and operations

The sender shares the one-time invitation link directly with the recipient (for example, through the device share sheet). The invitation expires after 72 hours; its token is stored as a hash and can only be accepted once by an account with the matching verified phone claim. No SMS invitation provider is configured by this feature.

After recipient acceptance, only the designated payer can start payment. Delivery remains undispatched until the backend verifies the Fapshi collection. An administrator then assigns an approved rider; only that rider can advance delivery status or report GPS updates. Test the complete flow with Fapshi sandbox credentials and a non-production Firebase project before switching to live payments.
