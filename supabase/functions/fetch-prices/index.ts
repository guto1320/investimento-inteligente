import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ error: "tickers array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { price: number; currency: string }> = {};

    // Process tickers in parallel
    await Promise.all(
      tickers.map(async (ticker: string) => {
        try {
          // For Brazilian tickers, append .SA
          const isBrazilian = /^\d/.test(ticker.slice(-1)) || ticker.endsWith("11") || ticker.endsWith("34");
          const symbol = isBrazilian ? `${ticker}.SA` : ticker;

          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
          const resp = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });

          if (!resp.ok) {
            console.log(`Failed to fetch ${symbol}: ${resp.status}`);
            return;
          }

          const data = await resp.json();
          const result = data?.chart?.result?.[0];
          if (result) {
            const price =
              result.meta?.regularMarketPrice ?? result.meta?.previousClose ?? 0;
            const cur = result.meta?.currency ?? (isBrazilian ? "BRL" : "USD");
            if (price > 0) {
              results[ticker] = { price, currency: cur };
            }
          }
        } catch (e) {
          console.log(`Error fetching ${ticker}:`, e);
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
