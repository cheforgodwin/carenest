# Installation and saved-order payments

The customer app is hosted at https://carenest237.com on Vercel. The browser installation manifest is advertised only on that origin. Other public hosts redirect there before advertising installation; localhost stays available for development without installation. Public preview hosts also redirect.

Firebase Hosting is a redirect-only entry point to the Vercel site. Deploy firebase.json hosting configuration to the existing Firebase project to activate the redirect. Do not attach carenest237.com to that redirect-only Firebase site: the custom domain must continue to point to Vercel.

Deploy the Vercel application and Firebase Hosting, Firestore rules, and Storage rules for these changes to become live. Existing installations from a different domain cannot have their installed origin changed by a manifest update. Users should open https://carenest237.com in their browser and install there, then remove the old shortcut. Existing saved orders remain attached to the same Firebase account.

After an order is saved, an initiation failure opens the existing order instead of leaving the customer on the booking form. Customers can also select Orders, open that order, and select Retry payment, then approve the Mobile Money prompt. Retrying uses the original Firestore order ID and does not create another order.

When a payment reference already exists, the UI directs the customer to check their phone or contact support. Do not clear a reference or retry an ambiguous transaction without verifying its outcome with the provider. Payment initiation does not mean payment succeeded.

Customers can read their own user profile, orders and application. The server verifies payment ownership. Administrators retain operational access, and approved providers/riders see only orders assigned to them. Public marketplace listings and provider photos remain shared catalog content. Private profile photo reads require the matching account. Account changes reset dashboard component state.
