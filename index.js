// PTaaS agent proxy — Cloudflare Worker
//
// Holds ANTHROPIC_API_KEY as a server-side secret. The client (console.html)
// never sees this key — it only ever calls this Worker's URL.
//
// Deploy with Wrangler:
//   npx wrangler deploy
//   npx wrangler secret put ANTHROPIC_API_KEY
//
// Set ALLOWED_ORIGIN in wrangler.toml (or as a var) to your actual site's
// origin once deployed, e.g. "https://kirkngrant.github.io" — using "*"
// works for testing but lets any website call your Worker (and burn your
// API credits) once the URL is known.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { system, userText } = body || {};
    if (!userText || typeof userText !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid userText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfigured: missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let anthropicResponse;
    try {
      anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: system || undefined,
          messages: [{ role: "user", content: userText }],
        }),
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Upstream request failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await anthropicResponse.json();

    // Pass the Anthropic response straight through — the client's existing
    // parsing logic (filtering content blocks for type "text") keeps working
    // unchanged, since this is the same response shape.
    return new Response(JSON.stringify(data), {
      status: anthropicResponse.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};
