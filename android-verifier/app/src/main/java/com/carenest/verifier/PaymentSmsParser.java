package com.carenest.verifier;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class PaymentSmsParser {
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("(?:XAF|FCFA|CFA)?\\s*([0-9 .,_]{3,})\\s*(?:XAF|FCFA|CFA)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PHONE_PATTERN = Pattern.compile("(?:\\+?237)?\\s*6(?:[\\s.-]?\\d){8}");
    private static final Pattern REF_PATTERN = Pattern.compile("(?:transaction|trans|txn|reference|ref|id|code)\\D{0,12}([A-Z0-9-]{5,})", Pattern.CASE_INSENSITIVE);

    private PaymentSmsParser() {}

    static ParsedPayment parse(String sender, String message, long timestampMillis) {
        String safeMessage = message == null ? "" : message;
        String lowerMessage = safeMessage.toLowerCase(Locale.ROOT);
        String lowerSender = sender == null ? "" : sender.toLowerCase(Locale.ROOT);

        int amount = parseAmount(safeMessage);
        String senderPhone = parseSenderPhone(safeMessage);
        String transactionId = parseTransactionId(safeMessage);
        boolean providerSender = lowerSender.contains("mtn")
            || lowerSender.contains("momo")
            || lowerSender.contains("orange");
        boolean paymentWords = lowerMessage.contains("received")
            || lowerMessage.contains("recu")
            || lowerMessage.contains("paiement")
            || lowerMessage.contains("payment")
            || lowerMessage.contains("transfert")
            || lowerMessage.contains("transfer");
        boolean looksLikePayment = amount > 0 && paymentWords && (providerSender || !senderPhone.isEmpty() || !transactionId.isEmpty());

        return new ParsedPayment(
            BuildConfig.VERIFIER_PROVIDER,
            amount,
            senderPhone,
            transactionId,
            safeMessage,
            toIsoDate(timestampMillis),
            looksLikePayment
        );
    }

    private static int parseAmount(String message) {
        Matcher matcher = AMOUNT_PATTERN.matcher(message);
        if (!matcher.find()) return 0;
        String digits = matcher.group(1).replaceAll("[^0-9]", "");
        if (digits.isEmpty()) return 0;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static String parseSenderPhone(String message) {
        Matcher matcher = PHONE_PATTERN.matcher(message);
        if (!matcher.find()) return "";
        String digits = matcher.group().replaceAll("[^0-9]", "");
        return digits.length() > 9 ? digits.substring(digits.length() - 9) : digits;
    }

    private static String parseTransactionId(String message) {
        Matcher matcher = REF_PATTERN.matcher(message);
        if (!matcher.find()) return "";
        return matcher.group(1).replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private static String toIsoDate(long timestampMillis) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
        return formatter.format(new Date(timestampMillis));
    }

    static final class ParsedPayment {
        final String provider;
        final int amount;
        final String senderPhone;
        final String transactionId;
        final String message;
        final String receivedAt;
        final boolean looksLikePayment;

        ParsedPayment(String provider, int amount, String senderPhone, String transactionId, String message, String receivedAt, boolean looksLikePayment) {
            this.provider = provider;
            this.amount = amount;
            this.senderPhone = senderPhone;
            this.transactionId = transactionId;
            this.message = message;
            this.receivedAt = receivedAt;
            this.looksLikePayment = looksLikePayment;
        }
    }
}
