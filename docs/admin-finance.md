# Admin transactions and earnings

Open `/dashboard/admin?view=finance` as an administrator. The Notifications menu (`?view=notifications`) lists unresolved transaction issues and opens the matching order for review. All admin tables become labelled cards on phone/tablet screens, including requests, users, applications, financial allocations and history.

- Obsolete SMS/pasted-receipt fields and duplicate Settings counters have been removed. Customer payments are verified automatically by Fapshi; Refresh Fapshi status repeats that independent check. Notifications have one dedicated page.
- Transfer forms appear only for eligible outstanding earnings or an open refund review. Pricing percentages remain available in a collapsible section.
- The order table includes every saved order, with filters for environment, collection status, date and customer/provider/rider/reference. Summary cards include verified live collections only (or sandbox only when explicitly selected). Unknown historical environments never count as real money until an independent Fapshi status check confirms the environment.
- Fapshi collection fees are `amount - revenue` from the authenticated payment-status response. Missing or invalid revenue remains unknown, never zero. The displayed percentage is the actual effective percentage for that transaction, not a promise about future pricing.
- Confirm provider and delivery/rider percentages and who absorbs the collection fee under Pricing percentages. The old 80/20 split is a draft only. Basis points are whole integers; shares cannot exceed 100%. A versioned allocation is frozen when payment starts. New settings do not rewrite old orders.
- Historical orders without an allocation require an admin explanation before applying the current approved policy. Confirm the original agreement first. Verified fee enrichment is possible later; a conflicting already-recorded fee requires investigation.
- Collections are not earnings. Earnings require server-verified payment, customer-confirmed completion, a known allocation and fee, and no complaint, hold or refund. Partially refunded orders remain held and excluded from earnings. CareNest earnings are after collection fees, before transfer fees, tax and other business expenses. This is an operational ledger, not a bank balance or full accounting system.
- The finance form still records transfers already sent manually, with receipt/reference and evidence; it does not initiate transfers. Fapshi payouts use a separate payout-enabled service and separate credentials from collections. The `POST /api/payouts` API supports worker actions `balance`, `request` (unique `idempotencyKey`), `listMine`, and `cancel`; admin actions are `serviceBalance`, `adminList`, `execute`, `verify`, and `close` (reject with a review note). Requests reserve their eligible per-order amounts, and the manual transfer API refuses to spend those same reservations. The admin `execute` action checks the payout-service balance and sends no more than 500,000 XAF per request. Earnings are updated only after Fapshi reports a matching `Payout` transaction as `SUCCESSFUL`; ambiguous outcomes stay locked until verified. Fapshi does not deduplicate requests, so the API reconciles by `userId` and `externalId` before sending and never blindly retries a timeout.
- Payout documents are inaccessible from client Firestore SDKs. Live payout sends are locked unless `FAPSHI_PAYOUT_LIVE_ENABLED=true`; keep this false until payout sandbox testing is complete and Fapshi enables the separate live payout service. Configure the payout service webhook at `/api/fapshi-payout-webhook` with its own `x-wh-secret`. The webhook is only a signal: CareNest re-queries Fapshi before recording the result. The API does not move funds from the collections service into the payout service; fund that separate balance in Fapshi's dashboard/app.
- Financial events are append-only to browser clients, including admins. Financial orders cannot be deleted after payment initiation. Collections, attempts, fees and transfers are separate event types; status events are never counted as extra collections.
- Needs your attention covers unknown/stale/failed collections, missing pricing/fees/environment, refunds, complaints, negative CareNest margins and unpaid completed work. The banner is available across admin views. Browser notifications are opt-in, generic (no customer details), and only generated while an admin dashboard is open. Email, WhatsApp and closed-app push delivery are not configured. Notifications open the protected finance page.

## Operations

1. Confirm pricing, especially delivery provider/rider shares and collection-fee ownership.
2. Filter historical/unknown orders and verify collection details before settlement. Failed verification does not fabricate a payment or fee.
3. Review holds/refunds and confirm actual work before paying anyone.
4. Send approved money through the chosen payment service, then record the receipt once. Recording evidence does not initiate a second transfer.
5. Export the filtered transactions for reconciliation. Unknown amounts stay labelled in the CSV.

No production financial history, transfer or pricing policy is seeded by deployment. The collection activation/403 issue with Fapshi remains a separate provider-side matter; this feature does not enable DirectPay permissions.

## Validation

Vitest covers rounding, fees, immutable allocations, duplicate verification, transfer idempotency, overpayment, refund limits and admin authorization. Firestore emulator tests cover private finance reads, server-only writes and protection against forged financial metadata. The desktop/mobile screen check uses isolated fictional transactions and never calls a live payment endpoint.
