#!/usr/bin/env node
'use strict';

// ── THE LIST — GitHub Actions push notification sender ──
// Runs daily via .github/workflows/notify.yml
// Reads BASE_TICKERS from index.html, checks today's alert dates,
// sends a Web Push notification to the subscribed iPhone.

const webpush = require('web-push');
const fs      = require('fs');
const path    = require('path');

// ── ENV VARS (set in GitHub Secrets) ──
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SUBSCRIPTION } = process.env;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !PUSH_SUBSCRIPTION) {
  console.error('Missing required env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_SUBSCRIPTION');
  process.exit(1);
}

webpush.setVapidDetails(
  VAPID_SUBJECT || 'mailto:admin@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const subscription = JSON.parse(PUSH_SUBSCRIPTION);

// ── PARSE BASE_TICKERS FROM index.html ──
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const match = html.match(/const BASE_TICKERS\s*=\s*(\[[\s\S]*?\]);/);
if (!match) { console.error('BASE_TICKERS not found in index.html'); process.exit(1); }
let BASE_TICKERS;
try { BASE_TICKERS = eval(match[1]); }
catch (e) { console.error('Failed to parse BASE_TICKERS:', e.message); process.exit(1); }

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

BASE_TICKERS.forEach(t => {
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
const title = 'BUY TODAY 🔥';
const body  = 'SSIIIUUUU';

console.log('Sending push notification:');
console.log('  Title:', title);

webpush.sendNotification(subscription, JSON.stringify({ title, body }))
  .then(() => {
    console.log('✓ Push sent to', alerts.map(a => a.ticker).join(', '));
  })
  .catch(e => {
    console.error('✗ Push failed:', e.statusCode, e.body || e.message);
    process.exit(1);
  });
