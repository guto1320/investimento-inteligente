import { PortfolioProvider, usePortfolio } from '@/context/PortfolioContext';
import { CurrencySelector } from '@/components/CurrencySelector';
import { MacroAllocation } from '@/components/MacroAllocation';
import { AssetManager } from '@/components/AssetManager';
import { NextInvestment } from '@/components/NextInvestment';
import { PortfolioOverview } from '@/components/PortfolioOverview';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PaletteSelector } from '@/components/PaletteSelector';
import { useAuth } from '@/context/AuthContext';
import { LogOut, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function VisibilityToggle() {
  const { valuesHidden, setValuesHidden } = usePortfolio();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setValuesHidden(!valuesHidden)}
      className="text-muted-foreground"
      title={valuesHidden ? 'Mostrar valores' : 'Ocultar valores'}
    >
      {valuesHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </Button>
  );
}

const Index = () => {
  const { signOut } = useAuth();

  return (
    <PortfolioProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-foreground">Assistente de Aportes</h1>
            <div className="flex items-center gap-2">
              <VisibilityToggle />
              <CurrencySelector />
              <PaletteSelector />
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-muted-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container max-w-7xl mx-auto px-4 py-6">
          <Tabs defaultValue="visao-geral" className="space-y-8">
            <div className="flex justify-center">
              <TabsList className="flex flex-wrap h-auto w-full max-w-[800px] justify-center gap-1 p-1">
                <TabsTrigger value="visao-geral" className="flex-1 min-w-[120px]">Visão Geral</TabsTrigger>
                <TabsTrigger value="meus-ativos" className="flex-1 min-w-[120px]">Meus Ativos</TabsTrigger>
                <TabsTrigger value="objetivos" className="flex-1 min-w-[120px]">Objetivos</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="visao-geral" className="space-y-6 animate-in fade-in-50 duration-500">
              <div className="max-w-4xl mx-auto space-y-6">
                <NextInvestment />
                <PortfolioOverview />
              </div>
            </TabsContent>

            <TabsContent value="meus-ativos" className="animate-in fade-in-50 duration-500">
              <AssetManager />
            </TabsContent>

            <TabsContent value="objetivos" className="animate-in fade-in-50 duration-500">
              <div className="max-w-2xl mx-auto">
                <MacroAllocation />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </PortfolioProvider>
  );
};

export default Index;
