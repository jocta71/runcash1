import React, { useState } from 'react';
import { Check, Filter, X, Calendar, Hash, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
 * Componente para filtrar roletas por diversos critérios
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
  // Estados para os filtros
  const [numberFilter, setNumberFilter] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<'red' | 'black' | 'green' | null>(null);
  const [selectedParity, setSelectedParity] = useState<'even' | 'odd' | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>('');

  // Se não existirem provedores, não renderiza o componente
  if (!providers || providers.length === 0) {
    return null;
  }

  // Verificar se há qualquer filtro ativo
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
    <div className="space-y-4">
      {/* Cabeçalho e botão limpar */}
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
      
      {/* Filtros por cor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Circle size={16} className="text-vegas-gold" />
            <h4 className="text-xs font-medium text-gray-400">Filtrar por cor</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleColorChange('red')}
              size="sm"
              variant={selectedColor === 'red' ? "default" : "outline"}
              className={cn(
                "h-8 rounded-full",
                selectedColor === 'red' ? "bg-red-600 text-white hover:bg-red-700" : "text-red-500 border-red-700/30 hover:bg-red-500/10"
              )}
            >
              {selectedColor === 'red' && <Check size={14} className="mr-1" />}
              Vermelhos
            </Button>
            <Button
              onClick={() => handleColorChange('black')}
              size="sm"
              variant={selectedColor === 'black' ? "default" : "outline"}
              className={cn(
                "h-8 rounded-full",
                selectedColor === 'black' ? "bg-gray-800 text-white hover:bg-gray-900" : "text-gray-300 border-gray-700/30 hover:bg-gray-800/10"
              )}
            >
              {selectedColor === 'black' && <Check size={14} className="mr-1" />}
              Pretos
            </Button>
            <Button
              onClick={() => handleColorChange('green')}
              size="sm"
              variant={selectedColor === 'green' ? "default" : "outline"}
              className={cn(
                "h-8 rounded-full",
                selectedColor === 'green' ? "bg-green-600 text-white hover:bg-green-700" : "text-green-500 border-green-700/30 hover:bg-green-500/10"
              )}
            >
              {selectedColor === 'green' && <Check size={14} className="mr-1" />}
              Zero
            </Button>
          </div>
        </div>

        {/* Filtros por paridade */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Hash size={16} className="text-vegas-gold" />
            <h4 className="text-xs font-medium text-gray-400">Filtrar por paridade</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleParityChange('even')}
              size="sm"
              variant={selectedParity === 'even' ? "default" : "outline"}
              className={cn(
                "h-8 rounded-full",
                selectedParity === 'even' ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" : "text-vegas-gold hover:bg-vegas-gold/10 border-vegas-gold/30"
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
                "h-8 rounded-full",
                selectedParity === 'odd' ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" : "text-vegas-gold hover:bg-vegas-gold/10 border-vegas-gold/30"
              )}
            >
              {selectedParity === 'odd' && <Check size={14} className="mr-1" />}
              Ímpares
            </Button>
          </div>
        </div>
      </div>

      {/* Segunda linha de filtros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Filtro por número */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Hash size={16} className="text-vegas-gold" />
            <h4 className="text-xs font-medium text-gray-400">Filtrar por número específico</h4>
          </div>
          <Input
            value={numberFilter}
            onChange={handleNumberChange}
            placeholder="Ex: 7 (0-36)"
            type="number"
            min={0}
            max={36}
            className="h-8 bg-gray-800/50 border-gray-700/50 text-white"
          />
        </div>

        {/* Filtro por tempo */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-vegas-gold" />
            <h4 className="text-xs font-medium text-gray-400">Filtrar por tempo (minutos)</h4>
          </div>
          <Input
            value={timeFilter}
            onChange={handleTimeChange}
            placeholder="Últimos X minutos"
            type="number"
            min={1}
            className="h-8 bg-gray-800/50 border-gray-700/50 text-white"
          />
        </div>
      </div>

      {/* Filtro por provedores */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <Filter size={16} className="text-vegas-gold" />
          <h4 className="text-xs font-medium text-gray-400">Filtrar por provedor</h4>
        </div>
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
                  isSelected ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" : "text-vegas-gold hover:bg-vegas-gold/10 border-vegas-gold/30"
                )}
              >
                {isSelected && <Check size={14} className="mr-1" />}
                {provider.name}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RouletteFilters; 