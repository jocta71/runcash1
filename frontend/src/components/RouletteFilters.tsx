import React, { useState } from 'react';
import { Check, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
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
  // Estado para saber se há filtros aplicados
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  
  // Estados para cada filtro selecionado
  const [selectedColor, setSelectedColor] = useState('todas');
  const [selectedNumber, setSelectedNumber] = useState('todos');
  const [selectedParity, setSelectedParity] = useState('todas');
  const [selectedTime, setSelectedTime] = useState('todos');
  const [selectedProvider, setSelectedProvider] = useState('todos');

  // Se não existirem provedores, não renderiza o componente
  if (!providers || providers.length === 0) {
    return null;
  }

  // Opções para o filtro de números
  const numberOptions = [
    { value: 'todos', label: 'Todos' },
    { value: '0', label: '0' },
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    // ... outros números podem ser adicionados conforme necessário
  ];

  // Opções para o filtro de tempo
  const timeOptions = [
    { value: 'todos', label: 'Todos' },
    { value: '1', label: 'Último 1 min' },
    { value: '5', label: 'Últimos 5 min' },
    { value: '10', label: 'Últimos 10 min' },
    { value: '30', label: 'Últimos 30 min' },
    { value: '60', label: 'Última 1 hora' },
  ];

  // Handler para o filtro de cor
  const handleColorChange = (value: string) => {
    setSelectedColor(value);
    let color: 'red' | 'black' | 'green' | null = null;
    
    switch (value) {
      case 'vermelho':
        color = 'red';
        break;
      case 'preto':
        color = 'black';
        break;
      case 'verde':
        color = 'green';
        break;
      case 'todas':
      default:
        color = null;
    }
    
    onColorFilterChange?.(color);
    checkActiveFilters();
  };

  // Handler para o filtro de número
  const handleNumberChange = (value: string) => {
    setSelectedNumber(value);
    
    if (value === 'todos') {
      onNumberFilterChange?.(null);
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        onNumberFilterChange?.(num);
      }
    }
    
    checkActiveFilters();
  };

  // Handler para o filtro de paridade
  const handleParityChange = (value: string) => {
    setSelectedParity(value);
    let parity: 'even' | 'odd' | null = null;
    
    switch (value) {
      case 'par':
        parity = 'even';
        break;
      case 'impar':
        parity = 'odd';
        break;
      case 'todas':
      default:
        parity = null;
    }
    
    onParityFilterChange?.(parity);
    checkActiveFilters();
  };

  // Handler para o filtro de tempo
  const handleTimeChange = (value: string) => {
    setSelectedTime(value);
    
    if (value === 'todos') {
      onTimeFilterChange?.(null);
    } else {
      const minutes = parseInt(value, 10);
      if (!isNaN(minutes)) {
        onTimeFilterChange?.(minutes);
      }
    }
    
    checkActiveFilters();
  };

  // Handler para o filtro de provedor
  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    
    if (value === 'todos') {
      onClearFilters();
    } else {
      onProviderSelect(value);
    }
    
    checkActiveFilters();
  };

  // Verificar se há filtros ativos
  const checkActiveFilters = () => {
    const hasFilters = 
      selectedColor !== 'todas' || 
      selectedNumber !== 'todos' || 
      selectedParity !== 'todas' || 
      selectedTime !== 'todos' || 
      selectedProvider !== 'todos' ||
      selectedProviders.length > 0;
    
    setHasActiveFilters(hasFilters);
  };

  // Limpar todos os filtros
  const handleClearAllFilters = () => {
    setSelectedColor('todas');
    setSelectedNumber('todos');
    setSelectedParity('todas');
    setSelectedTime('todos');
    setSelectedProvider('todos');
    
    onClearFilters();
    onNumberFilterChange?.(null);
    onColorFilterChange?.(null);
    onParityFilterChange?.(null);
    onTimeFilterChange?.(null);
    
    setHasActiveFilters(false);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho e botão limpar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-vegas-gold" />
          <h3 className="text-sm font-medium text-white">Filtros de roleta</h3>
        </div>
        
        {hasActiveFilters && (
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
      
      {/* Filtros em row com dropdowns */}
      <div className="flex w-full space-x-2 bg-[#17191a] p-1">
        {/* Filtro por cor */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1 px-2">Por cores</div>
          <Select value={selectedColor} onValueChange={handleColorChange}>
            <SelectTrigger className="w-full bg-black border-none text-white h-10">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-800 text-white">
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="vermelho">
                <div className="flex items-center">
                  <span className="mr-2 w-2 h-2 rounded-full bg-red-600"></span> Vermelhos
                </div>
              </SelectItem>
              <SelectItem value="preto">
                <div className="flex items-center">
                  <span className="mr-2 w-2 h-2 rounded-full bg-gray-900"></span> Pretos
                </div>
              </SelectItem>
              <SelectItem value="verde">
                <div className="flex items-center">
                  <span className="mr-2 w-2 h-2 rounded-full bg-green-600"></span> Zero
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por número */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1 px-2">Por número</div>
          <Select value={selectedNumber} onValueChange={handleNumberChange}>
            <SelectTrigger className="w-full bg-black border-none text-white h-10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-800 text-white max-h-[200px] overflow-y-auto">
              {numberOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por paridade */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1 px-2">Por paridade</div>
          <Select value={selectedParity} onValueChange={handleParityChange}>
            <SelectTrigger className="w-full bg-black border-none text-white h-10">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-800 text-white">
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="par">Pares</SelectItem>
              <SelectItem value="impar">Ímpares</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por provedor */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1 px-2">Por provedor</div>
          <Select value={selectedProvider} onValueChange={handleProviderChange}>
            <SelectTrigger className="w-full bg-black border-none text-white h-10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-800 text-white max-h-[200px] overflow-y-auto">
              <SelectItem value="todos">Todos</SelectItem>
              {providers.map(provider => (
                <SelectItem key={provider.id} value={provider.id}>
                  {provider.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro por tempo */}
        <div className="flex-1">
          <div className="text-xs text-gray-400 mb-1 px-2">Por tempo</div>
          <Select value={selectedTime} onValueChange={handleTimeChange}>
            <SelectTrigger className="w-full bg-black border-none text-white h-10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-800 text-white">
              {timeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default RouletteFilters; 