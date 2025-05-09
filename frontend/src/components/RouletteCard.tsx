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
  // Log inicial simplificado para evitar sobrecarga no console com JSON gigante
  console.log(`[processRouletteData - ${rouletteIdForLog}] Iniciando processamento para '${rouletteNameForLog}'. Keys recebidas:`, roulette ? Object.keys(roulette) : 'null');

  if (!roulette || !(roulette.id || roulette.roleta_id)) {
    console.warn(`[processRouletteData - ${rouletteIdForLog}] Dados inválidos ou sem ID.`);
    return null;
  }

  const currentId = roulette.id || roulette.roleta_id;
  // Priorizar o nome real da roleta (roleta_nome), apenas construir nome genérico se não existir
  const currentName = roulette.roleta_nome || roulette.nome || roulette.name || `Roleta ${currentId}`;

  // 1. Identificar a fonte primária dos números
  let potentialSources = [
    { key: 'numbers', data: roulette.numbers },
    { key: 'numero', data: roulette.numero },
    { key: 'lastNumbers', data: roulette.lastNumbers }, // Adicionado fallback para lastNumbers
  ];

  let sourceArray: any[] = [];
  let sourceKey: string = 'none';
  let itemFormat: 'object_number' | 'object_numero' | 'number' | 'unknown' = 'unknown';

  for (const source of potentialSources) {
    if (Array.isArray(source.data) && source.data.length > 0) {
      sourceArray = source.data;
      sourceKey = source.key;
      console.log(`[processRouletteData - ${rouletteIdForLog}] Usando '${sourceKey}' como fonte de números.`);
      
      // Determinar formato do item dentro do array encontrado
      const firstItem = sourceArray[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
          if (typeof firstItem.number !== 'undefined') {
              itemFormat = 'object_number'; // formato { number: ..., timestamp: ... }
          } else if (typeof firstItem.numero !== 'undefined') {
              itemFormat = 'object_numero'; // formato { numero: ..., timestamp: ... }
    } else {
              itemFormat = 'unknown';
              console.warn(`[processRouletteData - ${rouletteIdForLog}] Array '${sourceKey}' contém objetos, mas sem 'number' ou 'numero'.`);
          }
      } else if (typeof firstItem === 'number') {
          itemFormat = 'number'; // formato [1, 2, 3]
      } else {
           itemFormat = 'unknown';
           console.warn(`[processRouletteData - ${rouletteIdForLog}] Array '${sourceKey}' contém itens de formato não reconhecido:`, typeof firstItem);
      }
      break; // Encontrou uma fonte válida, para a busca
    }
  }

  if (sourceKey === 'none') {
    console.log(`[processRouletteData - ${rouletteIdForLog}] Nenhuma fonte de números ('numbers', 'numero', 'lastNumbers') encontrada ou array vazio.`);
    // Se não achou fonte, retorna null para não sobrescrever dados possivelmente bons
    console.warn(`[processRouletteData - ${rouletteIdForLog}] Retornando null pois nenhuma fonte de números foi encontrada.`);
    return null; 
  }
  console.log(`[processRouletteData - ${rouletteIdForLog}] Fonte: '${sourceKey}', Formato Item: '${itemFormat}', Total Itens: ${sourceArray.length}`);

  // 2. Mapear o array fonte para o formato { numero: number, timestamp: string }
  const numerosComTimestamp: RouletteNumber[] = sourceArray.map((item: any) => {
    let numero: number | null = null;
    let timestamp: string | null | undefined = null;

    // Extrair número baseado no formato detectado
    if (itemFormat === 'object_number' && typeof item === 'object') {
        numero = Number(item.number);
        timestamp = item.timestamp;
    } else if (itemFormat === 'object_numero' && typeof item === 'object') {
        numero = Number(item.numero);
        timestamp = item.timestamp;
    } else if (itemFormat === 'number') {
        numero = Number(item);
        timestamp = roulette.timestamp; // Tenta usar timestamp global para arrays de números simples
    }

    // Fallback/Default para timestamp
    let timeString = "--:--";
    if (timestamp) {
        try {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                 timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } else {
                // Não loga warning para cada timestamp inválido para não poluir muito
                // console.warn(`[processRouletteData - ${rouletteIdForLog}] Timestamp inválido recebido:`, timestamp);
            }
        } catch (e) {
            // console.error(`[processRouletteData - ${rouletteIdForLog}] Erro ao processar timestamp:`, timestamp, e);
        }
    } else if ((itemFormat === 'object_number' || itemFormat === 'object_numero') && typeof item === 'object' && item?.timestamp) {
         // Fallback se timestamp principal falhou mas existe no item
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
  // Filtrar números inválidos (incluindo os que não foram extraídos corretamente)
  .filter(n => n.numero !== -1 && n.numero >= 0 && n.numero <= 36);
  
  // Ordenação removida por enquanto, confiando na ordem da API

  console.log(`[processRouletteData - ${rouletteIdForLog}] Números processados válidos (primeiros 10):`, numerosComTimestamp.slice(0, 10));

  // Adicionar verificação extra: Se após processar, não sobrar nenhum número válido
  // e a fonte original foi encontrada, ainda assim pode ser útil retornar os outros dados.
  // A decisão de retornar null deve ser apenas se a FONTE não foi encontrada.

  // 3. Obter outros dados (sem alterações aqui)
  const ultimoNumero = numerosComTimestamp.length > 0 ? numerosComTimestamp[0].numero : null;
  const winRate = roulette.winRate !== undefined ? roulette.winRate : Math.random() * 100; // Usar valor real se existir
  const streak = roulette.streak !== undefined ? roulette.streak : Math.floor(Math.random() * 5); // Usar valor real se existir
  const finalUpdateTime = roulette.lastUpdateTime || roulette.timestamp ? new Date(roulette.lastUpdateTime || roulette.timestamp).getTime() : Date.now();
  const currentProvider = roulette.provider || 'Desconhecido';
  const currentStatus = roulette.status || (numerosComTimestamp.length > 0 ? 'online' : 'offline'); // Inferir status se não vier

  const result: ProcessedRouletteData = {
    id: currentId,
    nome: currentName,
    provider: currentProvider,
    status: currentStatus,
    ultimoNumero: ultimoNumero,
    numeros: numerosComTimestamp.slice(0, 10),
    winRate: winRate,
    streak: streak,
    lastUpdateTime: finalUpdateTime,
  };
  console.log(`[processRouletteData - ${rouletteIdForLog}] Objeto final retornado...`);
  return result;
};

// Renomear o componente para evitar o conflito
const RouletteCardTitle = ({ data }: { data: ProcessedRouletteData }) => (
  <div className="flex items-center gap-2">
    <span className="text-lg font-semibold truncate">{data.nome}</span>
    <Badge variant={data.status === 'online' ? 'default' : 'destructive'} className={`ml-auto ${data.status === 'online' ? 'bg-green-500 hover:bg-green-600' : ''}`}>
      {data.status === 'online' ? 'Online' : 'Offline'}
    </Badge>
  </div>
);

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
    const componentId = `roulette-${safeData.id}-${Math.random().toString(36).substring(2, 9)}`; 
    console.log(`[${componentId}] useEffect executado. ID: ${safeData.id}`);

    const handleUpdate = (updateData: any) => {
        // <<< Log 1: Verificar se o handleUpdate é chamado e o que recebe >>>
        console.log(`[${componentId}] handleUpdate chamado para roleta ${safeData.id}`, 
            updateData ? (typeof updateData === 'object' ? Object.keys(updateData) : typeof updateData) : 'null');
        
        try {
            // Se a atualização for para esta roleta específica
            if (updateData && 
                (updateData.id === safeData.id || 
                 updateData.roleta_id === safeData.id ||
                 (updateData.type === 'new_number' && updateData.roleta_id === safeData.id))) {
                
                console.log(`[${componentId}] Processando atualização para roleta ${safeData.id}`);
                
                // Processar os dados atualizados
                let processedData;
                
                // Verificar se o evento é do tipo 'new_number' (formato SSE)
                if (updateData.type === 'new_number') {
                    console.log(`[${componentId}] Recebido evento SSE new_number:`, updateData.numero);
                    
                    // Construir objeto no formato esperado pelo processador
                    const currentData = rouletteData || { numeros: [], nome: safeData.name };
                    
                    // Se o número já está nos dados atuais, não adicionar duplicado
                    const numeroJaExiste = currentData.numeros && 
                                          currentData.numeros.some(n => n.numero === updateData.numero);
                    
                    if (numeroJaExiste) {
                        console.log(`[${componentId}] Número ${updateData.numero} já existe, ignorando duplicação`);
                        return;
                    }
                    
                    const newData = {
                        ...currentData,
                        id: updateData.roleta_id,
                        nome: updateData.roleta_nome || currentData.nome,
                        numbers: [
                            { 
                                number: updateData.numero, 
                                timestamp: updateData.timestamp || new Date().toISOString()
                            },
                            ...(currentData.numeros || []).map(n => ({ 
                                number: n.numero, 
                                timestamp: n.timestamp 
                            }))
                        ],
                        // Atualizar timestamp
                        lastUpdateTime: Date.now()
                    };
                    
                    console.log(`[${componentId}] Dados preparados para processamento:`, 
                                { id: newData.id, nome: newData.nome, numbers: newData.numbers.length });
                    
                    processedData = processRouletteData(newData);
                    
                    if (processedData) {
                        // Definir flag para tocar som apenas se processamos o dado com sucesso
                        setIsNewNumber(true);
                        
                        // Pequena animação visual
                        if (cardRef.current) {
                            cardRef.current.classList.add('card-updated');
                            setTimeout(() => {
                                if (cardRef.current) {
                                    cardRef.current.classList.remove('card-updated');
                                }
                            }, 1000);
                        }
                    }
                } else {
                    // Formato normal de dados
                    processedData = processRouletteData(updateData);
                }
                
                if (processedData) {
                    console.log(`[${componentId}] ✅ Atualizando estado com novos dados:`, 
                                processedData.numeros?.[0]?.numero);
                    
                    setRouletteData(processedData);
                    setIsLoading(false);
                    setError(null);
                    
                    // Incrementar contador de atualizações
                    setUpdateCount(prev => prev + 1);
                } else {
                    console.warn(`[${componentId}] ❌ Falha ao processar dados:`, 
                                 JSON.stringify(updateData).substring(0, 100));
                }
            }
        } catch (error) {
            console.error(`[${componentId}] Erro ao processar atualização:`, error);
        }
    };
    
    // Registrar para a atualização global, usando o ID como chave
    EventBus.on(`roulette:update:${safeData.id}`, handleUpdate);
    
    // Registrar para qualquer atualização individual
    unifiedClient.on('update:' + safeData.id, handleUpdate);
    
    // IMPORTANTE: Registrar para os eventos gerais também
    unifiedClient.on('update', (data) => {
        // Filtrar apenas eventos para esta roleta
        if (Array.isArray(data)) {
            const myData = data.find(r => (r.id || r.roleta_id) === safeData.id);
            if (myData) {
                handleUpdate(myData);
            }
        }
    });
    
    // Registrar para atualizações em tempo real via SSE
    import('../services/SocketService').then(module => {
        const SocketService = module.default;
        const socketService = SocketService.getInstance();
        
        // Registrar para atualizações desta roleta específica
        socketService.subscribe(safeData.name, handleUpdate);
        
        // Também registrar para o ID da roleta caso o nome seja diferente
        if (safeData.id !== safeData.name) {
            socketService.subscribe(safeData.id, handleUpdate);
        }
        
        // Registrar para eventos globais (*)
        socketService.subscribe('*', (event) => {
            // Filtrar apenas eventos para esta roleta
            if (event && event.roleta_id === safeData.id) {
                handleUpdate(event);
            }
        });
        
        console.log(`[${componentId}] Registrado para eventos SSE da roleta: ${safeData.name}`);
    }).catch(error => {
        console.error(`[${componentId}] Erro ao importar SocketService:`, error);
    });
    
    // Registrar para eventos do EventService
    import('../services/EventService').then(module => {
        const EventService = module.EventService;
        const eventService = EventService.getInstance();
        
        // Registrar para atualizações específicas desta roleta
        eventService.subscribe(safeData.name, handleUpdate);
        
        // Também registrar para o ID como alternativa
        if (safeData.id !== safeData.name) {
            eventService.subscribe(safeData.id, handleUpdate);
        }
        
        // Registrar para eventos globais
        eventService.subscribeToGlobalEvents((event) => {
            if (event && event.roleta_id === safeData.id) {
                handleUpdate(event);
            }
        });
        
        console.log(`[${componentId}] Registrado para eventos do EventService para roleta: ${safeData.name}`);
    }).catch(error => {
        console.error(`[${componentId}] Erro ao importar EventService:`, error);
    });
    
    // Limpar timers e listeners na desmontagem
    return () => {
        // Remover listeners de eventos
        EventBus.off(`roulette:update:${safeData.id}`, handleUpdate);
        unifiedClient.off('update:' + safeData.id, handleUpdate);
        unifiedClient.off('update', handleUpdate);
        
        // Limpar timers
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        
        // Limpar qualquer solicitação pendente
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        // Desinscrever dos serviços (versão segura)
        try {
            import('../services/SocketService').then(module => {
                const SocketService = module.default;
                const socketService = SocketService.getInstance();
                socketService.unsubscribe(safeData.name, handleUpdate);
                if (safeData.id !== safeData.name) {
                    socketService.unsubscribe(safeData.id, handleUpdate);
                }
                socketService.unsubscribe('*', handleUpdate);
            }).catch(() => {});
            
            import('../services/EventService').then(module => {
                const EventService = module.EventService;
                const eventService = EventService.getInstance();
                eventService.unsubscribe(safeData.name, handleUpdate);
                if (safeData.id !== safeData.name) {
                    eventService.unsubscribe(safeData.id, handleUpdate);
                }
                eventService.unsubscribeFromGlobalEvents(handleUpdate);
            }).catch(() => {});
        } catch (e) {
            console.error(`[${componentId}] Erro ao desinscrever:`, e);
        }
    };
}, [safeData.id, safeData.name]);

// Efeito para tocar som quando um novo número chega (somente via SSE)
useEffect(() => {
    if (isNewNumber && enableSound) {
        // Tocar som de atualização
        try {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => {
                    console.warn('[RouletteCard] Erro ao tocar som:', e);
                });
            }
        } catch (e) {
            console.error('[RouletteCard] Erro ao manipular áudio:', e);
        }
        
        // Resetar flag
        setIsNewNumber(false);
    }
}, [isNewNumber, enableSound]);

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
    onClick={handleCardClick}
    className={cn(
      "relative h-full w-full transition-all group",
      {
        'border-primary border-2': isSelected,
        'cursor-pointer hover:border-primary hover:shadow-md': !isDetailView,
        'shadow-inner bg-muted/40': isDetailView,
        'animate-shake': isNewNumber
      }
    )}
  >
    {loadingTimeout && (
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm font-medium">Carregando dados...</span>
      </div>
    )}

    <CardHeader className="p-3 pb-0">
      {/* Exibe o NOME da roleta ao invés do ID */}
      {rouletteData && <RouletteCardTitle data={rouletteData} />}
      <CardDescription className="text-xs flex justify-between items-center mt-1">
        <span className="opacity-70">{rouletteData?.provider || 'Provedor desconhecido'}</span>
        <span className="text-xs flex items-center gap-1">
          {rouletteData && (
            <span>{getTimeAgo()}</span>
          )}
        </span>
      </CardDescription>
    </CardHeader>

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