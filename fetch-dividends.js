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
const fs = require('fs');
const path = require('path');

// ── Ticker list ──────────────────────────────────────────────────────────────
const TICKERS = [
  'JEPQ','MAIN','PECO','GLAD','GAIN','GOOD','PFLT','ADC','EPR','LTC',
  'O','AGNC','DOC','DX','PSEC','TYG','GROW','OXSQ','BCIC','NLOP',
  'EARN','GWRS','MDV','SPMC','EIC','SCM','PNNT','HRZN','SAR','CION',
  'LAND','ECC','XRN','DIV','TBLD','HSHP','IVR','DSL','ORC','CSWC',
  'TRIN','BST','EFC','BTX','SMA','ARR','BBAR','APLE','SLG','BMA',
  'AVAL','VIV','AMRZ','BBD','ITUB'
];

// Polite delay between requests (ms) — keeps Yahoo happy
const DELAY_MS = 600;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Fetch a single ticker ────────────────────────────────────────────────────
async function fetchTicker(ticker) {
  try {
    // Run both calls in parallel for speed
    const [quote, summary] = await Promise.allSettled([
      yahooFinance.quote(ticker),
      yahooFinance.quoteSummary(ticker, {
        modules: ['summaryDetail', 'calendarEvents'],
        suppressErrors: true
      })
    ]);

    const q  = quote.status  === 'fulfilled' ? quote.value  : null;
    const s  = summary.status === 'fulfilled' ? summary.value : null;
    const sd = s?.summaryDetail ?? {};
    const ce = s?.calendarEvents ?? {};

    // ── Price ──
    const price = q?.regularMarketPrice ?? null;

    // ── Company name ──
    const companyName = q?.shortName || q?.longName || ticker;

    // ── Dividend per share (forward annual rate preferred) ──
    const dividendPerShare =
      sd.dividendRate ??
      q?.trailingAnnualDividendRate ??
      null;

    // ── Yield % ──
    const rawYield = sd.dividendYield ?? q?.trailingAnnualDividendYield ?? null;
    const dividendYieldPct = rawYield != null
      ? parseFloat((rawYield * 100).toFixed(4))
      : (dividendPerShare && price
          ? parseFloat(((dividendPerShare / price) * 100).toFixed(4))
          : null);

    // ── Ex-dividend date ──
    // Strategy: collect all candidate dates, prefer the soonest upcoming one,
    // fall back to the most recently passed one.
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const raw = [sd.exDividendDate, ce.exDividendDate];
    const candidates = raw
      .filter(Boolean)
      .map(d => (d instanceof Date ? d : new Date(d)))
      .filter(d => !isNaN(d.getTime()));

    let exDividendDate = null;
    const upcoming = candidates.filter(d => d >= now);
    if (upcoming.length > 0) {
      upcoming.sort((a, b) => a - b);
      exDividendDate = upcoming[0].toISOString().split('T')[0];
    } else if (candidates.length > 0) {
      candidates.sort((a, b) => b - a);            // most recent first
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
  console.log(`Fetching ${TICKERS.length} tickers from Yahoo Finance`);
  console.log('─'.repeat(56));

  const tickers = {};
  let success = 0, failed = 0;

  for (let i = 0; i < TICKERS.length; i++) {
    const ticker = TICKERS[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${TICKERS.length}] ${ticker.padEnd(6)} `);

    const data = await fetchTicker(ticker);
    tickers[ticker] = data;

    if (data.error) {
      console.log(`✗  ${data.error}`);
      failed++;
    } else {
      const p = data.price            != null ? `$${data.price.toFixed(2)}`            : 'N/A    ';
      const y = data.dividendYieldPct != null ? `${data.dividendYieldPct.toFixed(2)}%` : 'N/A   ';
      const d = data.dividendPerShare != null ? `$${data.dividendPerShare.toFixed(2)}` : 'N/A  ';
      const x = data.exDividendDate   ?? 'Not announced';
      console.log(`✓  price:${p.padStart(8)}  yield:${y.padStart(7)}  div/sh:${d.padStart(6)}  ex:${x}`);
      success++;
    }

    // Polite delay between requests (skip after last one)
    if (i < TICKERS.length - 1) await sleep(DELAY_MS);
  }

  // ── Write output ──
  const output = {
    lastUpdated: new Date().toISOString(),
    fetchSummary: {
      total:   TICKERS.length,
      success,
      failed,
      runAt:   new Date().toUTCString()
    },
    tickers
  };

  const outPath = path.join(__dirname, 'data.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log('─'.repeat(56));
  console.log(`✓ ${success} succeeded   ✗ ${failed} failed`);
  console.log(`Written → ${outPath}`);
  console.log(`Timestamp: ${output.lastUpdated}\n`);

  // Exit with error code if too many failures (lets GitHub Actions flag the run)
  if (failed > TICKERS.length * 0.3) {
    console.error('More than 30% of tickers failed — marking run as failed.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
