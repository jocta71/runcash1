import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import RouletteSearch from '@/components/RouletteSearch';
import { RouletteData } from '@/types';
import { 
  filterRoulettesBySearchTerm
} from '@/utils/rouletteFilters';
import { extractProviders, filterRoulettesByProvider, RouletteProvider } from '@/utils/rouletteProviders';

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

    // Atualizar a contagem e enviar os resultados filtrados
    setFilteredCount(filtered.length);
    onFilter(filtered);
  }, [searchTerm, selectedProviders, roulettes, onFilter]);

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

  // Verificar se um provedor está selecionado
  const isProviderSelected = (providerId: string) => {
    return selectedProviders.includes(providerId);
  };

  // Número de provedores selecionados
  const selectedProvidersCount = selectedProviders.length;

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
        <div className="flex flex-wrap gap-2">
          {providers.map((provider: RouletteProvider) => (
            <Button
              key={provider.id}
              variant={isProviderSelected(provider.id) ? "default" : "outline"}
              size="sm"
              className={`h-8 text-xs ${
                isProviderSelected(provider.id) 
                  ? "bg-amber-500 hover:bg-amber-600 text-black" 
                  : "bg-transparent hover:bg-card/50 border-border"
              }`}
              onClick={() => handleProviderToggle(provider.id)}
            >
              {provider.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="text-sm text-muted-foreground mt-1">
        Mostrando {filteredCount} roletas
      </div>
    </div>
  );
};

export default RouletteFilterBar; 