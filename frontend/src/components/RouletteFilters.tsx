import React, { useState } from 'react';
import { Check, Filter, X, Calendar, Hash, Circle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [selectedProvider, setSelectedProvider] = useState<string>('');

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
  const handleColorChange = (value: string) => {
    const colorMap: Record<string, 'red' | 'black' | 'green' | null> = {
      'todas': null,
      'vermelho': 'red',
      'preto': 'black',
      'verde': 'green'
    };
    
    const newColor = colorMap[value] || null;
    setSelectedColor(newColor);
    onColorFilterChange?.(newColor);
  };

  // Handler para o filtro de paridade
  const handleParityChange = (value: string) => {
    const parityMap: Record<string, 'even' | 'odd' | null> = {
      'todas': null,
      'par': 'even',
      'impar': 'odd'
    };
    
    const newParity = parityMap[value] || null;
    setSelectedParity(newParity);
    onParityFilterChange?.(newParity);
  };

  // Handler para o filtro de provedor
  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    if (value === 'all') {
      // Limpar todos os provedores selecionados
      onClearFilters();
    } else {
      // Selecionar apenas o provedor escolhido
      onProviderSelect(value);
    }
  };

  // Limpar todos os filtros
  const handleClearAllFilters = () => {
    setNumberFilter('');
    setSelectedColor(null);
    setSelectedParity(null);
    setTimeFilter('');
    setSelectedProvider('');
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
      
      {/* Filtros em grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Filtro por cor */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Por cores</label>
          <Select onValueChange={handleColorChange} value={selectedColor || 'todas'}>
            <SelectTrigger className="w-full bg-[#111] border-gray-700 text-white h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-700 text-white">
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="vermelho" className="flex items-center">
                <span className="mr-2 w-2 h-2 rounded-full bg-red-600"></span> Vermelhos
              </SelectItem>
              <SelectItem value="preto" className="flex items-center">
                <span className="mr-2 w-2 h-2 rounded-full bg-gray-900"></span> Pretos
              </SelectItem>
              <SelectItem value="verde" className="flex items-center">
                <span className="mr-2 w-2 h-2 rounded-full bg-green-600"></span> Zero
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por número */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Por número</label>
          <Input
            value={numberFilter}
            onChange={handleNumberChange}
            placeholder="Ex: 7 (0-36)"
            type="number"
            min={0}
            max={36}
            className="w-full h-9 bg-[#111] border-gray-700 text-white"
          />
        </div>

        {/* Filtro por hora */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Por paridade</label>
          <Select onValueChange={handleParityChange} value={selectedParity || 'todas'}>
            <SelectTrigger className="w-full bg-[#111] border-gray-700 text-white h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-700 text-white">
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="par">Pares</SelectItem>
              <SelectItem value="impar">Ímpares</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por provedor */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Por provedor</label>
          <Select onValueChange={handleProviderChange} value={selectedProvider || 'all'}>
            <SelectTrigger className="w-full bg-[#111] border-gray-700 text-white h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-700 text-white max-h-[200px] overflow-y-auto">
              <SelectItem value="all">Todos</SelectItem>
              {providers.map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por tempo */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Por tempo (min)</label>
          <Input
            value={timeFilter}
            onChange={handleTimeChange}
            placeholder="Últimos X min"
            type="number"
            min={1}
            className="w-full h-9 bg-[#111] border-gray-700 text-white"
          />
        </div>
      </div>
    </div>
  );
};

export default RouletteFilters; 