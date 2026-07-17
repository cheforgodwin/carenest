# CareNest Operations Runbook

## Before every release

1. Run `npm run test:release` and `npm run test:load -- 100 20`.
2. Confirm Firebase variables, receiving numbers, prices, support number, and service areas.
3. Deploy Firestore and Storage rules before the web build when both change.
4. Complete `docs/e2e-checklist.md` using separate customer, provider, and admin accounts.
5. Record the Git commit and retain the previous hosting release for rollback.

## Incident response

1. Stop new bookings if prices, permissions, or payments are incorrect.
2. Revoke Firebase sessions and change the admin password if the verifier phone is lost.
3. Review payment receipts, affected requests, and admin audit fields.
4. Inform affected customers and state when the next update will be provided.
5. Restore the last known-good hosting release and rules when necessary.

## Payment review

- `needs_review` must never be treated as paid automatically.
- Never resolve a payment using amount alone.
- Record a reason and reviewer for payment changes and refunds.

## Capacity and recovery

- Monitor Authentication errors, Firestore denied requests, reads/writes, and quota usage.
- Alert on payment failures, verifier inactivity, and signup/login failure spikes.
- Use staging or emulators for load tests—never production.
- Back up Firestore regularly and test restoration before launch.
