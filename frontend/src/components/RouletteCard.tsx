import { Loader2 } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { RouletteData } from '@/types';
import NumberDisplay from './NumberDisplay';
import { Badge } from "@/components/ui/badge";
import { useRouletteSettingsStore } from '@/stores/rouletteSettingsStore';
import { cn } from '@/lib/utils';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import EventBus from '../services/EventBus';
import { TrendingUp, Zap, CheckCircle, XCircle, AlertTriangle, Info, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

// Interface para os dados específicos que o Card precisa
interface ProcessedRouletteData {
  id: string;
  nome: string;
  provider: string;
  status: string;
  ultimoNumero: number | null;
  numeros: RouletteNumber[]; // Array de objetos { numero: number, timestamp: string }
  winRate: number;
  streak: number;
  lastUpdateTime: number;
}

// Função para extrair e processar dados da roleta (Adaptar para nova estrutura)
const processRouletteData = (roulette: any): ProcessedRouletteData | null => {
  if (!roulette || !roulette.id) return null;

  // Adaptar para pegar os números da estrutura correta (ex: roulette.numero)
  const numerosComTimestamp: RouletteNumber[] = (Array.isArray(roulette.numero) ? roulette.numero : []).map((item: any) => {
      let timeString = "00:00";
      if (item.timestamp) {
          try {
              const date = new Date(item.timestamp);
              timeString = date.getHours().toString().padStart(2, '0') + ':' +
                           date.getMinutes().toString().padStart(2, '0');
          } catch (e) { /* Ignorar erro de timestamp */ }
      }
      return {
          numero: Number(item.numero),
          timestamp: timeString
      };
  }).filter((n: any) => !isNaN(n.numero) && n.numero >= 0 && n.numero <= 36);

  const ultimoNumero = numerosComTimestamp.length > 0 ? numerosComTimestamp[0].numero : null;
  
  // Calcular winRate e streak (manter lógica existente se aplicável)
  const winRate = roulette.winRate || Math.random() * 100; // Placeholder
  const streak = roulette.streak || Math.floor(Math.random() * 5); // Placeholder

  return {
    id: roulette.id,
    nome: roulette.nome || roulette.name || 'Roleta Desconhecida',
    provider: roulette.provider || 'Desconhecido',
    status: roulette.status || 'offline',
    ultimoNumero: ultimoNumero,
    numeros: numerosComTimestamp.slice(0, 10), // Limitar a 10 para exibição no card
    winRate: winRate,
    streak: streak,
    lastUpdateTime: roulette.timestamp ? new Date(roulette.timestamp).getTime() : Date.now(),
  };
};

const RouletteCard: React.FC<RouletteCardProps> = ({ data, isDetailView = false }) => {
  // Estados
  const [rouletteData, setRouletteData] = useState<ProcessedRouletteData | null>(processRouletteData(data));
  const [isLoading, setIsLoading] = useState(!rouletteData); // Inicia como loading se não houver dados iniciais
  const [error, setError] = useState<string | null>(null);
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
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
  
  // Obter instância do UnifiedClient
  const unifiedClient = UnifiedRouletteClient.getInstance();
  
  // Função para lidar com atualizações de dados
  const handleDataUpdate = useCallback((allRoulettes: any[]) => {
    if (!allRoulettes || !Array.isArray(allRoulettes) || allRoulettes.length === 0) return;
    
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
      
    // Processar os dados da roleta
    processApiData(myRoulette);
        
    // Atualizar timestamp e contador
    setUpdateCount(prev => prev + 1);
    setError(null);
    setIsLoading(false);
  }, [safeData.id, safeData.name]);
  
  // Efeito para iniciar a busca de dados
  useEffect(() => {
    // Função para lidar com a atualização de UMA roleta específica
    const handleSingleRouletteUpdate = (data: any) => {
      if (data && data.id === safeData.id) { // Verificar se a atualização é para esta roleta
        const processed = processRouletteData(data);
        if (processed) {
          setRouletteData(processed);
          setIsLoading(false);
          setError(null);
        } else {
          setError('Falha ao processar dados da roleta.');
          setIsLoading(false);
        }
      } 
    };

    // Função para lidar com a atualização GERAL (array de roletas)
    const handleAllRoulettesUpdate = (allData: any[]) => {
        const myData = allData.find(r => r.id === safeData.id);
        if (myData) {
            handleSingleRouletteUpdate(myData); // Reutiliza a lógica de processamento
        }
    };

    // Tentar obter dados atuais do UnifiedClient ao montar
    const currentDataFromClient = unifiedClient.getRouletteById(safeData.id);
    if (currentDataFromClient) {
        handleSingleRouletteUpdate(currentDataFromClient);
    } else {
         // Se não houver dados no cliente, manter isLoading ou buscar dados iniciais
         // Se initialData foi fornecido, já o usamos no useState inicial
         if (!rouletteData) setIsLoading(true); 
    }

    // Assinar evento 'update'
    const unsubscribe = unifiedClient.on('update', (updateData) => {
        if (Array.isArray(updateData)) {
            handleAllRoulettesUpdate(updateData);
        } else {
            handleSingleRouletteUpdate(updateData); // Processa atualização de roleta única
        }
    });

    // Limpar inscrição ao desmontar
    return () => {
      unsubscribe();
    };
  }, [safeData.id, unifiedClient]); // Depender do ID da roleta e do cliente
  
  // Adicionar um comentário para garantir que este é o único lugar fazendo requisições:
  // Console.log para verificar se há apenas uma fonte de requisições:
  console.log('[VERIFICAÇÃO DE FONTE ÚNICA] O componente RouletteCard usa apenas UnifiedRouletteClient para obter dados da API.');
  
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
    if (!hasNewNumbers && rouletteData) {
      debugLog(`Sem alterações nos números para ${safeData.name} - ignorando atualização`);
      return;
    }
    
    // Se não tínhamos dados reais antes, atualizamos a UI mesmo sem novos números
    if (!rouletteData) {
      setRouletteData({
        id: safeData.id,
        nome: safeData.name,
        provider: rouletteData.provider,
        status: rouletteData.status,
        ultimoNumero: rouletteData.ultimoNumero,
        numeros: apiNumbers.slice(0, 10),
        winRate: rouletteData.winRate,
        streak: rouletteData.streak,
        lastUpdateTime: Date.now(),
      });
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
    
    if (rouletteData && rouletteData.numero && rouletteData.numero.length > 0) {
      const matchingNumber = rouletteData.numero.find((n: any) => n.numero === newNumber);
      if (matchingNumber && matchingNumber.cor) {
        color = matchingNumber.cor.toLowerCase();
      }
    }
    
    // Mostrar notificação
    setIsNewNumber(true);
    setTimeout(() => setIsNewNumber(false), 2000);
    
  }, [rouletteData]);
  
  // Função para abrir detalhes da roleta
  const handleCardClick = () => {
    // Removida a navegação para a página de detalhes
    return; // Não faz nada ao clicar no card
  };
  
  // Formatar tempo relativo
  const getTimeAgo = () => {
    const seconds = Math.floor((Date.now() - rouletteData.lastUpdateTime) / 1000);
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
    if (!rouletteData) {
      return true;
    }
    
    // Caso 2: Verificar se o último número da API é igual ao nosso
    if (apiNumbers[0] === rouletteData.ultimoNumero) {
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
      if (rouletteData.numeros.includes(apiNum)) {
        break;
      }
      
      // Adicionar o número novo à nossa lista temporária
      newNumbers.push(apiNum);
    }
    
    // Se encontramos números novos, atualizamos o estado
    if (newNumbers.length > 0) {
      debugLog(`${newNumbers.length} novos números para ${safeData.name}: ${newNumbers.join(', ')}`);
      
      // Adicionar os novos números no início da nossa lista
      const updatedNumbers = [...newNumbers, ...rouletteData.numeros];
      
      // Atualizar estados
      setRouletteData({
        ...rouletteData,
        numeros: updatedNumbers.slice(0, 10),
        ultimoNumero: newNumbers[0],
        isNewNumber: true,
      });
      
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

  if (isLoading) {
    return (
      <Card className="w-full max-w-sm mx-auto shadow-lg rounded-lg overflow-hidden bg-card text-card-foreground animate-pulse">
        <CardHeader className="p-4">
          <div className="h-6 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mt-1"></div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-center items-center space-x-2">
            <div className="h-8 w-8 bg-muted rounded-full"></div>
            <div className="h-8 w-8 bg-muted rounded-full"></div>
            <div className="h-8 w-8 bg-muted rounded-full"></div>
            <div className="h-8 w-8 bg-muted rounded-full"></div>
            <div className="h-8 w-8 bg-muted rounded-full"></div>
          </div>
          <div className="h-4 bg-muted rounded w-full"></div>
        </CardContent>
        <CardFooter className="p-4 bg-muted/50 flex justify-between items-center">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-4 bg-muted rounded w-1/3"></div>
        </CardFooter>
      </Card>
    );
  }

  if (error) {
    return (
        <Card className="w-full max-w-sm mx-auto shadow-lg rounded-lg overflow-hidden border-destructive bg-destructive/10 text-destructive-foreground">
           <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Erro</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent className="p-4">
                <p className="text-xs">{error}</p>
                <Button variant="link" size="sm" className="mt-2 text-xs p-0 h-auto" onClick={() => unifiedClient.forceUpdate()}>Tentar novamente</Button>
            </CardContent>
        </Card>
    );
  }

  if (!rouletteData) {
    return (
        <Card className="w-full max-w-sm mx-auto shadow-lg rounded-lg overflow-hidden border-muted bg-muted/10 text-muted-foreground">
           <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sem Dados</CardTitle>
                <Info className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4">
                <p className="text-xs">Ainda não há dados disponíveis para {safeData.name || 'esta roleta'}.</p>
            </CardContent>
        </Card>
    );
  }
  
  // Renderização normal do Card com os dados do estado `rouletteData`
  const { nome, provider, status, ultimoNumero, numeros, winRate, streak, lastUpdateTime } = rouletteData;
  const isOnline = status?.toLowerCase() === 'online';
  const lastNumbersToDisplay = numeros.map(n => n.numero);

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "relative overflow-visible transition-all duration-300 backdrop-filter bg-opacity-40 bg-[#131614] border ", 
        "hover:border-vegas-green/50",
        rouletteData.isNewNumber ? "border-vegas-green animate-pulse" : "",
        isDetailView ? "w-full" : "w-full",
        !isOnline ? "opacity-60 grayscale" : ""
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
              variant={rouletteData ? "secondary" : "default"} 
              className={`text-xs ${rouletteData ? 'text-vegas-green border border-vegas-green/30' : 'bg-gray-700/50 text-gray-300'}`}
            >
              {rouletteData ? "Online" : "Sem dados"}
            </Badge>
          </div>
        </div>
        
        {/* Números recentes */}
        <div className="flex justify-center items-center space-x-1 min-h-[40px]">
          {lastNumbersToDisplay.slice(0, 5).map((num, index) => (
            <NumberDisplay 
              key={`${componentId}-num-${index}-${num}`} 
              number={num} 
              size="medium" 
              highlight={index === 0 && rouletteData.isNewNumber}
            />
          ))}
          {lastNumbersToDisplay.length === 0 && <span className="text-xs text-muted-foreground">Nenhum número recente</span>}
        </div>
      </CardContent>

      <CardFooter className="p-4 bg-muted/50 flex justify-between items-center text-xs text-muted-foreground">
        <span>{provider}</span>
        <Tooltip>
          <TooltipTrigger>
            <span>Atualizado: {new Date(lastUpdateTime).toLocaleTimeString()}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{new Date(lastUpdateTime).toLocaleString()}</p>
          </TooltipContent>
        </Tooltip>
      </CardFooter>
    </Card>
  );
};

export default RouletteCard;