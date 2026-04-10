import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload } from 'lucide-react';
import { usePortfolio } from '@/context/PortfolioContext';
import { AssetCategory, CATEGORY_LABELS, MACRO_CATEGORIES } from '@/types/portfolio';

export function ImportAssets() {
  const { addAsset } = usePortfolio();
  const [text, setText] = useState('');
  const [category, setCategory] = useState<AssetCategory>('br_acoes');
  const [open, setOpen] = useState(false);

  const handleImport = () => {
    const lines = text.trim().split('\n').filter(Boolean);
    const isBrazilian = category.startsWith('br_');

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;
      const ticker = parts[0].toUpperCase();
      const qty = parseFloat(parts[1].replace(',', '.'));
      if (!ticker || isNaN(qty) || qty <= 0) continue;

      addAsset({
        ticker,
        quantity: qty,
        currentPrice: 0,
        priceCurrency: isBrazilian ? 'BRL' : 'USD',
        targetWeight: 0,
        category,
      });
    }

    setText('');
    setOpen(false);
  };

  const allCategories = [...MACRO_CATEGORIES.brasil, ...MACRO_CATEGORIES.exterior];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" />
          Importar Ativos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Ativos em Lote</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categoria</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as AssetCategory)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ativos</label>
            <p className="text-xs text-muted-foreground">
              Um ativo por linha: <span className="font-mono">TICKER QUANTIDADE</span>
            </p>
            <Textarea
              placeholder={"PETR4 100\nVALE3 50\nWEGE3 200\nITUB4 150"}
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleImport} disabled={!text.trim()}>
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
