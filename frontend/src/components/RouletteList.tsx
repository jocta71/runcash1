import React, { useEffect, useState, useCallback } from 'react';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import EventBus from '../services/EventBus';
import SubscriptionRequired from './SubscriptionRequired';

// Importar o serviço de criptografia corretamente
import cryptoService from '../utils/crypto-service';

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
  }> | number[];
}

// Interface para status do stream
interface StreamStatus {
  isConnected: boolean;
  lastReceivedAt: number | null;
  reconnectAttempts: number;
}

// Interface para a inscrição de eventos
interface Subscription {
  unsubscribe: () => void;
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
  
  // Estado para controlar tentativas de carregamento
  const [loadAttempts, setLoadAttempts] = useState<number>(0);

  // Função para forçar o recarregamento dos dados
  const forceReload = useCallback(() => {
    console.log('[RouletteList] Forçando recarregamento de dados...');
    setLoadAttempts(prev => prev + 1);
    
    const unifiedClient = UnifiedRouletteClient.getInstance();
    
    // Reconectar ao stream SSE
    unifiedClient.connectStream();
    
    // Forçar atualização dos dados
    unifiedClient.forceUpdate().then(data => {
      console.log(`[RouletteList] Recarregamento forçado obteve ${data.length} roletas`);
      if (data && data.length > 0) {
        setRoulettes(data);
      }
    }).catch(err => {
      console.error('[RouletteList] Erro ao forçar recarregamento:', err);
    });
  }, []);
  
  // Inicializar streaming ao montar o componente
  useEffect(() => {
    console.log('[RouletteList] Inicializando UnifiedRouletteClient...');
    
    // Obter instância do cliente unificado
    const unifiedClient = UnifiedRouletteClient.getInstance({
      streamingEnabled: true,
      autoConnect: true
    });
    
    // Forçar conexão com stream SSE
    unifiedClient.connectStream();
    
    // Handler para atualizações de dados
    const handleDataUpdate = (data: any) => {
      console.log('[RouletteList] Recebida atualização de dados');
      
      if (data.encrypted) {
        console.log('[RouletteList] Dados criptografados recebidos');
        setIsEncrypted(true);
        return;
      }
      
      // Atualizar com todos os dados disponíveis
      const allRoulettes = unifiedClient.getAllRoulettes();
      if (allRoulettes && allRoulettes.length > 0) {
        console.log(`[RouletteList] Atualizando ${allRoulettes.length} roletas`);
        setRoulettes(allRoulettes);
      }
    };
    
    // Handler para eventos de conexão
    const handleConnect = (data: any) => {
      console.log('[RouletteList] Conectado ao stream');
      setStreamStatus(prevStatus => ({
        isConnected: true,
        lastReceivedAt: Date.now(),
        reconnectAttempts: prevStatus?.reconnectAttempts || 0
      }));
      
      // Forçar uma atualização ao conectar
      unifiedClient.forceUpdate();
    };
    
    // Handler para eventos de desconexão
    const handleDisconnect = (data: any) => {
      console.log('[RouletteList] Desconectado do stream');
      setStreamStatus(prevStatus => ({
        ...prevStatus!,
        isConnected: false
      }));
    };
    
    // Handler para erros
    const handleError = (error: any) => {
      console.error('[RouletteList] Erro no stream:', error);
      setError('Erro ao conectar ao stream de dados. Tente novamente.');
      setStreamStatus(prevStatus => ({
        ...prevStatus!,
        isConnected: false
      }));
    };
    
    // Handler para tentativas de reconexão
    const handleReconnecting = (data: any) => {
      console.log(`[RouletteList] Tentando reconectar (tentativa ${data.attempt})`);
      setStreamStatus(prevStatus => ({
        ...prevStatus!,
        isConnected: false,
        reconnectAttempts: data.attempt
      }));
    };
    
    // Registrar listeners para eventos do cliente unificado
    unifiedClient.on('update', handleDataUpdate);
    unifiedClient.on('connect', handleConnect);
    unifiedClient.on('disconnect', handleDisconnect);
    unifiedClient.on('error', handleError);
    unifiedClient.on('reconnecting', handleReconnecting);
    
    // Verificar status de assinatura
    const checkSubscription = () => {
      const hasValidKey = cryptoService.hasAccessKey();
      setHasSubscription(hasValidKey);
    };
    
    // Verificar imediatamente e quando o evento de chave mudar
    checkSubscription();
    
    // Inscrever-se em eventos de chave de acesso
    const encryptedSubscription = EventBus.on('access-key-changed', () => {
      checkSubscription();
      
      // Se agora temos uma chave, reconectar para obter dados decifrados
      if (cryptoService.hasAccessKey()) {
        console.log('[RouletteList] Chave de acesso detectada, reconectando...');
        setIsEncrypted(false);
        unifiedClient.connectStream();
      }
    });
    
    // Inicializar com os dados atuais, se disponíveis
    const initialRoulettes = unifiedClient.getAllRoulettes();
    if (initialRoulettes && initialRoulettes.length > 0) {
      console.log(`[RouletteList] Dados iniciais: ${initialRoulettes.length} roletas`);
      setRoulettes(initialRoulettes);
    } else {
      // Se não tivermos dados iniciais, forçar uma atualização
      console.log('[RouletteList] Sem dados iniciais, forçando atualização...');
      unifiedClient.forceUpdate().then(data => {
        if (data && data.length > 0) {
          console.log(`[RouletteList] Atualização forçada obteve ${data.length} roletas`);
          setRoulettes(data);
        }
      });
    }
    
    // Obter status de conexão atual
    const currentStatus = unifiedClient.getStatus();
    setStreamStatus({
      isConnected: currentStatus.isStreamConnected,
      lastReceivedAt: currentStatus.lastReceivedAt,
      reconnectAttempts: 0
    });
    
    // Configurar timer para verificar se dados foram carregados após 5 segundos
    const checkDataTimer = setTimeout(() => {
      const checkRoulettes = unifiedClient.getAllRoulettes();
      if (!checkRoulettes || checkRoulettes.length === 0) {
        console.log('[RouletteList] Sem dados após 5 segundos, forçando recarregamento...');
        forceReload();
      }
    }, 5000);
    
    // Limpar listeners ao desmontar o componente
    return () => {
      console.log('[RouletteList] Limpando listeners...');
      unifiedClient.off('update', handleDataUpdate);
      unifiedClient.off('connect', handleConnect);
      unifiedClient.off('disconnect', handleDisconnect);
      unifiedClient.off('error', handleError);
      unifiedClient.off('reconnecting', handleReconnecting);
      
      // Cancelar inscrição de eventos
      if (encryptedSubscription) {
        encryptedSubscription.unsubscribe();
      }
      
      // Limpar timer
      clearTimeout(checkDataTimer);
    };
  }, [forceReload, loadAttempts]);
  
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
        <button 
          className="reload-button"
          onClick={forceReload}
        >
          Recarregar Dados
        </button>
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
            forceReload();
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
      
      <div className="actions-bar">
        <div className="stream-status">
          {streamStatus && (
            <p>
              Status: {streamStatus.isConnected ? 'Conectado' : 'Desconectado'} | 
              Última atualização: {streamStatus.lastReceivedAt ? new Date(streamStatus.lastReceivedAt).toLocaleTimeString() : 'N/A'}
            </p>
          )}
        </div>
        <button 
          className="reload-button"
          onClick={forceReload}
        >
          Atualizar Dados
        </button>
      </div>
      
      <div className="roulette-grid">
        {roulettes.map((roulette: Roulette) => (
          <div key={roulette.id} className="roulette-card">
            <h3>{roulette.nome}</h3>
            <div className="numbers-container">
              {roulette.numero && Array.isArray(roulette.numero) && roulette.numero.slice(0, 10).map((num, index) => {
                // Valor seguro para o número
                const numero = typeof num === 'object' && num ? num.numero : (typeof num === 'number' ? num : 0);
                // Cor segura 
                const cor = typeof num === 'object' && num && 'cor' in num ? num.cor : getNumberColor(numero);
                
                return (
                  <div 
                    key={`${roulette.id}-${index}`} 
                    className={`number-ball ${cor}`}
                  >
                    {numero}
                  </div>
                );
              })}
            </div>
            <div className="roulette-info">
              {roulette.numero && Array.isArray(roulette.numero) && roulette.numero.length > 0 && (
                <>
                  {/* Renderizar último número de forma segura */}
                  {(() => {
                    const lastNum = roulette.numero[0];
                    if (!lastNum) return null;
                    
                    const numero = typeof lastNum === 'object' ? lastNum.numero : lastNum;
                    const cor = typeof lastNum === 'object' && 'cor' in lastNum ? lastNum.cor : getNumberColor(numero);
                    const timestamp = typeof lastNum === 'object' && 'timestamp' in lastNum && lastNum.timestamp
                      ? new Date(lastNum.timestamp).toLocaleTimeString()
                      : 'N/A';
                      
                    return (
                      <>
                        <p>Último número: {numero}</p>
                        <p>Cor: {cor}</p>
                        <p>Hora: {timestamp}</p>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Função auxiliar para obter cor com base no número
const getNumberColor = (num: number): string => {
  if (num === 0) return 'green';
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return redNumbers.includes(num) ? 'red' : 'black';
};

export default RouletteList; 