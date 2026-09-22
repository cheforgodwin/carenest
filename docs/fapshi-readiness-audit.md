# Fapshi readiness audit — 21 September 2026

## Result

CareNest has a working public website and a working sandbox collection integration. It is not yet ready to claim that both collection and automated disbursement are fully implemented and tested. Fapshi controls approval; this audit does not guarantee acceptance.

## Verified

- Inspected https://carenest237.com in an isolated Chrome browser at desktop (1366 × 900) and mobile (390 × 844) sizes.
- Homepage, signup, login, terms, and privacy routes rendered. The unauthenticated customer dashboard redirected to login as expected.
- No JavaScript exceptions, failed network loads, broken images, or horizontal overflow were observed on the inspected routes. The mobile homepage screenshot was visually reviewed.
- Homepage describes laundry, cleaning, delivery, repairs, scheduling and order tracking.
- Signup presents required identity/contact/password fields and links to terms and privacy with a required consent checkbox.
- Two actual Fapshi sandbox collections were exercised through the CareNest payment handler and webhook handler. Firebase authentication and database operations were replaced by isolated in-memory fixtures. All outgoing test requests were restricted to https://sandbox.fapshi.com. No live charge or production database write occurred.

| Sandbox scenario | Reference | Initiation | Provider result | CareNest verification result |
| --- | --- | --- | --- | --- |
| Documented success phone 670000000 | 3tXhSjyeJf | HTTP 202 | SUCCESSFUL | Paid; verified by fapshi-webhook, HTTP 200 |
| Documented failure phone 670000001 | l6Z2J29EQJ | HTTP 202 | FAILED | Failed; verified by fapshi-webhook, HTTP 200 |

Twenty tests passed across the sandbox collection audit, payment ownership/error handling, webhook boundary and authentication validation suites. This is not a complete production UI/Firestore end-to-end test.

Earlier production checks in this session established that live /balance authentication succeeds while payment initiation returns HTTP 403. The exact reason for the permission refusal remains unconfirmed by Fapshi.

## Gaps to address before describing both integrations as ready

1. **Automated disbursement is not implemented.** The api directory has collection, webhook and translation handlers, but no Fapshi /payout caller. `updateProviderPayoutStatus` in src/firebase/orderService.js updates Firestore status/history only; it does not send money. Admin actions such as "Mark paid" are recordkeeping. Separate payout sandbox credentials and a tested payout implementation are needed.
2. **No usable public support contact was visible.** The homepage has no support phone/email/contact section. Both live policy pages say to use the support number in the app but display no actual number. The business configuration uses an empty fallback for VITE_SUPPORT_PHONE, producing `#` for call links. The local .env has that variable, but the rendered production pages show it is not populated there.
3. **Policy content is unfinished.** Both pages include: "This document should be reviewed for the laws that apply to the final CareNest business entity and service area." The terms mention cash despite the current booking payment methods being Mobile Money/Fapshi. Final business identity, service area, contact details and actual cancellation/refund handling need the owner's confirmation; this audit is not legal review.
4. **Public navigation is incomplete for reviewers.** Privacy and terms are linked from signup but not directly from the homepage. The public homepage does not show service areas or prices, and the booking/price experience requires login. A reviewer can understand the broad business but cannot inspect a complete booking as a guest.
5. **Live collection remains blocked.** Successful credentials and sandbox tests do not establish live Direct Pay activation. Ask Fapshi to identify the HTTP 403 and confirm collections-service permissions.

## Test limitations

- Did not create a production user, submit a production booking, initiate a live payment, send a payout, or send the support email.
- Did not verify account registration/email delivery, authenticated booking creation, actual deployed Firestore rules or live webhook delivery in this audit.
- Payout implementation is absent; therefore no CareNest payout end-to-end test could be run. An API User alone is insufficient to authenticate a separate payout test.
- The existing scripts/production-payment-smoke.mjs is not suitable for this audit: it defaults to the live site, writes production data, and expects `transId` in an initiation response that now returns `{ accepted: true }`. It was not run.

## Evidence

Browser results and screenshots: `.task-fapshi-audit/` (local audit artifacts, excluded from Vercel deployment).
Sandbox harness: `.task-fapshi-audit/sandbox-collection.test.js`.
Sandbox outcomes: `.task-fapshi-audit/sandbox-results.json`.

## Provider requirements checked

- Direct Pay activation: https://www.fapshi.com/en/help-and-support/topics/payments
- Separate payout service and sandbox testing: https://docs.fapshi.com/en/api-reference/endpoint/payout
- Sandbox success/failure numbers and no-real-money behavior: https://docs.fapshi.com/en/api-reference/preliminary-knowledge/environment
