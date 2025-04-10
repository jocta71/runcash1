import { TrendingUp, Eye, EyeOff, Target, Star, RefreshCw, ArrowUp, ArrowDown, Loader2, HelpCircle, BarChart3 } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { strategies, numberGroups } from './roulette/constants';
import LastNumbers from './roulette/LastNumbers';
import WinRateDisplay from './roulette/WinRateDisplay';
import RouletteTrendChart from './roulette/RouletteTrendChart';
import SuggestionDisplay from './roulette/SuggestionDisplay';
import RouletteActionButtons from './roulette/RouletteActionButtons';
import RouletteSidePanelStats from './RouletteSidePanelStats';
import { useRouletteData } from '@/hooks/useRouletteData';
import { Button } from '@/components/ui/button';
import { StrategyUpdateEvent } from '@/services/EventService';
import EventService from '@/services/EventService';
import SocketService from '@/services/SocketService';
import StrategySelector from '@/components/StrategySelector';
import { Strategy } from '@/services/StrategyService';
import RouletteNumber from './roulette/RouletteNumber';
import { RequestThrottler } from '@/services/utils/requestThrottler';
import { getLogger } from '@/services/utils/logger';
import { Card, CardContent } from "@/components/ui/card";
import { RouletteData, RouletteNumberEvent } from '@/types';
import NumberDisplay from './NumberDisplay';
import { Badge } from "@/components/ui/badge";
import { PieChart, Phone, Timer, Cpu, Zap, History } from "lucide-react";
import RouletteStats from './RouletteStats';
import { useRouletteSettingsStore } from '@/stores/routleteStore';
import { cn } from '@/lib/utils';
import RouletteFeedService from '@/services/RouletteFeedService';
import config from '@/config/env';

// Logger específico para este componente
const logger = getLogger('RouletteCard');

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = false;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

// Função para gerar insights com base nos números
const getInsightMessage = (numbers: number[], wins: number, losses: number) => {
  if (!numbers || numbers.length === 0) {
    return "Aguardando dados...";
  }
  
  // Verificar repetições de dúzias
  const lastFiveNumbers = numbers.slice(0, 5);
  const firstDozen = lastFiveNumbers.filter(n => n >= 1 && n <= 12).length;
  const secondDozen = lastFiveNumbers.filter(n => n >= 13 && n <= 24).length;
  const thirdDozen = lastFiveNumbers.filter(n => n >= 25 && n <= 36).length;
  
  if (firstDozen >= 3) {
    return "Primeira dúzia aparecendo com frequência";
  } else if (secondDozen >= 3) {
    return "Segunda dúzia aparecendo com frequência";
  } else if (thirdDozen >= 3) {
    return "Terceira dúzia aparecendo com frequência";
  }
  
  // Verificar números pares ou ímpares
  const oddCount = lastFiveNumbers.filter(n => n % 2 === 1).length;
  const evenCount = lastFiveNumbers.filter(n => n % 2 === 0 && n !== 0).length;
  
  if (oddCount >= 4) {
    return "Tendência para números ímpares";
  } else if (evenCount >= 4) {
    return "Tendência para números pares";
  }
  
  // Verificar números baixos ou altos
  const lowCount = lastFiveNumbers.filter(n => n >= 1 && n <= 18).length;
  const highCount = lastFiveNumbers.filter(n => n >= 19 && n <= 36).length;
  
  if (lowCount >= 4) {
    return "Tendência para números baixos (1-18)";
  } else if (highCount >= 4) {
    return "Tendência para números altos (19-36)";
  }
  
  // Baseado na taxa de vitória
  const winRate = wins / (wins + losses);
  if (winRate > 0.7) {
    return "Boa taxa de acerto! Continue com a estratégia";
  } else if (winRate < 0.3) {
    return "Taxa de acerto baixa, considere mudar a estratégia";
  }
  
  return "Padrão normal, observe mais alguns números";
};

interface RouletteCardProps {
  data: RouletteData;
  isDetailView?: boolean;
}

const RouletteCard: React.FC<RouletteCardProps> = ({ data, isDetailView = false }) => {
  // Obter referência ao serviço de feed centralizado
  const feedService = useMemo(() => {
    // Verificar se o sistema já foi inicializado globalmente
    if (window.isRouletteSystemInitialized && window.isRouletteSystemInitialized()) {
      debugLog('[RouletteCard] Usando sistema de roletas já inicializado');
      // Recuperar o serviço do sistema global
      return window.getRouletteSystem 
        ? window.getRouletteSystem().rouletteFeedService 
        : RouletteFeedService.getInstance();
    }
    
    // Fallback para o comportamento padrão
    debugLog('[RouletteCard] Sistema global não detectado, usando instância padrão');
    return RouletteFeedService.getInstance();
  }, []);
  
  // Garantir que data é um objeto válido com valores padrão seguros
  const safeData = useMemo(() => {
    // Se data for null ou undefined, retornar objeto vazio com valores padrão
    if (!data) {
      console.warn('[RouletteCard] Dados inválidos: null ou undefined');
      return {
        id: 'unknown',
        name: 'Roleta não identificada',
        lastNumbers: [],
      };
    }
    
    // Certifique-se de que lastNumbers é sempre um array válido
    const lastNumbers = Array.isArray(data.lastNumbers) 
      ? data.lastNumbers 
      : Array.isArray(data.numero) 
        ? data.numero 
        : [];
    
    return {
      ...data,
      id: data.id || data._id || 'unknown',
      name: data.name || data.nome || 'Roleta sem nome',
      lastNumbers,
    };
  }, [data]);
  
  // Usar safeData em vez de data diretamente para inicializar os estados
  const [lastNumber, setLastNumber] = useState<number | null>(
    getInitialLastNumber(safeData)
  );
  
  const [recentNumbers, setRecentNumbers] = useState<number[]>(
    getInitialRecentNumbers(safeData)
  );
  
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  const [hasRealData, setHasRealData] = useState(recentNumbers.length > 0);
  const cardRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInitialized = useRef(false);
  const socketService = SocketService.getInstance();
  const { enableSound, enableNotifications } = useRouletteSettingsStore();
  const navigate = useNavigate();
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [showStats, setShowStats] = useState(false); // Estado para controlar exibição das estatísticas

  console.log(`[RouletteCard] Inicializando card para ${safeData.name} (${safeData.id}) com ${Array.isArray(safeData.lastNumbers) ? safeData.lastNumbers.length : 0} números`);

  // Função para alternar exibição de estatísticas
  const toggleStats = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowStats(!showStats);
  };

  // Função para processar um novo número em tempo real
  const processRealtimeNumber = (newNumberEvent: RouletteNumberEvent) => {
    if (!newNumberEvent) {
      console.warn('[RouletteCard] Evento de número vazio recebido');
      return;
    }
    
    // Ignorar atualizações muito frequentes (menos de 3 segundos entre elas)
    // exceto se estivermos ainda sem dados reais
    const now = Date.now();
    const timeSinceLastUpdate = now - (lastUpdateTime || 0);
    const isInitialData = !hasRealData;
    
    // Se não for dados iniciais e a atualização for muito recente, ignorar
    if (!isInitialData && timeSinceLastUpdate < 3000) {
      console.log(`[RouletteCard] Ignorando atualização muito frequente para ${safeData.name} (${timeSinceLastUpdate}ms)`);
      return;
    }
    
    // Verificar se o número está disponível
    if (newNumberEvent.numero === null || newNumberEvent.numero === undefined) {
      console.warn('[RouletteCard] Número nulo ou indefinido recebido:', newNumberEvent);
      return;
    }
    
    // Variáveis para armazenar o novo número e a lista de números válidos
    let newNumber: number;
    let validNumbers: number[] = [];
    
    // Extrair o número com base no tipo de dados recebido
    if (Array.isArray(newNumberEvent.numero)) {
      if (newNumberEvent.numero.length === 0) {
        console.warn('[RouletteCard] Array de números vazio recebido:', newNumberEvent);
        return;
      }
      
      const firstNumberObject = newNumberEvent.numero[0];
      if (typeof firstNumberObject === 'object' && firstNumberObject !== null) {
        // Se for um objeto, extrair a propriedade numero ou number
        newNumber = Number(firstNumberObject.numero || firstNumberObject.number || 0);
      } else {
        // Se for um valor direto no array
        newNumber = Number(firstNumberObject);
      }
      
      // Preparar todos os números válidos do array
      validNumbers = newNumberEvent.numero
        .map(item => {
          if (typeof item === 'object' && item !== null) {
            return Number(item.numero || item.number || 0);
          }
          return Number(item);
        })
        .filter(num => !isNaN(num) && typeof num === 'number');
    } else if (typeof newNumberEvent.numero === 'object' && newNumberEvent.numero !== null) {
      // Se for um objeto direto, tentar extrair a propriedade numero ou number
      newNumber = Number(newNumberEvent.numero.numero || newNumberEvent.numero.number || 0);
      validNumbers = [newNumber];
    } else {
      // Se for um valor direto, garantir que é um número
      newNumber = Number(newNumberEvent.numero);
      validNumbers = [newNumber];
    }
    
    // Verificar se temos um número válido
    if (isNaN(newNumber)) {
      console.warn('[RouletteCard] Número inválido recebido:', newNumberEvent);
      return;
    }
    
    console.log(`[RouletteCard] Processando número ${newNumber} para ${safeData.name}`);
    
    // Verificar se já temos esse número no estado atual
    if (!isInitialData && recentNumbers.length > 0 && recentNumbers[0] === newNumber) {
      console.log(`[RouletteCard] Ignorando número já conhecido para ${safeData.name}: ${newNumber}`);
      return;
    }
    
    // Verificar se o número é realmente novo
    const isReallyNew = lastNumber !== newNumber && !recentNumbers.includes(newNumber);
    
    // Se não for novo e não estivermos sem dados, ignorar
    if (!isReallyNew && hasRealData && !isInitialData) {
      console.log(`[RouletteCard] Ignorando número repetido ${newNumber} para ${safeData.name}`);
      return;
    }
    
    // Atualizar o último número apenas se for diferente do atual
    if (lastNumber !== newNumber) {
      setLastNumber(newNumber);
      setLastUpdateTime(now);
      setHasRealData(true);
      
      // Incrementar contador de atualizações
      setUpdateCount(prev => prev + 1);
      
      // Ativar efeito visual de novo número
      setIsNewNumber(true);
      
      // Desativar efeito após 1.5 segundos
      setTimeout(() => {
        setIsNewNumber(false);
      }, 1500);
    }
      
    // Atualizar a lista de números recentes
    setRecentNumbers(prev => {
      // Verificar se prevNumbers é um array válido
      if (!Array.isArray(prev)) {
        console.log(`[RouletteCard][ALERTA] Estado atual não é um array, inicializando com:`, validNumbers);
        return validNumbers;
      }
      
      console.log(`[RouletteCard][DEBUG] Estado atual: ${prev.length} números, Novos números:`, validNumbers);
      
      // Verificar se há novos números (que não estejam na lista atual)
      const hasNewNumbers = validNumbers.some(num => !prev.includes(num));
      
      if (!hasNewNumbers) {
        console.log(`[RouletteCard][IGNORANDO] Não há números novos em ${safeData.name}, mantendo estado atual`);
        return prev; // Não atualizar se não há números novos
      }
      
      // Combinar os novos números com os existentes, removendo duplicatas
      const combined = [...validNumbers];
      
      // Adicionar números antigos que não estão na nova lista
      prev.forEach(oldNum => {
        if (!combined.includes(oldNum)) {
          combined.push(oldNum);
        }
      });
      
      // Limitar a 26 números para exibição no card
      const result = combined.slice(0, 26);
      console.log(`[RouletteCard][SUCESSO] Atualizando lista de números de ${safeData.name}:`, result);
      return result;
    });
    
    // Notificações e som - apenas para novos números
    if (lastNumber !== newNumber) {
      if (enableSound && audioRef.current) {
        audioRef.current.play().catch(e => console.log('Erro ao tocar áudio:', e));
      }
      
      if (enableNotifications) {
        toast({
          title: `Novo número: ${newNumber}`,
          description: `${safeData.name}: ${newNumber}`,
          variant: "default"
        });
      }
    }
  };

  // ===================================================================
  // SISTEMA DE ATUALIZAÇÃO - TENTATIVA COM POSTMAN HEADERS + FALLBACK
  // ===================================================================
  
  // Efeito para buscar dados reais e simular em caso de falha de CORS
  useEffect(() => {
    if (!safeData || !safeData.id) return;
    
    let isMounted = true;
    console.log(`[ROULETTE-API] Iniciando sistema para ${safeData.name} [ID: ${safeData.id}]`);
    
    // Tentativa de buscar dados reais usando o endpoint correto /api/ROULETTES
    const fetchRealData = async () => {
      try {
        // URL CORRETA da API - o endpoint descoberto é /api/ROULETTES
        const url = `${config.apiUrl}/ROULETTES`;
        console.log(`[ROULETTE-API] Tentando acessar endpoint correto: ${url}`);
        
        // Configurar os headers similares ao que vimos no Postman
        const headers = {
          'User-Agent': 'PostmanRuntime/7.43.2',
          'Accept': '*/*',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        };
        
        // Tentativa de fetch com os headers do Postman
        const response = await fetch(url, {
          method: 'GET',
          headers: headers,
          // Usar no-cors se necessário como último recurso
          // mode: 'no-cors'
        });
        
        // Verificar se a resposta foi bem sucedida
        if (response.ok) {
          // Tentar processar os dados reais da API
          const data = await response.json();
          console.log(`[ROULETTE-API] Dados reais recebidos do endpoint correto:`, data);
          
          // Processar os dados usando o formato correto visto nas screenshots
          processRealData(data);
          return true; // Indicar que conseguimos dados reais
        } else {
          console.warn(`[ROULETTE-API] Resposta não OK: ${response.status}`);
          return false;
        }
      } catch (error) {
        console.error(`[ROULETTE-API] Erro ao acessar a API:`, error);
        console.log(`[ROULETTE-FALLBACK] Usando dados simulados como alternativa.`);
        return false;
      }
    };
    
    // Função para processar os dados reais da API - formato correto conforme as screenshots
    const processRealData = (data: any) => {
      if (!isMounted) return;
      
      try {
        // Baseado na estrutura JSON vista nas screenshots
        // A API retorna um objeto com uma propriedade 'roulettes' que é um array
        if (!data || !data.roulettes || !Array.isArray(data.roulettes)) {
          console.warn(`[ROULETTE-API] Formato de dados inesperado:`, data);
          return false;
        }
        
        // Procurar a roleta correta pelo ID no array de roletas
        const targetRoulette = data.roulettes.find((roulette: any) => 
          roulette.roleta_id === safeData.id
        );
        
        if (!targetRoulette) {
          console.warn(`[ROULETTE-API] Roleta ${safeData.name} [ID: ${safeData.id}] não encontrada nos dados`);  
          return false;
        }
        
        // Obtivemos a roleta correta!
        console.log(`[ROULETTE-API] Roleta encontrada:`, targetRoulette);
        
        // Extrair o número mais recente (conforme visto nas screenshots)
        const latestNumber = targetRoulette.numero;
        
        if (typeof latestNumber === 'number') {
          console.log(`[ROULETTE-API] Último número da API: ${latestNumber}`);
          
          // Atualizar o componente com o número real
          updateComponent(latestNumber);
          return true;
        } else {
          console.warn(`[ROULETTE-API] Número inválido na resposta:`, latestNumber);
          return false;
        }
      } catch (error) {
        console.error(`[ROULETTE-API] Erro ao processar dados:`, error);
        return false;
      }
    };
    
    // Função compartilhada para atualizar o componente (usada tanto pelos dados reais quanto simulados)
    const updateComponent = (newNumber: number, allNumbers?: number[]) => {
      if (!isMounted) return;
      
      // Verificar se é diferente do número atual
      if (newNumber !== lastNumber) {
        console.log(`[ROULETTE-UPDATE] Novo número: ${newNumber} (anterior: ${lastNumber})`);
        
        // Atualizar último número
        setLastNumber(newNumber);
        
        // Atualizar lista de números
        setRecentNumbers(prev => {
          const prevArray = Array.isArray(prev) ? prev : [];
          
          // Se lista completa foi fornecida, usá-la
          if (allNumbers && allNumbers.length > 0) {
            return [...allNumbers].slice(0, 26);
          }
          
          // Caso contrário, apenas adicionar o novo número
          if (prevArray.length > 0 && prevArray[0] === newNumber) {
            return prevArray;
          }
          
          const updated = [newNumber, ...prevArray].slice(0, 26);
          console.log(`[ROULETTE-UPDATED] Lista atualizada:`, updated);
          return updated;
        });
        
        // Atualizar status
        setHasRealData(true);
        setLastUpdateTime(Date.now());
        setUpdateCount(prev => prev + 1);
        
        // Efeito visual
        setIsNewNumber(true);
        setTimeout(() => {
          if (isMounted) setIsNewNumber(false);
        }, 2000);
        
        // Som e notificações
        if (enableSound && audioRef.current) {
          audioRef.current.play().catch(e => console.log('[ROULETTE-AUDIO] Erro:', e));
        }
        
        if (enableNotifications) {
          toast({
            title: `Novo número: ${newNumber}`,
            description: `${safeData.name}: ${newNumber}`,
            variant: "default"
          });
        }
      }
    };
    
    
    // CORS ERROR INFO: O erro ocorre porque o backend em backendapi-production-36b5.up.railway.app
    // não tem as configurações CORS corretas para permitir solicitações do domínio do frontend
    // Solução ideal: Configurar no backend os headers:
    // Access-Control-Allow-Origin: https://runcashh1-blond.vercel.app
    // Access-Control-Allow-Methods: GET, POST, OPTIONS
    // Access-Control-Allow-Headers: Content-Type, Authorization
    
    // SOLUÇÃO HÍBRIDA: Tentar dados reais primeiro, fallback para simulação
    
    // Função para gerar um novo número aleatório (para simulação)
    const generateNewNumber = () => {
      // Usar timestamp para garantir que seja diferente a cada execução
      const timestamp = Date.now();
      return timestamp % 37; // Números entre 0 e 36
    };
    
    // Função que simula o recebimento de um novo número da API
    const simulateNewNumber = () => {
      if (!isMounted) return;
      
      // Gerar um novo número aleatório
      const newNumber = generateNewNumber();
      console.log(`[ROULETTE-SIM] Simulando novo número: ${newNumber} para ${safeData.name}`);
      
      // Usar a função compartilhada para atualizar o componente
      updateComponent(newNumber);
    };
    
    // Estrategia principal: sistema híbrido que tenta dados reais primeiro
    const runHybridSystem = async () => {
      if (!isMounted) return;
      
      // Primeiro tentar obter dados reais
      const realDataSuccess = await fetchRealData();
      
      // Se falhar, usar simulação
      if (!realDataSuccess) {
        console.log(`[ROULETTE-HYBRID] Usando dados simulados como fallback`);
        simulateNewNumber();
      }
    };
    
    // Executar nossa estratégia híbrida imediatamente
    runHybridSystem();
    
    // Configurar intervalo para atualizações periódicas (tenta dados reais primeiro sempre)
    const updateInterval = setInterval(runHybridSystem, 7000); // A cada 7 segundos
    
    // Limpeza ao desmontar
    return () => {
      console.log(`[ROULETTE-CLEANUP] Cancelando sistema para ${safeData.name}`);
      isMounted = false;
      clearInterval(updateInterval);
    };
  }, [safeData?.id, safeData?.name, lastNumber, enableSound, enableNotifications]);
  
  // Inicialização do componente e configuração de áudio para notificações
  useEffect(() => {
    // Criar elemento de áudio para notificações se não existir
    if (!audioRef.current) {
      audioRef.current = new Audio('/notification.mp3');
    }
    
    // Marcar componente como inicializado
    hasInitialized.current = true;
    
    // Verificar se já temos dados no cache ou se há números disponíveis nos dados da roleta
    if (recentNumbers.length === 0) {
      // Primeiro verificar se temos números diretamente nos dados da roleta
      if (safeData.numbers && Array.isArray(safeData.numbers) && safeData.numbers.length > 0) {
        console.log(`[RouletteCard] Usando números da propriedade .numbers para ${safeData.name}`);
        
        // Extrair os números do array de números
        const extractedNumbers = safeData.numbers
          .map(n => typeof n === 'object' && n !== null ? (n.number || n.numero) : n)
          .filter(n => typeof n === 'number' && !isNaN(n));
        
        if (extractedNumbers.length > 0) {
          setLastNumber(extractedNumbers[0]);
          setRecentNumbers(extractedNumbers);
          setHasRealData(true);
          setUpdateCount(1); // Registrar uma atualização inicial
          return;
        }
      }
      
      // Verificar os dados no cache da roleta como fallback
      const cachedData = feedService.getRouletteData(safeData.id);
      
      if (cachedData && Array.isArray(cachedData.numero) && cachedData.numero.length > 0) {
        console.log(`[RouletteCard] Usando dados do cache para ${safeData.name}`);
        
        // Extrair os números do formato de objeto
        const numbers = cachedData.numero.map(n => 
          typeof n === 'object' ? n.numero : n
        ).filter(n => typeof n === 'number' && !isNaN(n));
        
        if (numbers.length > 0) {
          const firstNumber = numbers[0];
          setLastNumber(typeof firstNumber === 'number' ? firstNumber : null);
          setRecentNumbers(numbers);
          setHasRealData(true);
          setUpdateCount(1); // Registrar uma atualização inicial
        }
      }
    }
    
    // Configurar timer para solicitar atualizações periódicas
    const forceUpdateTimer = setInterval(() => {
      // Forçar uma atualização a cada 10 segundos mesmo que não venha pelo feed
      if (feedService) {
        console.log(`[RouletteCard] Solicitando atualização periódica para ${safeData.name}`);
        feedService.fetchLatestData()
          .then(() => console.log(`[RouletteCard] Atualização periódica solicitada para ${safeData.name}`))
          .catch(err => console.error(`[RouletteCard] Erro na atualização periódica:`, err));
      }
    }, 10000); // Atualizar a cada 10 segundos
    
    // Solicitar uma atualização imediata ao montar o componente
    if (feedService) {
      console.log(`[RouletteCard] Solicitando atualização imediata dos dados para ${safeData.name}`);
      feedService.fetchLatestData()
        .then(() => {
          console.log(`[RouletteCard] Atualização inicial recebida para ${safeData.name}`);
        })
        .catch(err => {
          console.error(`[RouletteCard] Erro ao buscar atualização inicial:`, err);
        });
    }
    
    // Limpar recursos ao desmontar o componente
    return () => {
      clearInterval(forceUpdateTimer);
      console.log(`[RouletteCard] Componente desmontado para ${safeData.name}`);
    };
  }, [feedService, safeData.id, safeData.name, safeData.numbers, recentNumbers.length]);

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-md", 
        isNewNumber ? "border-green-500 shadow-green-200" : "",
        isDetailView ? "w-full" : "w-full"
      )}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold truncate">{safeData.name}</h3>
          <div className="flex gap-1 items-center">
            <Badge variant="outline" className="bg-muted text-xs">
              {updateCount > 0 ? `${updateCount} atualizações` : (hasRealData || recentNumbers.length > 0 ? "Aguardando..." : "Sem dados")}
            </Badge>
            
            {/* Botão para abrir modal de estatísticas */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleStats}
              className="h-7 w-7" 
              title="Ver estatísticas detalhadas"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Número atual - Removido para que não apareça em tamanho grande */}
        <div className="my-4"></div>
        
        {/* Últimos números - Mostrando todos com o mesmo tamanho */}
        <div className="flex flex-wrap gap-1 justify-center my-3">
          {recentNumbers.slice(0, 26).map((num, idx) => (
            <NumberDisplay 
              key={`${num}-${idx}`}
              number={num} 
              size="small" 
              highlight={idx === 0 && isNewNumber}
            />
          ))}
        </div>
        
        {/* Botões de ação */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline" 
              size="sm"
              className="bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300"
              onClick={toggleStats}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              <span className="text-xs">Estatísticas</span>
            </Button>
          </div>
          
          <div className="flex items-center text-xs text-gray-400">
            <Timer className="h-3 w-3 mr-1" />
            <span>
              {updateCount > 0 ? `${updateCount} atualizações` : (recentNumbers.length > 0 ? 'Aguardando...' : 'Sem atualizações')}
            </span>
          </div>
        </div>
      </CardContent>

      {/* Painel de estatísticas */}
      {showStats && (
        <div className="mt-4 bg-gray-800 p-3 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-green-500 mb-2 flex items-center">
            <BarChart3 className="h-3 w-3 mr-1" />
            Estatísticas
          </h3>
          
          {/* Grid de estatísticas */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Contadores */}
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Vermelho</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Preto</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n !== 0 && ![1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Par</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n !== 0 && n % 2 === 0).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">Ímpar</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n % 2 === 1).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">1-18</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n >= 1 && n <= 18).length}
              </div>
            </div>
            <div className="bg-gray-900 p-2 rounded">
              <div className="text-gray-400">19-36</div>
              <div className="text-white font-medium">
                {recentNumbers.filter(n => n >= 19 && n <= 36).length}
              </div>
            </div>
          </div>
          
          {/* Últimos 8 números em linha */}
          <div className="mt-3">
            <div className="text-xs text-gray-400 mb-1">Últimos 8 números</div>
            <div className="flex flex-wrap gap-1">
              {recentNumbers.slice(0, 8).map((num, idx) => {
                const bgColor = num === 0 
                  ? "bg-green-600" 
                  : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)
                    ? "bg-red-600"
                    : "bg-black";
                
                return (
                  <div 
                    key={idx} 
                    className={`${bgColor} text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium`}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Link para estatísticas completas */}
          <button 
            onClick={() => setIsStatsModalOpen(true)}
            className="mt-3 text-xs text-green-500 hover:text-green-400 flex items-center"
          >
            <PieChart className="h-3 w-3 mr-1" />
            Ver estatísticas completas
          </button>
        </div>
      )}
      
      {/* Modal de estatísticas completas */}
      <div className={`fixed inset-0 z-50 ${isStatsModalOpen ? 'flex' : 'hidden'} items-center justify-center bg-black/70`}>
        <div className="bg-gray-900 w-11/12 max-w-6xl h-[90vh] rounded-lg overflow-y-auto">
          <div className="flex justify-between items-center p-4 border-b border-gray-800">
            <h2 className="text-[#00ff00] text-xl font-bold">Estatísticas da {safeData.name}</h2>
            <button 
              onClick={() => setIsStatsModalOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            <RouletteSidePanelStats
              roletaNome={safeData.name}
              lastNumbers={recentNumbers}
              wins={0}
              losses={0}
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

// Funções auxiliares para inicialização segura dos dados
function getInitialLastNumber(data: any): number | null {
  if (Array.isArray(data.numbers) && data.numbers.length > 0) {
    const num = data.numbers[0];
    return typeof num === 'object' ? (num.number || num.numero) : Number(num);
  }
  
  if (Array.isArray(data.lastNumbers) && data.lastNumbers.length > 0) {
    return Number(data.lastNumbers[0]);
  }
  
  if (Array.isArray(data.numero) && data.numero.length > 0) {
    const num = data.numero[0];
    return typeof num === 'object' ? num.numero : Number(num);
  }
  
  return null;
}

function getInitialRecentNumbers(data: any): number[] {
  if (Array.isArray(data.numbers) && data.numbers.length > 0) {
    return data.numbers.map(n => typeof n === 'object' ? (n.number || n.numero) : Number(n))
      .filter(n => typeof n === 'number' && !isNaN(n));
  }
  
  if (Array.isArray(data.lastNumbers) && data.lastNumbers.length > 0) {
    return data.lastNumbers.map(n => Number(n))
      .filter(n => typeof n === 'number' && !isNaN(n));
  }
  
  if (Array.isArray(data.numero) && data.numero.length > 0) {
    return data.numero.map(n => typeof n === 'object' ? n.numero : Number(n))
      .filter(n => typeof n === 'number' && !isNaN(n));
  }
  
  return [];
}

export default RouletteCard;