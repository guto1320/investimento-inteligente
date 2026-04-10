import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Asset, AssetCategory, Currency, MacroAllocation, MacroCategory, MACRO_CATEGORIES } from '@/types/portfolio';
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
  assets: Asset[];
  addAsset: (asset: Omit<Asset, 'id'>) => void;
  removeAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  updateAssetWeight: (id: string, weight: number) => void;
  distributeEqually: (category: AssetCategory) => void;
  exchangeRates: { USD_BRL: number; EUR_BRL: number; USD_EUR: number };
  getValueInCurrency: (value: number, from: Currency) => number;
  getTotalValue: () => number;
  getCategoryValue: (cat: AssetCategory) => number;
  getNextInvestment: (amount: number) => { ticker: string; category: AssetCategory; amount: number; reason: string }[];
  refreshPrices: () => Promise<void>;
  isLoadingPrices: boolean;
  isLoading: boolean;
}

const PortfolioContext = createContext<PortfolioState | null>(null);

const DEFAULT_TARGETS: CategoryTarget = {
  br_renda_fixa: 25, br_acoes: 30, br_etfs: 20, br_fiis: 25,
  ext_renda_fixa: 20, ext_stocks: 35, ext_reits: 20, ext_etfs: 25,
};

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [currency, setCurrencyState] = useState<Currency>('BRL');
  const [macroAllocation, setMacroAllocationState] = useState<MacroAllocation>({ brasil: 60, exterior: 40 });
  const [categoryTargets, setCategoryTargetsState] = useState<CategoryTarget>(DEFAULT_TARGETS);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [exchangeRates, setExchangeRates] = useState({ USD_BRL: 5.2, EUR_BRL: 5.7, USD_EUR: 0.92 });
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
      // Load portfolio settings
      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (portfolio) {
        setCurrencyState(portfolio.currency as Currency);
        setMacroAllocationState({ brasil: Number(portfolio.macro_brasil), exterior: Number(portfolio.macro_exterior) });
        if (portfolio.category_targets) setCategoryTargetsState(portfolio.category_targets as CategoryTarget);
      } else {
        // Create default portfolio
        await supabase.from('portfolios').insert({
          user_id: userId,
          currency: 'BRL',
          macro_brasil: 60,
          macro_exterior: 40,
          category_targets: DEFAULT_TARGETS,
        });
      }

      // Load assets
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

  // Save portfolio settings to DB (debounced)
  const savePortfolioSettings = useCallback(async (cur: Currency, macro: MacroAllocation, targets: CategoryTarget) => {
    if (!userId) return;
    await supabase.from('portfolios').update({
      currency: cur,
      macro_brasil: macro.brasil,
      macro_exterior: macro.exterior,
      category_targets: targets,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId);
  }, [userId]);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    savePortfolioSettings(c, macroAllocation, categoryTargets);
  }, [macroAllocation, categoryTargets, savePortfolioSettings]);

  const setMacroAllocation = useCallback((a: MacroAllocation) => {
    setMacroAllocationState(a);
    savePortfolioSettings(currency, a, categoryTargets);
  }, [currency, categoryTargets, savePortfolioSettings]);

  const setCategoryTarget = useCallback((cat: AssetCategory, pct: number) => {
    setCategoryTargetsState(prev => {
      const next = { ...prev, [cat]: pct };
      savePortfolioSettings(currency, macroAllocation, next);
      return next;
    });
  }, [currency, macroAllocation, savePortfolioSettings]);

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

    // Insert into DB
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

    // Auto-fetch price
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
    const dbUpdates: {
      updated_at: string;
      quantity?: number;
      current_price?: number;
      price_currency?: string;
      target_weight?: number;
      category?: string;
    } = { updated_at: new Date().toISOString() };
    if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
    if (updates.currentPrice !== undefined) dbUpdates.current_price = updates.currentPrice;
    if (updates.priceCurrency !== undefined) dbUpdates.price_currency = updates.priceCurrency;
    if (updates.targetWeight !== undefined) dbUpdates.target_weight = updates.targetWeight;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    await supabase.from('portfolio_assets').update(dbUpdates).eq('id', id);
  }, []);

  const updateAssetWeight = useCallback(async (id: string, weight: number) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, targetWeight: weight } : a));
    await supabase.from('portfolio_assets').update({ target_weight: weight, updated_at: new Date().toISOString() }).eq('id', id);
  }, []);

  const distributeEqually = useCallback((category: AssetCategory) => {
    setAssets(prev => {
      const catAssets = prev.filter(a => a.category === category);
      const weight = catAssets.length > 0 ? 100 / catAssets.length : 0;
      const rounded = Math.round(weight * 100) / 100;
      // Update DB for each
      catAssets.forEach(a => {
        supabase.from('portfolio_assets').update({ target_weight: rounded, updated_at: new Date().toISOString() }).eq('id', a.id).then(() => {});
      });
      return prev.map(a => a.category === category ? { ...a, targetWeight: rounded } : a);
    });
  }, []);

  const getNextInvestment = useCallback((amount: number) => {
    const total = getTotalValue() + amount;
    if (total === 0) return [];

    const suggestions: { ticker: string; category: AssetCategory; amount: number; reason: string }[] = [];

    const brasilValue = MACRO_CATEGORIES.brasil.reduce((s, c) => s + getCategoryValue(c), 0);
    const exteriorValue = MACRO_CATEGORIES.exterior.reduce((s, c) => s + getCategoryValue(c), 0);
    const currentTotal = brasilValue + exteriorValue;

    const brasilCurrent = currentTotal > 0 ? (brasilValue / currentTotal) * 100 : 0;
    const exteriorCurrent = currentTotal > 0 ? (exteriorValue / currentTotal) * 100 : 0;

    const brasilGap = macroAllocation.brasil - brasilCurrent;
    const exteriorGap = macroAllocation.exterior - exteriorCurrent;

    const macroToInvest: MacroCategory = brasilGap >= exteriorGap ? 'brasil' : 'exterior';
    const macroLabel = macroToInvest === 'brasil' ? 'Brasil' : 'Exterior';

    const cats = MACRO_CATEGORIES[macroToInvest];
    const macroValue = macroToInvest === 'brasil' ? brasilValue : exteriorValue;

    const catGaps = cats.map(cat => {
      const catValue = getCategoryValue(cat);
      const currentPct = macroValue > 0 ? (catValue / macroValue) * 100 : 0;
      const target = categoryTargets[cat] || 0;
      return { cat, gap: target - currentPct, currentPct, target };
    }).sort((a, b) => b.gap - a.gap);

    const targetCat = catGaps[0];
    if (!targetCat) return [];

    const catAssets = assets.filter(a => a.category === targetCat.cat);
    if (catAssets.length === 0) {
      suggestions.push({
        ticker: '-',
        category: targetCat.cat,
        amount,
        reason: `${macroLabel} está ${Math.abs(macroToInvest === 'brasil' ? brasilGap : exteriorGap).toFixed(1)}% abaixo da meta. Adicione ativos nesta categoria.`,
      });
      return suggestions;
    }

    const catTotalValue = getCategoryValue(targetCat.cat);
    const assetGaps = catAssets.map(a => {
      const assetValue = getValueInCurrency(a.currentPrice * a.quantity, a.priceCurrency);
      const currentPct = catTotalValue > 0 ? (assetValue / catTotalValue) * 100 : 0;
      return { asset: a, gap: a.targetWeight - currentPct, currentPct };
    }).sort((a, b) => b.gap - a.gap);

    let remaining = amount;
    for (const ag of assetGaps) {
      if (remaining <= 0) break;
      if (ag.gap <= 0 && assetGaps[0].gap > 0) continue;
      const allocation = Math.min(remaining, amount * (ag.asset.targetWeight / 100));
      if (allocation > 0) {
        suggestions.push({
          ticker: ag.asset.ticker,
          category: ag.asset.category,
          amount: allocation,
          reason: `Meta: ${ag.asset.targetWeight.toFixed(1)}% | Atual: ${ag.currentPct.toFixed(1)}%`,
        });
        remaining -= allocation;
      }
    }

    return suggestions;
  }, [getTotalValue, getCategoryValue, macroAllocation, categoryTargets, assets, getValueInCurrency]);

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
      categoryTargets, setCategoryTarget,
      assets, addAsset, removeAsset, updateAsset, updateAssetWeight, distributeEqually,
      exchangeRates, getValueInCurrency, getTotalValue, getCategoryValue,
      getNextInvestment, refreshPrices, isLoadingPrices, isLoading,
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
