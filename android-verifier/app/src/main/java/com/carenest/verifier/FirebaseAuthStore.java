package com.carenest.verifier;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class FirebaseAuthStore {
    interface TokenCallback {
        void onToken(boolean success, String tokenOrError);
    }

    interface SignInCallback {
        void onComplete(boolean success, String message);
    }

    private static final String PREFS = "carenest_verifier_auth";
    private static final String ID_TOKEN = "idToken";
    private static final String REFRESH_TOKEN = "refreshToken";
    private static final String EXPIRES_AT = "expiresAt";

    private FirebaseAuthStore() {}

    static boolean hasRefreshToken(Context context) {
        return !prefs(context).getString(REFRESH_TOKEN, "").isEmpty();
    }

    static void signOut(Context context) {
        prefs(context).edit().clear().apply();
    }

    static void signIn(Context context, String email, String password, SignInCallback callback) {
        new Thread(() -> {
            try {
                String endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + BuildConfig.FIREBASE_API_KEY;
                JSONObject payload = new JSONObject();
                payload.put("email", email);
                payload.put("password", password);
                payload.put("returnSecureToken", true);

                JSONObject response = postJson(endpoint, payload, "");
                saveTokens(context, response.getString("idToken"), response.getString("refreshToken"), response.optLong("expiresIn", 3600));
                callback.onComplete(true, "Verifier signed in.");
            } catch (Exception error) {
                callback.onComplete(false, error.getMessage());
            }
        }).start();
    }

    static void withIdToken(Context context, TokenCallback callback) {
        SharedPreferences prefs = prefs(context);
        String idToken = prefs.getString(ID_TOKEN, "");
        long expiresAt = prefs.getLong(EXPIRES_AT, 0);
        if (!idToken.isEmpty() && System.currentTimeMillis() < expiresAt - 60000) {
            callback.onToken(true, idToken);
            return;
        }

        String refreshToken = prefs.getString(REFRESH_TOKEN, "");
        if (refreshToken.isEmpty()) {
            callback.onToken(false, "Open CareNest Verifier and sign in with the admin account first.");
            return;
        }

        new Thread(() -> {
            try {
                String endpoint = "https://securetoken.googleapis.com/v1/token?key=" + BuildConfig.FIREBASE_API_KEY;
                String body = "grant_type=refresh_token&refresh_token=" + refreshToken;
                JSONObject response = postForm(endpoint, body);
                String nextIdToken = response.getString("id_token");
                String nextRefreshToken = response.getString("refresh_token");
                long expiresIn = response.optLong("expires_in", 3600);
                saveTokens(context, nextIdToken, nextRefreshToken, expiresIn);
                callback.onToken(true, nextIdToken);
            } catch (Exception error) {
                callback.onToken(false, error.getMessage());
            }
        }).start();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void saveTokens(Context context, String idToken, String refreshToken, long expiresInSeconds) {
        prefs(context).edit()
            .putString(ID_TOKEN, idToken)
            .putString(REFRESH_TOKEN, refreshToken)
            .putLong(EXPIRES_AT, System.currentTimeMillis() + expiresInSeconds * 1000)
            .apply();
    }

    private static JSONObject postJson(String endpoint, JSONObject payload, String bearerToken) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        if (!bearerToken.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + bearerToken);
        byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(bytes);
        }
        return readResponse(connection);
    }

    private static JSONObject postForm(String endpoint, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body.getBytes(StandardCharsets.UTF_8));
        }
        return readResponse(connection);
    }

    static JSONObject readResponse(HttpURLConnection connection) throws Exception {
        int status = connection.getResponseCode();
        BufferedReader reader = new BufferedReader(new InputStreamReader(
            status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream(),
            StandardCharsets.UTF_8
        ));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) response.append(line);
        if (status < 200 || status >= 300) throw new IllegalStateException(response.toString());
        return new JSONObject(response.toString());
    }
}
