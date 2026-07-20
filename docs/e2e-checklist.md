# CareNest E2E Checklist

Run these checks before promoting a build to production.

## Firebase Setup

- Email/password authentication is enabled.
- Firestore rules from `firestore.rules` are published.
- Production environment variables include every `VITE_FIREBASE_*` key.
- At least one trusted user has `accountType: "admin"` in `users/{uid}`.

## Customer Flow

- A new visitor can sign up and is saved as `accountType: "customer"`.
- Signup rejects weak passwords and invalid Cameroon phone numbers.
- A new account receives an email-verification message.
- An unverified account cannot open dashboards, create bookings, or apply as a provider.
- After using the verification link, the customer can continue into the dashboard.
- The signup form does not expose admin or provider roles.
- A customer can create laundry, cleaning, and delivery requests.
- A customer cannot create a request with a changed amount from browser dev tools.
- A customer can only see their own requests.
- A request records `paymentMethod: "Cash"`, `"Mobile Money"`, or `"Orange Money"`.
- A request starts with `paymentStatus: "Pending"`.

## Provider Application Flow

- A customer can submit a provider application from the customer dashboard.
- The admin dashboard shows the application in the Applications view.
- Rejecting an application leaves the user as `accountType: "customer"`.
- Approving an application changes the user to `accountType: "provider"`.
- Approval stays disabled until an admin confirms identity review and the payout phone.
- After logging back in, the approved provider reaches the provider dashboard.

## Provider Job Flow

- A provider sees pending open jobs.
- A provider sees only their assigned jobs after accepting work.
- A provider can accept a pending job.
- A provider can move their own job through allowed statuses.
- A provider cannot edit the request amount or payment status.
- Completing a job requires a completion note.
- A provider sees the 80% provider earning and current payout state.

## Complaint and Payout Flow

- A customer can submit a complaint with a meaningful description.
- A complaint changes the request to `Complaint` and holds the provider payout.
- Only a completed request with customer payment marked `Paid` can be paid to a provider.
- An admin can mark an eligible payout `Paid`, `Partial`, or `Held`.
- The payout export contains the provider phone, provider earning, and CareNest fee.
- The provider payout method and phone persist after saving availability.

## Admin Flow

- An admin can list users, requests, and provider applications.
- An admin can update request status.
- An admin can update payment status to `Paid`, `Failed`, or `Refunded`.
- An admin can export users and service requests.

## Negative Permission Checks

- A customer cannot open another customer's order URL.
- A customer cannot update `accountType`.
- A provider cannot update a job assigned to another provider.
- A provider cannot update their own payout state.
- A customer cannot mark a provider payout as paid.
- A signed-out user cannot read `users`, `serviceRequests`, or `providerApplications`.
