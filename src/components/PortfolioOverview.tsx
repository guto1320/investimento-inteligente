import { usePortfolio } from '@/context/PortfolioContext';
import { MACRO_CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, AssetCategory } from '@/types/portfolio';
import { formatCurrency } from './CurrencySelector';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export function PortfolioOverview() {
  const { getCategoryValue, getTotalValue, currency, categoryTargets, getMacroFromTargets, valuesHidden } = usePortfolio();
  const macroTargets = getMacroFromTargets();
  const total = getTotalValue();

  const data = Object.keys(CATEGORY_LABELS).map(cat => ({
    name: CATEGORY_LABELS[cat as AssetCategory],
    value: getCategoryValue(cat as AssetCategory),
    color: CATEGORY_COLORS[cat as AssetCategory],
    category: cat as AssetCategory,
  })).filter(d => d.value > 0);

  const brasilValue = MACRO_CATEGORIES.brasil.reduce((s, c) => s + getCategoryValue(c), 0);
  const exteriorValue = MACRO_CATEGORIES.exterior.reduce((s, c) => s + getCategoryValue(c), 0);
  const criptoValue = MACRO_CATEGORIES.cripto.reduce((s, c) => s + getCategoryValue(c), 0);
  const brasilPct = total > 0 ? (brasilValue / total) * 100 : 0;
  const exteriorPct = total > 0 ? (exteriorValue / total) * 100 : 0;
  const criptoPct = total > 0 ? (criptoValue / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-muted-foreground text-sm">
          Adicione ativos para visualizar seu portfólio
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Visão Geral</h2>

      {/* Patrimônio total */}
      <div className="bg-secondary/50 rounded-lg p-4">
        <p className="text-xs text-muted-foreground mb-1">Patrimônio total</p>
        <p className="text-2xl font-bold text-gradient">{formatCurrency(total, currency, valuesHidden)}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 bg-secondary/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">🇧🇷 Brasil</p>
          <p className="text-lg font-bold">{formatCurrency(brasilValue, currency, valuesHidden)}</p>
          <div className="flex items-center gap-1 mt-1">
             <span className={`text-xs font-medium ${Math.abs(brasilPct - macroTargets.brasil) > 3 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
              {brasilPct.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">/ {macroTargets.brasil}%</span>
          </div>
        </div>
        <div className="flex-1 bg-secondary/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">🌎 Exterior</p>
          <p className="text-lg font-bold">{formatCurrency(exteriorValue, currency, valuesHidden)}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className={`text-xs font-medium ${Math.abs(exteriorPct - macroTargets.exterior) > 3 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
              {exteriorPct.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">/ {macroTargets.exterior}%</span>
          </div>
        </div>
        <div className="flex-1 bg-secondary/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">🪙 Cripto</p>
          <p className="text-lg font-bold">{formatCurrency(criptoValue, currency, valuesHidden)}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className={`text-xs font-medium ${Math.abs(criptoPct - macroTargets.cripto) > 3 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
              {criptoPct.toFixed(1)}%
            </span>
            <span className="text-xs text-muted-foreground">/ {macroTargets.cripto}%</span>
          </div>
        </div>
      </div>

      {data.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                  {data.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-popover border border-border rounded-lg p-2 text-xs shadow-lg">
                        <p className="font-medium">{d.name}</p>
                        <p className="text-muted-foreground">{formatCurrency(d.value, currency, valuesHidden)}</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            {data.map(d => (
              <div key={d.category} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground flex-1">{d.name}</span>
                <span className="font-medium">{((d.value / total) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
