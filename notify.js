#!/usr/bin/env node
'use strict';

// ── THE LIST — GitHub Actions push notification sender ──
// Runs daily via .github/workflows/notify.yml
// Reads ex-dates from portfolio.json (live synced data),
// sends a Web Push notification to the subscribed device.

const webpush = require('web-push');
const fs      = require('fs');
const path    = require('path');

// ── VAPID keys (stored in GitHub Secrets) ──
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing required env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY');
  process.exit(1);
}

webpush.setVapidDetails(
  VAPID_SUBJECT || 'mailto:admin@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// ── Load push subscription ──
// Reads from push_subscription.json (saved by the app when user subscribes).
// Falls back to PUSH_SUBSCRIPTION env var if file doesn't exist yet.
let subscription;
const subPath = path.join(__dirname, 'push_subscription.json');
if (fs.existsSync(subPath)) {
  try {
    subscription = JSON.parse(fs.readFileSync(subPath, 'utf8'));
    console.log('Loaded subscription from push_subscription.json');
  } catch (e) {
    console.error('Failed to parse push_subscription.json:', e.message);
    process.exit(1);
  }
} else if (process.env.PUSH_SUBSCRIPTION) {
  try {
    subscription = JSON.parse(process.env.PUSH_SUBSCRIPTION);
    console.log('Loaded subscription from PUSH_SUBSCRIPTION secret');
  } catch (e) {
    console.error('Failed to parse PUSH_SUBSCRIPTION secret:', e.message);
    process.exit(1);
  }
} else {
  console.log('No push subscription found (push_subscription.json missing, PUSH_SUBSCRIPTION secret not set).');
  console.log('Open the app on your phone, go to Alerts, and tap Subscribe.');
  process.exit(0);
}

// ── Load portfolio.json ──
// portfolio.json has structure: { _syncedAt, stocks: [{ticker, exDividendDate, ...}] }
const portfolioPath = path.join(__dirname, 'portfolio.json');
if (!fs.existsSync(portfolioPath)) {
  console.log('portfolio.json not found — no ex-dates to check. Run the app once to sync.');
  process.exit(0);
}

let entries = [];
try {
  const raw = JSON.parse(fs.readFileSync(portfolioPath, 'utf8'));
  entries = Array.isArray(raw) ? raw : (raw.stocks || []);
} catch (e) {
  console.error('Failed to parse portfolio.json:', e.message);
  process.exit(1);
}

// ── MARKET HOLIDAYS (keep in sync with index.html) ──
const MARKET_HOLIDAYS = new Set([
  '2026-01-01','2026-01-19','2026-02-16','2026-04-03',
  '2026-05-25','2026-06-19','2026-07-03','2026-09-07',
  '2026-11-26','2026-12-25',
  '2027-01-01','2027-01-18'
]);

function isMarketHoliday(d) {
  const s = d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
  return MARKET_HOLIDAYS.has(s);
}

function prevBizDay(d) {
  const r = new Date(d); r.setHours(0,0,0,0);
  do { r.setDate(r.getDate()-1); }
  while (r.getDay()===0 || r.getDay()===6 || isMarketHoliday(r));
  return r;
}

function alertDateFor(exDateStr) {
  if (!exDateStr) return null;
  const ex = new Date(exDateStr + 'T00:00:00');
  if (ex.getDay()===1 || isMarketHoliday(ex)) return prevBizDay(prevBizDay(ex));
  return prevBizDay(ex);
}

function today0() {
  const d = new Date(); d.setHours(0,0,0,0); return d;
}

// ── CHECK WHICH TICKERS NEED ALERTING TODAY ──
const today  = today0();
const alerts = [];
const seen   = new Set();
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

entries.forEach(t => {
  if (!t.exDividendDate) return;
  const key = t.ticker + '_' + t.exDividendDate;
  if (seen.has(key)) return;
  seen.add(key);

  const alertDate = alertDateFor(t.exDividendDate);
  if (!alertDate || alertDate.getTime() !== today.getTime()) return;

  const ex       = new Date(t.exDividendDate + 'T00:00:00');
  const isMonday = ex.getDay() === 1;
  const isHol    = isMarketHoliday(ex);
  const dateStr  = MONTHS[ex.getMonth()] + ' ' + ex.getDate();

  const msg = isMonday
    ? `${t.ticker} ex-div Mon ${dateStr} — buy TODAY (Friday) to capture the dividend`
    : isHol
    ? `${t.ticker} ex-div ${dateStr} falls on a holiday — buy TODAY, last trading day`
    : `${t.ticker} ex-div TOMORROW ${dateStr} — buy today to capture the dividend`;

  alerts.push({ ticker: t.ticker, msg });
});

if (!alerts.length) {
  console.log('No dividend alerts for today (' + today.toDateString() + '). Done.');
  process.exit(0);
}

// ── SEND PUSH ──
const title = 'BUY TODAY';
const body  = alerts.map(a => a.msg).join('\n');

console.log('Sending push notification:');
console.log('  Title:', title);
console.log('  Body:', body);

webpush.sendNotification(subscription, JSON.stringify({ title, body }))
  .then(() => {
    console.log('Push sent to', alerts.map(a => a.ticker).join(', '));
  })
  .catch(e => {
    console.error('Push failed:', e.statusCode, e.body || e.message);
    // Exit 0 so the workflow doesn't fail — a stale subscription is expected occasionally
    process.exit(0);
  });
