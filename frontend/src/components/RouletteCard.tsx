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

interface RouletteNumber {
  numero: number;
  timestamp: string;
  cor?: string; // Adicionar cor opcional se vier da API
}

interface RouletteCardProps {
  initialData: RouletteData;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
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

const RouletteCard: React.FC<RouletteCardProps> = ({ initialData, onSelect, isSelected, isDetailView }) => {
  // Estados
  const [rouletteData, setRouletteData] = useState<ProcessedRouletteData | null>(processRouletteData(initialData));
  const [isLoading, setIsLoading] = useState(!rouletteData);
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
    id: initialData?.id || initialData?._id || 'unknown',
    name: initialData?.name || initialData?.nome || 'Roleta sem nome',
  };
  
  // ID único para este componente
  const componentId = useRef(`roulette-${safeData.id}-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Obter instância do UnifiedClient
  const unifiedClient = UnifiedRouletteClient.getInstance();
  
  // useEffect para buscar dados iniciais e assinar updates
  useEffect(() => {
    // Função para processar UM update e definir o estado
    const handleSingleUpdate = (data: any) => {
      if (data && data.id === safeData.id) {
        console.log(`[DEBUG ${componentId}] Recebido update para esta roleta:`, data);
        const processed = processRouletteData(data); // Processa os dados recebidos
        if (processed) {
          // Compara com o estado ANTERIOR para detectar novo número
          setRouletteData(prevState => {
            if (prevState && processed.ultimoNumero !== prevState.ultimoNumero && processed.ultimoNumero !== null) {
              console.log(`[DEBUG ${componentId}] Novo número detectado: ${processed.ultimoNumero}`);
              setIsNewNumber(true);
              setTimeout(() => setIsNewNumber(false), 2000); // Resetar após animação
            }
            return processed; // Retorna o novo estado processado
          });
          setIsLoading(false);
          setError(null);
        } else {
          console.error(`[DEBUG ${componentId}] Falha ao processar dados recebidos.`);
          setError('Falha ao processar dados da roleta.');
          setIsLoading(false);
        }
      }
    };

    // Tenta obter dados do cache do cliente ao montar
    console.log(`[DEBUG ${componentId}] Tentando obter dados do cache para ${safeData.id}`);
    const currentDataFromClient = unifiedClient.getRouletteById(safeData.id);
    if (currentDataFromClient) {
        console.log(`[DEBUG ${componentId}] Dados encontrados no cache:`, currentDataFromClient);
        handleSingleUpdate(currentDataFromClient); // Processa dados do cache
    } else {
        // Se não há no cache E não tínhamos initialData processado, manter loading
        if (!rouletteData) {
            console.log(`[DEBUG ${componentId}] Sem dados no cache ou initialData, mantendo loading.`);
            setIsLoading(true);
        }
    }

    // Assina o evento 'update'
    console.log(`[DEBUG ${componentId}] Assinando evento 'update'.`);
    const unsubscribe = unifiedClient.on('update', (updateData) => {
        if (Array.isArray(updateData)) {
            // Se for array, encontra os dados desta roleta específica
            const myData = updateData.find(r => r.id === safeData.id);
            if (myData) {
                handleSingleUpdate(myData);
            }
        } else {
            // Se for objeto único, processa diretamente
            handleSingleUpdate(updateData);
        }
    });

    // Limpa a inscrição ao desmontar
    return () => {
      console.log(`[DEBUG ${componentId}] Cancelando inscrição do evento 'update'.`);
      unsubscribe();
    };
    // Não incluir rouletteData nas dependências para evitar loop de re-assinatura
  }, [safeData.id, unifiedClient]); 
  
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
    const apiNumbers = extractNumbers(apiRoulette); // Retorna number[]
    debugLog(`Números extraídos para ${safeData.name}:`, apiNumbers);
    
    if (!apiNumbers || apiNumbers.length === 0) {
      debugLog(`Nenhum número extraído para ${safeData.name} - API response:`, apiRoulette);
      // <<< Se não há números E não tínhamos dados, definir estado como "sem números" >>>
      if (!rouletteData) {
          setRouletteData({
            id: apiRoulette.id || safeData.id,
            nome: apiRoulette.nome || apiRoulette.name || safeData.name,
            provider: apiRoulette.provider || 'Desconhecido',
            status: apiRoulette.status || 'offline',
            ultimoNumero: null,
            numeros: [], // Array vazio de RouletteNumber
            winRate: apiRoulette.winRate || 0,
            streak: apiRoulette.streak || 0,
            lastUpdateTime: apiRoulette.timestamp ? new Date(apiRoulette.timestamp).getTime() : Date.now(),
          });
           setIsLoading(false); // Garantir que parou de carregar
      }
      return;
    }
    
    // Verificar se temos números novos (esta função pode ser simplificada depois)
    const hasNewNumbers = updateNumberSequence(apiNumbers);
    debugLog(`Novos números encontrados para ${safeData.name}: ${hasNewNumbers ? 'SIM' : 'NÃO'}`);
    
    // Se não tínhamos dados reais antes, inicializar o estado corretamente
    if (!rouletteData) {
        // <<< CORRIGIR A INICIALIZAÇÃO DO ESTADO >>>
        // Mapear apiNumbers para RouletteNumber[]
        const initialNumeros: RouletteNumber[] = apiNumbers.slice(0, 10).map(num => ({
            numero: num,
            timestamp: new Date().toLocaleTimeString() // Usar timestamp placeholder
        }));

        setRouletteData({
            id: apiRoulette.id || safeData.id, // Usar dados da apiRoulette
            nome: apiRoulette.nome || apiRoulette.name || safeData.name,
            provider: apiRoulette.provider || 'Desconhecido',
            status: apiRoulette.status || 'offline',
            ultimoNumero: initialNumeros.length > 0 ? initialNumeros[0].numero : null,
            numeros: initialNumeros, // <<< Usar array formatado
            winRate: apiRoulette.winRate || 0, // Usar dados da apiRoulette ou padrão
            streak: apiRoulette.streak || 0,
            lastUpdateTime: apiRoulette.timestamp ? new Date(apiRoulette.timestamp).getTime() : Date.now(), // Usar dados da apiRoulette
        });
        debugLog(`Dados iniciais carregados para ${safeData.name} - ${apiNumbers.length} números`);
        setIsLoading(false); // Garantir que parou de carregar
        return; // Retornar após inicializar
    }

    // Se já tínhamos dados e não há números novos, não fazer nada
    if (!hasNewNumbers) {
      debugLog(`Sem alterações nos números para ${safeData.name} - ignorando atualização`);
      // Atualizar apenas o timestamp se desejado
      // setRouletteData(prev => prev ? {...prev, lastUpdateTime: Date.now()} : null);
      return;
    }

    // Se chegamos aqui, é porque hasNewNumbers é true e a função updateNumberSequence
    // já atualizou o estado rouletteData corretamente.
    debugLog(`Estado atualizado com novos números para ${safeData.name}`);
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
    
    if (rouletteData && rouletteData.numeros && rouletteData.numeros.length > 0) {
      const matchingNumber = rouletteData.numeros.find((n: RouletteNumber) => n.numero === newNumber);
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
    if (onSelect && rouletteData) {
      onSelect(rouletteData.id);
    }
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
    if (!rouletteData) { // Checar se temos dados base para atualizar
        // Se não temos, a lógica inicial no useEffect ou processRouletteData deve tratar
        return false; 
    }

    if (apiNumbers[0] === rouletteData.ultimoNumero) {
      return false;
    }

    const newNumbers: RouletteNumber[] = [];
    for (const apiNum of apiNumbers) {
      // Precisamos recriar o objeto RouletteNumber aqui, idealmente com timestamp real da API
      // Por enquanto, usando timestamp atual como placeholder
      const now = new Date();
      const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
      const newNumObj: RouletteNumber = { numero: apiNum, timestamp: timeString }; 
      
      // Checar se o número já existe no array atual
      if (rouletteData.numeros.some(n => n.numero === apiNum && n.timestamp === newNumObj.timestamp)) {
          break; // Para se encontrarmos um que já existe
      }
      newNumbers.push(newNumObj);
    }

    if (newNumbers.length > 0) {
      const updatedNumbers = [...newNumbers, ...rouletteData.numeros];
      
      // Atualizar o estado principal
      setRouletteData({
        ...rouletteData, // Manter dados existentes
        numeros: updatedNumbers.slice(0, 10), // Atualizar array de números (limitado para exibição)
        ultimoNumero: newNumbers[0].numero, // Atualizar o último número
        lastUpdateTime: Date.now() // Atualizar timestamp da atualização
        // NÃO adicionar isNewNumber aqui
      });
      
      // <<< Usar o state setter para isNewNumber >>>
      setIsNewNumber(true); 
      showNumberNotification(newNumbers[0].numero);
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
        isNewNumber ? "border-vegas-green animate-pulse" : "",
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
          {lastNumbersToDisplay.length > 0 ? (
              lastNumbersToDisplay.slice(0, 5).map((num, index) => (
                <NumberDisplay 
                  key={`${componentId}-num-${index}-${num}`}
                  number={num} 
                  size="medium" 
                  highlight={index === 0 && isNewNumber}
                />
              ))
          ) : (
              <span className="text-xs text-muted-foreground">Nenhum número recente</span>
          )}
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