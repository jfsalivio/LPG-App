const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nodemailer = require('nodemailer');

function setup({ failToken = false, failSend = false, missing = false } = {}) {
  const calls = [];
  const env = {
    MAIL_PROVIDER: 'gmail-api', GMAIL_USER: 'sender@gmail.com',
    GMAIL_CLIENT_ID: 'client', GMAIL_CLIENT_SECRET: 'secret',
    ...(!missing && { GMAIL_REFRESH_TOKEN: 'refresh' }),
  };
  const context = {
    module: { exports: {} }, process: { env }, Buffer, URLSearchParams, AbortSignal,
    require(name) {
      if (name === 'nodemailer') return nodemailer;
      if (name === 'dotenv') return { config() {} };
      throw new Error(name);
    },
    async fetch(url, options) {
      calls.push({ url, options });
      const token = url.includes('oauth2');
      const failed = token ? failToken : failSend;
      return {
        ok: !failed, status: failed ? (token ? 400 : 403) : 200,
        async json() { return failed ? { error: 'private credential details' } :
          token ? { access_token: 'access', expires_in: 3600 } : { id: 'gmail-message' }; },
      };
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../config/mailer.js'), 'utf8'), context);
  return { ...context.module.exports, calls };
}

test('Gmail API preserves Reply-To and PDF MIME, forces sender, and reuses OAuth token', async () => {
  const { sendMail, transporter, calls } = setup();
  const result = await sendMail({
    from: 'old@example.com', to: 'recipient@example.com', replyTo: 'customer@example.com',
    subject: 'Test', text: 'Hello', html: '<p>Hello</p>',
    attachments: [{ filename: 'order.pdf', content: Buffer.from('%PDF-1.4\nexample') }],
  });
  assert.equal(result.messageId, 'gmail-message');
  assert.deepEqual(Array.from(result.accepted), ['recipient@example.com']);
  const request = calls[1];
  assert.match(request.url, /users\/sender%40gmail.com\/messages\/send$/);
  assert.equal(request.options.headers.Authorization, 'Bearer access');
  const raw = JSON.parse(request.options.body).raw;
  assert.doesNotMatch(raw, /[+/=]/);
  const mime = Buffer.from(raw, 'base64url').toString();
  assert.match(mime, /From: GasTrack <sender@gmail.com>/);
  assert.match(mime, /Reply-To: customer@example.com/);
  assert.match(mime, /Content-Type: application\/pdf/);
  assert.match(mime, /JVBERi0xLjQKZXhhbXBsZQ==/);
  assert.doesNotMatch(mime, /old@example.com/);
  await transporter.sendMail({ to: 'supplier@example.com', subject: 'Direct send', text: 'PDF' });
  assert.equal(calls.filter(c => c.url.includes('oauth2')).length, 1);
});

test('missing OAuth settings fail before network requests', async () => {
  const { sendMail, calls } = setup({ missing: true });
  await assert.rejects(sendMail({ to: 'recipient@example.com', text: 'Test' }), /GMAIL_REFRESH_TOKEN/);
  assert.equal(calls.length, 0);
});

test('OAuth failure does not send a message or expose Google response details', async () => {
  const { sendMail, calls } = setup({ failToken: true });
  await assert.rejects(sendMail({ to: 'recipient@example.com', text: 'Test' }), /^Error: Gmail API request failed \(HTTP 400\)$/);
  assert.equal(calls.length, 1);
});

test('send failure is surfaced without duplicate retries', async () => {
  const { sendMail, calls } = setup({ failSend: true });
  await assert.rejects(sendMail({ to: 'recipient@example.com', text: 'Test' }), /HTTP 403/);
  assert.equal(calls.length, 2);
});
