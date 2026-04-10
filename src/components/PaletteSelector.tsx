import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Palette } from 'lucide-react';

const PALETTES = [
  { id: 'blue', label: 'Azul', color: 'hsl(220, 70%, 50%)' },
  { id: 'violet', label: 'Violeta', color: 'hsl(260, 60%, 55%)' },
  { id: 'rose', label: 'Rosa', color: 'hsl(340, 65%, 50%)' },
  { id: 'amber', label: 'Âmbar', color: 'hsl(38, 92%, 50%)' },
  { id: 'teal', label: 'Teal', color: 'hsl(175, 60%, 40%)' },
  { id: 'slate', label: 'Cinza', color: 'hsl(215, 20%, 45%)' },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

export function PaletteSelector() {
  const [palette, setPalette] = useState<PaletteId>(() => {
    return (localStorage.getItem('palette') as PaletteId) || 'blue';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('palette', palette);
  }, [palette]);

  // Set on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Palette className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Paleta de cores</p>
        <div className="grid grid-cols-3 gap-1.5">
          {PALETTES.map(p => (
            <button
              key={p.id}
              onClick={() => setPalette(p.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors hover:bg-secondary ${palette === p.id ? 'bg-secondary ring-1 ring-primary' : ''}`}
            >
              <div
                className="w-6 h-6 rounded-full border border-border"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[10px] font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
