import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCcw, X, Clock, Palette, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RouletteData } from '@/types';
import { 
  filterRoulettesBySearchTerm,
  filterRoulettesByNumber,
  filterRoulettesByColor,
  filterRoulettesByParity,
  filterRoulettesByTime,
  filterRoulettesByMinute
} from '@/utils/rouletteFilters';
import { extractProviders, filterRoulettesByProvider, RouletteProvider } from '@/utils/rouletteProviders';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RouletteFilterBarProps {
  roulettes: RouletteData[];
  onFilter: (filtered: RouletteData[]) => void;
  loading?: boolean;
  onRefresh?: () => void;
}

/**
 * Componente simplificado com barra de busca, filtro de provedores e botão de atualização
 * Filtros mais avançados permanecem exclusivamente no SidePanelStats
 */
const RouletteFilterBar = ({
  roulettes,
  onFilter,
  loading = false,
  onRefresh,
}: RouletteFilterBarProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [filteredCount, setFilteredCount] = useState(roulettes.length);
  
  // Novos estados para filtros adicionais
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState<'red' | 'black' | 'green' | null>(null);
  const [selectedParity, setSelectedParity] = useState<'even' | 'odd' | null>(null);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);
  const [selectedMinute, setSelectedMinute] = useState<string | null>(null);

  // Extrair provedores disponíveis dos dados de roletas
  const providers = useMemo(() => {
    return extractProviders(roulettes);
  }, [roulettes]);

  // Aplicar filtros quando o termo de busca, provedores selecionados ou dados de roletas mudam
  useEffect(() => {
    if (!roulettes || !Array.isArray(roulettes)) {
      setFilteredCount(0);
      onFilter([]);
      return;
    }

    let filtered = roulettes;

    // Aplicar filtro de busca por termo se houver um
    if (searchTerm) {
      filtered = filterRoulettesBySearchTerm(filtered, searchTerm);
    }

    // Aplicar filtro de provedor se houver provedores selecionados
    if (selectedProviders.length > 0) {
      filtered = filterRoulettesByProvider(filtered, selectedProviders);
    }
    
    // Aplicar filtros adicionais
    if (selectedNumber !== null) {
      filtered = filterRoulettesByNumber(filtered, selectedNumber);
    }
    
    if (selectedColor !== null) {
      filtered = filterRoulettesByColor(filtered, selectedColor);
    }
    
    if (selectedParity !== null) {
      filtered = filterRoulettesByParity(filtered, selectedParity);
    }
    
    if (selectedTime !== null) {
      filtered = filterRoulettesByTime(filtered, selectedTime);
    }
    
    if (selectedMinute !== null) {
      filtered = filterRoulettesByMinute(filtered, selectedMinute);
    }

    // Atualizar a contagem e enviar os resultados filtrados
    setFilteredCount(filtered.length);
    onFilter(filtered);
  }, [
    searchTerm, 
    selectedProviders, 
    roulettes, 
    onFilter, 
    selectedNumber, 
    selectedColor, 
    selectedParity, 
    selectedTime,
    selectedMinute
  ]);

  // Alternar seleção de um provedor
  const handleProviderToggle = (providerId: string) => {
    setSelectedProviders((current) => {
      if (current.includes(providerId)) {
        // Remover este provedor se já estiver selecionado
        return current.filter((id) => id !== providerId);
      } else {
        // Adicionar este provedor à seleção
        return [...current, providerId];
      }
    });
  };

  // Limpar todos os filtros de provedor
  const clearProviderFilters = () => {
    setSelectedProviders([]);
  };
  
  // Limpar todos os filtros
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedProviders([]);
    setSelectedNumber(null);
    setSelectedColor(null);
    setSelectedParity(null);
    setSelectedTime(null);
    setSelectedMinute(null);
  };

  // Verificar se um provedor está selecionado
  const isProviderSelected = (providerId: string) => {
    return selectedProviders.includes(providerId);
  };

  // Número de provedores selecionados
  const selectedProvidersCount = selectedProviders.length;
  
  // Verificar se algum filtro está ativo
  const hasActiveFilters = searchTerm || 
    selectedProviders.length > 0 || 
    selectedNumber !== null || 
    selectedColor !== null || 
    selectedParity !== null || 
    selectedTime !== null ||
    selectedMinute !== null;

  // Opções para os dropdowns
  const numberOptions = [
    { value: 'all', label: 'Todos' },
    { value: '0', label: '0' },
    ...Array.from({ length: 36 }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1)
    }))
  ];
  
  const colorOptions = [
    { value: 'all', label: 'Todas' },
    { value: 'red', label: 'Vermelhas' },
    { value: 'black', label: 'Pretas' },
    { value: 'green', label: 'Verdes (0)' }
  ];
  
  const parityOptions = [
    { value: 'all', label: 'Todas' },
    { value: 'even', label: 'Pares' },
    { value: 'odd', label: 'Ímpares' }
  ];
  
  const timeOptions = [
    { value: 'all', label: 'Todos' },
    { value: '1', label: 'Último minuto' },
    { value: '5', label: 'Últimos 5 minutos' },
    { value: '10', label: 'Últimos 10 minutos' },
    { value: '30', label: 'Últimos 30 minutos' },
    { value: '60', label: 'Última hora' }
  ];
  
  const minuteOptions = [
    { value: 'all', label: 'Todos' },
    ...Array.from({ length: 60 }, (_, i) => ({
      value: i.toString().padStart(2, '0'),
      label: i.toString().padStart(2, '0')
    }))
  ];

  return (
    <div className="flex flex-col w-full gap-2 mb-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            className="pr-10"
            placeholder="Pesquisar roletas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchTerm("")}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            disabled={loading}
            onClick={onRefresh}
            title="Atualizar dados"
          >
            <RefreshCcw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
          </Button>
        )}
      </div>

      {/* Filtros de Provedor como botões sempre visíveis */}
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Provedores:</span>
            {selectedProvidersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={clearProviderFilters}
              >
                <X size={14} className="mr-1" />
                Limpar filtros ({selectedProvidersCount})
              </Button>
            )}
          </div>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20"
              onClick={clearAllFilters}
            >
              <X size={14} className="mr-1" />
              Limpar todos os filtros
            </Button>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {providers.map((provider: RouletteProvider) => (
            <Button
              key={provider.id}
              variant={isProviderSelected(provider.id) ? "default" : "outline"}
              size="sm"
              className={`h-8 text-xs ${
                isProviderSelected(provider.id) 
                  ? "bg-amber-500 hover:bg-amber-600 text-black" 
                  : "bg-background hover:bg-muted"
              }`}
              onClick={() => handleProviderToggle(provider.id)}
            >
              {provider.name}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Filtros adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-1">
        {/* Filtro por número */}
        <div>
          <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
            <HandCoins size={12} />
            <span>Número:</span>
          </div>
          <Select 
            value={selectedNumber !== null ? String(selectedNumber) : 'all'} 
            onValueChange={(value) => setSelectedNumber(value === 'all' ? null : parseInt(value, 10))}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto">
              {numberOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro por cor */}
        <div>
          <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
            <Palette size={12} />
            <span>Cor:</span>
          </div>
          <Select 
            value={selectedColor || 'all'} 
            onValueChange={(value) => setSelectedColor(value === 'all' ? null : value as 'red' | 'black' | 'green')}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {colorOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro por paridade */}
        <div>
          <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
            <span>Paridade:</span>
          </div>
          <Select 
            value={selectedParity || 'all'} 
            onValueChange={(value) => setSelectedParity(value === 'all' ? null : value as 'even' | 'odd')}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {parityOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro por tempo */}
        <div>
          <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
            <Clock size={12} />
            <span>Tempo:</span>
          </div>
          <Select 
            value={selectedTime !== null ? String(selectedTime) : 'all'} 
            onValueChange={(value) => setSelectedTime(value === 'all' ? null : parseInt(value, 10))}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro por minuto específico */}
        <div>
          <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
            <span>Minuto (HH:MM):</span>
          </div>
          <Select 
            value={selectedMinute || 'all'} 
            onValueChange={(value) => setSelectedMinute(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px] overflow-y-auto">
              {minuteOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm text-muted-foreground mt-1">
        Mostrando {filteredCount} roletas
      </div>
    </div>
  );
};

export default RouletteFilterBar; 