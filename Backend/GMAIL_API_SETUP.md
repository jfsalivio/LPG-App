# Gmail API on Render

The backend supports `MAIL_PROVIDER=gmail-api` over HTTPS with Node 20+.
Password resets, contact messages (including Reply-To), purchase orders and
payment PDFs all use the same transport. SMTP remains the default for existing
deployments. A Gmail App Password cannot be used as an OAuth refresh token.

## Authorize the sender

1. Open https://console.cloud.google.com/ and create or select a project.
2. Enable **Gmail API** in APIs & Services > Library.
3. Configure Google Auth Platform branding and audience (External for personal
   Gmail). While Testing, add `jose.villanueva.admin@gmail.com` as a test user.
4. Create an OAuth client of type **Web application**. Add this exact authorized
   redirect URI: `https://developers.google.com/oauthplayground`.
5. Open https://developers.google.com/oauthplayground/ . In the settings gear,
   enable **Use your own OAuth credentials** and enter that client's ID and secret.
   Use the server-side flow with offline access and consent prompting.
6. Enter scope `https://www.googleapis.com/auth/gmail.send`, click Authorize APIs,
   and sign in as **jose.villanueva.admin@gmail.com**. Approve sending mail.
7. Exchange the authorization code for tokens. Copy the refresh token directly
   into Render's environment settings; do not commit or paste credentials in chat.

Google's External/Testing refresh tokens with Gmail scope expire after seven
days. For ongoing use, configure the consent screen for Production, follow any
verification requirements Google presents, and authorize again. Tokens can also
be revoked later; an HTTP 400 on token refresh usually requires checking or
renewing OAuth authorization.

## Configure and deploy

Set these values on the existing Render **backend service**, with no surrounding
quotes, then deploy the updated backend code:

```dotenv
MAIL_PROVIDER=gmail-api
GMAIL_USER=jose.villanueva.admin@gmail.com
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
```

SMTP variables are unused in Gmail API mode. Keep other database and application
variables. The transport forces the From address to GMAIL_USER; authorize that
same mailbox. It caches access tokens and refreshes them automatically, with
15-second HTTP timeouts. It does not automatically retry sends, because a timeout
can mean submission succeeded but its response was lost.

After deployment, submit one contact message or request a password reset for a
known active account. Check the sender's Sent folder and the recipient's inbox
and spam folder. Then check a purchase-order PDF send. HTTP 401 suggests revoked
authorization; 403 suggests API enablement, scope, mailbox or policy issues.
Password resets intentionally return a generic response even on email failure;
check Render logs to confirm failures. Never enable HTTP credential logging.

References:
- https://developers.google.com/workspace/gmail/api/guides/sending
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/protocols/oauth2
