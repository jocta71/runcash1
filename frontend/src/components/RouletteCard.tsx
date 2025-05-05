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
  data: any; // Manter any por enquanto ou definir tipo específico
  isDetailView?: boolean;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
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

// Função processRouletteData GLOBAL
const processRouletteData = (roulette: any): ProcessedRouletteData | null => {
  const rouletteIdForLog = roulette?.id || roulette?.roleta_id || 'ID Desconhecido';
  const rouletteNameForLog = roulette?.nome || roulette?.name || roulette?.roleta_nome || 'Nome Desconhecido';
  console.log(`[processRouletteData - ${rouletteIdForLog}] Iniciando processamento para '${rouletteNameForLog}'. Dados recebidos:`, JSON.stringify(roulette)); // Log completo como string

  if (!roulette || !(roulette.id || roulette.roleta_id)) {
    console.warn(`[processRouletteData - ${rouletteIdForLog}] Dados inválidos ou sem ID.`);
    return null;
  }
  
  const currentId = roulette.id || roulette.roleta_id;
  const currentName = roulette.nome || roulette.name || roulette.roleta_nome;

  // 1. Definir a fonte dos números: priorizar 'numbers', depois 'numero', depois chave com nome da roleta
  let sourceArray: any[] = [];
  let sourceFormat: 'object' | 'number' | 'nested_object' | 'none' = 'none';

  if (Array.isArray(roulette.numbers) && roulette.numbers.length > 0) {
      sourceArray = roulette.numbers;
      sourceFormat = 'object';
      console.log(`[processRouletteData - ${rouletteIdForLog}] Usando 'roulette.numbers' como fonte.`);
  } else if (Array.isArray(roulette.numero) && roulette.numero.length > 0) {
      sourceArray = roulette.numero;
      // Detectar se é array de números ou de objetos {numero: ...}
      if (sourceArray.length > 0 && typeof sourceArray[0] === 'object' && sourceArray[0] !== null && typeof sourceArray[0].numero !== 'undefined') {
          sourceFormat = 'nested_object'; // Array de objetos {numero: ...}
          console.log(`[processRouletteData - ${rouletteIdForLog}] Usando 'roulette.numero' (array de objetos) como fonte.`);
      } else if (sourceArray.length > 0 && typeof sourceArray[0] === 'number') {
          sourceFormat = 'number'; // Array de números simples
          console.log(`[processRouletteData - ${rouletteIdForLog}] Usando 'roulette.numero' (array de números) como fonte.`);
      } else {
           console.log(`[processRouletteData - ${rouletteIdForLog}] 'roulette.numero' encontrado, mas formato interno não reconhecido.`);
      }
  } else if (currentName && typeof roulette[currentName] === 'object' && roulette[currentName] !== null && Array.isArray(roulette[currentName])) {
      // Checa se existe uma chave com o nome da roleta e se é um array (formato da imagem)
      sourceArray = roulette[currentName];
      if (sourceArray.length > 0 && typeof sourceArray[0] === 'object' && sourceArray[0] !== null && typeof sourceArray[0].numero !== 'undefined') {
          sourceFormat = 'nested_object'; // Assumindo array de objetos {numero: ..., timestamp: ...}
           console.log(`[processRouletteData - ${rouletteIdForLog}] Usando 'roulette[${currentName}]' (array de objetos) como fonte.`);
      } else {
          console.log(`[processRouletteData - ${rouletteIdForLog}] Chave com nome da roleta encontrada ('${currentName}'), mas formato interno não reconhecido.`);
      }
  } else {
      console.log(`[processRouletteData - ${rouletteIdForLog}] Nenhuma fonte de números válida ('numbers', 'numero', ou chave '${currentName}') encontrada.`);
  }
  console.log(`[processRouletteData - ${rouletteIdForLog}] Array fonte para números:`, JSON.stringify(sourceArray), `Formato: ${sourceFormat}`);

  // 2. Mapear o array fonte para o formato { numero: number, timestamp: string }
  const numerosComTimestamp: RouletteNumber[] = sourceArray.map((item: any) => {
    let numero: number | null = null;
    let timestamp: string | null | undefined = null;

    if (sourceFormat === 'object' && typeof item === 'object' && item !== null) {
      numero = Number(item.number); // Vem de roulette.numbers
      timestamp = item.timestamp;
    } else if (sourceFormat === 'nested_object' && typeof item === 'object' && item !== null) {
      numero = Number(item.numero); // Vem de roulette.numero (obj) ou roulette[nome] (obj)
      timestamp = item.timestamp;
    } else if (sourceFormat === 'number') {
      numero = Number(item); // Vem de roulette.numero (num)
      timestamp = roulette.timestamp; // Tenta usar timestamp global
    }

    // Fallback/Default para timestamp
    let timeString = "--:--";
    if (timestamp) {
        try {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                 timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } else {
                console.warn(`[processRouletteData - ${rouletteIdForLog}] Timestamp inválido recebido:`, timestamp);
            }
        } catch (e) {
            console.error(`[processRouletteData - ${rouletteIdForLog}] Erro ao processar timestamp:`, timestamp, e);
        }
    } else if (sourceFormat !== 'number' && typeof item === 'object' && item?.timestamp) {
         // Fallback se o timestamp principal falhou mas existe no item (redundante mas seguro)
          try {
             const date = new Date(item.timestamp);
             if (!isNaN(date.getTime())) {
                  timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
             }
         } catch {} 
    }

    const finalNumero = (numero === null || isNaN(numero)) ? -1 : numero;

    return {
      numero: finalNumero,
      timestamp: timeString
    };
  })
  // Filtrar números inválidos
  .filter(n => n.numero !== -1 && n.numero >= 0 && n.numero <= 36);

  // Ordenar por timestamp DESCENDENTE (mais recente primeiro) se houver timestamps válidos
  // É crucial que o timestamp no map() seja pego corretamente
  if (numerosComTimestamp.every(n => n.timestamp !== '--:--') && sourceFormat !== 'number') {
      numerosComTimestamp.sort((a, b) => {
          // Precisamos converter de volta para comparar, ou usar o timestamp original se guardado
          // Por simplicidade, vamos assumir que a ordem original da API está correta (mais recente primeiro)
          // Se a ordem estiver errada, precisaria de um timestamp original para ordenar aqui.
          return 0; // Mantém a ordem original por enquanto
      });
      // console.log(`[processRouletteData - ${rouletteIdForLog}] Números ordenados (se necessário).`);
  }

  console.log(`[processRouletteData - ${rouletteIdForLog}] Números processados com timestamp (primeiros 10):`, numerosComTimestamp.slice(0, 10));

  // 3. Obter outros dados
  const ultimoNumero = numerosComTimestamp.length > 0 ? numerosComTimestamp[0].numero : null;
  const winRate = roulette.winRate !== undefined ? roulette.winRate : Math.random() * 100; // Usar valor real se existir
  const streak = roulette.streak !== undefined ? roulette.streak : Math.floor(Math.random() * 5); // Usar valor real se existir
  const finalUpdateTime = roulette.lastUpdateTime || roulette.timestamp ? new Date(roulette.lastUpdateTime || roulette.timestamp).getTime() : Date.now();
  const currentProvider = roulette.provider || 'Desconhecido';
  const currentStatus = roulette.status || (numerosComTimestamp.length > 0 ? 'online' : 'offline'); // Inferir status se não vier

  const result: ProcessedRouletteData = {
    id: currentId,
    nome: currentName || 'Roleta Desconhecida',
    provider: currentProvider,
    status: currentStatus,
    ultimoNumero: ultimoNumero,
    numeros: numerosComTimestamp.slice(0, 10), // Pega os até 10 números mais recentes já processados
    winRate: winRate,
    streak: streak,
    lastUpdateTime: finalUpdateTime,
  };
  console.log(`[processRouletteData - ${rouletteIdForLog}] Objeto final retornado:`, JSON.stringify(result));
  return result;
};

const RouletteCard: React.FC<RouletteCardProps> = ({ data: initialData, isDetailView = false, onSelect, isSelected }) => {
  // Estados
  const [rouletteData, setRouletteData] = useState<ProcessedRouletteData | null>(() => {
       // Usar função no useState para processar apenas uma vez na montagem inicial
       const processedInitial = processRouletteData(initialData);
       console.log(`[RouletteCard - ${initialData?.id}] Estado inicial definido com:`, processedInitial); // Log 5: Estado inicial
       return processedInitial;
  });
  const [isLoading, setIsLoading] = useState(!rouletteData); // Correto: true se não houver dados iniciais
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
  const safeData = useMemo(() => ({
    id: initialData?.id || initialData?._id || 'unknown',
    name: initialData?.name || initialData?.nome || 'Roleta sem nome',
  }), [initialData]);
  
  // ID único para este componente
  const componentId = useRef(`roulette-${safeData.id}-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Obter instância do UnifiedClient
  const unifiedClient = UnifiedRouletteClient.getInstance();
  
  // Efeito para iniciar a busca de dados
  useEffect(() => {
    console.log(`[${componentId}] useEffect executado. ID: ${safeData.id}`);

    const handleUpdate = (updateData: any) => {
        let myData: any = null;
        if (Array.isArray(updateData)) {
            myData = updateData.find(r => r.id === safeData.id);
        } else if (updateData && updateData.id === safeData.id) {
            myData = updateData;
        }

        if (myData) {
            // console.log(`[${componentId}] Recebendo atualização para ${safeData.name}`, myData);
            const processed = processRouletteData(myData); // Usa a função GLOBAL com logs
            if (processed) {
                 console.log(`[${componentId}] Atualizando estado com dados processados:`, processed); // Log 6: Antes de setRouletteData
                 setRouletteData(currentData => {
                     if (currentData && processed.ultimoNumero !== currentData.ultimoNumero && processed.ultimoNumero !== null) {
                         console.log(`[${componentId}] Novo número detectado: ${processed.ultimoNumero}`);
                         setIsNewNumber(true);
                         setTimeout(() => setIsNewNumber(false), 2000); 
                     }
                     return processed; 
                 });
                 setIsLoading(false);
                 setError(null);
            } else {
                console.error(`[${componentId}] Falha ao processar dados recebidos.`);
                setError('Falha ao processar dados da roleta.');
                setIsLoading(false);
            }
        }
    };

    console.log(`[${componentId}] Verificando dados existentes no UnifiedClient...`);
    const currentDataFromClient = unifiedClient.getRouletteById(safeData.id);
    if (currentDataFromClient) {
        // console.log(`[${componentId}] Dados encontrados no cliente`, currentDataFromClient);
        handleUpdate(currentDataFromClient); 
    } else {
        if (!rouletteData) {
            console.log(`[${componentId}] Sem dados iniciais ou no cliente, definindo isLoading.`);
            setIsLoading(true); 
        } else {
             console.log(`[${componentId}] Usando dados iniciais passados via props.`);
             setIsLoading(false); 
        }
    }

    console.log(`[${componentId}] Assinando evento 'update' do UnifiedClient.`);
    const unsubscribe = unifiedClient.on('update', handleUpdate);

    return () => {
      console.log(`[${componentId}] Desmontando e cancelando inscrição 'update'.`);
      unsubscribe();
    };
  }, [safeData.id, unifiedClient]);
  
  // Adicionar um comentário para garantir que este é o único lugar fazendo requisições:
  // Console.log para verificar se há apenas uma fonte de requisições:
  console.log('[VERIFICAÇÃO DE FONTE ÚNICA] O componente RouletteCard usa apenas UnifiedRouletteClient para obter dados da API.');
  
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

  // Log para verificar o estado antes de renderizar
  console.log(`[${componentId}] Renderizando. Estado rouletteData:`, rouletteData); // Log 7: Estado na renderização

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
  
  // Desestruturação e Renderização Normal
  const { nome, provider, status, ultimoNumero, numeros, winRate, streak, lastUpdateTime } = rouletteData;
  const isOnline = status?.toLowerCase() === 'online';
  console.log(`[${componentId}] Renderizando números:`, numeros); // Log 8: Array de números antes de mapear
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
          {lastNumbersToDisplay.slice(0, 5).map((num, index) => (
            <NumberDisplay 
              key={`${componentId}-num-${index}-${num}`} 
              number={num} 
              size="medium" 
              highlight={index === 0 && isNewNumber}
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