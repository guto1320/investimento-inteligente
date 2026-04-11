import { usePortfolio } from '@/context/PortfolioContext';
import { Slider } from '@/components/ui/slider';
import { MACRO_CATEGORIES, CATEGORY_LABELS, AssetCategory } from '@/types/portfolio';
import { formatCurrency } from './CurrencySelector';
import { Globe, MapPin, Target, AlertTriangle, CheckCircle, Bitcoin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MacroAllocation() {
  const { categoryTargets, setCategoryTarget, getCategoryValue, getTotalValue, currency, syncTargetsToActual, getTotalTargets, getMacroFromTargets, valuesHidden } = usePortfolio();
  const total = getTotalValue();
  const totalTargets = getTotalTargets();
  const macroTargets = getMacroFromTargets();
  const isValid = totalTargets === 100;
  const diff = 100 - totalTargets;

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Alocação Objetivo</h2>
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

      {/* Total indicator */}
      <div className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${
        isValid
          ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
          : 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
      }`}>
        {isValid ? (
          <>
            <CheckCircle className="w-4 h-4" />
            <span>100% alocado — objetivo completo</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4" />
            <span>
              Total: {totalTargets}% — {diff > 0 ? `faltam ${diff}%` : `excede em ${Math.abs(diff)}%`}
            </span>
          </>
        )}
      </div>

      {/* Macro summary (derived from categories) */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Brasil (objetivo)</span>
          </div>
          <p className="text-lg font-bold text-primary">{macroTargets.brasil}%</p>
        </div>
        <div className="flex-1 bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Globe className="w-3.5 h-3.5 text-chart-2" />
            <span className="text-xs font-medium text-muted-foreground">Exterior (objetivo)</span>
          </div>
          <p className="text-lg font-bold text-chart-2">{macroTargets.exterior}%</p>
        </div>
        <div className="flex-1 bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Bitcoin className="w-3.5 h-3.5" style={{ color: '#F7931A' }} />
            <span className="text-xs font-medium text-muted-foreground">Cripto (objetivo)</span>
          </div>
          <p className="text-lg font-bold" style={{ color: '#F7931A' }}>{macroTargets.cripto}%</p>
        </div>
      </div>

      {/* Category sliders — % of total */}
      <div className="space-y-4">
        {(['brasil', 'exterior', 'cripto'] as const).map(macro => (
          <div key={macro} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {macro === 'brasil' ? '🇧🇷 Brasil' : macro === 'exterior' ? '🌎 Exterior' : '₿ Criptoativos'}
            </p>
            {MACRO_CATEGORIES[macro].map(cat => {
              const catValue = getCategoryValue(cat);
              const actualPct = total > 0 ? (catValue / total) * 100 : 0;
              const target = categoryTargets[cat] || 0;

              return (
                <CategorySlider
                  key={cat}
                  category={cat}
                  target={target}
                  actual={actualPct}
                  value={catValue}
                  currency={currency}
                  onChange={(v) => setCategoryTarget(cat, v)}
                  hidden={valuesHidden}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function CategorySlider({ category, target, actual, value, currency, onChange, hidden }: {
  category: AssetCategory;
  target: number;
  actual: number;
  value: number;
  currency: string;
  onChange: (v: number) => void;
  hidden?: boolean;
}) {
  const diff = actual - target;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm">{CATEGORY_LABELS[category]}</span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            {formatCurrency(value, currency as any, hidden)}
          </span>
          <span className={`font-medium ${Math.abs(diff) > 2 ? (diff > 0 ? 'text-chart-2' : 'text-destructive') : 'text-green-600 dark:text-green-400'}`}>
            {actual.toFixed(1)}%
          </span>
          <span className="font-semibold text-foreground bg-secondary px-1.5 py-0.5 rounded">
            {target}%
          </span>
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
