import yfinance as yf
import json
import time
import os
from datetime import datetime, timezone

TICKERS = [
    "JEPQ", "MAIN", "PECO", "GLAD", "GAIN", "GOOD", "PFLT", "ADC", "EPR", "LTC",
    "O", "AGNC", "DOC", "DX", "PSEC", "TYG", "GROW", "OXSQ", "BCIC", "NLOP",
    "EARN", "GWRS", "MDV", "SPMC", "EIC", "SCM", "PNNT", "HRZN", "SAR", "CION",
    "LAND", "ECC", "XRN", "DIV", "TBLD", "HSHP", "IVR", "DSL", "ORC", "CSWC",
    "TRIN", "BST", "EFC", "BTX", "SMA", "ARR", "BBAR", "APLE", "SLG", "BMA",
    "AVAL", "VIV", "AMRZ", "BBD", "ITUB"
]

DATA_FILE = "data.json"


def load_existing_data():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"tickers": {}}


def fetch_ticker(symbol):
    ticker = yf.Ticker(symbol)
    info = ticker.info

    price = info.get("currentPrice") or info.get("regularMarketPrice") or info.get("navPrice")

    dividend_yield = info.get("dividendYield")
    dividend_yield_pct = round(dividend_yield * 100, 4) if dividend_yield else None

    dividend_per_share = info.get("dividendRate")

    ex_div_raw = info.get("exDividendDate")
    ex_div_date = None
    if ex_div_raw:
        ex_div_date = datetime.fromtimestamp(ex_div_raw, tz=timezone.utc).strftime("%Y-%m-%d")

    company_name = info.get("longName") or info.get("shortName") or symbol

    return {
        "price": price,
        "dividendYieldPct": dividend_yield_pct,
        "dividendPerShare": dividend_per_share,
        "exDividendDate": ex_div_date,
        "companyName": company_name,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "error": None,
    }


def main():
    existing_data = load_existing_data()
    existing_tickers = existing_data.get("tickers", {})

    results = {}
    fetch_ok = 0
    fetch_stale = 0
    fetch_error = 0

    for i, symbol in enumerate(TICKERS):
        print(f"[{i + 1}/{len(TICKERS)}] Fetching {symbol}...")

        success = False
        last_error = None

        for attempt in range(3):
            try:
                data = fetch_ticker(symbol)
                results[symbol] = data
                fetch_ok += 1
                success = True
                break
            except Exception as e:
                last_error = str(e)
                print(f"  Attempt {attempt + 1} failed: {last_error}")
                if attempt < 2:
                    time.sleep(5)

        if not success:
            if symbol in existing_tickers:
                stale = dict(existing_tickers[symbol])
                stale["error"] = f"Stale (last fetch failed): {last_error}"
                results[symbol] = stale
                fetch_stale += 1
                print(f"  Using stale data for {symbol}")
            else:
                results[symbol] = {
                    "price": None,
                    "dividendYieldPct": None,
                    "dividendPerShare": None,
                    "exDividendDate": None,
                    "companyName": symbol,
                    "fetchedAt": datetime.now(timezone.utc).isoformat(),
                    "error": last_error,
                }
                fetch_error += 1
                print(f"  No prior data for {symbol}")

        if i < len(TICKERS) - 1:
            time.sleep(1.2)

    output = {
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "fetchSummary": {
            "total": len(TICKERS),
            "success": fetch_ok,
            "stale": fetch_stale,
            "error": fetch_error,
        },
        "tickers": results,
    }

    with open(DATA_FILE, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\nDone! {fetch_ok} ok, {fetch_stale} stale, {fetch_error} error")
    print(f"Written to {DATA_FILE}")


if __name__ == "__main__":
    main()
