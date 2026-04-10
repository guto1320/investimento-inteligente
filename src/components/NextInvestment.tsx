import { useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { CATEGORY_LABELS } from '@/types/portfolio';
import { formatCurrency } from './CurrencySelector';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TrendingUp, ArrowRight, Zap } from 'lucide-react';

export function NextInvestment() {
  const { getNextInvestment, currency, getTotalValue } = usePortfolio();
  const [amount, setAmount] = useState('');
  const [suggestions, setSuggestions] = useState<ReturnType<typeof getNextInvestment>>([]);

  const handleCalculate = () => {
    const value = parseFloat(amount);
    if (value > 0) {
      setSuggestions(getNextInvestment(value));
    }
  };

  const total = getTotalValue();

  return (
    <div className="glass-card p-6 glow-primary space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Próximo Aporte</h2>
      </div>

      <div className="bg-secondary/50 rounded-lg p-4">
        <p className="text-xs text-muted-foreground mb-1">Patrimônio total</p>
        <p className="text-2xl font-bold text-gradient">{formatCurrency(total, currency)}</p>
      </div>

      <div className="flex gap-2">
        <Input
          type="number"
          placeholder={`Valor do aporte (${currency})`}
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="flex-1"
          onKeyDown={e => e.key === 'Enter' && handleCalculate()}
        />
        <Button onClick={handleCalculate} className="gap-2">
          <TrendingUp className="w-4 h-4" />
          Calcular
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium text-muted-foreground">Sugestão de alocação:</p>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-center gap-3 bg-secondary/30 rounded-lg p-3">
              <ArrowRight className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary">{s.ticker}</span>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
                    {CATEGORY_LABELS[s.category]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.reason}</p>
              </div>
              <span className="text-sm font-semibold text-foreground shrink-0">
                {formatCurrency(s.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
