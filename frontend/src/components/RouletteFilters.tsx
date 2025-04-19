import React, { useState } from 'react';
import { Check, Filter, X, Hash, Clock, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export interface RouletteProvider {
  id: string;
  name: string;
}

interface RouletteFiltersProps {
  providers: RouletteProvider[];
  selectedProviders: string[];
  onProviderSelect: (providerId: string) => void;
  onClearFilters: () => void;
  onNumberFilterChange?: (number: number | null) => void;
  onColorFilterChange?: (color: 'red' | 'black' | 'green' | null) => void;
  onParityFilterChange?: (parity: 'even' | 'odd' | null) => void;
  onTimeFilterChange?: (minutes: number | null) => void;
}

/**
 * Componente para filtrar roletas por provedor
 */
const RouletteFilters: React.FC<RouletteFiltersProps> = ({
  providers,
  selectedProviders,
  onProviderSelect,
  onClearFilters,
  onNumberFilterChange,
  onColorFilterChange,
  onParityFilterChange,
  onTimeFilterChange
}) => {
  // Estados locais para os novos filtros
  const [numberFilter, setNumberFilter] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<'red' | 'black' | 'green' | null>(null);
  const [selectedParity, setSelectedParity] = useState<'even' | 'odd' | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>('');

  // Se não existirem provedores, não renderiza o componente
  if (!providers || providers.length === 0) {
    return null;
  }

  const hasFilters = selectedProviders.length > 0 || 
                     numberFilter || 
                     selectedColor || 
                     selectedParity || 
                     timeFilter;

  // Handler para o filtro de número
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNumberFilter(value);
    
    const parsedNumber = value ? parseInt(value, 10) : null;
    if (parsedNumber === null || (!isNaN(parsedNumber) && parsedNumber >= 0 && parsedNumber <= 36)) {
      onNumberFilterChange?.(parsedNumber);
    }
  };

  // Handler para o filtro de tempo
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTimeFilter(value);
    
    const parsedTime = value ? parseInt(value, 10) : null;
    if (parsedTime === null || !isNaN(parsedTime)) {
      onTimeFilterChange?.(parsedTime);
    }
  };

  // Handler para o filtro de cor
  const handleColorChange = (color: 'red' | 'black' | 'green' | null) => {
    const newColor = selectedColor === color ? null : color;
    setSelectedColor(newColor);
    onColorFilterChange?.(newColor);
  };

  // Handler para o filtro de paridade
  const handleParityChange = (parity: 'even' | 'odd' | null) => {
    const newParity = selectedParity === parity ? null : parity;
    setSelectedParity(newParity);
    onParityFilterChange?.(newParity);
  };

  // Limpar todos os filtros
  const handleClearAllFilters = () => {
    setNumberFilter('');
    setSelectedColor(null);
    setSelectedParity(null);
    setTimeFilter('');
    onClearFilters();
    onNumberFilterChange?.(null);
    onColorFilterChange?.(null);
    onParityFilterChange?.(null);
    onTimeFilterChange?.(null);
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-vegas-gold" />
          <h3 className="text-sm font-medium text-white">Filtros de roleta</h3>
        </div>
        
        {hasFilters && (
          <Button 
            onClick={handleClearAllFilters}
            variant="ghost" 
            size="sm"
            className="h-7 px-2 text-xs text-gray-400 hover:text-white"
          >
            <X size={14} className="mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>
      
      <Tabs defaultValue="providers" className="w-full">
        <TabsList className="mb-2 grid grid-cols-4 h-9">
          <TabsTrigger value="providers">Provedores</TabsTrigger>
          <TabsTrigger value="numbers">Números</TabsTrigger>
          <TabsTrigger value="colors">Cores</TabsTrigger>
          <TabsTrigger value="time">Tempo</TabsTrigger>
        </TabsList>
        
        <TabsContent value="providers" className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {providers.map(provider => {
              const isSelected = selectedProviders.includes(provider.id);
              
              return (
                <Button
                  key={provider.id}
                  onClick={() => onProviderSelect(provider.id)}
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "h-8 rounded-full",
                    isSelected ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" : "text-vegas-gold hover:bg-vegas-gold/10"
                  )}
                >
                  {isSelected && <Check size={14} className="mr-1" />}
                  {provider.name}
                </Button>
              );
            })}
          </div>
        </TabsContent>
        
        <TabsContent value="numbers" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Número específico (0-36)</label>
              <Input
                value={numberFilter}
                onChange={handleNumberChange}
                placeholder="Ex: 7"
                type="number"
                min={0}
                max={36}
                className="h-9"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Paridade</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleParityChange('even')}
                  size="sm"
                  variant={selectedParity === 'even' ? "default" : "outline"}
                  className={cn(
                    "flex-1 h-9 rounded-md",
                    selectedParity === 'even' ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" : "text-vegas-gold hover:bg-vegas-gold/10"
                  )}
                >
                  {selectedParity === 'even' && <Check size={14} className="mr-1" />}
                  Pares
                </Button>
                <Button
                  onClick={() => handleParityChange('odd')}
                  size="sm"
                  variant={selectedParity === 'odd' ? "default" : "outline"}
                  className={cn(
                    "flex-1 h-9 rounded-md",
                    selectedParity === 'odd' ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" : "text-vegas-gold hover:bg-vegas-gold/10"
                  )}
                >
                  {selectedParity === 'odd' && <Check size={14} className="mr-1" />}
                  Ímpares
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="colors" className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleColorChange('red')}
              size="sm"
              variant={selectedColor === 'red' ? "default" : "outline"}
              className={cn(
                "h-9 px-4",
                selectedColor === 'red' ? "bg-red-600 text-white hover:bg-red-700 border-red-600" : "text-red-500 border-red-500 hover:bg-red-500/10"
              )}
            >
              {selectedColor === 'red' && <Check size={14} className="mr-1" />}
              <Circle size={12} className="mr-1 fill-current" /> Vermelhos
            </Button>
            <Button
              onClick={() => handleColorChange('black')}
              size="sm"
              variant={selectedColor === 'black' ? "default" : "outline"}
              className={cn(
                "h-9 px-4",
                selectedColor === 'black' ? "bg-gray-800 text-white hover:bg-gray-900 border-gray-800" : "text-gray-300 border-gray-700 hover:bg-gray-800/10"
              )}
            >
              {selectedColor === 'black' && <Check size={14} className="mr-1" />}
              <Circle size={12} className="mr-1 fill-current" /> Pretos
            </Button>
            <Button
              onClick={() => handleColorChange('green')}
              size="sm"
              variant={selectedColor === 'green' ? "default" : "outline"}
              className={cn(
                "h-9 px-4",
                selectedColor === 'green' ? "bg-green-600 text-white hover:bg-green-700 border-green-600" : "text-green-500 border-green-500 hover:bg-green-500/10"
              )}
            >
              {selectedColor === 'green' && <Check size={14} className="mr-1" />}
              <Circle size={12} className="mr-1 fill-current" /> Zero
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="time" className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs text-gray-400">Último número nos últimos (minutos)</label>
            <Input
              value={timeFilter}
              onChange={handleTimeChange}
              placeholder="Ex: 5"
              type="number"
              min={1}
              className="h-9"
            />
            <p className="text-xs text-gray-500">Filtra roletas que tiveram um número nos últimos X minutos</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RouletteFilters; 