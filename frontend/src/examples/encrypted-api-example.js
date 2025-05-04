/**
 * Exemplo de implementação para consumir a API pública com dados criptografados
 * Inclui exemplos de requisições normais e SSE (Server-Sent Events)
 */

import { useState, useEffect } from 'react';
import Iron from '@hapi/iron';

// IMPORTANTE: Em produção, esta chave deve ser carregada de forma segura
// Idealmente incluída no build do aplicativo, não diretamente no código
const ENCRYPTION_KEY = 'CwRS4tDa5uY7Bz9E0fGhJmNpQrStVxYz';

/**
 * Hook para buscar e decodificar a lista de roletas
 */
export function useRoulettes() {
  const [roulettes, setRoulettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRoulettes = async () => {
      try {
        setLoading(true);
        
        // Buscar dados criptografados da API pública
        const response = await fetch('/api/public/roulettes');
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || 'Erro ao buscar roletas');
        }
        
        // Decodificar os dados com @hapi/iron
        const decryptedData = await Iron.unseal(result.data, ENCRYPTION_KEY, Iron.defaults);
        
        setRoulettes(decryptedData.roulettes);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar roletas:', err);
        setError(err.message);
        setLoading(false);
      }
    };
    
    fetchRoulettes();
  }, []);
  
  return { roulettes, loading, error };
}

/**
 * Hook para buscar e decodificar os dados de uma roleta específica
 */
export function useRouletteData(rouletteId) {
  const [rouletteData, setRouletteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!rouletteId) {
      setError('ID da roleta não fornecido');
      setLoading(false);
      return;
    }
    
    const fetchRouletteData = async () => {
      try {
        setLoading(true);
        
        // Buscar dados criptografados da API pública
        const response = await fetch(`/api/public/roulettes/${rouletteId}`);
        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || 'Erro ao buscar dados da roleta');
        }
        
        // Decodificar os dados com @hapi/iron
        const decryptedData = await Iron.unseal(result.data, ENCRYPTION_KEY, Iron.defaults);
        
        setRouletteData(decryptedData);
        setLoading(false);
      } catch (err) {
        console.error(`Erro ao buscar dados da roleta ${rouletteId}:`, err);
        setError(err.message);
        setLoading(false);
      }
    };
    
    fetchRouletteData();
  }, [rouletteId]);
  
  return { rouletteData, loading, error };
}

/**
 * Hook para dados em tempo real via SSE
 */
export function useRealtimeRouletteData() {
  const [realtimeData, setRealtimeData] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const eventSource = new EventSource('/api/events/roulettes');
    let retryCount = 0;
    const maxRetries = 5;
    
    const handleUpdate = async (event) => {
      try {
        // Os dados vêm criptografados no formato Fe26.2*...
        const encryptedData = event.data;
        
        // Decodificar dados com @hapi/iron
        const decryptedData = await Iron.unseal(encryptedData, ENCRYPTION_KEY, Iron.defaults);
        
        // Atualizar o estado com os novos dados
        setRealtimeData(decryptedData.roulettes);
        setConnected(true);
        
        // Resetar contador de tentativas
        retryCount = 0;
      } catch (err) {
        console.error('Erro ao processar evento em tempo real:', err);
        setError(`Erro ao processar dados: ${err.message}`);
      }
    };
    
    // Configurar handlers do SSE
    eventSource.addEventListener('update', handleUpdate);
    
    eventSource.onopen = () => {
      console.log('Conexão SSE estabelecida');
      setConnected(true);
      retryCount = 0;
    };
    
    eventSource.onerror = (err) => {
      console.error('Erro na conexão SSE:', err);
      setConnected(false);
      
      // Tentar reconectar até atingir o limite de tentativas
      retryCount++;
      if (retryCount > maxRetries) {
        setError('Número máximo de tentativas de conexão excedido');
        eventSource.close();
      }
    };
    
    // Limpar na desmontagem do componente
    return () => {
      eventSource.removeEventListener('update', handleUpdate);
      eventSource.close();
    };
  }, []);
  
  return { realtimeData, connected, error };
}

/**
 * Exemplo de componente usando os hooks
 */
export function RouletteExample() {
  const { roulettes, loading: loadingRoulettes } = useRoulettes();
  const [selectedRouletteId, setSelectedRouletteId] = useState(null);
  const { rouletteData, loading: loadingRouletteData } = useRouletteData(selectedRouletteId);
  const { realtimeData, connected } = useRealtimeRouletteData();
  
  // Selecionar primeira roleta por padrão quando os dados carregarem
  useEffect(() => {
    if (roulettes.length > 0 && !selectedRouletteId) {
      setSelectedRouletteId(roulettes[0].id);
    }
  }, [roulettes, selectedRouletteId]);
  
  if (loadingRoulettes) {
    return <div>Carregando roletas...</div>;
  }
  
  return (
    <div>
      <h1>Exemplo da API Criptografada</h1>
      
      {/* Status da conexão em tempo real */}
      <div className="status-bar">
        Status: {connected ? 'Conectado' : 'Desconectado'}
      </div>
      
      {/* Seletor de roleta */}
      <div className="roulette-selector">
        <h2>Selecione uma roleta:</h2>
        <select
          value={selectedRouletteId || ''}
          onChange={(e) => setSelectedRouletteId(e.target.value)}
        >
          {roulettes.map((roulette) => (
            <option key={roulette.id} value={roulette.id}>
              {roulette.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Detalhes da roleta selecionada */}
      {loadingRouletteData ? (
        <div>Carregando dados da roleta...</div>
      ) : rouletteData ? (
        <div className="roulette-details">
          <h2>{rouletteData.name}</h2>
          <p>Provedor: {rouletteData.provider}</p>
          
          <h3>Últimos números:</h3>
          <div className="numbers-list">
            {rouletteData.numbers.map((num, index) => (
              <span 
                key={index} 
                className={`number ${num.color}`}
                title={new Date(num.timestamp).toLocaleString()}
              >
                {num.number}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      
      {/* Dados em tempo real */}
      <div className="realtime-section">
        <h2>Dados em tempo real:</h2>
        
        <div className="realtime-grid">
          {realtimeData.map((roulette) => (
            <div key={roulette.id} className="realtime-card">
              <h3>{roulette.name}</h3>
              {roulette.latestNumber && (
                <div className={`latest-number ${roulette.latestNumber.color}`}>
                  {roulette.latestNumber.number}
                </div>
              )}
              
              <div className="recent-numbers">
                {roulette.recentNumbers.map((num, index) => (
                  <span 
                    key={index} 
                    className={`number ${num.color}`}
                  >
                    {num.number}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 