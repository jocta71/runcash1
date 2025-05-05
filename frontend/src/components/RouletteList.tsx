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
    console.log('[RouletteList] Inicializando cliente de streaming...');
    
    // Obter instância do cliente de streaming
    const streamClient = RouletteStreamClient.getInstance({
      autoConnect: true // Conectar automaticamente ao stream
    });
    
    // Handler para atualizações de dados
    const handleDataUpdate = (data: any) => {
      console.log('[RouletteList] Recebida atualização de dados');
      
      if (data.encrypted) {
        console.log('[RouletteList] Dados criptografados recebidos');
        setIsEncrypted(true);
        return;
      }
      
      // Verificar formato de dados recebidos
      if (Array.isArray(data)) {
        console.log(`[RouletteList] Atualizando ${data.length} roletas`);
        setRoulettes(data);
      } else if (data.id) {
        // Atualização de uma única roleta
        setRoulettes(prevRoulettes => {
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
      }
    };
    
    // Registrar listeners para eventos do stream
    const handleConnect = () => {
      console.log('[RouletteList] Stream conectado');
      setError(null);
      setStreamStatus(streamClient.getStatus());
    };
    
    const handleDisconnect = () => {
      console.log('[RouletteList] Stream desconectado');
      setStreamStatus(streamClient.getStatus());
    };
    
    const handleError = (event: any) => {
      console.error('[RouletteList] Erro no stream:', event);
      setError(`Erro na conexão: ${event.message || 'Desconhecido'}`);
      setStreamStatus(streamClient.getStatus());
    };
    
    // Registrar handlers no cliente de streaming
    streamClient.on('update', handleDataUpdate);
    streamClient.on('connect', handleConnect);
    streamClient.on('disconnect', handleDisconnect);
    streamClient.on('error', handleError);
    
    // Registrar handlers de eventos globais
    const encryptedSubscription = EventBus.on('roulette:encrypted-data', () => {
      console.log('[RouletteList] Evento de dados criptografados recebido');
      setIsEncrypted(true);
      
      // Verificar se temos chave de acesso
      if (!cryptoService.hasAccessKey()) {
        setError('Dados criptografados. Você precisa de uma assinatura para ver os dados completos.');
      }
    });
    
    // Verificar se o usuário tem assinatura/chave de acesso
    setHasSubscription(cryptoService.hasAccessKey());
    
    // Atualizar status inicial
    setStreamStatus(streamClient.getStatus());
    
    // Conectar ao stream se ainda não estiver conectado
    if (!streamClient.getStatus().isConnected && !streamClient.getStatus().isConnecting) {
      console.log('[RouletteList] Iniciando conexão com o stream...');
      streamClient.connect();
    }
    
    // Limpar listeners ao desmontar o componente
    return () => {
      console.log('[RouletteList] Limpando listeners...');
      streamClient.off('update', handleDataUpdate);
      streamClient.off('connect', handleConnect);
      streamClient.off('disconnect', handleDisconnect);
      streamClient.off('error', handleError);
      encryptedSubscription.unsubscribe();
    };
  }, []);
  
  // Renderizar indicador de carregamento se não tivermos dados
  if (roulettes.length === 0 && !isEncrypted && !error) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando dados de roletas em tempo real...</p>
        {streamStatus && (
          <div className="stream-status">
            <p>Status do stream: {streamStatus.isConnected ? 'Conectado' : 'Conectando...'}</p>
            {streamStatus.reconnectAttempts > 0 && (
              <p>Tentativas de reconexão: {streamStatus.reconnectAttempts}</p>
            )}
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
        <button 
          className="retry-button"
          onClick={() => {
            setError(null);
            RouletteStreamClient.getInstance().connect();
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
  
  // Renderizar mensagem para dados criptografados sem assinatura
  if (isEncrypted && !hasSubscription) {
    return (
      <SubscriptionRequired 
        message="Os dados de roletas estão criptografados. Assine para obter acesso completo em tempo real."
      />
    );
  }
  
  // Renderizar lista de roletas
  return (
    <div className="roulette-list-container">
      <h2>Roletas em Tempo Real</h2>
      
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