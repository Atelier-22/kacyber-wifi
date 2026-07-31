# WhatsApp WiFi Voucher Bot

A WhatsApp chatbot that sells WiFi vouchers, airtime and mobile-data bundles: menu-driven purchases, KaCyber Pay collection prompts, delivery callbacks, and a secured admin dashboard.

Data offers are loaded from KaCyber's live Data Products Catalog whenever a customer opens **Buy Data**. The WhatsApp menu paginates every current MTN/Airtel offer up to 12 GB; it falls back to the documented sample offers only if KaCyber is temporarily unavailable.

Payment and voucher issuing are currently **mocked** (no MTN MoMo / Airtel / FlexiPay wired in yet — that's a deliberate next step, not an oversight). Everything else — WhatsApp messaging, session handling, webhook security, admin auth, dashboard — is real and production-ready.

## Structure

```
whatsapp-wifi-bot/
  src/
    server.js                Express app: webhook, payment callback, admin API, auth
    config.js                All settings, pulled from .env
    conversationFlow.js      State machine driving the chat experience
    messages.js              Every customer-facing message template
    validators.js            Phone number + menu input validation
    sessionStore.js          Per-user conversation state (15 min TTL)
    whatsappClient.js        Sends messages via WhatsApp Cloud API
    webhookSecurity.js       Verifies Meta's webhook signature
    dedupeStore.js           Ignores retried webhook deliveries
    authMiddleware.js        HTTP Basic Auth for the admin dashboard
    paymentTimeoutWatcher.js Nudges customers stuck mid-payment
    store.js                 Tiny JSON file persistence helper
    data/                    transactions.json / vouchers.json (auto-created, gitignored)
    integrations/
      paymentService.js      Mock payment provider — swap when MTN/Airtel is ready
      voucherService.js      Mock voucher issuer — swap when MikroTik/DB is ready
  admin-dashboard/
    index.html, style.css, app.js   Live transactions console
  .env.example
  package.json
```

## Local setup

```
npm install
cp .env.example .env
```

Fill in `.env` — see the walkthrough below for where each value comes from.

```
npm start
```

### Voucher stock

The supplied [`src/unifi_vouchers.xlsx`](src/unifi_vouchers.xlsx) is imported into SQLite voucher inventory. It is safe to run repeatedly: existing voucher codes are skipped.

```
node src/importVouchers.js
```

The import currently contains 20 three-hour, 20 sixteen-hour, and 19 thirty-day vouchers. A voucher is assigned only after payment success, is linked to the receiving phone number and transaction, and the customer can check either their own WhatsApp number or a different number. The protected admin endpoint `GET /api/vouchers` shows stock counts and whether `WIFI_VOUCHER_MERCHANT_ID` is configured (without exposing the ID).

- Bot webhook: `http://localhost:3000/webhook`
- Admin dashboard: `http://localhost:3000/admin` (browser will prompt for the `ADMIN_USERNAME` / `ADMIN_PASSWORD` you set)
- Health check: `http://localhost:3000/health`

On first run it seeds 60 mock transactions so the dashboard isn't empty. This only happens once — delete the `paymentService.seedMockTransactions(60)` line in `server.js` before real customers start paying.

## What's actually protecting this now

- **Webhook signature verification** — every incoming webhook POST is checked against Meta's `X-Hub-Signature-256` header using `WHATSAPP_APP_SECRET`. Forged requests are rejected with 401.
- **Duplicate delivery protection** — Meta retries webhooks that don't respond fast enough; `dedupeStore.js` makes sure the same message never gets processed twice.
- **Admin dashboard + API behind Basic Auth** — nobody sees transaction data or phone numbers without the admin password.
- **Payment timeout messaging** — if a customer never confirms payment, they get a message after 5 minutes instead of being left hanging silently.
- **Disk persistence** — transactions and vouchers survive a server restart (`src/data/*.json`), instead of vanishing from memory.

## Where the real backend plugs in later

Two files, two function signatures — nothing else in the app needs to change when you're ready:

**`src/integrations/paymentService.js`**
- `initiatePayment(phoneNumber, amount, meta)` → call the real payment provider, return `{ transactionId, status }`
- `getPaymentStatus(transactionId)` → check real payment status
- Real provider's webhook should POST `{ transactionId, status }` to `/payment-callback`

**`src/integrations/voucherService.js`**
- `issueVoucher(phoneNumber, packageInfo)` → pull a real voucher from MikroTik User Manager or a DB
- `getActiveVoucher(phoneNumber)` → look up a customer's real active voucher

---

# Step-by-step: getting this live with a real WhatsApp number

Do this in order. Takes about 30–45 minutes if Meta doesn't stall you on verification.

## 1. Create a Meta Developer app

1. Go to the [Meta App Dashboard](https://developers.facebook.com/apps) and log in with a Facebook account.
2. Click **Create App** → choose **"Connect with customers through WhatsApp"** as the use case.
3. Name the app (e.g. "XYZ WiFi Bot"), add your email, click through.
4. Select an existing Business Portfolio or create a new one for KaCyber / the client.
5. Confirm and click **Create app**.

You'll land on **Customize use case → Connect on WhatsApp → Quickstart**.

## 2. Connect a WhatsApp Business Account and get your test number

1. Click **Start using the API**.
2. Under API Setup, connect (or create) a WhatsApp Business Account.
3. Meta gives you a **free test phone number** automatically — good enough for tonight. You can add your real business number later without changing any code.
4. Copy the **Phone Number ID** shown on this page → this is your `WHATSAPP_PHONE_NUMBER_ID`.

## 3. Get a temporary access token (to prove things work first)

1. Still on the API Setup page, click **Generate access token**.
2. This token expires in ~24 hours — fine for testing tonight, not for production (step 5 fixes that).
3. Copy it → this is your `WHATSAPP_ACCESS_TOKEN` for now.
4. Add your own WhatsApp number as a **To** number and send yourself the test message to confirm the number works.

## 4. Point the webhook at your running server

Meta needs an HTTPS URL it can reach — `localhost` won't work directly.

1. Install and run [ngrok](https://ngrok.com) (free tier is fine):
   ```
   ngrok http 3000
   ```
2. Copy the `https://xxxx.ngrok-free.app` URL it gives you.
3. Back in the Meta dashboard, go to **Configuration** → **Webhook**.
4. Set the **Callback URL** to `https://xxxx.ngrok-free.app/webhook`.
5. Set the **Verify Token** to any string you like — put that exact string in your `.env` as `WHATSAPP_VERIFY_TOKEN`.
6. Click **Verify and Save**. Your running server needs to already be up for this handshake to succeed (`npm start` first).
7. Subscribe to the **messages** webhook field.

## 5. Get your App Secret (needed for webhook signature verification)

1. In the Meta dashboard, go to **App Settings → Basic**.
2. Copy the **App Secret** (click "Show", you may need to re-enter your Facebook password).
3. Put it in `.env` as `WHATSAPP_APP_SECRET`. Without this, the bot logs a warning and skips signature verification — fine for tonight, not for going live with real customers.

## 6. Create a permanent access token (replaces the 24-hour one)

The temporary token from step 3 expires — don't build on it long-term.

1. Go to **Business Settings → System Users**.
2. Click **Add** → create a new system user (e.g. "wifi-bot-system-user").
3. Select it, click **Assign Assets** → assign your app (Full control) and your WhatsApp Business Account (Full control).
4. Click **Generate token**, select your app, and add these permissions:
   - `business_management`
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Copy the generated token → replace `WHATSAPP_ACCESS_TOKEN` in `.env` with this one. It doesn't expire the way the test token does.

## 7. Test the full loop

```
npm start
```

Then on WhatsApp, message your test number:

1. Send `hi` → you should get the main menu back.
2. Reply `1` → package list.
3. Pick a package → it asks for your Mobile Money number.
4. Enter a number → "payment request sent" message.
5. Simulate the payment confirming (since real payment isn't wired in yet):
   ```
   curl -X POST http://localhost:3000/payment-callback \
     -H "Content-Type: application/json" \
     -d '{"transactionId":"<the TX id from the admin dashboard>","status":"SUCCESS"}'
   ```
6. You should get the voucher pushed straight to your WhatsApp chat.

Check `http://localhost:3000/admin` (with your admin login) to see the transaction and voucher recorded.

## 8. Going properly live (whenever you're ready, not necessarily tonight)

- Deploy the server somewhere with a stable HTTPS URL (Render, Railway, a VPS with Nginx + Let's Encrypt) instead of relying on ngrok, which changes URLs on restart.
- Submit the app for **App Review** in Meta's dashboard to move off test numbers and lift messaging limits, if you're not already using a verified business number.
- Replace the mock `paymentService.js` and `voucherService.js` with MTN MoMo / Airtel Money and MikroTik integrations once those are ready — the rest of the app doesn't change.
- Delete the `seedMockTransactions(60)` call in `server.js`.
- Set a strong, unique `ADMIN_PASSWORD` — the example one is not safe to ship with.
