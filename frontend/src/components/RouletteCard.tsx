import { Loader2 } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { RouletteData } from '@/types';
import NumberDisplay from './NumberDisplay';
import { Badge } from "@/components/ui/badge";
import { useRouletteSettingsStore } from '@/stores/rouletteSettingsStore';
import { cn } from '@/lib/utils';
import globalRouletteDataService from '@/services/GlobalRouletteDataService';
import EventBus from '@/services/EventBus';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = true;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log('[DEBUG-RouletteCard]', ...args);
  }
};

interface RouletteCardProps {
  data: RouletteData;
  isDetailView?: boolean;
}

const RouletteCard: React.FC<RouletteCardProps> = ({ data, isDetailView = false }) => {
  // Estados
  const [lastNumber, setLastNumber] = useState<number | null>(null);
  const [recentNumbers, setRecentNumbers] = useState<number[]>([]);
  const [allNumbers, setAllNumbers] = useState<number[]>([]); // Array com todos os números, sem limite
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [updateCount, setUpdateCount] = useState(0);
  const [hasRealData, setHasRealData] = useState(false);
  const [rawRouletteData, setRawRouletteData] = useState<any>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [allRoulettesData, setAllRoulettesData] = useState<any[]>([]);
  const [loadingTimeout, setLoadingTimeout] = useState<boolean>(false); // Estado para controlar timeout do carregamento
  const [reloadingData, setReloadingData] = useState<boolean>(false); // Estado para controlar feedback visual ao recarregar
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null); // Referência para o timeout
  
  // Hooks
  const navigate = useNavigate();
  const { enableSound, enableNotifications } = useRouletteSettingsStore();
  
  // Dados iniciais seguros
  const safeData = {
    id: data?.id || data?._id || 'unknown',
    name: data?.name || data?.nome || 'Roleta sem nome',
  };
  
  // ID único para este componente
  const componentId = useRef(`roulette-${safeData.id}-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Função para lidar com atualizações de dados
  const handleDataUpdate = useCallback((allRoulettes: any[]) => {
    if (!allRoulettes || !Array.isArray(allRoulettes) || allRoulettes.length === 0) return;
    
    // Armazenar todas as roletas
    setAllRoulettesData(allRoulettes);
    
    // Encontrar a roleta específica pelo ID ou nome
    const myRoulette = allRoulettes.find((roulette: any) => 
      roulette.id === safeData.id || 
      roulette._id === safeData.id || 
      roulette.name === safeData.name || 
      roulette.nome === safeData.name
    );
    
    if (!myRoulette) {
      console.warn(`[${componentId}] Roleta com ID ${safeData.id} não encontrada na resposta`);
        return;
      }
      
    // Salvar dados brutos para uso posterior
    setRawRouletteData(myRoulette);
      
    // Processar os dados da roleta
    processApiData(myRoulette);
        
    // Atualizar timestamp e contador
        setLastUpdateTime(Date.now());
        setUpdateCount(prev => prev + 1);
    setError(null);
    setLoading(false);
  }, [safeData.id, safeData.name]);
  
  // Efeito para iniciar a busca de dados
  useEffect(() => {
    // Configurar loading inicial
    setLoading(true);
    
    // Configurar um timeout para caso o carregamento demore demais
    // Define um timeout de 15 segundos para mostrar uma mensagem amigável
    timeoutRef.current = setTimeout(() => {
      if (loading && !hasRealData) {
        console.log('[RouletteCard] Timeout de carregamento atingido');
        setLoadingTimeout(true);
      }
    }, 15000);
    
    // Assinar atualizações do gerenciador global
    const unsubscribe = globalRouletteDataService.subscribe(componentId, handleDataUpdate);
    
    // Assinar eventos do EventBus para atualizações SSE
    EventBus.on('roulette:data-updated', (eventData) => {
      console.log(`[${componentId}] Evento roulette:data-updated recebido:`, eventData);
      
      // Verificar se temos dados válidos no evento
      if (eventData && eventData.data) {
        // Se for um array, processamos todas as roletas
        if (Array.isArray(eventData.data)) {
          handleDataUpdate(eventData.data);
        } 
        // Se for uma roleta única, verificamos se é a nossa e atualizamos
        else if (eventData.data.id === safeData.id || 
                eventData.data._id === safeData.id || 
                eventData.data.name === safeData.name || 
                eventData.data.nome === safeData.name) {
          handleDataUpdate([eventData.data]);
        }
      }
    });
    
    // Limpar inscrição ao desmontar o componente
    return () => {
      unsubscribe();
      
      // Remover listener do EventBus
      EventBus.off('roulette:data-updated', null);
      
      // Limpar timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Certificar-se de limpar qualquer outro recurso de requisição
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [handleDataUpdate]);
  
  // Adicionar um comentário para garantir que este é o único lugar fazendo requisições:
  // Console.log para verificar se há apenas uma fonte de requisições:
  console.log('[VERIFICAÇÃO DE FONTE ÚNICA] O componente RouletteCard usa apenas GlobalRouletteDataService para obter dados da API.');
  
  // Função para processar dados da API
  const processApiData = (apiRoulette: any) => {
    debugLog(`Processando dados para roleta ${safeData.name}:`, apiRoulette);
    
    if (!apiRoulette) {
      console.warn(`[${componentId}] Dados vazios ou inválidos para a roleta ${safeData.name}`);
      return;
    }
    
    // Extrair números da resposta
    const apiNumbers = extractNumbers(apiRoulette);
    debugLog(`Números extraídos para ${safeData.name}:`, apiNumbers);
    
    // Se não há números, não faz nada
    if (!apiNumbers || apiNumbers.length === 0) {
      debugLog(`Nenhum número extraído para ${safeData.name} - API response:`, apiRoulette);
      return;
    }
    
    // Verificar se temos números novos
    const hasNewNumbers = updateNumberSequence(apiNumbers);
    debugLog(`Novos números encontrados para ${safeData.name}: ${hasNewNumbers ? 'SIM' : 'NÃO'}`);
    
    // Se não há números novos e já temos dados, não precisamos atualizar a UI
    if (!hasNewNumbers && hasRealData) {
      debugLog(`Sem alterações nos números para ${safeData.name} - ignorando atualização`);
      return;
    }
    
    // Se não tínhamos dados reais antes, atualizamos a UI mesmo sem novos números
    if (!hasRealData) {
      setAllNumbers(apiNumbers);
      setRecentNumbers(apiNumbers.slice(0, 20)); // Mostrar até 20 números recentes
      setLastNumber(apiNumbers[0]); // O número mais recente
      setHasRealData(true);
      debugLog(`Dados iniciais carregados para ${safeData.name} - ${apiNumbers.length} números`);
    }
  };

  // Função para extrair números da resposta da API
  const extractNumbers = (apiData: any): number[] => {
    // Array para armazenar os números
    let extractedNumbers: number[] = [];
    
    try {
      // Verificar se os dados estão em formato processado pelo UnifiedRouletteClient
      if (apiData && Array.isArray(apiData.numero) && apiData.numero.length > 0) {
        console.log(`Extraindo números a partir do campo 'numero' para ${safeData.name}`);
        
        // Mapear cada objeto do array para extrair o número
        extractedNumbers = apiData.numero
          .map((item: any) => {
            // Cada item pode ser um número ou um objeto
            if (typeof item === 'number') {
              return item;
            }
            // Cada item deve ter uma propriedade 'numero'
            if (item && typeof item === 'object' && 'numero' in item) {
              return typeof item.numero === 'number' ? item.numero : parseInt(item.numero);
            }
            return null;
          })
          .filter((n: any) => n !== null && !isNaN(n));
      } 
      // Verificar formato de eventos SSE descriptografados
      else if (apiData && apiData.data && Array.isArray(apiData.data.numeros)) {
        console.log(`Extraindo números de dados descriptografados SSE para ${safeData.name}`);
        extractedNumbers = apiData.data.numeros
          .map((n: any) => typeof n === 'number' ? n : parseInt(n))
          .filter((n: any) => n !== null && !isNaN(n));
      }
      // Verificar outro formato comum em eventos SSE
      else if (apiData && Array.isArray(apiData.numeros)) {
        console.log(`Extraindo números do campo 'numeros' para ${safeData.name}`);
        extractedNumbers = apiData.numeros
          .map((n: any) => typeof n === 'number' ? n : parseInt(n))
          .filter((n: any) => n !== null && !isNaN(n));
      }
      // Outros formatos de dados possíveis como fallback
      else if (Array.isArray(apiData.lastNumbers) && apiData.lastNumbers.length > 0) {
        extractedNumbers = apiData.lastNumbers
          .map((n: any) => typeof n === 'number' ? n : (typeof n === 'object' && n?.numero ? n.numero : null))
          .filter((n: any) => n !== null && !isNaN(n));
      } else if (Array.isArray(apiData.numbers) && apiData.numbers.length > 0) {
        extractedNumbers = apiData.numbers
          .map((n: any) => {
            if (typeof n === 'object' && n) {
              return n.numero || n.number || n.value;
            }
            return typeof n === 'number' ? n : null;
          })
          .filter((n: any) => n !== null && !isNaN(n));
      }
      
      // Verificar se há dados criptografados sem processamento
      if (extractedNumbers.length === 0 && apiData && apiData.encrypted) {
        console.log(`Dados criptografados recebidos para ${safeData.name}, aguardando processamento`);
        return []; // Retornar array vazio e aguardar processamento pelo UnifiedRouletteClient
      }
      
      // Se não encontramos números em nenhum dos formatos, log de aviso
      if (extractedNumbers.length === 0) {
        console.warn(`Não foi possível extrair números para ${safeData.name}. Estrutura de dados:`, apiData);
      } else {
        console.log(`Extraídos ${extractedNumbers.length} números para ${safeData.name}:`, extractedNumbers.slice(0, 5));
      }
    } catch (err) {
      console.error(`Erro ao extrair números para ${safeData.name}:`, err);
    }
    
    return extractedNumbers;
  };
  
  // Função para mostrar notificação de novo número
  const showNumberNotification = useCallback((newNumber: number) => {
    if (newNumber === undefined || newNumber === null) return;
    
    // Obter cor do número a partir dos dados da API
    let color = 'cinza';
    
    if (rawRouletteData && rawRouletteData.numero && rawRouletteData.numero.length > 0) {
      const matchingNumber = rawRouletteData.numero.find((n: any) => n.numero === newNumber);
      if (matchingNumber && matchingNumber.cor) {
        color = matchingNumber.cor.toLowerCase();
      }
    }
    
    // Mostrar notificação
    setToastVisible(true);
    setToastMessage(`Novo número: ${newNumber} (${color})`);
    setTimeout(() => setToastVisible(false), 3000);
    
  }, [rawRouletteData]);
  
  // Função para abrir detalhes da roleta
  const handleCardClick = () => {
    // Removida a navegação para a página de detalhes
    return; // Não faz nada ao clicar no card
  };
  
  // Formatar tempo relativo
  const getTimeAgo = () => {
    const seconds = Math.floor((Date.now() - lastUpdateTime) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s atrás`;
  };
  
  // Determinar a cor do número
  const getNumberColor = (num: number): string => {
    if (num === 0) return 'verde';
    
    // Números vermelhos na roleta europeia
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return numerosVermelhos.includes(num) ? 'vermelho' : 'preto';
  };

  // Função para verificar e atualizar sequência de números
  const updateNumberSequence = (apiNumbers: number[]): boolean => {
    // Caso 1: Não temos números ainda - inicializar com os da API (já tratado no processApiData)
    if (allNumbers.length === 0) {
      return true;
    }
    
    // Caso 2: Verificar se o último número da API é igual ao nosso
    if (apiNumbers[0] === allNumbers[0]) {
      // Nenhum número novo
      return false;
    }
    
    // Caso 3: Temos números novos na API
    // Procurar por números novos que ainda não estão na nossa lista
    const newNumbers = [];
    
    // Percorrer a lista da API até encontrar um número que já temos
    for (let i = 0; i < apiNumbers.length; i++) {
      const apiNum = apiNumbers[i];
      
      // Se encontramos um número que já está na nossa lista, paramos
      if (allNumbers.includes(apiNum)) {
        break;
      }
      
      // Adicionar o número novo à nossa lista temporária
      newNumbers.push(apiNum);
    }
    
    // Se encontramos números novos, atualizamos o estado
    if (newNumbers.length > 0) {
      debugLog(`${newNumbers.length} novos números para ${safeData.name}: ${newNumbers.join(', ')}`);
      
      // Adicionar os novos números no início da nossa lista
      const updatedAllNumbers = [...newNumbers, ...allNumbers];
      
      // Atualizar estados
      setAllNumbers(updatedAllNumbers);
      setRecentNumbers(updatedAllNumbers.slice(0, 20));
      setLastNumber(newNumbers[0]);
      setIsNewNumber(true);
      
      // Mostrar notificação para o primeiro novo número
      showNumberNotification(newNumbers[0]);
      
      // Resetar a animação após 2 segundos
      setTimeout(() => {
        setIsNewNumber(false);
      }, 2000);
      
      return true;
    }
    
    return false;
  };

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "relative overflow-visible transition-all duration-300 backdrop-filter bg-opacity-40 bg-[#131614] border ", 
        "hover:border-vegas-green/50",
        isNewNumber ? "border-vegas-green animate-pulse" : "",
        isDetailView ? "w-full" : "w-full"
      )}
      onClick={handleCardClick}
    >
      {/* Logo de fundo com baixa opacidade e saturação 0 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-lg">
        <img 
          src="/assets/icon-rabbit.svg" 
          alt="Icon Rabbit" 
          className="w-[95%] h-auto opacity-[0.025] grayscale filter select-none"
          style={{ 
            objectFit: "contain",
            transformOrigin: "center"
          }} 
        />
      </div>
      
      {/* Reprodutor de áudio (invisível) */}
      <audio ref={audioRef} src="/sounds/coin.mp3" preload="auto" />
      
      <CardContent className="p-4 relative z-10">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold truncate text-white flex items-center">
            <span className="w-2 h-2 rounded-full bg-vegas-green mr-2"></span>
            {safeData.name}
          </h3>
          <div className="flex gap-1 items-center">
            <Badge 
              variant={hasRealData ? "secondary" : "default"} 
              className={`text-xs ${hasRealData ? 'text-vegas-green border border-vegas-green/30' : 'bg-gray-700/50 text-gray-300'}`}
            >
              {loading ? "Atualizando..." : (hasRealData ? "Online" : "Sem dados")}
            </Badge>
          </div>
        </div>
        
        {/* Números recentes */}
        <div className="flex flex-wrap gap-1 justify-center my-5 p-3 rounded-xl border border-gray-700/50" style={{ backgroundColor: 'rgb(19 22 20 / var(--tw-bg-opacity, 1))' }}>
          {recentNumbers.length > 0 ? (
            recentNumbers.slice(0, 20).map((num, idx) => (
            <NumberDisplay 
              key={`${num}-${idx}`}
              number={num} 
              size="small" 
              highlight={idx === 0 && isNewNumber}
            />
            ))
          ) : (
            <div className="text-center text-gray-400 py-2 w-full">
              {loading ? (
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center mb-2">
                    <Loader2 className="h-4 w-4 animate-spin mr-2 text-vegas-green" />
                    Carregando números...
                  </div>
                  {loadingTimeout && (
                    <div className="mt-2 text-xs text-gray-500">
                      <p>O carregamento está demorando mais que o normal.</p>
                      <button 
                        onClick={() => {
                          setLoadingTimeout(false);
                          setLoading(true);
                          setReloadingData(true); // Ativar efeito visual de recarregamento
                          
                          // Forçar atualização dos dados
                          globalRouletteDataService.forceUpdate();
                          
                          // Reiniciar o timeout
                          if (timeoutRef.current) {
                            clearTimeout(timeoutRef.current);
                          }
                          timeoutRef.current = setTimeout(() => {
                            setLoadingTimeout(true);
                            setReloadingData(false); // Desativar efeito após timeout
                          }, 15000);
                          
                          // Desativar efeito visual após 2 segundos para dar feedback
                          setTimeout(() => {
                            setReloadingData(false);
                          }, 2000);
                        }}
                        className={`px-3 py-1 mt-2 text-xs ${reloadingData 
                          ? 'bg-vegas-green/40 text-white animate-pulse' 
                          : 'bg-vegas-green/20 text-vegas-green hover:bg-vegas-green/30'} 
                          transition-colors rounded-md flex items-center justify-center`}
                        disabled={reloadingData}
                      >
                        {reloadingData ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Recarregando...
                          </>
                        ) : 'Tentar novamente'}
                      </button>
                    </div>
                  )}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center">
                  <p className="mb-2">Erro ao carregar números</p>
                  <button 
                    onClick={() => {
                      setError(null);
                      setLoading(true);
                      setReloadingData(true); // Ativar efeito visual
                      
                      // Forçar atualização dos dados
                      globalRouletteDataService.forceUpdate();
                      
                      // Desativar efeito visual após 2 segundos
                      setTimeout(() => {
                        setReloadingData(false);
                      }, 2000);
                    }}
                    className={`px-3 py-1 text-xs ${reloadingData 
                      ? 'bg-vegas-green/40 text-white animate-pulse' 
                      : 'bg-vegas-green/20 text-vegas-green hover:bg-vegas-green/30'} 
                      transition-colors rounded-md flex items-center justify-center`}
                    disabled={reloadingData}
                  >
                    {reloadingData ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Recarregando...
                      </>
                    ) : 'Tentar novamente'}
                  </button>
                </div>
              ) : "Nenhum número disponível"}
            </div>
          )}
        </div>
      </CardContent>

      {/* Toast de notificação */}
      {toastVisible && (
        <div className="fixed bottom-4 right-4 bg-[#14161F] bg-opacity-95 border border-vegas-green text-white px-4 py-2 rounded-lg z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}
    </Card>
  );
};

export default RouletteCard;