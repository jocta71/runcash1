import React, { useState, useEffect } from 'react';
import { useMultipleRoulettes } from '../hooks/useRoulette';
import RouletteCard from '@/components/RouletteCard';
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
  
  // Converter os dados para o formato esperado pelo componente RouletteCard original
  const formattedRoulettes = Object.entries(roulettes).map(([id, roulette]) => {
    // Extrai os números da roleta 
    // Primeiro tenta o campo 'numbers', depois 'numero', ou usa um array vazio como fallback
    const recentNumbers = roulette?.numbers 
      ? roulette.numbers.slice(0, 5).map(n => n.number) 
      : roulette?.numero 
        ? roulette.numero.slice(0, 5) 
        : [0, 0, 0, 0, 0];
      
    return {
      name: roulette?.name || id,
      lastNumbers: recentNumbers,
      wins: roulette?.wins || 0,
      losses: roulette?.losses || 0,
      trend: Array.from({ length: 20 }, () => ({ value: Math.random() * 100 }))
    };
  });
  
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
        {formattedRoulettes.map((roulette, index) => (
          <RouletteCard 
            key={index}
            {...roulette}
          />
        ))}
      </div>
    </div>
  );
};

export default RoulettesPage; 