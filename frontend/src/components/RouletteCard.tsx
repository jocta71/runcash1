import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { RouletteData } from '@/types';
import NumberDisplay from './NumberDisplay';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouletteSettingsStore } from '@/stores/rouletteSettingsStore';
import { cn } from '@/lib/utils';
import EventBus from '@/services/EventBus';
import { UnifiedRouletteClient } from '@/services/UnifiedRouletteClient';
import { getLogger } from '@/services/utils/logger';
import { Loader2 } from 'lucide-react';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = true;

// Helper function for controlled logging
const logger = getLogger('RouletteCard');
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    // Formatar argumentos em uma string antes de passar para o logger
    logger.debug(args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' '));
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
  const safeData = useMemo(() => ({
    id: data?.id || data?._id || 'unknown',
    name: data?.name || data?.nome || 'Roleta sem nome',
  }), [data]);
  
  // ID único para este componente
  const componentId = useRef(`roulette-${safeData.id}-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Referência ao cliente unificado
  const unifiedClient = useMemo(() => UnifiedRouletteClient.getInstance(), []);
  
  // Função para lidar com atualizações de dados do cliente unificado
  const handleDataUpdate = useCallback((allRoulettes: any[]) => {
    if (!allRoulettes || !Array.isArray(allRoulettes)) return;
    
    // Encontrar a roleta específica pelo ID ou nome
    const myRoulette = allRoulettes.find((roulette: any) => 
      roulette.id === safeData.id || 
      roulette._id === safeData.id || 
      roulette.name === safeData.name || 
      roulette.nome === safeData.name
    );
    
    if (!myRoulette) {
      return;
    }
      
    // Salvar dados brutos para uso posterior (se necessário)
    setRawRouletteData(myRoulette);
      
    // Processar os dados da roleta
    processApiData(myRoulette);
        
    // Atualizar timestamp e contador
    setLastUpdateTime(Date.now());
    setUpdateCount(prev => prev + 1);
    setError(null);
    if(loading) setLoading(false);
    if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        setLoadingTimeout(false);
    }

  }, [safeData.id, safeData.name, componentId]);
  
  // Efeito para iniciar a busca de dados e se inscrever em eventos
  useEffect(() => {
    logger.info(`[${componentId}] Montando e buscando dados iniciais para ${safeData.name}`);
    setLoading(true);
    setLoadingTimeout(false);
    
    // Configurar um timeout para caso o carregamento demore demais
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        logger.warn(`[${componentId}] Timeout de carregamento atingido para ${safeData.name}`);
        setLoadingTimeout(true);
        setLoading(false);
        setError('Não foi possível carregar os dados. Verifique sua conexão.');
      }
    }, 15000);

    // Buscar dados iniciais do cache do cliente unificado
    const initialData = unifiedClient.getAllRoulettes();
    if (initialData && initialData.length > 0) {
       logger.info(`[${componentId}] Dados iniciais encontrados no cache do UnifiedClient`);
       handleDataUpdate(initialData);
    } else {
       logger.info(`[${componentId}] Cache inicial vazio, aguardando dados via SSE...`);
       unifiedClient.forceUpdate().catch(err => logger.error('Erro ao forçar update inicial:', err));
    }
    
    // Listener para atualizações gerais do UnifiedClient
    const updateListenerId = `${componentId}_update`;
    const generalUpdateHandler = () => {
        logger.debug(`[${componentId}] Recebido evento de update geral do UnifiedClient`);
        const allData = unifiedClient.getAllRoulettes();
        handleDataUpdate(allData);
    };
    unifiedClient.on(updateListenerId, generalUpdateHandler);
    
    // Listener específico para novos números (se aplicável/emitido pelo UnifiedClient ou EventBus)
    const newNumberListenerId = `${componentId}_new_number`;
    const newNumberHandler = (event: any) => {
        if (event && (event.roleta_id === safeData.id || event.id === safeData.id) && event.numero !== undefined) {
             logger.info(`[${componentId}] Evento roulette:new-number recebido: ${event.numero}`);
             processNewSingleNumber(event.numero);
        }
    };
    EventBus.on('roulette:new-number', newNumberHandler);
    
    // Limpar inscrição ao desmontar o componente
    return () => {
      logger.info(`[${componentId}] Desmontando e limpando listeners para ${safeData.name}`);
      unifiedClient.off(updateListenerId, generalUpdateHandler);
      EventBus.off('roulette:new-number', newNumberHandler);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [unifiedClient, componentId, safeData.id, safeData.name, handleDataUpdate]); 
  
  // Função para processar dados da API
  const processApiData = (apiRoulette: any) => {
    debugLog(`Processando dados para roleta ${safeData.name}:`, apiRoulette);
    
    if (!apiRoulette) {
      logger.warn(`[${componentId}] Dados vazios ou inválidos para a roleta ${safeData.name}`);
      return;
    }
    
    // Extrair números da resposta
    const apiNumbers = extractNumbers(apiRoulette);
    debugLog(`Números extraídos para ${safeData.name}:`, apiNumbers);
    
    // Se não há números, não faz nada
    if (!apiNumbers || apiNumbers.length === 0) {
      if (allNumbers.length === 0) setLoading(false);
      return;
    }
    
    setHasRealData(true);
    
    // Verificar se temos números novos e atualizar estado
    const hasNew = updateNumberSequence(apiNumbers);
    
    // Tocar som se houver número novo e o som estiver habilitado
    if (hasNew && enableSound && audioRef.current) {
      audioRef.current.play().catch(error => console.error("Erro ao tocar som:", error));
    }
  };

  // Função para extrair números (pode ser movida para utils)
  const extractNumbers = (apiData: any): number[] => {
    let extracted: number[] = [];
    if (apiData && Array.isArray(apiData.numero)) {
      extracted = apiData.numero
        .map((item: any) => item?.numero ?? item?.value ?? item)
        .filter((n: any) => typeof n === 'number' && !isNaN(n) && n >= 0 && n <= 36)
        .map(Number);
    } else if (Array.isArray(apiData)) {
        extracted = apiData.filter((n: any) => typeof n === 'number' && !isNaN(n) && n >= 0 && n <= 36).map(Number);
    }
    return extracted;
  };
  
  // Função para atualizar a sequência de números e destacar novo número
  const updateNumberSequence = (apiNumbers: number[]): boolean => {
    let hasNew = false;
    setAllNumbers(prevAllNumbers => {
      if (!prevAllNumbers || prevAllNumbers.length === 0 || apiNumbers[0] !== prevAllNumbers[0]) {
        hasNew = true;
        const newLastNumber = apiNumbers[0];
        setLastNumber(newLastNumber);
        setIsNewNumber(true);
        setTimeout(() => setIsNewNumber(false), 1500);
        setRecentNumbers(apiNumbers.slice(0, 20)); 
        return apiNumbers; 
      } else {
        hasNew = false;
        return prevAllNumbers;
      }
    });
    return hasNew;
  };

  // Função para processar um único número novo (vindo de evento específico)
  const processNewSingleNumber = (newNum: number) => {
       let hasNew = false;
       setAllNumbers(prevAll => {
           if (prevAll[0] === newNum) return prevAll;
           
           hasNew = true;
           setLastNumber(newNum);
           setIsNewNumber(true);
           setTimeout(() => setIsNewNumber(false), 1500);
           
           const updatedAll = [newNum, ...prevAll];
           setRecentNumbers(updatedAll.slice(0, 20));
           return updatedAll;
       });

       if (hasNew && enableSound && audioRef.current) {
           audioRef.current.play().catch(error => console.error("Erro ao tocar som:", error));
       }
  };
  
  // Função para navegar para detalhes
  const handleCardClick = () => {
    if (!isDetailView) {
      navigate(`/roulette/${safeData.id}`);
    }
  };

  // Calcular tempo desde a última atualização
  const getTimeAgo = () => {
    const seconds = Math.floor((Date.now() - lastUpdateTime) / 1000);
    if (seconds < 5) return "agora";
    if (seconds < 60) return `${seconds}s atrás`;
    return `${Math.floor(seconds / 60)}min atrás`;
  };

  // Determinar cor do número
  const getNumberColor = (num: number | null): string => {
    if (num === null) return "bg-gray-700";
    if (num === 0) return "bg-green-600";
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num) ? "bg-red-600" : "bg-gray-900";
  };
  
  // Renderização
  return (
    <Card 
      ref={cardRef}
      className={cn(
        "roulette-card bg-card border border-border rounded-lg shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/50",
        isDetailView ? "" : "cursor-pointer"
      )}
      onClick={handleCardClick}
    >
      {/* Som para novo número */}
      {enableSound && <audio ref={audioRef} src="/sounds/coin.mp3" preload="auto" />}
      
      <CardContent className="p-4">
        {/* Cabeçalho com Nome e Status */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-white truncate" title={safeData.name}>{safeData.name}</h3>
          <Badge 
            variant={loading || loadingTimeout ? "secondary" : (error ? "destructive" : "default")} 
            className={cn(
              "text-xs px-2 py-0.5",
              loading || loadingTimeout ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
              error ? "bg-red-500/20 text-red-400 border-red-500/30" :
              "bg-green-500/20 text-green-400 border-green-500/30"
            )}
          >
            {loading ? "Carregando..." : (loadingTimeout ? "Aguardando Dados..." : (error ? "Erro" : "Online"))}
          </Badge>
        </div>

        {/* Mensagem de erro */}
        {error && !loading && (
          <div className="text-center text-red-400 text-sm py-4">
            {error}
            <Button 
              size="sm" 
              variant="outline" 
              className="ml-2 text-xs h-6 px-2 border-primary text-primary hover:bg-primary/10"
              onClick={async (e) => { 
                e.stopPropagation();
                setLoading(true); 
                setError(null); 
                setReloadingData(true);
                await unifiedClient.forceUpdate(); 
                setTimeout(() => setReloadingData(false), 500);
              }}
              disabled={reloadingData}
            >
              {reloadingData ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* Números Recentes */}
        {!error && (
          <div className="mb-4 flex flex-wrap gap-1.5 items-center justify-center min-h-[30px]">
            {recentNumbers.length > 0 ? (
              recentNumbers.map((num, index) => (
                <NumberDisplay 
                  key={`${safeData.id}-hist-${index}-${num}`}
                  number={num} 
                  size="small"
                  highlight={index === 0 && isNewNumber}
                />
              ))
            ) : !loading && (
              <span className="text-xs text-gray-500">Aguardando números...</span>
            )}
          </div>
        )}

        {/* Último Número e Tempo */}
        {!loading && !error && recentNumbers.length > 0 && (
          <div className="flex justify-between items-center text-xs text-gray-400">
            <div className="flex items-center">
              <span className="mr-1">Último:</span>
              <NumberDisplay number={lastNumber} size="small" />
            </div>
            <span>{getTimeAgo()}</span>
          </div>
        )}
        
        {/* Feedback visual de recarregamento */}
        {reloadingData && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
        )}

      </CardContent>
    </Card>
  );
};

export default React.memo(RouletteCard);