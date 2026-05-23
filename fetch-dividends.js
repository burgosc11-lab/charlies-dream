#!/usr/bin/env node
/**
 * Charlie's Dream — Dividend Data Fetcher
 * ----------------------------------------
 * Runs daily via GitHub Actions.
 * Fetches live data from Yahoo Finance for all 54 tickers.
 * Writes results to data.json in the repo root.
 * No API key required.
 */

const yahooFinance = require('yahoo-finance2').default;
const fs   = require('fs');
const path = require('path');

// ── Suppress yahoo-finance2 survey/validation notices ──
yahooFinance.setGlobalConfig({ validation: { logErrors: false } });

// ── Ticker list ──────────────────────────────────────────────────────────────
const TICKERS = [
  'JEPQ','MAIN','PECO','GLAD','GAIN','GOOD','PFLT','ADC','EPR','LTC',
  'O','AGNC','DOC','DX','PSEC','TYG','GROW','OXSQ','BCIC','NLOP',
  'EARN','GWRS','MDV','SPMC','EIC','SCM','PNNT','HRZN','SAR','CION',
  'LAND','ECC','XRN','DIV','TBLD','HSHP','IVR','DSL','ORC','CSWC',
  'TRIN','BST','EFC','BTX','SMA','ARR','BBAR','APLE','SLG','BMA',
  'AVAL','VIV','AMRZ','BBD','ITUB'
];

const DELAY_MS  = 1200;  // 1.2 s between tickers — polite to Yahoo
const MAX_RETRY = 3;     // retry each ticker up to 3 times on failure
const RETRY_DELAY_MS = 4000;  // wait 4 s before each retry

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Fetch one ticker (with retries) ──────────────────────────────────────────
async function fetchTicker(ticker, attempt = 1) {
  try {
    const [quoteResult, summaryResult] = await Promise.allSettled([
      yahooFinance.quote(ticker),
      yahooFinance.quoteSummary(ticker, {
        modules: ['summaryDetail', 'calendarEvents'],
        suppressErrors: true
      })
    ]);

    const q  = quoteResult.status  === 'fulfilled' ? quoteResult.value  : null;
    const s  = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
    const sd = s?.summaryDetail   ?? {};
    const ce = s?.calendarEvents  ?? {};

    // ── Price ──
    const price = q?.regularMarketPrice ?? null;
    if (price == null) throw new Error('No price returned — possible rate limit');

    // ── Company name ──
    const companyName = q?.shortName || q?.longName || ticker;

    // ── Dividend per share ──
    const dividendPerShare =
      sd.dividendRate               ??
      q?.trailingAnnualDividendRate ??
      null;

    // ── Yield % ──
    const rawYield =
      sd.dividendYield               ??
      q?.trailingAnnualDividendYield ??
      null;
    const dividendYieldPct = rawYield != null
      ? parseFloat((rawYield * 100).toFixed(4))
      : (dividendPerShare && price
          ? parseFloat(((dividendPerShare / price) * 100).toFixed(4))
          : null);

    // ── Ex-dividend date ──
    // Collect candidates from both modules, prefer the soonest upcoming date.
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const candidates = [sd.exDividendDate, ce.exDividendDate]
      .filter(Boolean)
      .map(d => (d instanceof Date ? d : new Date(d)))
      .filter(d => !isNaN(d.getTime()));

    let exDividendDate = null;
    const upcoming = candidates.filter(d => d >= now);
    if (upcoming.length > 0) {
      upcoming.sort((a, b) => a - b);
      exDividendDate = upcoming[0].toISOString().split('T')[0];
    } else if (candidates.length > 0) {
      candidates.sort((a, b) => b - a);
      exDividendDate = candidates[0].toISOString().split('T')[0];
    }

    return {
      ticker,
      companyName,
      price:            price            != null ? parseFloat(price.toFixed(4))            : null,
      dividendYieldPct: dividendYieldPct != null ? dividendYieldPct                        : null,
      dividendPerShare: dividendPerShare != null ? parseFloat(dividendPerShare.toFixed(4)) : null,
      exDividendDate,
      fetchedAt: new Date().toISOString(),
      error: null
    };

  } catch (err) {
    if (attempt < MAX_RETRY) {
      console.log(`  ↻ ${ticker} retry ${attempt}/${MAX_RETRY - 1} after ${RETRY_DELAY_MS / 1000}s — ${err.message}`);
      await sleep(RETRY_DELAY_MS);
      return fetchTicker(ticker, attempt + 1);
    }
    // All retries exhausted — return a stub so data.json stays valid
    return {
      ticker,
      companyName:      ticker,
      price:            null,
      dividendYieldPct: null,
      dividendPerShare: null,
      exDividendDate:   null,
      fetchedAt: new Date().toISOString(),
      error: err.message
    };
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nCharlie's Dream — Dividend Data Fetcher`);
  console.log(`Fetching ${TICKERS.length} tickers  |  delay: ${DELAY_MS}ms  |  retries: ${MAX_RETRY - 1}`);
  console.log('─'.repeat(60));

  // Load existing data.json so we can keep last-known-good values for failed tickers
  let existing = {};
  const outPath = path.join(__dirname, 'data.json');
  try {
    existing = JSON.parse(fs.readFileSync(outPath, 'utf8')).tickers ?? {};
  } catch (_) { /* first run — no existing data */ }

  const tickers = {};
  let success = 0, failed = 0, kept = 0;

  for (let i = 0; i < TICKERS.length; i++) {
    const ticker = TICKERS[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${TICKERS.length}] ${ticker.padEnd(6)} `);

    const data = await fetchTicker(ticker);

    if (data.error) {
      // Keep the previous good value rather than writing nulls
      if (existing[ticker] && !existing[ticker].error) {
        tickers[ticker] = {
          ...existing[ticker],
          fetchedAt: new Date().toISOString(),
          error: `STALE — live fetch failed: ${data.error}`
        };
        console.log(`⚠  kept previous value  (${data.error})`);
        kept++;
      } else {
        tickers[ticker] = data;
        console.log(`✗  ${data.error}`);
        failed++;
      }
    } else {
      const p = `$${data.price?.toFixed(2) ?? 'N/A'}`;
      const y = data.dividendYieldPct ? `${data.dividendYieldPct.toFixed(2)}%` : 'N/A';
      const x = data.exDividendDate ?? 'Not announced';
      console.log(`✓  price:${p.padStart(8)}  yield:${y.padStart(7)}  ex: ${x}`);
      success++;
    }

    // Polite delay (skip after last ticker)
    if (i < TICKERS.length - 1) await sleep(DELAY_MS);
  }

  // ── Write output ──
  const output = {
    lastUpdated: new Date().toISOString(),
    fetchSummary: {
      total: TICKERS.length,
      success,
      kept,         // used previous value
      failed,
      runAt: new Date().toUTCString()
    },
    tickers
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log('─'.repeat(60));
  console.log(`✓ ${success} fresh   ⚠ ${kept} kept previous   ✗ ${failed} failed`);
  console.log(`Written → ${outPath}`);
  console.log(`Timestamp: ${output.lastUpdated}\n`);

  // Always exit 0 — even partial data is better than a failed workflow.
  // GitHub Actions will still show the summary counts in the logs.
  process.exit(0);
}

main().catch(err => {
  // Unexpected crash — log but still exit 0 so the commit step can run
  // and preserve whatever was already written.
  console.error('Unexpected error in main():', err);
  process.exit(0);
});

