package com.carenest.verifier;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class PaymentVerifierClient {
    interface Callback {
        void onComplete(boolean success, String message);
    }

    private static final String DATABASE = "https://firestore.googleapis.com/v1/projects/"
        + BuildConfig.FIREBASE_PROJECT_ID
        + "/databases/(default)/documents";

    private PaymentVerifierClient() {}

    static void submit(Context context, PaymentSmsParser.ParsedPayment payment, Callback callback) {
        FirebaseAuthStore.withIdToken(context, (success, tokenOrError) -> {
            if (!success) {
                callback.onComplete(false, tokenOrError);
                return;
            }

            new Thread(() -> {
                try {
                    MatchResult match = findMatchingOrder(payment, tokenOrError);
                    String receiptId = receiptId(payment);
                    String now = isoNow();

                    if (match.status.equals("matched")) {
                        markOrderPaid(match.order.documentName, payment, receiptId, now, tokenOrError);
                        createReceipt(receiptId, payment, "matched", "", match.order.orderId, match.score, now, tokenOrError);
                        callback.onComplete(true, "Marked " + match.order.orderId + " paid.");
                    } else {
                        createReceipt(receiptId, payment, "needs_review", match.reason, "", 0, now, tokenOrError);
                        callback.onComplete(true, "Saved SMS for admin review.");
                    }
                } catch (Exception error) {
                    callback.onComplete(false, error.getMessage());
                }
            }).start();
        });
    }

    private static MatchResult findMatchingOrder(PaymentSmsParser.ParsedPayment payment, String idToken) throws Exception {
        JSONObject query = new JSONObject()
            .put("structuredQuery", new JSONObject()
                .put("from", new JSONArray().put(new JSONObject().put("collectionId", "serviceRequests")))
                .put("where", new JSONObject()
                    .put("compositeFilter", new JSONObject()
                        .put("op", "AND")
                        .put("filters", new JSONArray()
                            .put(fieldFilter("paymentStatus", "EQUAL", stringValue("Submitted")))
                            .put(fieldFilter("amount", "EQUAL", integerValue(payment.amount)))))));

        JSONArray rows = postArray(DATABASE + ":runQuery", query, idToken);
        ArrayList<ScoredOrder> scoredOrders = new ArrayList<>();
        for (int i = 0; i < rows.length(); i++) {
            JSONObject row = rows.optJSONObject(i);
            if (row == null || !row.has("document")) continue;
            ScoredOrder order = ScoredOrder.fromDocument(row.getJSONObject("document"));
            order.score = score(order, payment);
            if (order.score > 0) scoredOrders.add(order);
        }

        if (scoredOrders.isEmpty()) return MatchResult.needsReview("No submitted order matched this SMS.");

        scoredOrders.sort((left, right) -> Integer.compare(right.score, left.score));
        if (scoredOrders.size() > 1 && scoredOrders.get(0).score == scoredOrders.get(1).score) {
            return MatchResult.needsReview("More than one submitted order matched this SMS.");
        }

        return MatchResult.matched(scoredOrders.get(0));
    }

    private static int score(ScoredOrder order, PaymentSmsParser.ParsedPayment payment) {
        int score = 0;
        String reference = normalizeReference(order.paymentReference);
        String transaction = normalizeReference(payment.transactionId);
        if (!transaction.isEmpty() && reference.equals(transaction)) score += 5;
        if (samePhone(order.paymentReference, payment.senderPhone)) score += 4;
        if (samePhone(order.customerPhone, payment.senderPhone)) score += 2;
        if (order.paymentMethod.toLowerCase(Locale.ROOT).contains(payment.provider.toLowerCase(Locale.ROOT))) score += 1;
        return score;
    }

    private static void markOrderPaid(String documentName, PaymentSmsParser.ParsedPayment payment, String receiptId, String now, String idToken) throws Exception {
        String endpoint = "https://firestore.googleapis.com/v1/" + documentName
            + "?updateMask.fieldPaths=paymentStatus"
            + "&updateMask.fieldPaths=paidAt"
            + "&updateMask.fieldPaths=paymentVerifiedAt"
            + "&updateMask.fieldPaths=paymentVerifiedBy"
            + "&updateMask.fieldPaths=paymentSmsReceiptId"
            + "&updateMask.fieldPaths=paymentTransactionId"
            + "&updateMask.fieldPaths=updatedAt";

        JSONObject payload = new JSONObject().put("fields", new JSONObject()
            .put("paymentStatus", stringValue("Paid"))
            .put("paidAt", timestampValue(now))
            .put("paymentVerifiedAt", timestampValue(now))
            .put("paymentVerifiedBy", stringValue("owner-android-verifier"))
            .put("paymentSmsReceiptId", stringValue(receiptId))
            .put("paymentTransactionId", stringValue(payment.transactionId))
            .put("updatedAt", timestampValue(now)));
        patch(endpoint, payload, idToken);
    }

    private static void createReceipt(String receiptId, PaymentSmsParser.ParsedPayment payment, String status, String reason, String orderId, int score, String now, String idToken) throws Exception {
        String endpoint = DATABASE + "/paymentSmsReceipts/" + receiptId;
        JSONObject fields = new JSONObject()
            .put("provider", stringValue(payment.provider))
            .put("paymentMethod", stringValue(payment.provider.equalsIgnoreCase("orange") ? "Orange Money" : "MTN Mobile Money"))
            .put("amount", integerValue(payment.amount))
            .put("senderPhone", stringValue(payment.senderPhone))
            .put("transactionId", stringValue(payment.transactionId))
            .put("message", stringValue(payment.message))
            .put("receivedAt", timestampValue(payment.receivedAt))
            .put("createdAt", timestampValue(now))
            .put("matchStatus", stringValue(status))
            .put("matchReason", stringValue(reason))
            .put("matchedOrderId", stringValue(orderId))
            .put("matchScore", integerValue(score))
            .put("source", stringValue("owner-android-direct"));
        patch(endpoint, new JSONObject().put("fields", fields), idToken);
    }

    private static JSONObject fieldFilter(String field, String op, JSONObject value) throws Exception {
        return new JSONObject().put("fieldFilter", new JSONObject()
            .put("field", new JSONObject().put("fieldPath", field))
            .put("op", op)
            .put("value", value));
    }

    private static JSONObject stringValue(String value) throws Exception {
        return new JSONObject().put("stringValue", value == null ? "" : value);
    }

    private static JSONObject integerValue(int value) throws Exception {
        return new JSONObject().put("integerValue", String.valueOf(value));
    }

    private static JSONObject timestampValue(String value) throws Exception {
        return new JSONObject().put("timestampValue", value);
    }

    private static JSONObject post(String endpoint, JSONObject payload, String idToken) throws Exception {
        return request("POST", endpoint, payload, idToken);
    }

    private static JSONArray postArray(String endpoint, JSONObject payload, String idToken) throws Exception {
        HttpURLConnection connection = open("POST", endpoint, idToken);
        write(connection, payload);
        int status = connection.getResponseCode();
        BufferedReader reader = new BufferedReader(new InputStreamReader(
            status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream(),
            StandardCharsets.UTF_8
        ));
        StringBuilder response = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) response.append(line);
        String body = response.toString();
        if (status < 200 || status >= 300) throw new IllegalStateException(body);
        return new JSONArray(body);
    }

    private static JSONObject patch(String endpoint, JSONObject payload, String idToken) throws Exception {
        return request("PATCH", endpoint, payload, idToken);
    }

    private static JSONObject request(String method, String endpoint, JSONObject payload, String idToken) throws Exception {
        HttpURLConnection connection = open(method, endpoint, idToken);
        write(connection, payload);
        return FirebaseAuthStore.readResponse(connection);
    }

    private static HttpURLConnection open(String method, String endpoint, String idToken) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Authorization", "Bearer " + idToken);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        return connection;
    }

    private static void write(HttpURLConnection connection, JSONObject payload) throws Exception {
        byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(bytes);
        }
    }

    private static String normalizePhone(String value) {
        String digits = value == null ? "" : value.replaceAll("\\D", "");
        return digits.length() > 9 ? digits.substring(digits.length() - 9) : digits;
    }

    private static boolean samePhone(String left, String right) {
        String normalizedLeft = normalizePhone(left);
        String normalizedRight = normalizePhone(right);
        return !normalizedLeft.isEmpty() && normalizedLeft.equals(normalizedRight);
    }

    private static String normalizeReference(String value) {
        return value == null ? "" : value.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private static String receiptId(PaymentSmsParser.ParsedPayment payment) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hash = digest.digest((payment.provider + ":" + payment.transactionId + ":" + payment.message).getBytes(StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < 20; i++) builder.append(String.format("%02x", hash[i]));
        return builder.toString();
    }

    private static String isoNow() {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
        return formatter.format(new Date());
    }

    private static final class MatchResult {
        final String status;
        final String reason;
        final ScoredOrder order;
        final int score;

        private MatchResult(String status, String reason, ScoredOrder order) {
            this.status = status;
            this.reason = reason;
            this.order = order;
            this.score = order == null ? 0 : order.score;
        }

        static MatchResult matched(ScoredOrder order) {
            return new MatchResult("matched", "", order);
        }

        static MatchResult needsReview(String reason) {
            return new MatchResult("needs_review", reason, null);
        }
    }

    private static final class ScoredOrder {
        String documentName;
        String orderId;
        String paymentReference;
        String customerPhone;
        String paymentMethod;
        int score;

        static ScoredOrder fromDocument(JSONObject document) throws Exception {
            JSONObject fields = document.getJSONObject("fields");
            ScoredOrder order = new ScoredOrder();
            order.documentName = document.getString("name");
            order.orderId = stringField(fields, "id");
            order.paymentReference = stringField(fields, "paymentReference");
            order.customerPhone = stringField(fields, "customerPhone");
            order.paymentMethod = stringField(fields, "paymentMethod");
            return order;
        }

        private static String stringField(JSONObject fields, String name) {
            JSONObject field = fields.optJSONObject(name);
            return field == null ? "" : field.optString("stringValue", "");
        }
    }
}
