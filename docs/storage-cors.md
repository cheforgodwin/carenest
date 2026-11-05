# Firebase Storage CORS

Storage security rules and bucket CORS are separate settings. `storage.rules` controls which signed-in users may upload gas bottle photos; `storage.cors.json` allows the app origins to make those browser requests.

After installing and authenticating the Google Cloud CLI, apply the CORS policy to the Firebase Storage bucket:

```sh
gcloud storage buckets update gs://carenest-11319.firebasestorage.app --cors-file=storage.cors.json
```

Verify the bucket configuration with:

```sh
gcloud storage buckets describe gs://carenest-11319.firebasestorage.app --format="json(cors)"
```

Firebase CLI Storage Rules deployment does not apply bucket CORS. Keep the allowed origins explicit; add any new production or preview origin to `storage.cors.json` before applying the policy again.