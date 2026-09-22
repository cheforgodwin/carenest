# Payment reliability and fulfilment changes ? 22 September 2026

Deployed to production on 22 September 2026. The Fapshi approval email was sent on 22 September 2026 after owner review and approval. Vercel deployment: dpl_B5BuGmkfFdD64921DcmZrMmXwYqo, promoted to https://carenest237.com.

## Payment handling

POST /api/payments initiates collection. POST /api/payments with { firestoreId, action: "verify" } checks an owned order without creating a charge.

Starting and Unknown initiation states never expire into permission to charge again. Network errors, server errors and missing transaction references keep the order locked. Definite request rejections (400, 401, 403, 404, 422) allow a later initiation when no transaction reference exists. Bound references are never cleared automatically, including failed transactions.

The webhook and explicit customer status check share a Firestore transaction that verifies the order, customer, amount and transaction binding. Duplicate terminal results do not rewrite confirmation timestamps. A late pending/failed result cannot downgrade Paid, and provider success cannot undo Refunded. A verified callback may bind a server-initiated request before the initiation response is saved. The initiation response cannot overwrite that callback.

Unknown requests without a reference are searched by amount and initiation date, then matched by order and customer, followed by an independent status lookup. Search is limited to 100 results. No match or multiple matches stays locked for manual support investigation; absence is not proof that no charge exists. Customer status checks are limited to one per order per 15 seconds. Webhooks remain the main update mechanism.

## Work sequence

Firestore requires server-verified payment before provider acceptance/progress, admin assignment or rider assignment. Providers accept assigned jobs and advance through In Progress and Quality Check. Non-delivery services can request customer confirmation with completion proof. Delivery jobs move to Out for Delivery, an admin assigns a rider, and the rider must record pickup before delivery. Only the owning customer can confirm completion.

Admins cannot forge payment verification, replace payment references or skip worker/customer steps. Refund review is a separate Requested state that holds payout eligibility and leaves the collection Paid. It does not transfer money or claim a completed refund. Complaints record an Open dispute and hold settlement.

## Remaining launch work

Frontend, API and Firestore rules were deployed together after owner approval. Existing Paid records without server verification metadata cannot advance until verified. Review any old records with inconsistent status before launch; do not synthesize payment evidence.

Automated refund execution, a complete immutable financial ledger, settlement evidence, automated payouts and dispute-resolution procedures remain separate work. No live charges, payouts or production database writes were performed for this change.

Fapshi 403 means the provider refused the requested action. Direct Pay activation and transaction-creation IP restrictions are distinct possible causes; balance access does not rule out an IP restriction. Support must confirm the account-specific cause.

References:
- https://docs.fapshi.com/en/api-reference/preliminary-knowledge/request-status
- https://docs.fapshi.com/en/api-reference/endpoint/payment-status
- https://docs.fapshi.com/en/api-reference/endpoint/search-transactions

## Validation

71 Vitest tests and 3 phone utility tests passed. All 29 Firestore emulator rule tests passed. Full lint and final focused lint passed. Production build passed. Firebase CLI startup stalled, so rules tests used the cached Firestore emulator directly on 127.0.0.1:8080 with project demo-carenest.

## Production verification

The published Firestore ruleset dbddb0f6-617e-41e4-b355-906c372ad514 exactly matches the tested local rules. Unauthenticated initiation and verification requests returned HTTP 401. A malformed webhook returned HTTP 400 before provider lookup. Public homepage, privacy and terms pages display the approved email and WhatsApp contacts. Browser/API check artifacts are under .task-release-20260922/. No live charge was initiated. Fapshi activation remains subject to provider review.
