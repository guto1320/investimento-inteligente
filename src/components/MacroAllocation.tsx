import { usePortfolio } from '@/context/PortfolioContext';
import { Slider } from '@/components/ui/slider';
import { MACRO_CATEGORIES, CATEGORY_LABELS, AssetCategory } from '@/types/portfolio';
import { formatCurrency } from './CurrencySelector';
import { Globe, MapPin, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MacroAllocation() {
  const { macroAllocation, setMacroAllocation, categoryTargets, setCategoryTarget, getCategoryValue, getTotalValue, currency, syncTargetsToActual } = usePortfolio();
  const total = getTotalValue();

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Alocação Macro</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={syncTargetsToActual}
          disabled={total === 0}
          className="gap-1.5 text-xs"
          title="Definir metas com base na alocação atual"
        >
          <Target className="w-3.5 h-3.5" />
          Usar atual
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Brasil</span>
          </div>
          <span className="text-sm font-bold text-primary">{macroAllocation.brasil}%</span>
        </div>
        <Slider
          value={[macroAllocation.brasil]}
          onValueChange={([v]) => setMacroAllocation({ brasil: v, exterior: 100 - v })}
          max={100}
          step={1}
          className="w-full"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-chart-2" />
            <span className="text-sm font-medium">Exterior</span>
          </div>
          <span className="text-sm font-bold text-chart-2">{macroAllocation.exterior}%</span>
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Distribuição por Categoria</h3>

        {(['brasil', 'exterior'] as const).map(macro => (
          <div key={macro} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {macro === 'brasil' ? '🇧🇷 Brasil' : '🌎 Exterior'}
            </p>
            {MACRO_CATEGORIES[macro].map(cat => {
              const catValue = getCategoryValue(cat);
              const macroValue = MACRO_CATEGORIES[macro].reduce((s, c) => s + getCategoryValue(c), 0);
              const actualPct = macroValue > 0 ? (catValue / macroValue) * 100 : 0;

              return (
                <CategorySlider
                  key={cat}
                  category={cat}
                  target={categoryTargets[cat] || 0}
                  actual={actualPct}
                  value={catValue}
                  currency={currency}
                  onChange={(v) => setCategoryTarget(cat, v)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategorySlider({ category, target, actual, value, currency, onChange }: {
  category: AssetCategory;
  target: number;
  actual: number;
  value: number;
  currency: string;
  onChange: (v: number) => void;
}) {
  const diff = actual - target;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm">{CATEGORY_LABELS[category]}</span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            {formatCurrency(value, currency as any)}
          </span>
          <span className={`font-medium ${diff > 2 ? 'text-warning' : diff < -2 ? 'text-destructive' : 'text-success'}`}>
            {actual.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">meta: {target}%</span>
        </div>
      </div>
      <Slider
        value={[target]}
        onValueChange={([v]) => onChange(v)}
        max={100}
        step={1}
        className="w-full"
      />
    </div>
  );
}
