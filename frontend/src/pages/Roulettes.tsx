import React, { useState, useEffect } from 'react';
import { useMultipleRoulettes } from '../hooks/useRoulette';
import RouletteCard from '../services/ui/components/RouletteCard';
import { RouletteRepository } from '../services/data/rouletteRepository';
import './Roulettes.css';

/**
 * Página que exibe todas as roletas disponíveis
 */
const RoulettesPage: React.FC = () => {
  const [allRouletteIds, setAllRouletteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Carregar todas as IDs de roletas disponíveis
  useEffect(() => {
    const loadRouletteIds = async () => {
      try {
        setLoading(true);
        const roulettes = await RouletteRepository.fetchAllRoulettesWithNumbers();
        setAllRouletteIds(roulettes.map(r => r.id));
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
  
  return (
    <div className="roulettes-page">
      <h1>Roletas Disponíveis</h1>
      
      {(loading || roulettesLoading) && (
        <div className="loading-indicator">
          <p>Carregando roletas...</p>
        </div>
      )}
      
      {(error || roulettesError) && (
        <div className="error-message">
          <p>Erro: {error || roulettesError}</p>
        </div>
      )}
      
      {!loading && !error && Object.keys(roulettes).length === 0 && (
        <div className="no-roulettes">
          <p>Nenhuma roleta disponível no momento</p>
        </div>
      )}
      
      <div className="grid grid-cols-3 gap-6">
        {Object.entries(roulettes).map(([id, roulette]) => (
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