# Putting the ask layer on the public site

The site itself needs none of this. Every screen renders from the committed static
export, and `askAvailable()` fails closed — with no API configured the command palette
stays in navigation mode and behaves exactly as it does today. This host exists so ⌘K
can answer questions on the public site. If it is down, asleep or never deployed,
nothing else changes.

## What it costs

Fly's free allowance covers one shared-cpu-1x machine at 256 MB. `fly.toml` sets
`min_machines_running = 0` and `auto_stop_machines = "stop"`, so it sleeps when nobody
is asking and wakes on the first request. A cold start costs a few seconds on that first
question. OpenAI usage is the only real spend and it is per-question.

## Deploy

```bash
brew install flyctl            # or: curl -L https://fly.io/install.sh | sh
fly auth signup                # or fly auth login
fly launch --no-deploy --copy-config --name wattson-api
fly secrets set OPENAI_API_KEY="$(grep '^OPENAI_API_KEY=' ~/.wattson.env | cut -d= -f2-)"
fly deploy
```

Two optional secrets, both degrade gracefully when absent:

```bash
fly secrets set XAI_API_KEY=...            # Grok voice on the irradiance screen
fly secrets set ELASTICSEARCH_URL=... ELASTIC_API_KEY=...   # corpus search
```

**The key never reaches the browser.** It lives in Fly's secret store, is injected as an
environment variable at runtime, and appears in no file in this repository. The client
reads exactly two env vars — `BASE_URL` and `VITE_API_BASE` — and `VITE_API_BASE` is a
URL, not a credential.

## Point the site at it

Add the API base to the Pages build. In `.github/workflows/pages.yml`, on the build step:

```yaml
      - run: npm run build
        working-directory: web
        env:
          VITE_API_BASE: https://wattson-api.fly.dev
```

Then push. ⌘K on the public site gains "Summarize this screen" and free-text ask.

## Check it worked

```bash
curl https://wattson-api.fly.dev/api/ask/status
# {"available": true, "model": "gpt-5", "tools": [...]}

curl -X POST https://wattson-api.fly.dev/api/ask \
  -H 'content-type: application/json' \
  -d '{"q":"Which regions got dirtiest at night since 2019?"}'
```

If `available` is false the key did not land. If the site still shows no ask button,
`VITE_API_BASE` was not set at build time — it is inlined at build, not read at runtime.

## What is deliberately not in the image

`.dockerignore` excludes `web/`, `docs/`, `scripts/`, `engine/`, `tests/`, the 61
heatmaps and `data/`. The API serves regions, alerts, companies, facilities, corrections
and the corpus; it does not need the frontend, the pipeline or the raw parquet. Smaller
image, faster cold start, less to go wrong.
