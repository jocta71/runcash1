import React, { useEffect, useState, useRef, useCallback } from 'react';
import { RouletteData } from '@/integrations/api/rouletteService';
import RouletteFeedService from '@/services/RouletteFeedService';
import LastNumbersBar from './LastNumbersBar';
import EventService from '@/services/EventService';
import { RouletteStatsInline } from '@/components/roulette/RouletteStatsInline';
import { useDataLoading } from '@/App';
import UnifiedRouletteClient from '@/services/UnifiedRouletteClient';

interface RouletteTable {
  tableId: string;
  tableName: string;
  numbers: string[];
  dealer?: string;
  players?: number;
}

// Estender o tipo RouletteData para incluir propriedades adicionais que usamos
interface ExtendedRouletteData extends RouletteData {
  lastNumbers?: number[];
  numeros?: any[];
  name?: string;
}

interface LiveRoulettesDisplayProps {
  roulettesData?: ExtendedRouletteData[]; // Opcional para manter compatibilidade retroativa
}

// Função auxiliar para formatar dados da roleta - colocada fora dos useEffect para reutilização
const formatRouletteData = (data: ExtendedRouletteData[]) => {
  return data.map(roleta => {
    // Garantir que os números sejam tratados corretamente
    let formattedNumbers = [];
    
    // Verificar se o número é um array com objetos que têm a propriedade número
    if (Array.isArray(roleta.numero) && roleta.numero.length > 0) {
      // Verificar se os itens têm a propriedade numero
      const firstItem = roleta.numero[0];
      if (typeof firstItem === 'object' && firstItem !== null && 'numero' in firstItem) {
        // Já está no formato correto
        formattedNumbers = roleta.numero;
      } else {
        // Converter para o formato esperado
        formattedNumbers = roleta.numero.map(n => {
          if (typeof n === 'number' || typeof n === 'string') {
            return { numero: Number(n) };
          }
          return n;
        });
      }
    } 
    // Tentar usar lastNumbers se disponível
    else if (Array.isArray(roleta.lastNumbers) && roleta.lastNumbers.length > 0) {
      formattedNumbers = roleta.lastNumbers.map(n => ({ numero: Number(n) }));
    } 
    // Tentar usar numeros se disponível
    else if (Array.isArray(roleta.numeros) && roleta.numeros.length > 0) {
      formattedNumbers = roleta.numeros.map(n => ({ numero: Number(n) }));
    }
    
    return {
      ...roleta,
      numero: formattedNumbers,
      nome: roleta.nome || roleta.name || 'Roleta sem nome'
    };
  });
};

const LiveRoulettesDisplay: React.FC<LiveRoulettesDisplayProps> = ({ roulettesData }) => {
  // Obter dados pré-carregados do contexto, se disponíveis
  const { isDataLoaded, rouletteData: preloadedData, forceReconnect } = useDataLoading();
  
  const [tables, setTables] = useState<RouletteTable[]>([]);
  const [roulettes, setRoulettes] = useState<ExtendedRouletteData[]>(roulettesData || []);
  const [isLoading, setIsLoading] = useState(!isDataLoaded && !roulettesData);
  const [selectedRoulette, setSelectedRoulette] = useState<ExtendedRouletteData | null>(null);
  const [showStatsInline, setShowStatsInline] = useState(false);
  const [updatingData, setUpdatingData] = useState(false);
  // Novo estado para armazenar informações de diagnóstico
  const [connectionStatus, setConnectionStatus] = useState<{
    lastUpdate: string;
    lastHeartbeat: string;
    totalUpdates: number;
    connectionState: string;
    error: string | null;
  }>({
    lastUpdate: 'Nunca',
    lastHeartbeat: 'Nunca',
    totalUpdates: 0,
    connectionState: 'Desconectado',
    error: null
  });
  const rouletteCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Referência ao cliente de roletas unificado
  const clientRef = useRef<UnifiedRouletteClient | null>(null);

  // Inicialização - obter cliente unificado uma única vez
  useEffect(() => {
    clientRef.current = UnifiedRouletteClient.getInstance({
      streamingEnabled: true,
      autoConnect: true,
    });
    
    // Diagnóstico de conexão
    console.log('[LiveRoulettesDisplay] Status inicial da conexão:');
    const diagInfo = clientRef.current.diagnoseConnectionState();
    setConnectionStatus(prev => ({
      ...prev,
      connectionState: diagInfo.isConnected ? 'Conectado' : 
                       diagInfo.isConnecting ? 'Conectando...' : 'Desconectado',
      error: null
    }));
    
    // Limpar
    return () => {
      // Não precisamos desconectar, pois outros componentes podem estar usando o cliente
    };
  }, []);
  
  // Handler para eventos de heartbeat
  const handleHeartbeat = useCallback((data: any) => {
    console.log('❤️ Heartbeat recebido:', data);
    setConnectionStatus(prev => ({
      ...prev,
      lastHeartbeat: new Date().toLocaleTimeString(),
      connectionState: 'Conectado (ativo)'
    }));
  }, []);

  // Inscrever-se para eventos de heartbeat
  useEffect(() => {
    // Inscrever-se no evento de heartbeat
    EventService.on('roulette:heartbeat', handleHeartbeat);
    
    // Limpar ao desmontar
    return () => {
      EventService.off('roulette:heartbeat', handleHeartbeat);
    };
  }, [handleHeartbeat]);
  
  // Usar os dados passados como prop ou obter do clientRef
  useEffect(() => {
    // Verificar dados da props primeiro (prioridade mais alta)
    if (roulettesData && Array.isArray(roulettesData) && roulettesData.length > 0) {
      console.log(`[LiveRoulettesDisplay] Usando ${roulettesData.length} roletas fornecidas via props`);
      const formattedData = formatRouletteData(roulettesData);
      setRoulettes(formattedData);
      setIsLoading(false);
      return; // Encerrar aqui
    } 
    
    // Verificar dados do contexto global (segunda prioridade)
    if (isDataLoaded && preloadedData && preloadedData.length > 0) {
      console.log(`[LiveRoulettesDisplay] Usando ${preloadedData.length} roletas do contexto global`);
      const formattedData = formatRouletteData(preloadedData as ExtendedRouletteData[]);
      setRoulettes(formattedData);
      setIsLoading(false);
      return; // Encerrar aqui
    }
    
    // Verificar se temos cliente unificado
    if (clientRef.current) {
      // Verificar cache do cliente (terceira prioridade)
      const cachedRoulettes = clientRef.current.getAllRoulettes();
      if (cachedRoulettes && cachedRoulettes.length > 0) {
        console.log(`[LiveRoulettesDisplay] Usando ${cachedRoulettes.length} roletas do cache do cliente unificado`);
        const formattedData = formatRouletteData(cachedRoulettes as ExtendedRouletteData[]);
        setRoulettes(formattedData);
        setIsLoading(false);
        return; // Encerrar aqui
      }

      // Se não temos dados em cache, forçar uma conexão direta com o stream
      console.log('[LiveRoulettesDisplay] Sem dados em cache, forçando conexão com o stream...');
      clientRef.current.forceUpdate();
      
      // Atualizar status da conexão
      setConnectionStatus(prev => ({
        ...prev,
        connectionState: 'Conectando...',
        error: null
      }));
    }
    
    // Timeout de segurança para evitar tela de carregamento infinita
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
      // Verificar se ainda não temos dados após timeout
      if (roulettes.length === 0) {
        setConnectionStatus(prev => ({
          ...prev,
          connectionState: 'Timeout',
          error: 'Tempo esgotado aguardando dados'
        }));
      }
    }, 5000); // 5 segundos máximos de espera
    
    return () => clearTimeout(safetyTimeout);
  }, [clientRef, roulettesData, isDataLoaded, preloadedData, roulettes.length]);
  
  // Efeito para simular clique automático quando os dados são carregados
  useEffect(() => {
    // Verificar se temos roletas carregadas, não temos roleta selecionada,
    // e a segunda roleta existe
    if (roulettes.length > 1 && !selectedRoulette && !isLoading) {
      console.log('[LiveRoulettesDisplay] Simulando clique na segunda roleta');
      // Pequeno delay para garantir que a UI já renderizou
      setTimeout(() => {
        // Simular clique usando a função de manipulação de clique existente
        handleRouletteSelect(roulettes[1]);
      }, 100);
    }
  }, [roulettes, selectedRoulette, isLoading]);

  // Inscrever-se para atualizações de dados do SSE
  useEffect(() => {
    const handleDataUpdated = (updateData: any) => {
      console.log('[LiveRoulettesDisplay] Recebida atualização de dados:', 
        updateData.source || 'desconhecido');
      
      setUpdatingData(true);
      
      // Atualizar o estado de diagnóstico
      setConnectionStatus(prev => ({
        ...prev,
        lastUpdate: new Date().toLocaleTimeString(),
        totalUpdates: prev.totalUpdates + 1,
        connectionState: 'Conectado (dados recebidos)',
        error: null
      }));
      
      // Obter dados atualizados do cliente unificado
      if (clientRef.current) {
        const updatedRoulettes = clientRef.current.getAllRoulettes();
        
        if (updatedRoulettes && updatedRoulettes.length > 0) {
          console.log(`[LiveRoulettesDisplay] Atualizando com ${updatedRoulettes.length} roletas`);
          
          // Formatar dados para garantir consistência
          const formattedData = formatRouletteData(updatedRoulettes as ExtendedRouletteData[]);
          
          // Atualizar o estado com os dados formatados
          setRoulettes(formattedData);
          setIsLoading(false);
          
          // Se ainda não houver roleta selecionada, selecionar a segunda
          if (!selectedRoulette && formattedData.length > 1) {
            setSelectedRoulette(formattedData[1]);
            setShowStatsInline(true);
          } else if (selectedRoulette) {
            // Atualizar a roleta selecionada com dados mais recentes
            const updatedSelectedRoulette = formattedData.find(r => 
              r.id === selectedRoulette.id || r._id === selectedRoulette._id || r.nome === selectedRoulette.nome
            );
            
            if (updatedSelectedRoulette) {
              setSelectedRoulette(updatedSelectedRoulette);
            }
          }
        } else {
          console.warn('[LiveRoulettesDisplay] Nenhum dado recebido na atualização');
        }
      }
      
      // Terminar a atualização após um breve atraso para feedback visual
      setTimeout(() => {
        setUpdatingData(false);
      }, 300);
    };
    
    // Handler para erros de conexão
    const handleConnectionError = (error: any) => {
      console.error('[LiveRoulettesDisplay] Erro de conexão:', error);
      setConnectionStatus(prev => ({
        ...prev,
        connectionState: 'Erro',
        error: error.message || 'Erro de conexão'
      }));
    };
    
    // Inscrever-se no evento de atualização de dados
    EventService.on('roulette:data-updated', handleDataUpdated);
    
    // Inscrever-se também para o evento de novo número
    EventService.on('roulette:new-number', handleDataUpdated);
    
    // Inscrever-se para erros de conexão
    EventService.on('roulette:connection-error', handleConnectionError);
    
    // Limpar ao desmontar
    return () => {
      EventService.off('roulette:data-updated', handleDataUpdated);
      EventService.off('roulette:new-number', handleDataUpdated);
      EventService.off('roulette:connection-error', handleConnectionError);
    };
  }, [selectedRoulette]);

  // Função para selecionar uma roleta e mostrar estatísticas ao lado
  const handleRouletteSelect = (roleta: ExtendedRouletteData) => {
    setSelectedRoulette(roleta);
    setShowStatsInline(true);
  };

  // Função para fechar a visualização de estatísticas
  const handleCloseStats = () => {
    setSelectedRoulette(null);
    setShowStatsInline(false);
  };

  // Função para reconectar manualmente o stream
  const handleManualReconnect = () => {
    console.log('[LiveRoulettesDisplay] Forçando reconexão manual do stream...');
    setUpdatingData(true);
    
    // Atualizar estado de conexão
    setConnectionStatus(prev => ({
      ...prev,
      connectionState: 'Reconectando...',
      error: null
    }));
    
    if (clientRef.current) {
      clientRef.current.forceReconnectStream();
      
      // Agendar diagnóstico de conexão após tentativa
      setTimeout(() => {
        if (clientRef.current) {
          console.log('[LiveRoulettesDisplay] Status após tentativa de reconexão:');
          const diagInfo = clientRef.current.diagnoseConnectionState();
          setConnectionStatus(prev => ({
            ...prev,
            connectionState: diagInfo.isConnected ? 'Conectado' : 
                            diagInfo.isConnecting ? 'Conectando...' : 'Desconectado',
            error: diagInfo.isConnected ? null : 'Falha na conexão, tente novamente'
          }));
        }
        setUpdatingData(false);
      }, 2000);
    } else if (forceReconnect) {
      // Fallback para a função de reconexão do contexto global
      forceReconnect();
      setTimeout(() => {
        setUpdatingData(false);
        setConnectionStatus(prev => ({
          ...prev,
          connectionState: 'Reconexão solicitada',
          error: null
        }));
      }, 2000);
    } else {
      setUpdatingData(false);
      setConnectionStatus(prev => ({
        ...prev,
        connectionState: 'Falha',
        error: 'Cliente não inicializado'
      }));
    }
  };

  // Renderizar indicador de status da conexão SSE
  const renderConnectionStatus = () => {
    const { connectionState, lastUpdate, lastHeartbeat, totalUpdates, error } = connectionStatus;
    
    // Determinar cor com base no estado da conexão
    let statusColor = 'text-gray-500';
    let statusIcon = '⚪';
    
    if (connectionState.includes('Conectado')) {
      statusColor = 'text-green-500';
      statusIcon = '🟢';
    } else if (connectionState === 'Conectando...') {
      statusColor = 'text-yellow-500';
      statusIcon = '🟡';
    } else if (connectionState === 'Erro' || connectionState === 'Falha' || connectionState === 'Timeout') {
      statusColor = 'text-red-500';
      statusIcon = '🔴';
    }
    
    return (
      <div className="flex flex-col items-start mb-2 p-2 bg-gray-800 rounded-md text-xs w-full">
        <div className="flex justify-between w-full">
          <span className={`font-semibold ${statusColor}`}>
            {statusIcon} Stream SSE: {connectionState}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Updates: {totalUpdates}</span>
            {updatingData && (
              <div className="animate-spin h-3 w-3 border-2 border-yellow-400 border-t-transparent rounded-full ml-1"></div>
            )}
          </div>
        </div>
        <div className="flex justify-between w-full mt-1 text-gray-400">
          <span>Último update: {lastUpdate}</span>
          <span>Último heartbeat: {lastHeartbeat}</span>
        </div>
        {error && <div className="text-red-400 mt-1">Erro: {error}</div>}
      </div>
    );
  };

  // Se temos dados passados por props, mostrar eles diretamente
  if (roulettesData && roulettesData.length > 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Roletas Disponíveis</h2>
            <p className="text-gray-400">Escolha uma roleta para começar a jogar</p>
          </div>
          <div className="flex items-center gap-2">
            {updatingData && (
              <div className="flex items-center gap-1 text-sm text-yellow-400">
                <div className="animate-spin h-4 w-4 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
                <span>Atualizando...</span>
              </div>
            )}
            <button
              onClick={handleManualReconnect}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
              disabled={updatingData}
            >
              {updatingData ? (
                <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {updatingData ? 'Reconectando...' : 'Reconectar'}
            </button>
            <div className="relative w-64">
              <input 
                type="text" 
                placeholder="Buscar roleta..." 
                className="w-full bg-gray-800 text-white py-2 px-4 pl-10 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <svg 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Indicador de status da conexão SSE */}
        {renderConnectionStatus()}
        
        {/* Layout flexbox: roletas à esquerda, estatísticas à direita */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Lista de roletas à esquerda */}
          <div className="w-full md:w-1/2 overflow-y-auto max-h-[calc(100vh-200px)]">
            <div className="grid grid-cols-1 gap-3">
              {roulettes.map((roleta, index) => (
                <div 
                  key={roleta.id} 
                  ref={el => rouletteCardRefs.current[index] = el}
                  className={`bg-gray-900 rounded-lg overflow-hidden shadow-lg cursor-pointer hover:bg-gray-800 transition-colors border ${selectedRoulette?.id === roleta.id ? 'border-2 border-[#00ff00]' : 'border-gray-800'}`}
                  onClick={() => handleRouletteSelect(roleta)}
                >
                  <div className="p-3">
                    {/* Cabeçalho do card */}
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {/* Nome da roleta com contagem de atualizações */}
                        <h3 className="text-lg font-semibold text-white">{roleta.nome}</h3>
                        
                        {/* Ícone do número de atualizações */}
                        <div className="flex items-center">
                          <span className="bg-gray-800 text-xs text-gray-300 px-2 py-0.5 rounded">
                            {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? roleta.numero.length : 0} números
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Número atual e últimos números em linha */}
                    <div className="flex items-center gap-2">
                      {/* Número atual */}
                      <div className="flex-shrink-0">
                        {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? (
                          <div 
                            className={`${
                              roleta.numero[0].numero === 0 
                                ? "bg-green-600" 
                                : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(roleta.numero[0].numero)
                                  ? "bg-red-600"
                                  : "bg-black"
                            } w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold`}
                          >
                            {roleta.numero[0].numero}
                          </div>
                        ) : (
                          <div className="bg-gray-700 text-gray-400 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                            ?
                          </div>
                        )}
                      </div>
                      
                      {/* Últimos números recentes em linha */}
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(roleta.numero) && roleta.numero.slice(1, 6).map((n, index) => {
                          const num = n.numero;
                          const bgColor = num === 0 
                            ? "bg-green-600" 
                            : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)
                              ? "bg-red-600"
                              : "bg-black";
                          
                          return (
                            <div 
                              key={index} 
                              className={`${bgColor} text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium`}
                            >
                              {num}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Rodapé do card simplificado */}
                    <div className="flex items-center justify-between mt-3 text-xs text-gray-500 border-t border-gray-800 pt-2">
                      <div className="flex items-center gap-1">
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="12" 
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>Tempo real</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Painel de estatísticas à direita */}
          <div className="w-full md:w-1/2 bg-gray-900 rounded-lg overflow-hidden shadow-lg border border-gray-800">
            {selectedRoulette && Array.isArray(selectedRoulette.numero) && selectedRoulette.numero.length > 0 ? (
              <RouletteStatsInline 
                roletaNome={selectedRoulette.nome}
                lastNumbers={selectedRoulette.numero.map(n => n.numero)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[70vh] p-6 text-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="64" 
                  height="64" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="text-gray-600 mb-4"
                >
                  <path d="M3 3v18h18"></path>
                  <path d="M18 12V8"></path>
                  <path d="M12 18v-2"></path>
                  <path d="M6 18v-6"></path>
                </svg>
                <h3 className="text-xl font-semibold text-gray-300 mb-2">Selecione uma roleta</h3>
                <p className="text-gray-500 max-w-md">Clique em uma roleta à esquerda para visualizar estatísticas detalhadas, histórico de números e tendências.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center p-8 h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
        <span className="text-white mb-4">Carregando mesas de roleta...</span>
        {renderConnectionStatus()}
      </div>
    );
  }

  if (roulettes.length === 0) {
    return (
      <div className="text-center p-4">
        <div className="mb-4 text-gray-400">Nenhuma mesa de roleta ativa no momento.</div>
        
        {/* Adicionar o indicador de status da conexão */}
        <div className="max-w-md mx-auto mb-4">{renderConnectionStatus()}</div>
        
        <button
          onClick={handleManualReconnect}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 mx-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reconectar Stream
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Roletas ao Vivo</h2>
        <button
          onClick={handleManualReconnect}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
          disabled={updatingData}
        >
          {updatingData ? (
            <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
          ) : (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {updatingData ? 'Reconectando...' : 'Reconectar Stream'}
        </button>
      </div>
      
      {/* Indicador de status da conexão SSE */}
      {renderConnectionStatus()}
      
      {/* Grid de roletas com exatamente 3 cards por linha */}
      <div className="grid grid-cols-3 gap-6">
        {tables.map(table => (
          <LastNumbersBar 
            key={table.tableId}
            tableId={table.tableId}
            tableName={table.tableName}
          />
        ))}
      </div>
    </div>
  );
};

export default LiveRoulettesDisplay; 