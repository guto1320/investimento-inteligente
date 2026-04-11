export type Currency = 'BRL' | 'USD' | 'EUR';

export type AssetCategory =
  | 'br_renda_fixa'
  | 'br_acoes'
  | 'br_etfs'
  | 'br_fiis'
  | 'ext_renda_fixa'
  | 'ext_stocks'
  | 'ext_reits'
  | 'ext_etfs'
  | 'cripto_ativos';

export type MacroCategory = 'brasil' | 'exterior' | 'cripto';

export interface Asset {
  id: string;
  ticker: string;
  quantity: number;
  currentPrice: number;
  priceCurrency: Currency;
  targetWeight: number; // percentage within its category
  category: AssetCategory;
}

export interface Transaction {
  id: string;
  assetId: string;
  type: 'buy' | 'sell';
  date: string;
  quantity: number;
  price: number;
  exchangeRate?: number;
  operationalCosts?: number;
}

export interface CategoryConfig {
  id: AssetCategory;
  label: string;
  macro: MacroCategory;
  targetPercent: number;
}

export interface MacroAllocation {
  brasil: number; // percentage
  exterior: number;
  cripto: number;
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  br_renda_fixa: 'Renda Fixa (BR)',
  br_acoes: 'Ações',
  br_etfs: 'ETFs (BR)',
  br_fiis: 'FIIs',
  ext_renda_fixa: 'Renda Fixa (EXT)',
  ext_stocks: 'Stocks',
  ext_reits: 'REITs',
  ext_etfs: 'ETFs (EXT)',
  cripto_ativos: 'Criptoativos',
};

export const MACRO_CATEGORIES: Record<MacroCategory, AssetCategory[]> = {
  brasil: ['br_renda_fixa', 'br_acoes', 'br_etfs', 'br_fiis'],
  exterior: ['ext_renda_fixa', 'ext_stocks', 'ext_reits', 'ext_etfs'],
  cripto: ['cripto_ativos'],
};

export const CATEGORY_COLORS: Record<AssetCategory, string> = {
  br_renda_fixa: 'hsl(var(--chart-1))',
  br_acoes: 'hsl(var(--chart-2))',
  br_etfs: 'hsl(var(--chart-3))',
  br_fiis: 'hsl(var(--chart-4))',
  ext_renda_fixa: 'hsl(var(--chart-5))',
  ext_stocks: 'hsl(var(--chart-6))',
  ext_reits: 'hsl(160 80% 60%)',
  ext_etfs: 'hsl(200 80% 65%)',
  cripto_ativos: '#F7931A',
};
