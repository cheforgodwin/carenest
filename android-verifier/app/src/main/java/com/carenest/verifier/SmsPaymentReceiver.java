package com.carenest.verifier;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

public class SmsPaymentReceiver extends BroadcastReceiver {
    private static final String TAG = "CareNestSmsVerifier";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        if (BuildConfig.FIREBASE_PROJECT_ID.isEmpty() || BuildConfig.FIREBASE_API_KEY.isEmpty()) {
            Log.w(TAG, "Firebase project ID or API key is missing.");
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        String format = bundle.getString("format");
        if (pdus == null || pdus.length == 0) return;

        StringBuilder body = new StringBuilder();
        String sender = "";
        long timestamp = System.currentTimeMillis();

        for (Object pdu : pdus) {
            SmsMessage sms = SmsMessage.createFromPdu((byte[]) pdu, format);
            if (sms == null) continue;
            if (sender.isEmpty()) sender = sms.getDisplayOriginatingAddress();
            timestamp = sms.getTimestampMillis();
            body.append(sms.getMessageBody());
        }

        PaymentSmsParser.ParsedPayment payment = PaymentSmsParser.parse(sender, body.toString(), timestamp);
        if (!payment.looksLikePayment) {
            Log.i(TAG, "SMS ignored because it does not look like a Mobile Money payment.");
            return;
        }

        PaymentVerifierClient.submit(context, payment, (success, message) -> {
            if (success) {
                Log.i(TAG, "Payment SMS submitted: " + message);
            } else {
                Log.e(TAG, "Payment SMS submission failed: " + message);
            }
        });
    }
}
