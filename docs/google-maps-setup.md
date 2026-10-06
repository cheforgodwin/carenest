# Google Maps setup

CareNest address forms can use Google's Place Autocomplete widget to save a selected address with its latitude, longitude, and place ID. Manual address entry continues to work when the Google key is unset or the Maps API is unavailable.

## Configure Google Cloud

1. Select the Google Cloud project used for CareNest and enable billing.
2. Enable **Maps JavaScript API** and **Places API (New)**.
3. Create a browser API key for CareNest.
4. Apply a website (HTTP referrer) restriction for the deployed CareNest domains and local development origins.
5. Apply an API restriction allowing only Maps JavaScript API and Places API (New).
6. Set `VITE_GOOGLE_MAPS_API_KEY` in the local environment and deployment environment, then rebuild the frontend.

This is a browser key and will be visible in network requests and the built application. Protect it with the website and API restrictions above; do not use a server-side web-service key here.

The picker currently restricts suggestions to Cameroon. New order documents save `addressCoordinates: { lat, lng }` and `addressPlaceId` when a Google place is selected. Existing and manually entered addresses keep working without coordinates. This prepares order data for a later map view; it does not display a map or provide live rider tracking.

## Saved and current locations

Customers can save one reusable home address to their own CareNest profile and choose it again on either service or marketplace orders. Providers can save one business/shop address in the provider Settings view. These profile fields are private to the account owner and administrators under the current user-document rules.

Customers and providers can also choose the device's current location for an address. This uses the browser Geolocation API after the user grants permission; it does not call Google Places or Geocoding. Coordinates are stored with the order, and selecting the current location does not overwrite a saved home address unless the user explicitly saves it. Geolocation requires a secure context (HTTPS, or localhost during development).

## Rider and dispatch roles

CareNest's rider role covers on-foot, bicycle, motorbike, and car couriers. The rider's approved transport mode is saved in the rider profile and shown to the administrator making assignments. Foot riders receive walking directions. Rider location sharing is opt-in per active delivery and writes to that order only after browser permission; updates are throttled to a minimum of 50 metres movement or one minute. The assigned customer and admins can see the latest shared position while the delivery is active. It is removed when the rider marks the delivery delivered, when the customer confirms completion, or when an administrator cancels or closes the job.

Delivery assignment remains in the administrator's Requests view. There is no separate dispatcher account; the person delivering on foot uses the rider account.
