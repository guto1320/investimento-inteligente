import { useState } from 'react';
import { usePortfolio, InvestmentSuggestion } from '@/context/PortfolioContext';
import { CATEGORY_LABELS } from '@/types/portfolio';
import { formatCurrency } from './CurrencySelector';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, ArrowRight, Zap, AlertTriangle, Info } from 'lucide-react';

export function NextInvestment() {
  const { getNextInvestment, currency, getTotalTargets } = usePortfolio();
  const [amount, setAmount] = useState('');
  const [suggestions, setSuggestions] = useState<InvestmentSuggestion[]>([]);

  const handleCalculate = () => {
    const value = parseFloat(amount.replace(',', '.'));
    if (value > 0) {
      setSuggestions(getNextInvestment(value));
    }
  };

  const totalTargets = getTotalTargets();
  const isValid = totalTargets === 100;

  // Group suggestions by category
  const grouped = suggestions.reduce<Record<string, InvestmentSuggestion[]>>((acc, s) => {
    const key = s.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const totalSuggested = suggestions.reduce((s, sg) => s + sg.amount, 0);

  return (
    <div className="glass-card p-6 glow-primary space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Próximo Aporte</h2>
      </div>

      {!isValid && (
        <div className="flex items-start gap-2 rounded-lg p-3 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Sua alocação objetivo soma <strong>{totalTargets}%</strong> (deveria ser 100%).
            Ajuste na seção "Alocação Objetivo" antes de calcular.
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="decimal"
          placeholder={`Valor do aporte (${currency})`}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="flex-1"
          onKeyDown={e => e.key === 'Enter' && handleCalculate()}
        />
        <Button onClick={handleCalculate} disabled={!isValid} className="gap-2">
          <TrendingUp className="w-4 h-4" />
          Calcular
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Sugestão de alocação:</p>
            <p className="text-xs text-muted-foreground">
              Total: {formatCurrency(totalSuggested, currency)}
            </p>
          </div>

          {/* Explanation */}
          <div className="flex items-start gap-2 bg-secondary/40 rounded-lg p-3 text-xs text-muted-foreground">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <span>
              O aporte é distribuído entre as categorias que estão <strong>abaixo da meta</strong>, 
              proporcionalmente ao quanto cada uma precisa para atingir o objetivo.
              Dentro de cada categoria, os ativos mais defasados recebem mais.
            </span>
          </div>

          {Object.entries(grouped).map(([cat, items]) => {
            const catTotal = items.reduce((s, i) => s + i.amount, 0);
            const first = items[0];
            return (
              <div key={cat} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      first.gap > 3 ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'
                    }`}>
                      {first.currentPct.toFixed(1)}% → {first.targetPct.toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-primary">
                    {formatCurrency(catTotal, currency)}
                  </span>
                </div>

                {items.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-secondary/30 rounded-lg p-3 ml-2">
                    <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-primary">{s.ticker}</span>
                      </div>
                      {s.detail && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.detail}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0">
                      {formatCurrency(s.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
