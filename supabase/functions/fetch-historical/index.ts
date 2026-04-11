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
    const { tickers, range = "1y" } = await req.json();
    if (!tickers || !Array.isArray(tickers)) {
      return new Response(JSON.stringify({ error: "tickers array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { timestamps: number[], closes: number[] }> = {};

    await Promise.all(
      tickers.map(async (ticker: string) => {
        try {
          if (ticker === 'CDI' || ticker === 'IPCA' || ticker === 'SELIC') {
            // Fetch from BCB. CDI = 12, Selic = 11, IPCA = 433
            const code = ticker === 'CDI' ? 12 : ticker === 'SELIC' ? 11 : 433;
            // limitation: bcb returns everything. We fetch everything and process.
            const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json`;
            const resp = await fetch(url);
            if(resp.ok) {
               const data = await resp.json();
               // Very crude filtering for the last 5 years to save bandwidth
               const recentData = data.slice(-1500); 
               const timestamps: number[] = [];
               const closes: number[] = [];
               let indexValue = 100; // start index base 100
               // BCB returns interest per period...
               // For a chart we need to compound it over time!
               recentData.forEach((d: any) => {
                 const [day, month, year] = d.data.split('/');
                 const date = new Date(`${year}-${month}-${day}T00:00:00Z`).getTime() / 1000;
                 // Add interest
                 indexValue = indexValue * (1 + (parseFloat(d.valor) / 100));
                 timestamps.push(date);
                 closes.push(indexValue);
               });
               
               // For comparative analysis, returning the accumulated index is perfect
               results[ticker] = { timestamps, closes };
            }
            return;
          }

          const isBrazilian = /^\d/.test(ticker.slice(-1)) || ticker.endsWith("11") || ticker.endsWith("34") || ticker === 'IBOV';
          let symbol = ticker;
          if (ticker === 'IBOV') symbol = '^BVSP';
          else if (ticker === 'S&P500') symbol = '^GSPC';
          else if (ticker === 'USDBRL') symbol = 'BRL=X';
          else if (isBrazilian && !ticker.includes('.SA')) symbol = `${ticker}.SA`;

          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
          const resp = await fetch(url, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });

          if (!resp.ok) return;
          const data = await resp.json();
          const result = data?.chart?.result?.[0];
          
          if (result && result.timestamp && result.indicators?.quote?.[0]?.close) {
             const timestamps = result.timestamp;
             const closes = result.indicators.quote[0].close;
             results[ticker] = { timestamps, closes };
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
