# CareNest E2E Checklist

Run these checks before promoting a build to production.

## Firebase Setup

- Email/password authentication is enabled.
- Firestore rules from `firestore.rules` are published.
- Production environment variables include every `VITE_FIREBASE_*` key.
- At least one trusted user has `accountType: "admin"` in `users/{uid}`.

## Customer Flow

- A new visitor can sign up and is saved as `accountType: "customer"`.
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
- After logging back in, the approved provider reaches the provider dashboard.

## Provider Job Flow

- A provider sees pending open jobs.
- A provider sees only their assigned jobs after accepting work.
- A provider can accept a pending job.
- A provider can move their own job through allowed statuses.
- A provider cannot edit the request amount or payment status.

## Admin Flow

- An admin can list users, requests, and provider applications.
- An admin can update request status.
- An admin can update payment status to `Paid`, `Failed`, or `Refunded`.
- An admin can export users and service requests.

## Negative Permission Checks

- A customer cannot open another customer's order URL.
- A customer cannot update `accountType`.
- A provider cannot update a job assigned to another provider.
- A signed-out user cannot read `users`, `serviceRequests`, or `providerApplications`.
