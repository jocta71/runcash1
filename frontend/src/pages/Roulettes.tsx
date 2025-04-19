import React, { useState, useEffect } from 'react';
import { useMultipleRoulettes } from '../hooks/useRoulette';
import RouletteCard from '../services/ui/components/RouletteCard';
import { RouletteRepository } from '../services/data/rouletteRepository';
import RouletteFilters from '../components/RouletteFilters';
import './Roulettes.css';

/**
 * Página que exibe todas as roletas disponíveis
 */
const RoulettesPage: React.FC = () => {
  const [allRouletteIds, setAllRouletteIds] = useState<string[]>([]);
  const [filteredRouletteIds, setFilteredRouletteIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState('default');
  
  // Carregar todas as IDs de roletas disponíveis
  useEffect(() => {
    const loadRouletteIds = async () => {
      try {
        setLoading(true);
        const roulettes = await RouletteRepository.fetchAllRoulettesWithNumbers();
        setAllRouletteIds(roulettes.map(r => r.id));
        // Inicialmente, todas as roletas são filtradas
        setFilteredRouletteIds(roulettes.map(r => r.id));
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro ao carregar roletas';
        console.error('Erro ao carregar roletas:', err);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };
    
    loadRouletteIds();
  }, []);
  
  // Usar o hook para carregar dados de todas as roletas
  const { roulettes, loading: roulettesLoading, error: roulettesError } = 
    useMultipleRoulettes(allRouletteIds);
  
  // Handler para mudança de filtro
  const handleFilterChange = (filteredIds: string[]) => {
    setFilteredRouletteIds(filteredIds);
  };
  
  // Handler para mudança de modo de visualização
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
  };
  
  // Handler para mudança de ordenação
  const handleSortModeChange = (mode: string) => {
    setSortMode(mode);
  };
  
  // Classes para o contêiner de cards com base no modo de visualização
  const cardsContainerClass = viewMode === 'grid' 
    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
    : "flex flex-col gap-4";
  
  return (
    <div className="roulettes-page p-4">
      <h1 className="text-2xl font-bold mb-6">Roletas Disponíveis</h1>
      
      {/* Componente de filtros */}
      {!loading && !error && Object.keys(roulettes).length > 0 && (
        <RouletteFilters 
          roulettes={roulettes}
          onFilterChange={handleFilterChange}
          onViewModeChange={handleViewModeChange}
          onSortModeChange={handleSortModeChange}
        />
      )}
      
      {/* Indicador de carregamento */}
      {(loading || roulettesLoading) && (
        <div className="loading-indicator">
          <p>Carregando roletas...</p>
        </div>
      )}
      
      {/* Mensagem de erro */}
      {(error || roulettesError) && (
        <div className="error-message bg-red-500/20 border border-red-500/50 p-4 rounded">
          <p>Erro: {error || roulettesError}</p>
        </div>
      )}
      
      {/* Mensagem quando não há roletas */}
      {!loading && !error && Object.keys(roulettes).length === 0 && (
        <div className="no-roulettes bg-black/40 p-6 rounded text-center">
          <p>Nenhuma roleta disponível no momento</p>
        </div>
      )}
      
      {/* Mensagem quando o filtro não retorna resultados */}
      {!loading && !error && Object.keys(roulettes).length > 0 && filteredRouletteIds.length === 0 && (
        <div className="no-roulettes-filtered bg-black/40 p-6 rounded text-center">
          <p>Nenhuma roleta corresponde aos filtros selecionados</p>
        </div>
      )}
      
      {/* Contagem de roletas */}
      {!loading && !error && filteredRouletteIds.length > 0 && (
        <div className="roulette-count mb-4 text-sm text-gray-400">
          Exibindo {filteredRouletteIds.length} de {Object.keys(roulettes).length} roletas
        </div>
      )}
      
      {/* Container de cards de roleta */}
      <div className={cardsContainerClass}>
        {filteredRouletteIds.map(id => (
          <RouletteCard 
            key={id} 
            rouletteId={id}
            onError={(errorMsg) => console.error(`Erro na roleta ${id}:`, errorMsg)}
          />
        ))}
      </div>
    </div>
  );
};

export default RoulettesPage; 