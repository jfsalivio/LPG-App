const nodemailer = require("nodemailer");
require("dotenv").config();

const provider = process.env.MAIL_PROVIDER || "smtp";
if (!["smtp", "gmail-api"].includes(provider)) throw new Error("Unsupported MAIL_PROVIDER");
let cachedToken;
let tokenExpiresAt = 0;
let refreshing;

async function googleRequest(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok) {
    // Do not expose OAuth response bodies or credentials in logs.
    const error = new Error(`Gmail API request failed (HTTP ${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function accessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  if (!refreshing) {
    refreshing = (async () => {
      const required = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_USER"];
      const missing = required.filter(key => !process.env[key]);
      if (missing.length) throw new Error(`Gmail API is not configured: missing ${missing.join(", ")}`);
      const data = await googleRequest("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({
          client_id: process.env.GMAIL_CLIENT_ID,
          client_secret: process.env.GMAIL_CLIENT_SECRET,
          refresh_token: process.env.GMAIL_REFRESH_TOKEN,
          grant_type: "refresh_token",
        }),
      });
      if (!data.access_token) throw new Error("Google did not return an access token");
      cachedToken = data.access_token;
      tokenExpiresAt = Date.now() + Math.max(0, Number(data.expires_in || 3600) - 60) * 1000;
      return cachedToken;
    })().finally(() => { refreshing = undefined; });
  }
  return refreshing;
}

const gmailTransport = {
  name: "gmail-api",
  version: "1.0.0",
  send(mail, callback) {
    (async () => {
      const token = await accessToken();
      const chunks = [];
      for await (const chunk of mail.message.createReadStream()) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString("base64url");
      const user = encodeURIComponent(process.env.GMAIL_USER);
      let result;
      try {
        result = await googleRequest(`https://gmail.googleapis.com/gmail/v1/users/${user}/messages/send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        });
      } catch (error) {
        if (error.status === 401) { cachedToken = undefined; tokenExpiresAt = 0; }
        // Never retry an uncertain send automatically: it could duplicate an order email.
        throw error;
      }
      if (!result.id) throw new Error("Gmail API did not confirm message submission");
      return { messageId: result.id, accepted: mail.message.getEnvelope().to, rejected: [] };
    })().then(result => callback(null, result), callback);
  },
};

const transporter = nodemailer.createTransport(provider === "gmail-api" ? gmailTransport : {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true", // true for port 465, false for 587/25
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Direct purchase-order sends must use the selected provider's sender too.
transporter.use("compile", (mail, callback) => {
  if (provider === "gmail-api") {
    mail.data.from = { name: "GasTrack", address: process.env.GMAIL_USER };
  } else if (!mail.data.from) {
    mail.data.from = process.env.SMTP_FROM || `"GasTrack" <${process.env.SMTP_USER}>`;
  }
  callback();
});

async function sendMail(message) {
  return transporter.sendMail(message);
}

module.exports = { transporter, sendMail };
