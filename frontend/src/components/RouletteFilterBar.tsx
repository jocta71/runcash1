import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RouletteFilters, { RouletteProvider } from '@/components/RouletteFilters';
import RouletteSearch from '@/components/RouletteSearch';
import { RouletteData } from '@/types';
import { extractProviders } from '@/utils/rouletteProviders';
import { 
  filterRoulettesBySearchTerm, 
  filterRoulettesByNumber, 
  filterRoulettesByColor,
  filterRoulettesByParity,
  filterRoulettesByTime
} from '@/utils/rouletteFilters';

interface RouletteFilterBarProps {
  roulettes: RouletteData[];
  onFilter: (filtered: RouletteData[]) => void;
  onRefresh?: () => void;
  onOpenSidePanelStats?: () => void;
}

/**
 * Componente que combina filtros para roletas
 */
const RouletteFilterBar: React.FC<RouletteFilterBarProps> = ({
  roulettes,
  onFilter,
  onRefresh,
  onOpenSidePanelStats
}) => {
  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [numberFilter, setNumberFilter] = useState<number | null>(null);
  const [colorFilter, setColorFilter] = useState<'red' | 'black' | 'green' | null>(null);
  const [parityFilter, setParityFilter] = useState<'even' | 'odd' | null>(null);
  const [timeFilter, setTimeFilter] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Extrair provedores das roletas
  const providers = useMemo(() => {
    return extractProviders(roulettes);
  }, [roulettes]);
  
  // Efeito para aplicar os filtros quando mudam
  useEffect(() => {
    const applyFilters = () => {
      let filtered = [...roulettes];
      
      // Aplicar filtro de pesquisa
      if (searchTerm.trim()) {
        filtered = filterRoulettesBySearchTerm(filtered, searchTerm);
      }
      
      // Aplicar filtro de provedores
      if (selectedProviders.length > 0) {
        filtered = filtered.filter(roulette => {
          const name = roulette.name || roulette.nome || '';
          
          // Identificar o provedor pelo nome
          for (const provider of providers) {
            if (selectedProviders.includes(provider.id)) {
              // Verificar se o nome da roleta contém o nome do provedor
              if (name.toLowerCase().includes(provider.id.toLowerCase())) {
                return true;
              }
            }
          }
          
          return false;
        });
      }
      
      // Aplicar filtro de número específico
      if (numberFilter !== null) {
        filtered = filterRoulettesByNumber(filtered, numberFilter);
      }
      
      // Aplicar filtro de cor
      if (colorFilter !== null) {
        filtered = filterRoulettesByColor(filtered, colorFilter);
      }
      
      // Aplicar filtro de paridade
      if (parityFilter !== null) {
        filtered = filterRoulettesByParity(filtered, parityFilter);
      }
      
      // Aplicar filtro de tempo
      if (timeFilter !== null) {
        filtered = filterRoulettesByTime(filtered, timeFilter);
      }
      
      // Enviar os resultados filtrados
      onFilter(filtered);
    };
    
    applyFilters();
  }, [
    roulettes, 
    searchTerm, 
    selectedProviders, 
    numberFilter, 
    colorFilter, 
    parityFilter, 
    timeFilter, 
    providers, 
    onFilter
  ]);
  
  // Função para lidar com a seleção de um provedor
  const handleProviderSelect = (providerId: string) => {
    setSelectedProviders(prev => {
      // Se já está selecionado, remove
      if (prev.includes(providerId)) {
        return prev.filter(id => id !== providerId);
      }
      // Caso contrário, adiciona
      return [...prev, providerId];
    });
  };
  
  // Função para limpar todos os filtros
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedProviders([]);
    setNumberFilter(null);
    setColorFilter(null);
    setParityFilter(null);
    setTimeFilter(null);
  };
  
  // Função para atualizar os dados
  const handleRefresh = () => {
    if (onRefresh) {
      setIsRefreshing(true);
      
      // Chamar a função de atualização
      onRefresh();
      
      // Desabilitar o botão por 2 segundos
      setTimeout(() => {
        setIsRefreshing(false);
      }, 2000);
    }
  };
  
  const hasAnyFilters = searchTerm.trim() || 
                        selectedProviders.length > 0 || 
                        numberFilter !== null || 
                        colorFilter !== null || 
                        parityFilter !== null || 
                        timeFilter !== null;
  
  // Número de roletas filtradas
  const filteredCount = roulettes.length;
  
  return (
    <div className="rounded-lg p-4 mb-6 border border-gray-700/50" style={{ backgroundColor: 'rgb(19 22 20 / var(--tw-bg-opacity, 1))' }}>
      <div className="flex flex-col gap-4">
        {/* Barra de busca e botão de atualização */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <RouletteSearch
              initialValue={searchTerm}
              onSearch={setSearchTerm}
            />
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-10 w-10 text-vegas-gold"
            title="Atualizar roletas"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
        
        {/* Filtros (sempre visíveis) */}
        <RouletteFilters
          providers={providers}
          selectedProviders={selectedProviders}
          onProviderSelect={handleProviderSelect}
          onClearFilters={() => setSelectedProviders([])}
          onNumberFilterChange={setNumberFilter}
          onColorFilterChange={setColorFilter}
          onParityFilterChange={setParityFilter}
          onTimeFilterChange={setTimeFilter}
          onOpenSidePanelStats={onOpenSidePanelStats}
        />
        
        {/* Exibir contadores e botão de limpar todos */}
        <div className="flex flex-col flex-wrap mt-6 gap-3 lg:flex-row">
          {renderSelectedFiltersSection()}
          <div className="flex justify-end w-full">
            <Button
              variant="ghost"
              size="xxs"
              onClick={() => {
                onFiltersChange(getEmptySearchObject())
                setSelectedProvider(null)
                setSelectedSearchTerm("")
                setSelectedNumber(null)
                setSelectedColor(null)
                setSelectedParity(null)
                setSelectedTime(null)
              }}
            >
              Limpar filtros
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouletteFilterBar; 