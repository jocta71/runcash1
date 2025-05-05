import React, { useEffect, useState } from 'react';
import RouletteStreamClient from '../utils/RouletteStreamClient';
import { cryptoService } from '../utils/crypto-utils';
import EventBus from '../services/EventBus';
import SubscriptionRequired from './SubscriptionRequired';

// Interface para dados de roleta
interface Roulette {
  id: string;
  nome: string;
  ativa: boolean;
  numero: Array<{
    numero: number;
    cor: string;
    timestamp: string;
    roleta_id: string;
    roleta_nome: string;
  }>;
}

// Interface para status do stream
interface StreamStatus {
  isConnected: boolean;
  isConnecting: boolean;
  reconnectAttempts: number;
  lastEventId: string | null;
  lastReceivedAt: number;
  cacheSize: number;
}

const RouletteList: React.FC = () => {
  // Estado para armazenar dados de roletas
  const [roulettes, setRoulettes] = useState<Roulette[]>([]);
  
  // Estado para rastrear se os dados estão criptografados
  const [isEncrypted, setIsEncrypted] = useState<boolean>(false);
  
  // Estado para rastrear status do stream
  const [streamStatus, setStreamStatus] = useState<StreamStatus | null>(null);
  
  // Estado para mensagens de erro
  const [error, setError] = useState<string | null>(null);
  
  // Estado para saber se o usuário tem assinatura
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  
  // Inicializar streaming ao montar o componente
  useEffect(() => {
    // Obter instância do cliente de streaming
    const streamClient = RouletteStreamClient.getInstance({
      autoConnect: true
    });
    
    // Registrar listener para eventos de atualização
    const handleUpdate = (data: any) => {
      if (data.encrypted) {
        setIsEncrypted(true);
        return;
      }
      
      // Verificar se temos uma atualização para uma única roleta ou várias
      if (data.id) {
        // Atualização de uma única roleta
        setRoulettes(prevRoulettes => {
          // Verificar se essa roleta já existe na lista
          const existingIndex = prevRoulettes.findIndex(r => r.id === data.id);
          
          if (existingIndex >= 0) {
            // Atualizar roleta existente
            const updatedRoulettes = [...prevRoulettes];
            updatedRoulettes[existingIndex] = data;
            return updatedRoulettes;
          } else {
            // Adicionar nova roleta
            return [...prevRoulettes, data];
          }
        });
      } else if (Array.isArray(data)) {
        // Atualização de múltiplas roletas
        setRoulettes(data);
      }
    };
    
    // Registrar listener para status do stream
    const handleConnect = () => {
      setError(null);
      setStreamStatus(streamClient.getStatus());
    };
    
    // Registrar listener para erros
    const handleError = (event: any) => {
      setError(`Erro na conexão: ${event.message || 'Desconhecido'}`);
      setStreamStatus(streamClient.getStatus());
    };
    
    // Registrar listener para dados criptografados
    const handleEncryptedData = () => {
      setIsEncrypted(true);
      
      // Verificar se temos chave de acesso
      if (!cryptoService.hasAccessKey()) {
        setError('Dados criptografados. Você precisa de uma assinatura para ver os dados completos.');
      }
    };
    
    // Registrar handlers de eventos
    streamClient.on('update', handleUpdate);
    streamClient.on('connect', handleConnect);
    streamClient.on('error', handleError);
    
    // Registrar handler global para dados criptografados
    const encryptedSubscription = EventBus.on('roulette:encrypted-data', handleEncryptedData);
    
    // Verificar se o usuário tem assinatura e chave de acesso
    setHasSubscription(cryptoService.hasAccessKey());
    
    // Atualizar status inicial
    setStreamStatus(streamClient.getStatus());
    
    // Conectar ao stream se não estiver conectado
    if (!streamClient.getStatus().isConnected && !streamClient.getStatus().isConnecting) {
      streamClient.connect();
    }
    
    // Limpar ao desmontar
    return () => {
      streamClient.off('update', handleUpdate);
      streamClient.off('connect', handleConnect);
      streamClient.off('error', handleError);
      encryptedSubscription.unsubscribe();
    };
  }, []);
  
  // Renderizar indicador de carregamento se não tivermos dados
  if (roulettes.length === 0 && !isEncrypted && !error) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando dados de roletas...</p>
        {streamStatus && (
          <div className="stream-status">
            <p>Status: {streamStatus.isConnected ? 'Conectado' : 'Desconectado'}</p>
          </div>
        )}
      </div>
    );
  }
  
  // Renderizar mensagem de erro
  if (error) {
    return (
      <div className="error-container">
        <h3>Erro ao carregar dados</h3>
        <p>{error}</p>
        {isEncrypted && !hasSubscription && (
          <SubscriptionRequired 
            message="Os dados de roletas estão criptografados. Assine para obter acesso completo."
          />
        )}
      </div>
    );
  }
  
  // Renderizar dados criptografados
  if (isEncrypted && !hasSubscription) {
    return (
      <SubscriptionRequired 
        message="Os dados de roletas estão criptografados. Assine para obter acesso completo."
      />
    );
  }
  
  // Renderizar lista de roletas
  return (
    <div className="roulette-list-container">
      <h2>Roletas Disponíveis</h2>
      
      {streamStatus && (
        <div className="stream-status">
          <p>
            Status: {streamStatus.isConnected ? 'Conectado' : 'Desconectado'} | 
            Última atualização: {streamStatus.lastReceivedAt ? new Date(streamStatus.lastReceivedAt).toLocaleTimeString() : 'N/A'}
          </p>
        </div>
      )}
      
      <div className="roulette-grid">
        {roulettes.map(roulette => (
          <div key={roulette.id} className="roulette-card">
            <h3>{roulette.nome}</h3>
            <div className="numbers-container">
              {roulette.numero.slice(0, 10).map((num, index) => (
                <div 
                  key={`${roulette.id}-${index}`} 
                  className={`number-ball ${num.cor}`}
                >
                  {num.numero}
                </div>
              ))}
            </div>
            <div className="roulette-info">
              <p>Último número: {roulette.numero[0]?.numero}</p>
              <p>Cor: {roulette.numero[0]?.cor}</p>
              <p>Hora: {new Date(roulette.numero[0]?.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RouletteList; 