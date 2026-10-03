# Automatic Mobile Money network detection

Checkout, marketplace checkout, and payment retries identify the network from the payment phone. Customers no longer choose a network. The API independently detects the network and ignores client or saved network selections.

Supported Cameroon prefixes:
- MTN MoMo: 650-654, 67x, 68x.
- Orange Money: 655-659, 69x.

The detector accepts nine-digit local numbers, +237/237 country codes, and 00237 international format, with spaces, parentheses, dots, or hyphens. It rejects other prefixes, foreign country codes, wrong lengths, and alphabetic input before initiating a payment. Prefix identification does not verify that the account exists, owns the number, or has sufficient funds; Fapshi processes the request and server verification confirms payment.

MTN pending-payment feedback tells the payer to dial *126# if the prompt does not appear, as advised in the supplied Fapshi support reply. It also reminds the payer to have enough funds. Retrying an existing transaction still requires independent failure verification.

References:
- Fapshi Direct Pay: https://docs.fapshi.com/en/api-reference/endpoint/direct-pay
- Mobile Money prefix allocations: https://docs.netwalletpay.com/netwallet-api-docs/reference/mobile-money-operator-prefixes

## Production validation ? 3 October 2026

Deployment dpl_BsecgGLCA4zA4LL6PvA8iJzhQiXD was promoted to https://carenest237.com. The canonical homepage and automatic-network checkout assets returned HTTP 200. All 177 unit tests passed before deployment.

The owner explicitly authorized one 100 XAF test to their MTN number ending 145. The protected build diagnostic called the deployed payment API once using durable test ID owner-auto-100-20261003-145. The API returned HTTP 202 with transaction PgS77Ya2. An authenticated Fapshi status check subsequently returned FAILED; no reason or operator reference was supplied. The diagnostic order, dispatch guard, and financial history remain available for reconciliation. No automatic retry was sent.

The diagnostic build dpl_9P8EYX76ofV3xzm3JCmqDTEtZXb5 used a one-off build flag. The flag was not saved as a project environment setting.


A subsequent read-only production check confirmed HTTP 200 credential authentication, MTN detection, matching customer/order/amount, matching webhook configuration, and failed-status delivery by fapshi-webhook. Fapshi confirmed FAILED approximately two seconds after initiation and supplied no failure reason. The owner reported that the payment wallet had no funds and no prompt appeared. Insufficient funds is a likely explanation, not a provider-confirmed failure reason. No further collection request was sent.


The owner then explicitly authorized one 100 XAF test to an alternate MTN number ending 468. Test ID owner-auto-100-20261003-468 produced transaction EYaSEYmV through the canonical production API (HTTP 202). Three authenticated status checks returned PENDING, most recently at 2026-10-03 02:04:50 UTC. Approval/prompt delivery remained unconfirmed at that point. No duplicate request was sent; webhook reconciliation remains active.
