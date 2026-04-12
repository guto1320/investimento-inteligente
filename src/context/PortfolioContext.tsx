import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Asset, AssetCategory, Currency, MacroAllocation, MacroCategory, MACRO_CATEGORIES, CATEGORY_LABELS } from '@/types/portfolio';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface CategoryTarget {
  [key: string]: number;
}

interface PortfolioState {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  macroAllocation: MacroAllocation;
  setMacroAllocation: (a: MacroAllocation) => void;
  categoryTargets: CategoryTarget;
  setCategoryTarget: (cat: AssetCategory, pct: number) => void;
  setCategoryTargets: (targets: CategoryTarget) => void;
  assets: Asset[];
  addAsset: (asset: Omit<Asset, 'id'> & { initialDate?: string; initialExchangeRate?: number; initialOperationalCosts?: number }) => void;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  updateAssetWeight: (id: string, weight: number) => void;
  distributeEqually: (category: AssetCategory) => void;
  exchangeRates: { USD_BRL: number; EUR_BRL: number; USD_EUR: number };
  getValueInCurrency: (value: number, from: Currency) => number;
  getTotalValue: () => number;
  getCategoryValue: (cat: AssetCategory) => number;
  getNextInvestment: (amount: number) => InvestmentSuggestion[];
  refreshPrices: () => Promise<void>;
  syncTargetsToActual: () => void;
  getTotalTargets: () => number;
  getMacroFromTargets: () => { brasil: number; exterior: number; cripto: number };
  isLoadingPrices: boolean;
  isLoading: boolean;
  valuesHidden: boolean;
  setValuesHidden: (v: boolean) => void;
}

export interface InvestmentSuggestion {
  ticker: string;
  category: AssetCategory;
  amount: number;
  reason: string;
  detail?: string;
  currentPct: number;
  targetPct: number;
  gap: number;
}

const PortfolioContext = createContext<PortfolioState | null>(null);

// Now targets are % of TOTAL portfolio, summing to 100
const DEFAULT_TARGETS: CategoryTarget = {
  br_renda_fixa: 15, br_acoes: 18, br_etfs: 12, br_fiis: 15,
  ext_renda_fixa: 8, ext_stocks: 14, ext_reits: 8, ext_etfs: 10,
  cripto_ativos: 0,
};

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [currency, setCurrencyState] = useState<Currency>('BRL');
  const [macroAllocation, setMacroAllocationState] = useState<MacroAllocation>({ brasil: 60, exterior: 40, cripto: 0 });
  const [categoryTargets, setCategoryTargetsState] = useState<CategoryTarget>(DEFAULT_TARGETS);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [exchangeRates, setExchangeRates] = useState({ USD_BRL: 5.2, EUR_BRL: 5.7, USD_EUR: 0.92 });
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [valuesHidden, setValuesHidden] = useState(true);

  // Fetch exchange rates
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(data => {
        if (data.rates) {
          setExchangeRates({
            USD_BRL: data.rates.BRL || 5.2,
            EUR_BRL: (data.rates.BRL || 5.2) / (data.rates.EUR || 0.92),
            USD_EUR: data.rates.EUR || 0.92,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Load portfolio from DB
  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);

    const loadData = async () => {
      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (portfolio) {
        setCurrencyState(portfolio.currency as Currency);
        setMacroAllocationState({ brasil: Number(portfolio.macro_brasil), exterior: Number(portfolio.macro_exterior), cripto: Number(portfolio.macro_cripto || 0) });
        if (portfolio.category_targets) setCategoryTargetsState(portfolio.category_targets as CategoryTarget);
      } else {
        await supabase.from('portfolios').insert({
          user_id: userId,
          currency: 'BRL',
          macro_brasil: 60,
          macro_exterior: 40,
          macro_cripto: 0,
          category_targets: DEFAULT_TARGETS,
        });
      }

      const { data: dbAssets } = await supabase
        .from('portfolio_assets')
        .select('*')
        .eq('user_id', userId);

      if (dbAssets) {
        setAssets(dbAssets.map(a => ({
          id: a.id,
          ticker: a.ticker,
          quantity: Number(a.quantity),
          currentPrice: Number(a.current_price),
          priceCurrency: a.price_currency as Currency,
          targetWeight: Number(a.target_weight),
          category: a.category as AssetCategory,
        })));
      }



      setIsLoading(false);
    };

    loadData();
  }, [userId]);

  const savePortfolioSettings = useCallback(async (cur: Currency, macro: MacroAllocation, targets: CategoryTarget) => {
    if (!userId) return;
    await supabase.from('portfolios').update({
      currency: cur,
      macro_brasil: macro.brasil,
      macro_exterior: macro.exterior,
      macro_cripto: macro.cripto,
      category_targets: targets,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
  }, [userId]);

  const getMacroFromTargets = useCallback((): { brasil: number; exterior: number; cripto: number } => {
    const brasil = MACRO_CATEGORIES.brasil.reduce((s, c) => s + (categoryTargets[c] || 0), 0);
    const exterior = MACRO_CATEGORIES.exterior.reduce((s, c) => s + (categoryTargets[c] || 0), 0);
    const cripto = MACRO_CATEGORIES.cripto.reduce((s, c) => s + (categoryTargets[c] || 0), 0);
    return { brasil, exterior, cripto };
  }, [categoryTargets]);

  const getTotalTargets = useCallback(() => {
    return Object.values(categoryTargets).reduce((s, v) => s + v, 0);
  }, [categoryTargets]);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    const macro = getMacroFromTargets();
    savePortfolioSettings(c, { brasil: macro.brasil, exterior: macro.exterior, cripto: macro.cripto }, categoryTargets);
  }, [categoryTargets, savePortfolioSettings, getMacroFromTargets]);

  const setMacroAllocation = useCallback((a: MacroAllocation) => {
    setMacroAllocationState(a);
    savePortfolioSettings(currency, a, categoryTargets);
  }, [currency, categoryTargets, savePortfolioSettings]);

  const setCategoryTarget = useCallback((cat: AssetCategory, pct: number) => {
    setCategoryTargetsState(prev => {
      const next = { ...prev, [cat]: pct };
      const macro = {
        brasil: MACRO_CATEGORIES.brasil.reduce((s, c) => s + (next[c] || 0), 0),
        exterior: MACRO_CATEGORIES.exterior.reduce((s, c) => s + (next[c] || 0), 0),
        cripto: MACRO_CATEGORIES.cripto.reduce((s, c) => s + (next[c] || 0), 0),
      };
      setMacroAllocationState(macro);
      savePortfolioSettings(currency, macro, next);
      return next;
    });
  }, [currency, savePortfolioSettings]);

  const setCategoryTargets = useCallback((targets: CategoryTarget) => {
    setCategoryTargetsState(targets);
    const macro = {
      brasil: MACRO_CATEGORIES.brasil.reduce((s, c) => s + (targets[c] || 0), 0),
      exterior: MACRO_CATEGORIES.exterior.reduce((s, c) => s + (targets[c] || 0), 0),
      cripto: MACRO_CATEGORIES.cripto.reduce((s, c) => s + (targets[c] || 0), 0),
    };
    setMacroAllocationState(macro);
    savePortfolioSettings(currency, macro, targets);
  }, [currency, savePortfolioSettings]);

  const getValueInCurrency = useCallback((value: number, from: Currency): number => {
    if (from === currency) return value;
    let inUSD = value;
    if (from === 'BRL') inUSD = value / exchangeRates.USD_BRL;
    else if (from === 'EUR') inUSD = value / exchangeRates.USD_EUR;
    if (currency === 'USD') return inUSD;
    if (currency === 'BRL') return inUSD * exchangeRates.USD_BRL;
    return inUSD * exchangeRates.USD_EUR;
  }, [currency, exchangeRates]);

  const getTotalValue = useCallback(() => {
    return assets.reduce((sum, a) => sum + getValueInCurrency(a.currentPrice * a.quantity, a.priceCurrency), 0);
  }, [assets, getValueInCurrency]);

  const getCategoryValue = useCallback((cat: AssetCategory) => {
    return assets
      .filter(a => a.category === cat)
      .reduce((sum, a) => sum + getValueInCurrency(a.currentPrice * a.quantity, a.priceCurrency), 0);
  }, [assets, getValueInCurrency]);

  const fetchTickerPrices = useCallback(async (tickers: string[]) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ tickers }),
      });
      const data = await resp.json();
      return data.results as Record<string, { price: number; currency: string }> | null;
    } catch { return null; }
  }, []);

  const addAsset = useCallback(async (asset: Omit<Asset, 'id'>) => {
    if (!userId) return;
    const id = crypto.randomUUID();
    const newAsset = { ...asset, id };
    setAssets(prev => [...prev, newAsset]);

    await supabase.from('portfolio_assets').insert({
      id,
      user_id: userId,
      ticker: asset.ticker,
      quantity: asset.quantity,
      current_price: asset.currentPrice,
      price_currency: asset.priceCurrency,
      target_weight: asset.targetWeight,
      category: asset.category,
    });

    setIsLoadingPrices(true);
    const results = await fetchTickerPrices([asset.ticker]);
    if (results && results[asset.ticker]) {
      const r = results[asset.ticker];
      setAssets(prev => prev.map(a => a.id === id ? { ...a, currentPrice: r.price, priceCurrency: r.currency as Currency } : a));
      await supabase.from('portfolio_assets').update({
        current_price: r.price,
        price_currency: r.currency,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
    }
    setIsLoadingPrices(false);
  }, [userId, fetchTickerPrices]);

  const removeAsset = useCallback(async (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    await supabase.from('portfolio_assets').delete().eq('id', id);
  }, []);

  const updateAsset = useCallback(async (id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    const dbUpdates: { updated_at: string; quantity?: number; current_price?: number; price_currency?: string; target_weight?: number; category?: string } = { updated_at: new Date().toISOString() };
    if (updates.quantity !== undefined) dbUpdates.quantity = Number(updates.quantity);
    if (updates.currentPrice !== undefined) dbUpdates.current_price = Number(updates.currentPrice);
    if (updates.priceCurrency !== undefined) dbUpdates.price_currency = updates.priceCurrency;
    if (updates.targetWeight !== undefined) dbUpdates.target_weight = Number(updates.targetWeight);
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    await supabase.from('portfolio_assets').update(dbUpdates).eq('id', id);
  }, []);

  const updateAssetWeight = useCallback((id: string, weight: number) => {
    updateAsset(id, { targetWeight: weight });
  }, [updateAsset]);

  const distributeEqually = useCallback((category: AssetCategory) => {
    const catAssets = assets.filter(a => a.category === category);
    if (catAssets.length === 0) return;
    const weight = Math.round((100 / catAssets.length) * 10) / 10;
    const totalAssigned = weight * (catAssets.length - 1);
    const lastWeight = Math.round((100 - totalAssigned) * 10) / 10;
    catAssets.forEach((a, i) => updateAssetWeight(a.id, i === catAssets.length - 1 ? lastWeight : weight));
  }, [assets, updateAssetWeight]);



  // ---- IMPROVED INVESTMENT SUGGESTION ----
  const getNextInvestment = useCallback((amount: number): InvestmentSuggestion[] => {
    const currentTotal = getTotalValue();
    const futureTotal = currentTotal + amount;
    if (futureTotal === 0) return [];

    const totalTargets = Object.values(categoryTargets).reduce((s, v) => s + v, 0);
    if (totalTargets === 0) return [];

    // Normalize targets to 100% if they don't sum exactly
    const normFactor = 100 / totalTargets;

    // Calculate gap for each category (target vs actual as % of total)
    const allCats = [...MACRO_CATEGORIES.brasil, ...MACRO_CATEGORIES.exterior, ...MACRO_CATEGORIES.cripto];
    const catAnalysis = allCats.map(cat => {
      const catValue = getCategoryValue(cat);
      const actualPct = currentTotal > 0 ? (catValue / currentTotal) * 100 : 0;
      const targetPct = (categoryTargets[cat] || 0) * normFactor;
      const gap = targetPct - actualPct;
      // How much money is needed to reach target at futureTotal
      const targetValue = (targetPct / 100) * futureTotal;
      const deficit = targetValue - catValue;
      return { cat, catValue, actualPct, targetPct, gap, deficit };
    }).filter(c => c.deficit > 0)
      .sort((a, b) => b.gap - a.gap);

    if (catAnalysis.length === 0) return [];

    // Distribute the amount proportionally to each deficit
    const totalDeficit = catAnalysis.reduce((s, c) => s + c.deficit, 0);
    const suggestions: InvestmentSuggestion[] = [];

    for (const ca of catAnalysis) {
      const proportion = ca.deficit / totalDeficit;
      const catAmount = Math.round(amount * proportion * 100) / 100;
      if (catAmount < 0.01) continue;

      // Find the best asset within the category
      const catAssets = assets.filter(a => a.category === ca.cat);
      if (catAssets.length === 0) {
        suggestions.push({
          ticker: '—',
          category: ca.cat,
          amount: catAmount,
          reason: `${CATEGORY_LABELS[ca.cat]} está ${ca.gap.toFixed(1)}pp abaixo da meta`,
          detail: `Atual: ${ca.actualPct.toFixed(1)}% → Meta: ${ca.targetPct.toFixed(1)}%. Adicione ativos nesta categoria.`,
          currentPct: ca.actualPct,
          targetPct: ca.targetPct,
          gap: ca.gap,
        });
        continue;
      }

      // Distribute within category by asset weight gaps
      const catTotalValue = ca.catValue;
      const assetAnalysis = catAssets.map(a => {
        const assetValue = getValueInCurrency(a.currentPrice * a.quantity, a.priceCurrency);
        const currentPctInCat = catTotalValue > 0 ? (assetValue / catTotalValue) * 100 : 0;
        const assetGap = a.targetWeight - currentPctInCat;
        return { asset: a, assetValue, currentPctInCat, assetGap };
      }).sort((a, b) => b.assetGap - a.assetGap);

      // Give more to assets with bigger gaps
      const totalAssetGap = assetAnalysis.reduce((s, a) => s + Math.max(0, a.assetGap), 0);

      let remaining = catAmount;
      for (const aa of assetAnalysis) {
        if (remaining <= 0.01) break;
        let assetAmount: number;
        if (totalAssetGap > 0 && aa.assetGap > 0) {
          assetAmount = Math.min(remaining, catAmount * (aa.assetGap / totalAssetGap));
        } else {
          assetAmount = remaining / assetAnalysis.length;
        }
        assetAmount = Math.round(assetAmount * 100) / 100;
        if (assetAmount < 0.01) continue;

        suggestions.push({
          ticker: aa.asset.ticker,
          category: ca.cat,
          amount: assetAmount,
          reason: `${CATEGORY_LABELS[ca.cat]}: ${ca.actualPct.toFixed(1)}% → meta ${ca.targetPct.toFixed(1)}%`,
          detail: `Peso no ativo: ${aa.currentPctInCat.toFixed(1)}% (meta ${aa.asset.targetWeight.toFixed(1)}%)`,
          currentPct: ca.actualPct,
          targetPct: ca.targetPct,
          gap: ca.gap,
        });
        remaining -= assetAmount;
      }
    }

    return suggestions.sort((a, b) => b.amount - a.amount);
  }, [getTotalValue, getCategoryValue, categoryTargets, assets, getValueInCurrency]);

  const syncTargetsToActual = useCallback(() => {
    const total = getTotalValue();
    if (total === 0) return;

    const newTargets: CategoryTarget = {};
    const allCats = [...MACRO_CATEGORIES.brasil, ...MACRO_CATEGORIES.exterior, ...MACRO_CATEGORIES.cripto];
    let sum = 0;
    for (const cat of allCats) {
      const catValue = getCategoryValue(cat);
      const pct = Math.round((catValue / total) * 100);
      newTargets[cat] = pct;
      sum += pct;
    }
    // Adjust rounding to ensure exactly 100
    if (sum !== 100 && allCats.length > 0) {
      const biggest = allCats.reduce((best, cat) => newTargets[cat] > newTargets[best] ? cat : best, allCats[0]);
      newTargets[biggest] += 100 - sum;
    }

    setCategoryTargets(newTargets);
  }, [getTotalValue, getCategoryValue]);

  const refreshPrices = useCallback(async () => {
    setIsLoadingPrices(true);
    try {
      const tickers = assets.map(a => a.ticker);
      if (tickers.length === 0) return;
      const results = await fetchTickerPrices(tickers);
      if (results) {
        for (const asset of assets) {
          const r = results[asset.ticker];
          if (r && r.price > 0) {
            updateAsset(asset.id, { currentPrice: r.price, priceCurrency: r.currency as Currency });
          }
        }
      }
    } finally {
      setIsLoadingPrices(false);
    }
  }, [assets, updateAsset, fetchTickerPrices]);

  return (
    <PortfolioContext.Provider value={{
      currency, setCurrency,
      macroAllocation, setMacroAllocation,
      categoryTargets, setCategoryTarget, setCategoryTargets,
      assets, addAsset, removeAsset, updateAsset, updateAssetWeight, distributeEqually,
      exchangeRates, getValueInCurrency, getTotalValue, getCategoryValue,
      getNextInvestment, refreshPrices, syncTargetsToActual,
      getTotalTargets, getMacroFromTargets,
      isLoadingPrices, isLoading,
      valuesHidden, setValuesHidden,
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
