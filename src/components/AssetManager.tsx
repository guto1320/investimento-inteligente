import { useState } from 'react';
import { usePortfolio } from '@/context/PortfolioContext';
import { AssetCategory, CATEGORY_LABELS, MACRO_CATEGORIES, Currency } from '@/types/portfolio';
import { formatCurrency } from './CurrencySelector';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Scale, RefreshCw, Loader2, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ImportAssets } from './ImportAssets';

const FIXED_INCOME_CATEGORIES: AssetCategory[] = ['br_renda_fixa', 'ext_renda_fixa'];

function isFixedIncome(cat: AssetCategory) {
  return FIXED_INCOME_CATEGORIES.includes(cat);
}


export function AssetManager() {
  const { assets, addAsset, removeAsset, updateAsset, updateAssetWeight, distributeEqually, getCategoryValue, getValueInCurrency, currency, refreshPrices, isLoadingPrices, valuesHidden } = usePortfolio();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Meus Ativos</h2>
        <div className="flex items-center gap-2">
          <ImportAssets />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshPrices}
            disabled={isLoadingPrices}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingPrices ? 'animate-spin' : ''}`} />
            Atualizar Cotações
          </Button>
        </div>
      </div>

      {(['brasil', 'exterior', 'cripto'] as const).map(macro => (
        <div key={macro} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {macro === 'brasil' ? '🇧🇷 Brasil' : macro === 'exterior' ? '🌎 Exterior' : '🪙 Criptoativos'}
          </h3>

          {MACRO_CATEGORIES[macro].map(cat => {
            if (isFixedIncome(cat)) {
              return (
                <FixedIncomeBlock
                  key={cat}
                  category={cat}
                  asset={assets.find(a => a.category === cat)}
                  displayCurrency={currency}
                  priceCurrency={macro === 'brasil' ? 'BRL' : 'USD'}
                  onSet={(value) => {
                    const existing = assets.find(a => a.category === cat);
                    if (existing) {
                      updateAsset(existing.id, { currentPrice: value, quantity: 1 });
                    } else {
                      addAsset({
                        ticker: cat === 'br_renda_fixa' ? 'RENDA FIXA BR' : 'RENDA FIXA EXT',
                        quantity: 1,
                        currentPrice: value,
                        priceCurrency: macro === 'brasil' ? 'BRL' : 'USD',
                        targetWeight: 100,
                        category: cat,
                      });
                    }
                  }}
                  onRemove={existing => {
                    if (existing) removeAsset(existing.id);
                  }}
                  getValueInCurrency={getValueInCurrency}
                  valuesHidden={valuesHidden}
                />
              );
            }

            return (
              <CategoryBlock
                key={cat}
                category={cat}
                assets={assets.filter(a => a.category === cat)}
                displayCurrency={currency}
                onAdd={(ticker, qty) => {
                  let finalTicker = ticker.toUpperCase();
                  if (cat === 'cripto_ativos' && !finalTicker.includes('-')) {
                    finalTicker = `${finalTicker}-USD`;
                  }
                  addAsset({
                    ticker: finalTicker,
                    quantity: qty,
                    currentPrice: 0,
                    priceCurrency: macro === 'brasil' ? 'BRL' : 'USD',
                    targetWeight: 0,
                    category: cat,
                  });
                }}
                onRemove={removeAsset}
                onUpdateQuantity={(id, qty) => updateAsset(id, { quantity: qty })}
                onUpdateWeight={updateAssetWeight}
                onDistributeEqually={() => distributeEqually(cat)}
                getValueInCurrency={getValueInCurrency}
                getCategoryValue={() => getCategoryValue(cat)}
                isLoadingPrices={isLoadingPrices}
                valuesHidden={valuesHidden}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── Fixed Income Block ── */
function FixedIncomeBlock({ category, asset, displayCurrency, priceCurrency, onSet, onRemove, getValueInCurrency, valuesHidden }: {
  category: AssetCategory;
  asset: any | undefined;
  displayCurrency: Currency;
  priceCurrency: Currency;
  onSet: (value: number) => void;
  onRemove: (asset: any) => void;
  getValueInCurrency: (value: number, from: Currency) => number;
  valuesHidden: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const currentValue = asset ? getValueInCurrency(asset.currentPrice * asset.quantity, asset.priceCurrency) : 0;

  const handleSave = () => {
    const val = parseFloat(inputValue.replace(',', '.'));
    if (val > 0) {
      onSet(val);
      setInputValue('');
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">{CATEGORY_LABELS[category]}</span>
          {asset && (
            <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
              valor definido
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-primary">
          {formatCurrency(currentValue, displayCurrency, valuesHidden)}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Informe o valor total investido em renda fixa ({priceCurrency}).
          </p>

          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              placeholder={`Valor total (${priceCurrency})`}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="h-8 text-xs flex-1"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <Button size="sm" onClick={handleSave} className="h-8 px-3">
              Salvar
            </Button>
          </div>

          {asset && (
            <div className="flex items-center justify-between bg-secondary/30 rounded-lg p-3">
              <span className="text-sm text-foreground">
                Valor atual: <strong>{formatCurrency(asset.currentPrice, priceCurrency, valuesHidden)}</strong>
              </span>
              <button
                onClick={() => onRemove(asset)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryBlock({ category, assets, displayCurrency, isForeign, onAdd, onRemove, onUpdateQuantity, onUpdateWeight, onDistributeEqually, getValueInCurrency, getCategoryValue, isLoadingPrices, valuesHidden }: {
  category: AssetCategory;
  assets: any[];
  displayCurrency: Currency;
  isForeign?: boolean;
  onAdd: (ticker: string, qty: number) => void;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, qty: number) => void;
  onUpdateWeight: (id: string, weight: number) => void;
  onDistributeEqually: () => void;
  getValueInCurrency: (value: number, from: Currency) => number;
  getCategoryValue: () => number;
  isLoadingPrices: boolean;
  valuesHidden: boolean;
}) {
  const [newTicker, setNewTicker] = useState('');
  const [newQty, setNewQty] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const catValue = getCategoryValue();

  const handleAdd = () => {
    if (!newTicker || !newQty) return;
    onAdd(newTicker, parseFloat(newQty));
    setNewTicker('');
    setNewQty('');
    setIsAddOpen(false);
  };

  const getPlaceholder = () => {
    switch(category) {
      case 'br_acoes': return "Ticker (ex: PETR4, VALE3)";
      case 'br_fiis': return "Ticker (ex: MXRF11, HGLG11)";
      case 'br_etfs': return "Ticker (ex: BOVA11, IVVB11)";
      case 'ext_stocks': return "Ticker (ex: AAPL, MSFT)";
      case 'ext_reits': return "Ticker (ex: VNQ, O)";
      case 'ext_etfs': return "Ticker (ex: VOO, QQQ)";
      case 'cripto_ativos': return "Ticker (ex: BTC, ETH)";
      default: return "Ticker";
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">{CATEGORY_LABELS[category]}</span>
          <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">
            {assets.length} ativos
          </span>
        </div>
        <span className="text-sm font-semibold text-primary">
          {formatCurrency(catValue, displayCurrency, valuesHidden)}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border p-4 space-y-3">
          {assets.length > 0 && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={onDistributeEqually} className="gap-1.5 text-xs">
                <Scale className="w-3.5 h-3.5" />
                Distribuir igualmente
              </Button>
            </div>
          )}

          {assets.map(asset => {
            const assetValue = getValueInCurrency(asset.currentPrice * asset.quantity, asset.priceCurrency);
            const pct = catValue > 0 ? (assetValue / catValue) * 100 : 0;

            return (
              <div key={asset.id} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-primary">{asset.ticker}</span>
                    <span className="text-xs text-muted-foreground">
                      {asset.quantity} un × {asset.currentPrice > 0
                        ? formatCurrency(asset.currentPrice, asset.priceCurrency, valuesHidden)
                        : <span className="inline-flex items-center gap-1 text-warning">
                            {isLoadingPrices ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            buscando...
                          </span>
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">
                      {asset.currentPrice > 0 ? formatCurrency(assetValue, displayCurrency, valuesHidden) : '—'}
                    </span>
                    <button onClick={() => onRemove(asset.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground shrink-0">Quantidade:</span>
                  <Input
                    type="number"
                    step="any"
                    value={asset.quantity}
                    onChange={(e) => onUpdateQuantity(asset.id, parseFloat(e.target.value) || 0)}
                    className="h-7 text-xs w-24"
                  />
                  <div className="text-xs text-muted-foreground">un</div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Meta individual</span>
                    <span className={`font-medium ${Math.abs(pct - asset.targetWeight) > 5 ? 'text-warning' : 'text-success'}`}>
                      {pct.toFixed(1)}% / {asset.targetWeight.toFixed(1)}%
                    </span>
                  </div>
                  <Slider
                    value={[asset.targetWeight]}
                    onValueChange={([v]) => onUpdateWeight(asset.id, v)}
                    max={100}
                    step={0.5}
                  />
                </div>
              </div>
            );
          })}

          <div className="flex gap-2 pt-2">
            <Input
              placeholder={getPlaceholder()}
              value={newTicker}
              onChange={e => setNewTicker(e.target.value)}
              className="h-8 text-xs flex-1"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Input
              type="number"
              step="any"
              placeholder="Qtd"
              value={newQty}
              onChange={e => setNewQty(e.target.value)}
              className="h-8 text-xs w-24"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <Button size="sm" onClick={handleAdd} className="h-8 px-3">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

