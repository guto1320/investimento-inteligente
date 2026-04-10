
-- Portfolio settings per user
CREATE TABLE public.portfolios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'BRL',
  macro_brasil NUMERIC NOT NULL DEFAULT 60,
  macro_exterior NUMERIC NOT NULL DEFAULT 40,
  category_targets JSONB NOT NULL DEFAULT '{
    "br_renda_fixa": 25,
    "br_acoes": 30,
    "br_etfs": 20,
    "br_fiis": 25,
    "ext_renda_fixa": 20,
    "ext_stocks": 35,
    "ext_reits": 20,
    "ext_etfs": 25
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolio" ON public.portfolios
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own portfolio" ON public.portfolios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio" ON public.portfolios
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Assets per user
CREATE TABLE public.portfolio_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  current_price NUMERIC NOT NULL DEFAULT 0,
  price_currency TEXT NOT NULL DEFAULT 'BRL',
  target_weight NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets" ON public.portfolio_assets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assets" ON public.portfolio_assets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.portfolio_assets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.portfolio_assets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
