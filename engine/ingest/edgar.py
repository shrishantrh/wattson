"""SEC EDGAR access.

SEC rejects requests that do not carry a contact email in the User-Agent, and
banning our IP would block the whole team, so the address is read from the
environment and never hardcoded. If it is unset we stop.
"""

import os
import time

import requests

UA_PRODUCT = "Wattson HackMIT"
MAX_REQUESTS_PER_SECOND = 8
_MIN_INTERVAL = 1.0 / MAX_REQUESTS_PER_SECOND
_last_request_at = 0.0

# Public SEC identifiers, not secrets.
CIKS = {
    "META": "1326801",
    "MSFT": "789019",
    "GOOGL": "1652044",
    "AMZN": "1018724",
}


def user_agent():
    email = os.environ.get("EDGAR_UA_EMAIL", "").strip()
    if not email:
        raise RuntimeError(
            "EDGAR_UA_EMAIL is not set. SEC blocks requests without a contact "
            "email in the User-Agent. Export EDGAR_UA_EMAIL=<address> and retry. "
            "Refusing to fetch without it rather than risk an IP ban."
        )
    return f"{UA_PRODUCT} {email}"


def cik_for(ticker):
    """10-digit zero-padded CIK, as the submissions API requires."""
    return CIKS[ticker.upper()].zfill(10)


def _throttled_get(url):
    global _last_request_at
    for attempt in range(5):
        wait = _MIN_INTERVAL - (time.monotonic() - _last_request_at)
        if wait > 0:
            time.sleep(wait)
        _last_request_at = time.monotonic()

        resp = requests.get(url, headers={"User-Agent": user_agent(),
                                          "Accept-Encoding": "gzip, deflate"},
                            timeout=60)
        if resp.status_code in (429, 503):
            time.sleep(2 ** attempt)
            continue
        resp.raise_for_status()
        return resp
    raise RuntimeError(f"SEC kept returning {resp.status_code} for {url}")


def latest_10k(ticker):
    """Return (document_url, fiscal_year) for the most recent 10-K."""
    cik = cik_for(ticker)
    data = _throttled_get(
        f"https://data.sec.gov/submissions/CIK{cik}.json").json()
    recent = data["filings"]["recent"]
    for i, form in enumerate(recent["form"]):
        if form == "10-K":
            accession = recent["accessionNumber"][i].replace("-", "")
            doc = recent["primaryDocument"][i]
            year = int(recent["reportDate"][i][:4])
            return (f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
                    f"{accession}/{doc}", year)
    raise LookupError(f"no 10-K found in recent filings for {ticker}")
