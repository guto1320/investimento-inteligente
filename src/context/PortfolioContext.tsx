import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Asset, AssetCategory, Currency, MacroAllocation, MacroCategory, MACRO_CATEGORIES } from '@/types/portfolio';

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
}

const PortfolioContext = createContext<PortfolioState | null>(null);

const STORAGE_KEY = 'portfolio-data';

function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch { /* ignore */ }
  return null;
}

function saveToStorage(data: object) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const saved = loadFromStorage();

  const [currency, setCurrency] = useState<Currency>(saved?.currency || 'BRL');
  const [macroAllocation, setMacroAllocation] = useState<MacroAllocation>(
    saved?.macroAllocation || { brasil: 60, exterior: 40 }
  );
  const [categoryTargets, setCategoryTargets] = useState<CategoryTarget>(
    saved?.categoryTargets || {
      br_renda_fixa: 25,
      br_acoes: 30,
      br_etfs: 20,
      br_fiis: 25,
      ext_renda_fixa: 20,
      ext_stocks: 35,
      ext_reits: 20,
      ext_etfs: 25,
    }
  );
  const [assets, setAssets] = useState<Asset[]>(saved?.assets || []);
  const [exchangeRates, setExchangeRates] = useState(
    saved?.exchangeRates || { USD_BRL: 5.2, EUR_BRL: 5.7, USD_EUR: 0.92 }
  );
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  useEffect(() => {
    saveToStorage({ currency, macroAllocation, categoryTargets, assets, exchangeRates });
  }, [currency, macroAllocation, categoryTargets, assets, exchangeRates]);

  // Fetch exchange rates on mount
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

  const getValueInCurrency = useCallback((value: number, from: Currency): number => {
    if (from === currency) return value;
    // Convert to USD first, then to target
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

  const setCategoryTarget = useCallback((cat: AssetCategory, pct: number) => {
    setCategoryTargets(prev => ({ ...prev, [cat]: pct }));
  }, []);

  const addAsset = useCallback((asset: Omit<Asset, 'id'>) => {
    setAssets(prev => [...prev, { ...asset, id: crypto.randomUUID() }]);
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  }, []);

  const updateAsset = useCallback((id: string, updates: Partial<Asset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const updateAssetWeight = useCallback((id: string, weight: number) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, targetWeight: weight } : a));
  }, []);

  const distributeEqually = useCallback((category: AssetCategory) => {
    setAssets(prev => {
      const catAssets = prev.filter(a => a.category === category);
      const weight = catAssets.length > 0 ? 100 / catAssets.length : 0;
      return prev.map(a => a.category === category ? { ...a, targetWeight: Math.round(weight * 100) / 100 } : a);
    });
  }, []);

  const getNextInvestment = useCallback((amount: number) => {
    const total = getTotalValue() + amount;
    if (total === 0) return [];

    const suggestions: { ticker: string; category: AssetCategory; amount: number; reason: string }[] = [];

    // Calculate macro gaps
    const brasilValue = MACRO_CATEGORIES.brasil.reduce((s, c) => s + getCategoryValue(c), 0);
    const exteriorValue = MACRO_CATEGORIES.exterior.reduce((s, c) => s + getCategoryValue(c), 0);
    const currentTotal = brasilValue + exteriorValue;

    const brasilCurrent = currentTotal > 0 ? (brasilValue / currentTotal) * 100 : 0;
    const exteriorCurrent = currentTotal > 0 ? (exteriorValue / currentTotal) * 100 : 0;

    const brasilGap = macroAllocation.brasil - brasilCurrent;
    const exteriorGap = macroAllocation.exterior - exteriorCurrent;

    // Determine which macro category needs more investment
    const macroToInvest: MacroCategory = brasilGap >= exteriorGap ? 'brasil' : 'exterior';
    const macroLabel = macroToInvest === 'brasil' ? 'Brasil' : 'Exterior';

    // Within that macro, find categories with biggest gap
    const cats = MACRO_CATEGORIES[macroToInvest];
    const macroValue = macroToInvest === 'brasil' ? brasilValue : exteriorValue;

    const catGaps = cats.map(cat => {
      const catValue = getCategoryValue(cat);
      const currentPct = macroValue > 0 ? (catValue / macroValue) * 100 : 0;
      const target = categoryTargets[cat] || 0;
      return { cat, gap: target - currentPct, currentPct, target };
    }).sort((a, b) => b.gap - a.gap);

    // Pick the category with biggest gap
    const targetCat = catGaps[0];
    if (!targetCat) return [];

    // Within that category, find assets with biggest gap
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

    // Suggest top assets to invest
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
      // Try fetching prices from a free API
      const tickers = assets.map(a => a.ticker);
      if (tickers.length === 0) return;

      // Use Yahoo Finance via a CORS proxy or similar
      // For now, we'll try brapi.dev for Brazilian assets and a proxy for international
      const brAssets = assets.filter(a => a.category.startsWith('br_'));
      const extAssets = assets.filter(a => a.category.startsWith('ext_'));

      // Brazilian assets via brapi
      if (brAssets.length > 0) {
        try {
          const brTickers = brAssets.map(a => a.ticker).join(',');
          const resp = await fetch(`https://brapi.dev/api/quote/${brTickers}?token=demo`);
          const data = await resp.json();
          if (data.results) {
            for (const result of data.results) {
              const asset = assets.find(a => a.ticker.toUpperCase() === result.symbol?.toUpperCase());
              if (asset && result.regularMarketPrice) {
                updateAsset(asset.id, { currentPrice: result.regularMarketPrice, priceCurrency: 'BRL' });
              }
            }
          }
        } catch { /* silent fail */ }
      }

      // International assets - try brapi as well (it supports some US stocks)
      if (extAssets.length > 0) {
        try {
          const extTickers = extAssets.map(a => a.ticker).join(',');
          const resp = await fetch(`https://brapi.dev/api/quote/${extTickers}?token=demo`);
          const data = await resp.json();
          if (data.results) {
            for (const result of data.results) {
              const asset = assets.find(a => a.ticker.toUpperCase() === result.symbol?.toUpperCase());
              if (asset && result.regularMarketPrice) {
                updateAsset(asset.id, { currentPrice: result.regularMarketPrice, priceCurrency: result.currency === 'BRL' ? 'BRL' : 'USD' });
              }
            }
          }
        } catch { /* silent fail */ }
      }
    } finally {
      setIsLoadingPrices(false);
    }
  }, [assets, updateAsset]);

  return (
    <PortfolioContext.Provider value={{
      currency, setCurrency,
      macroAllocation, setMacroAllocation,
      categoryTargets, setCategoryTarget,
      assets, addAsset, removeAsset, updateAsset, updateAssetWeight, distributeEqually,
      exchangeRates, getValueInCurrency, getTotalValue, getCategoryValue,
      getNextInvestment, refreshPrices, isLoadingPrices,
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
