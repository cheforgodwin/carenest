# Fapshi Live collections approval request

Updated 22 September 2026. Gmail draft updated; not sent.

To: support@fapshi.com
Subject: CareNest237 - Live Direct Pay collections activation and HTTP 403 review

Hello Fapshi Support,

Please review CareNest237 for Live Direct Pay collections activation and help us resolve the HTTP 403 affecting our live collection requests.

Full name: Chefor Godwin Nkepang
Fapshi account email: cheforgodwin01@gmail.com
Business/platform name: CareNest237
Website: https://carenest237.com
Platform type: Web application
Collections service Live API User: edfdbd6a-a70d-4c35-b537-88c2a5c1952f

CareNest connects customers with providers for home services including laundry, cleaning, deliveries and repairs. Customers select a service, place an order and pay through Mobile Money. CareNest tracks the order and coordinates fulfilment with providers and riders.

Why we implemented Direct Pay:
Customers approve the Mobile Money payment prompt on their phones while keeping their saved order open in CareNest. This keeps payment initiation and order tracking in the same web application. Please assess whether this use case meets your Direct Pay activation criteria; we are not claiming that hosted Initiate Pay is technically impossible for our platform.

Sandbox testing:
On 21 September 2026, our integration audit exercised successful and failed collections against Fapshi's real sandbox using CareNest's payment and webhook handlers. References: 3tXhSjyeJf (SUCCESSFUL) and l6Z2J29EQJ (FAILED). Authentication and database operations used isolated in-memory fixtures; this was not a complete browser-to-production-database test.

Our credentials are read server-side. Payment initiation requires an authenticated customer and an owned order. Our webhook queries Fapshi payment status and checks the returned transaction ID, order reference, customer and amount before updating payment status. A frontend success claim is not treated as proof of payment.

Earlier checks recorded successful live balance authentication, but live payment initiation returned HTTP 403. Please confirm that the API User above belongs to a collections service, whether Direct Pay is enabled, and any remaining service-verification requirements.

This activation request concerns collections only. Automated provider/rider payouts are not implemented or sandbox-tested. Our earlier draft also asked about a separate payout service; that remains a future integration and should not delay the collections review or change the collections service into a payout service.

Please let us know any additional business information or demonstration you require.

Regards,
Chefor Godwin Nkepang
CareNest237
cheforgodwin01@gmail.com

## Submission notes

CareNest237 is the business/platform name supplied by the owner; legal incorporation has not been asserted. Confirm it matches the Fapshi account label. Personal contact details in this document are for the private approval request, not the public website. Public support privacy changes are being prepared separately.

## Remaining implementation work

1. Atomic, idempotent webhook and polling verification; reconciliation of payment requests with unknown outcomes before retrying.
2. Backend/database-enforced lifecycle with verified payment before fulfilment, provider acceptance, manual rider assignment/pickup, completion, and separate dispute/refund states.
3. Immutable integer-XAF financial snapshot: service/product amount, delivery charge, provider entitlement, rider entitlement, CareNest fee, actual Fapshi fee and settlement status. Unknown fees must not be recorded as zero. Confirm fee ownership and balance totals. The existing 80/20 calculation is not a complete ledger.
4. Append-only accounting entries with unique collection/refund/settlement references and transfer evidence for manual payouts. Marking a payout paid does not execute a transfer.
5. Provider verification, manual dispatch/refund/dispute procedures and production webhook checks. Google Maps is not a launch dependency.

## Evidence

Local audit: docs/fapshi-readiness-audit.md
Activation requirements: https://www.fapshi.com/en/help-and-support/topics/payments
Payment methods: https://www.fapshi.com/en/help-and-support/direct-pay-vs-initiate-pay-all-you-need-to-know

