# PTaaS Operations Console — deployable version

This is the same console from your Claude artifact (Request → Diagnose →
Stabilize → Recover → Complete), rebuilt so a client can use it without a
Claude.ai account. Two things changed from the original:

1. **Agent calls** go through your own Cloudflare Worker instead of
   `api.anthropic.com` directly, so your API key stays server-side.
2. **Storage** uses the browser's real `localStorage` instead of
   `window.storage`, which only exists inside Claude.ai's artifact sandbox
   and would silently fail on any other site.

Nothing about the UI, the phases, the agent prompts, or the review/approval
flow changed — same behavior, just runnable outside claude.ai.

## 1. Deploy the Worker (`worker/`)

You'll need a free Cloudflare account and `wrangler` (Cloudflare's CLI):

```bash
cd worker
npm install -g wrangler   # if you don't have it already
wrangler login
wrangler deploy
```

Then set your Anthropic API key as a secret (never put it in the code or in
`wrangler.toml`):

```bash
wrangler secret put ANTHROPIC_API_KEY
```
Paste your key when prompted.

`wrangler deploy` will print your Worker's URL, something like:
```
https://ptaas-agent-proxy.your-subdomain.workers.dev
```

### Lock it down to your site (recommended)
Once your GitHub Pages site is live, edit `worker/wrangler.toml` and set:
```toml
[vars]
ALLOWED_ORIGIN = "https://your-username.github.io"
```
Then `wrangler deploy` again. Without this, `"*"` (the default) means any
website that discovers your Worker's URL could call it and spend your API
credits — fine for initial testing, not for production.

## 2. Point the console at your Worker

In `console.html`, find:
```js
const WORKER_URL = "https://ptaas-agent-proxy.YOUR-SUBDOMAIN.workers.dev";
```
Replace it with the real URL from step 1.

## 3. Deploy the console

`console.html` is a single static file — no build step. Commit it to your
GitHub Pages repo (alongside or separate from Waypoint Valet, your call) and
it's live. You can rename it `index.html` if it should be the entry point of
its own repo/subpath, or link to it from elsewhere on your site.

## What a client experiences now
- Opens the page — no login, no Claude.ai account, nothing to sign into.
- Fills in each phase's inputs, clicks "Run agent" where relevant.
- The browser calls your Worker → your Worker calls Anthropic with your key
  → the result comes back and renders in the console.
- Progress is saved in their own browser's `localStorage`, same as before —
  if they close the tab and come back on the same browser/device, their
  progress is still there. (It won't follow them to a different device;
  ask me if you want real cross-device persistence — that would mean
  adding a small database, e.g. via Cloudflare KV or D1, to the Worker.)

## Security notes
- The API key lives only in Cloudflare's secret store — never in the
  browser, never in your GitHub repo.
- `ALLOWED_ORIGIN` restricts which websites can call your Worker at all.
- There's currently no rate limiting or per-client auth on the Worker
  itself — anyone who has your site's URL can trigger agent calls (and use
  your API budget) while testing this. If this becomes a real client-facing
  tool at volume, worth adding either a lightweight shared secret/token check
  in the Worker, or the same Supabase-auth pattern from Waypoint Valet, so
  only logged-in clients can trigger agent runs. Happy to add that when
  you're ready.
