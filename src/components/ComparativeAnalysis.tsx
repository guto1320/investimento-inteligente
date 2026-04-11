import { useState, useEffect, useMemo } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subMonths, isAfter } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const BENCHMARKS = [
  { id: 'IBOV', name: 'Ibovespa', color: '#ffb300' },
  { id: 'S&P500', name: 'S&P 500', color: '#1e88e5' },
  { id: 'USDBRL', name: 'Dólar (BRL)', color: '#43a047' },
  { id: 'CDI', name: 'CDI', color: '#8e24aa' },
  { id: 'IPCA', name: 'IPCA', color: '#e53935' },
];

export function ComparativeAnalysis() {
  const { assets, transactions } = usePortfolio();
  
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>(['IBOV', 'CDI']);
  const [period, setPeriod] = useState<number>(6); // months
  
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Toggle benchmark logic
  const toggleBenchmark = (bId: string) => {
    setSelectedBenchmarks(prev => 
      prev.includes(bId) 
        ? prev.filter(id => id !== bId)
        : [...prev, bId].slice(0, 4) // max 4 bench + portfolio
    );
  };

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const pTickers = Array.from(new Set(assets.map(a => a.ticker)));
        const allTickers = [...pTickers, ...BENCHMARKS.map(b => b.id)];
        
        const rawResults: Record<string, { timestamps: number[], closes: number[] }> = {};

        await Promise.all(
          allTickers.map(async (ticker) => {
            try {
              if (ticker === 'CDI' || ticker === 'IPCA' || ticker === 'SELIC') {
                const code = ticker === 'CDI' ? 12 : ticker === 'SELIC' ? 11 : 433;
                const resp = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados?formato=json`);
                if (resp.ok) {
                  const data = await resp.json();
                  const recentData = data.slice(-500); 
                  const timestamps: number[] = [];
                  const closes: number[] = [];
                  let indexValue = 100;
                  recentData.forEach((d: any) => {
                    const [day, month, year] = d.data.split('/');
                    const date = new Date(`${year}-${month}-${day}T00:00:00Z`).getTime() / 1000;
                    indexValue = indexValue * (1 + (parseFloat(d.valor) / 100));
                    timestamps.push(date);
                    closes.push(indexValue);
                  });
                  rawResults[ticker] = { timestamps, closes };
                }
                return;
              }

              const isBrazilian = /^\d/.test(ticker.slice(-1)) || ticker.endsWith("11") || ticker.endsWith("34") || ticker === 'IBOV';
              let symbol = ticker;
              if (ticker === 'IBOV') symbol = '^BVSP';
              else if (ticker === 'S&P500') symbol = '^GSPC';
              else if (ticker === 'USDBRL') symbol = 'BRL=X';
              else if (isBrazilian && !ticker.includes('.SA')) symbol = `${ticker}.SA`;

              const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
              // Using a public CORS proxy to allow frontend fetching of Yahoo Finance
              const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
              
              const resp = await fetch(proxyUrl);
              if (resp.ok) {
                const data = await resp.json();
                const result = data?.chart?.result?.[0];
                if (result && result.timestamp && result.indicators?.quote?.[0]?.close) {
                   rawResults[ticker] = { 
                     timestamps: result.timestamp, 
                     closes: result.indicators.quote[0].close 
                   };
                }
              }
            } catch (e) {
               console.log('Error fetching:', ticker, e);
            }
          })
        );
        
        setHistoricalData(rawResults);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [assets]);

  // Compute charting data
  const chartData = useMemo(() => {
    if (!historicalData) return [];

    // Find the baseline date
    const startDate = subMonths(new Date(), period);

    // Collect all unique timestamps from all series (we'll interpolate missing)
    const allTs = new Set<number>();
    Object.values(historicalData).forEach((series: any) => {
      series.timestamps.forEach((ts: number) => {
        if (ts * 1000 >= startDate.getTime()) allTs.add(ts);
      });
    });
    const sortedTs = Array.from(allTs).sort((a,b)=>a-b);

    // Rebase indices
    const results: any[] = [];

    // Tracks last known prices to fill gaps
    const lastPrice: Record<string, number> = {};
    const firstPrice: Record<string, number> = {};

    sortedTs.forEach(ts => {
      const row: any = { 
        timestamp: ts, 
        dateStr: format(new Date(ts * 1000), 'dd/MM/yyyy') 
      };

      // For benchmarks
      selectedBenchmarks.forEach(b => {
        const series = historicalData[b];
        if (series) {
          const idx = series.timestamps.indexOf(ts);
          if (idx !== -1) {
            lastPrice[b] = series.closes[idx];
            if (!firstPrice[b]) firstPrice[b] = series.closes[idx];
          }
          if (lastPrice[b] && firstPrice[b]) {
            row[b] = (lastPrice[b] / firstPrice[b]) * 100;
          }
        }
      });

      // For Portfolio
      // 1. Calculate qty held on this timestamp
      let portValue = 0;
      let netDepositValue = 0; // if we want to isolate deposits for a true TWRR
      
      assets.forEach(asset => {
         const tHist = transactions.filter(t => t.assetId === asset.id);
         const heldQty = tHist.reduce((acc, t) => {
            if (new Date(t.date).getTime() <= ts * 1000) {
               return acc + (t.type === 'buy' ? t.quantity : -t.quantity);
            }
            return acc;
         }, 0);

         // latest price for asset
         const aSeries = historicalData[asset.ticker];
         let aPrice = 0;
         if (aSeries) {
            const idx = aSeries.timestamps.indexOf(ts);
            if (idx !== -1) lastPrice[asset.ticker] = aSeries.closes[idx];
            aPrice = lastPrice[asset.ticker] || 0;
         }
         portValue += (heldQty * aPrice);
      });

      if (!firstPrice['Portfolio'] && portValue > 0) {
          firstPrice['Portfolio'] = portValue;
      }
      
      // CRUDE: just plotting normalized Equity!
      if (firstPrice['Portfolio']) {
         row['Portfolio'] = (portValue / firstPrice['Portfolio']) * 100;
      } else {
         row['Portfolio'] = 100;
      }
      
      results.push(row);
    });

    return results;
  }, [historicalData, selectedBenchmarks, period, assets, transactions]);

  return (
    <div className="space-y-6">
       <div className="glass-card p-6 flex flex-col items-center justify-between gap-4 md:flex-row">
          <div>
            <h2 className="text-xl font-medium tracking-tight mb-1">Análise Comparativa Base-100</h2>
            <p className="text-sm text-muted-foreground">Compare rentabilidades do seu portfólio contra índices no tempo.</p>
          </div>
          <div className="flex gap-2">
            <select 
              className="h-9 rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm"
              value={period}
              onChange={e => setPeriod(Number(e.target.value))}
            >
               <option value={1}>1 Mês</option>
               <option value={6}>6 Meses</option>
               <option value={12}>12 Meses</option>
            </select>
          </div>
       </div>

       <div className="flex flex-wrap gap-2 items-center">
         <span className="text-sm font-medium pr-2">Benchmarks (Máx 4):</span>
         {BENCHMARKS.map(b => {
           const isActive = selectedBenchmarks.includes(b.id);
           return (
             <button 
               key={b.id} 
               onClick={() => toggleBenchmark(b.id)}
               className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-border hover:bg-secondary'}`}
             >
               {b.name}
             </button>
           );
         })}
       </div>

       <div className="glass-card p-4 min-h-[400px] flex items-center justify-center">
          {isLoading ? (
             <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Buscando histórico mundial de cotações...</span>
             </div>
          ) : chartData.length > 0 ? (
             <ResponsiveContainer width="100%" height={400}>
               <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                 <XAxis 
                   dataKey="dateStr" 
                   tick={{ fontSize: 11 }}
                   tickMargin={10}
                   minTickGap={30}
                 />
                 <YAxis 
                   domain={['auto', 'auto']} 
                   tick={{ fontSize: 11 }} 
                   tickFormatter={v => v.toFixed(0)}
                   width={40}
                 />
                 <Tooltip 
                   contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                   labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                   formatter={(val: number) => [val.toFixed(2), 'Índice']}
                 />
                 <Legend />
                 <Line 
                   type="monotone" 
                   dataKey="Portfolio" 
                   name="Meu Portfólio" 
                   stroke="hsl(var(--primary))" 
                   strokeWidth={3} 
                   dot={false} 
                   activeDot={{ r: 6 }} 
                 />
                 {selectedBenchmarks.map(bId => {
                   const config = BENCHMARKS.find(b => b.id === bId);
                   return config ? (
                     <Line 
                       key={bId}
                       type="monotone" 
                       dataKey={bId} 
                       name={config.name} 
                       stroke={config.color} 
                       strokeWidth={2} 
                       dot={false}
                     />
                   ) : null;
                 })}
               </LineChart>
             </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-sm">Sem dados suficientes para o período.</p>
          )}
       </div>
    </div>
  );
}
