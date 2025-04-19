import React, { useState, useEffect, useMemo } from 'react';
import { ArrowDownAZ, ListFilter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RouletteFilters, { RouletteProvider } from '@/components/RouletteFilters';
import RouletteSearch from '@/components/RouletteSearch';
import { RouletteData } from '@/types';
import { extractProviders } from '@/utils/rouletteProviders';

interface RouletteFilterBarProps {
  roulettes: RouletteData[];
  onFilter: (filtered: RouletteData[]) => void;
  onRefresh?: () => void;
}

/**
 * Componente que combina filtros para roletas
 */
const RouletteFilterBar: React.FC<RouletteFilterBarProps> = ({
  roulettes,
  onFilter,
  onRefresh
}) => {
  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [showProviderFilter, setShowProviderFilter] = useState(false);
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
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(roulette => {
          const name = (roulette.name || roulette.nome || '').toLowerCase();
          return name.includes(term);
        });
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
      
      // Enviar os resultados filtrados
      onFilter(filtered);
    };
    
    applyFilters();
  }, [roulettes, searchTerm, selectedProviders, providers, onFilter]);
  
  // Função para togglear a exibição do filtro de provedores
  const toggleProviderFilter = () => {
    setShowProviderFilter(prev => !prev);
  };
  
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
  
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700/50">
      <div className="flex flex-col gap-4">
        {/* Barra de busca e botões */}
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
            onClick={toggleProviderFilter}
            className={`h-10 w-10 ${showProviderFilter ? 'bg-vegas-gold text-black' : 'text-vegas-gold'}`}
            title="Filtrar por provedor"
          >
            <ListFilter size={18} />
          </Button>
          
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
        
        {/* Filtros de provedor (exibidos apenas quando o botão é clicado) */}
        {showProviderFilter && (
          <RouletteFilters
            providers={providers}
            selectedProviders={selectedProviders}
            onProviderSelect={handleProviderSelect}
            onClearFilters={() => setSelectedProviders([])}
          />
        )}
        
        {/* Exibir contadores */}
        <div className="flex justify-between items-center text-sm text-gray-400">
          <div>
            Mostrando <span className="text-vegas-gold font-medium">{roulettes.length}</span> roletas
          </div>
          
          {(selectedProviders.length > 0 || searchTerm.trim()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-7 px-2 text-xs hover:text-white"
            >
              Limpar todos os filtros
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouletteFilterBar; 