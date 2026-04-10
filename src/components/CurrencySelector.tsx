import { usePortfolio } from '@/context/PortfolioContext';
import { Currency } from '@/types/portfolio';
import { DollarSign } from 'lucide-react';

const currencies: { value: Currency; label: string; symbol: string }[] = [
  { value: 'BRL', label: 'BRL', symbol: 'R$' },
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'EUR', label: 'EUR', symbol: '€' },
];

export function CurrencySelector() {
  const { currency, setCurrency } = usePortfolio();

  return (
    <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
      {currencies.map(c => (
        <button
          key={c.value}
          onClick={() => setCurrency(c.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            currency === c.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function formatCurrency(value: number, currency: Currency): string {
  const formatter = new Intl.NumberFormat(
    currency === 'BRL' ? 'pt-BR' : currency === 'EUR' ? 'de-DE' : 'en-US',
    { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );
  return formatter.format(value);
}
