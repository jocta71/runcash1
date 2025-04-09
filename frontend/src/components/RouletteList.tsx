import React, { useEffect, useState } from 'react';
import RouletteCard from './RouletteCard';
import { RouletteApi } from '../services/api/rouletteApi';
import { getLogger } from '../services/utils/logger';

// Criar uma instância do logger para este componente
const logger = getLogger('RouletteList');

interface Roulette {
  id?: string;
  _id?: string;
  roleta_id?: string;
  nome?: string;
  name?: string;
}

const RouletteList: React.FC = () => {
  const [roulettes, setRoulettes] = useState<Roulette[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Carregar lista inicial de roletas usando o endpoint correto
    const loadRoulettes = async () => {
      try {
        setLoading(true);
        logger.info('Carregando lista de roletas...');
        
        // Usar API para buscar lista limitada de roletas
        const data = await RouletteApi.fetchLimitedRoulettes();
        
        if (data && data.length > 0) {
          logger.info(`✅ ${data.length} roletas carregadas com sucesso`);
          setRoulettes(data);
        } else {
          logger.warn('⚠️ Nenhuma roleta retornada pela API');
          setError('Não foi possível carregar as roletas. Tente novamente mais tarde.');
        }
      } catch (error) {
        logger.error('❌ Erro ao carregar roletas:', error);
        setError('Erro ao carregar roletas. Verifique sua conexão.');
      } finally {
        setLoading(false);
      }
    };

    loadRoulettes();
  }, []);

  // Renderizar mensagem de carregamento
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Renderizar mensagem de erro
  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        <p>{error}</p>
        <button 
          className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={() => window.location.reload()}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Renderizar lista de roletas
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {roulettes.length > 0 ? (
        roulettes.map((roulette) => (
          <RouletteCard
            key={roulette.roleta_id || roulette._id || roulette.id}
            roletaId={roulette.roleta_id || roulette._id || roulette.id || ''}
            roletaNome={roulette.nome || roulette.name || 'Roleta sem nome'}
          />
        ))
      ) : (
        <div className="col-span-3 text-center p-8 bg-gray-100 rounded">
          <p className="text-gray-500">Nenhuma roleta disponível no momento.</p>
        </div>
      )}
    </div>
  );
};

export default RouletteList; 