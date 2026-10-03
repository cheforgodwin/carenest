# Account settings and deletion

All signed-in roles have a shared /settings page. Customer navigation and provider/rider/admin sidebars link there. Notification permission controls and Logout are shown only in Settings; foreground notification listening and opted-in token refresh remain active across the app.

Account deletion requires password reauthentication, a fresh ID token and typing DELETE. The backend uses only the verified UID, checks authentication within five minutes, and transactionally reads all related orders. Active jobs, pending/unknown payments, disputes, holds, unsettled refunds and provider/rider earnings prevent deletion. Another admin must exist before an admin can delete the last admin account.

Deletion removes Firebase Authentication login, replaces the user profile with a minimal deleted UID marker (which prevents an old token recreating a customer profile), removes registered notification devices and applications, and hides provider listings while clearing listing name/phone. Order and financial history are retained, including historical order contact information, and this retention is disclosed in Settings. This is account deletion, not erasure of all transaction records. If Auth deletion fails, profile/device/application/listing records are restored. No test deletes a real account.

Validation 2026-10-03: 244 unit tests passed; lint and production builds passed. Published https://carenest237.com/settings (deployment dpl_3jNpqzVwzVGLsuesvuWuMEFRP4HK). Live Settings bundle includes notification controls, Logout and Delete my account. Dashboard bundle links to Settings and no longer contains logout/notification permission controls. Unauthenticated account deletion returns 401. No production account was deleted for verification.
