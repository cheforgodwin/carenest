# Direct Pay flow validation ? 3 October 2026

The requested flow uses automatic MTN/Orange detection from the separate payment phone. Contact numbers remain unchanged. Acceptance produces Submitted; only independently verified SUCCESSFUL Collection transactions matching reference, order, amount, customer and environment produce Paid. No manual admin payment approval is required.

Tests cover failed MTN attempt one followed by successful Orange attempt two on the same order, preserving both attempt records and preventing late retired callbacks from changing the next attempt. Pending/unknown payments remain protected from duplicate initiation.

Firestore rules require verified payment before provider progression and rider assignment, pickup before delivery, and owning-customer confirmation before completion. Payout readiness now also requires verified collection, customer confirmation, known allocation/fee, and no hold/dispute/refund condition. Payout transfers themselves remain manual and evidence-based.

Confirmed provider low-funds reasons now produce a clear insufficient-funds message in the payment popup and order details. Missing reasons produce wallet-balance guidance without asserting a specific cause. New payment attempts clear prior failure codes. Browser clients cannot forge the server-owned failure field.

Validation: 185 unit tests passed, build and scoped lint passed, and all 32 emulator rule assertions passed. The emulator wrapper reported a shutdown timeout after the tests succeeded. No new live payment was sent. The owner reported vibration on a locked payment phone; delivery/approval and final payment success remain distinct.

The one-off rule publication helper only adds paymentFailureCode to the existing live server-metadata create restriction and preserves all other live rules. It requires CARENEST_PROTECT_PAYMENT_FAILURE=1, checks the exact project, and verifies the release after publishing. It does not remove protections.
