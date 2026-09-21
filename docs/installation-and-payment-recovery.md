# Installation and saved-order payments

The customer app is hosted at https://carenest237.com on Vercel. The browser installation manifest is advertised only on that origin. Other public hosts redirect there before advertising installation; localhost stays available for development without installation. Public preview hosts also redirect.

Firebase Hosting is a redirect-only entry point to the Vercel site. Deploy firebase.json hosting configuration to the existing Firebase project to activate the redirect. Do not attach carenest237.com to that redirect-only Firebase site: the custom domain must continue to point to Vercel.

Deploy the Vercel application and Firebase Hosting, Firestore rules, and Storage rules for these changes to become live. Existing installations from a different domain cannot have their installed origin changed by a manifest update. Users should open https://carenest237.com in their browser and install there, then remove the old shortcut. Existing saved orders remain attached to the same Firebase account.

After an order is saved, an initiation failure opens the existing order instead of leaving the customer on the booking form. Customers can also select Orders, open that order, and select Retry payment, then approve the Mobile Money prompt. Retrying uses the original Firestore order ID and does not create another order.

When a payment reference already exists, the UI directs the customer to check their phone or contact support. Do not clear a reference or retry an ambiguous transaction without verifying its outcome with the provider. Payment initiation does not mean payment succeeded.

Customers can read their own user profile, orders and application. The server verifies payment ownership. Administrators retain operational access, and approved providers/riders see only orders assigned to them. Public marketplace listings and provider photos remain shared catalog content. Private profile photo reads require the matching account. Account changes reset dashboard component state.


## Updates and completion confirmation

Each production build stamps the service worker with an asset-derived version. Installed apps check for updates on startup, return to the foreground, reconnection, and every five minutes while visible. New workers wait while the app is open; the Update now notice lets the customer finish a booking or payment before reloading. Closing all app windows lets the waiting update activate normally. No reinstall is needed for updates on the same origin. Existing installations on a different origin still need migration.

Provider completion and rider delivery reports now set Awaiting confirmation. Only the owning customer can confirm completion. A complaint holds payout and cannot be cleared by a provider or rider. Payout eligibility requires verified payment and customer confirmation; the Firestore rules enforce this even if a client bypasses the UI. Administrators can review complaints but cannot forge the customer's confirmation. Existing Completed orders without confirmation remain ineligible for new payout changes until the customer confirms.

Deploy the frontend and Firestore rules together; older open clients that attempt direct worker completion will be rejected by the new rules and should apply the app update. Manual transfers outside CareNest are not controlled by database rules.


## Live payment authentication

"Invalid apiuser or apikey" means the provider rejected server authentication. Changing CORS or reinstalling the app will not correct that credential pair.

For real payments set these in Vercel's CareNest project, Production environment:
- FAPSHI_MODE: live
- FAPSHI_LIVE_API_URL: https://live.fapshi.com/initiate-pay
- FAPSHI_LIVE_API_USER: the apiuser from the Fapshi service's Live/API section
- FAPSHI_LIVE_SECRET_KEY: the matching apikey from that same service/environment
- FAPSHI_PAYMENT_FLOW: direct

Enter secrets in the Vercel dashboard. Do not copy sandbox keys into live variables. A Vercel deployment is needed after saving environment changes. Also confirm Direct Pay is enabled for the live service in Fapshi; successful credential authentication alone does not establish Direct Pay activation.

The configuration helper validates the environment, endpoint and placeholder credentials before acquiring a payment-initiation lock. Provider authentication refusals leave the saved order intact and return a customer-friendly support message; server logs contain a safe diagnostic event without credentials.

For read-only authentication verification, supply the intended environment to scripts/check-fapshi-credentials.mjs. It calls GET /balance and reports only authentication status, without outputting keys or balances. It never initiates a payment. Be careful with vercel env run: it also loads local .env files, and sensitive production values may not be exportable. Missing exported values do not prove they are missing in the deployed runtime.

Provider references:
- https://fapshi.mintlify.app/en/api-reference/preliminary-knowledge/environment
- https://docs.fapshi.com/en/api-reference/endpoint/balance
- https://www.fapshi.com/en/help-and-support/topics/payments
