package com.carenest.verifier;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {
    private static final int SMS_PERMISSION_REQUEST = 1001;
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(22);
        layout.setPadding(padding, padding, padding, padding);

        TextView title = new TextView(this);
        title.setText("CareNest Payment Verifier");
        title.setTextSize(24);
        title.setTextColor(0xFF073B25);
        title.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);

        status = new TextView(this);
        status.setTextSize(16);
        status.setTextColor(0xFF466454);
        status.setPadding(0, dp(14), 0, 0);
        status.setText(getStatusText());

        EditText email = new EditText(this);
        email.setHint("Admin email");
        email.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        email.setPadding(0, dp(14), 0, 0);

        EditText password = new EditText(this);
        password.setHint("Admin password");
        password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);

        Button signIn = new Button(this);
        signIn.setText("Sign in verifier");
        signIn.setOnClickListener((view) -> {
            status.setText("Signing in...");
            FirebaseAuthStore.signIn(this, email.getText().toString().trim(), password.getText().toString(), (success, message) -> runOnUiThread(() -> {
                status.setText(success ? getStatusText() : "Sign in failed: " + message);
                if (success) {
                    password.setText("");
                }
            }));
        });

        Button signOut = new Button(this);
        signOut.setText("Sign out");
        signOut.setOnClickListener((view) -> {
            FirebaseAuthStore.signOut(this);
            status.setText(getStatusText());
        });

        Button sendTest = new Button(this);
        sendTest.setText("Send test receipt");
        sendTest.setOnClickListener((view) -> {
            status.setText("Sending test receipt...");
            String message = "You have received " + BuildConfig.TEST_RECEIPT_AMOUNT + " FCFA from " + BuildConfig.TEST_RECEIPT_SENDER_PHONE + ". Transaction ID TEST" + System.currentTimeMillis() + ".";
            PaymentSmsParser.ParsedPayment payment = PaymentSmsParser.parse("MTN MoMo", message, System.currentTimeMillis());
            PaymentVerifierClient.submit(this, payment, (success, result) -> runOnUiThread(() -> status.setText(success ? "Test receipt sent: " + result : "Test failed: " + result)));
        });

        Button openAdmin = new Button(this);
        openAdmin.setText("Open admin dashboard");
        openAdmin.setOnClickListener((view) -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.ADMIN_DASHBOARD_URL))));

        layout.addView(title);
        layout.addView(status);
        layout.addView(email);
        layout.addView(password);
        layout.addView(signIn);
        layout.addView(signOut);
        layout.addView(sendTest);
        layout.addView(openAdmin);
        setContentView(layout);

        if (checkSelfPermission(Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] {
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS
            }, SMS_PERMISSION_REQUEST);
        }
    }

    private String getStatusText() {
        if (BuildConfig.FIREBASE_PROJECT_ID.isEmpty() || BuildConfig.FIREBASE_API_KEY.isEmpty()) {
            return "Missing Firebase project ID or API key. Add them in android-verifier/local.properties before building the private APK.";
        }

        if (!FirebaseAuthStore.hasRefreshToken(this)) {
            return "Sign in with the CareNest admin account. This private app will use Firestore rules to verify payments without Cloud Functions billing.";
        }

        if (checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED) {
            return "Ready. Keep this phone on and connected. Incoming Mobile Money SMS messages will be sent to CareNest for verification.";
        }

        return "SMS permission is required so this private owner app can read payment messages on this phone.";
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
