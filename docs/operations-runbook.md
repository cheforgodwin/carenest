# CareNest Operations Runbook

## Before every release

1. Run `npm run test:release` and `npm run test:load`.
2. Confirm Firebase variables, receiving numbers, prices, support number, and service areas.
3. Deploy Firestore and Storage rules before the web build when both change.
4. Complete `docs/e2e-checklist.md` using separate customer, provider, and admin accounts.
5. Record the Git commit and retain the previous hosting release for rollback.

## Incident response

1. Stop new bookings if prices, permissions, or payments are incorrect.
2. Revoke compromised Firebase sessions and rotate affected server credentials.
3. Review Fapshi transaction references, payment attempts, affected orders, and verified status events.
4. Inform affected customers and state when the next update will be provided.
5. Restore the last known-good hosting release and rules when necessary.

## Payment review

- Only independently verified Fapshi SUCCESSFUL collections can mark an order Paid. Admins cannot manually approve customer payments.
- Never resolve a payment using amount alone.
- Retry only after Fapshi verifies failure or expiry; pending and unknown outcomes stay locked. Record a reason and reviewer for refunds.

## Capacity and recovery

- Monitor Authentication errors, Firestore denied requests, reads/writes, and quota usage.
- Alert on payment failures, webhook failures, and signup/login failure spikes.
- Use staging or emulators for load tests—never production.
- Back up Firestore regularly and test restoration before launch.
