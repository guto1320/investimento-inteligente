import { PortfolioProvider } from '@/context/PortfolioContext';
import { CurrencySelector } from '@/components/CurrencySelector';
import { MacroAllocation } from '@/components/MacroAllocation';
import { AssetManager } from '@/components/AssetManager';
import { NextInvestment } from '@/components/NextInvestment';
import { PortfolioOverview } from '@/components/PortfolioOverview';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import { TrendingUp, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { signOut, user } = useAuth();

  return (
    <PortfolioProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gradient">AportAI</h1>
                <p className="text-xs text-muted-foreground">Gestão inteligente de aportes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CurrencySelector />
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-muted-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="container max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left column - Allocation & Overview */}
            <div className="lg:col-span-4 space-y-6">
              <NextInvestment />
              <PortfolioOverview />
              <MacroAllocation />
            </div>

            {/* Right column - Assets */}
            <div className="lg:col-span-8">
              <AssetManager />
            </div>
          </div>
        </main>
      </div>
    </PortfolioProvider>
  );
};

export default Index;
