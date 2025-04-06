import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SocketService from '@/services/SocketService';
import EventService from '@/services/EventService';
import { RouletteNumberEvent } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RouletteHistoryProps {
  roletaId: string;
  roletaNome: string;
  initialNumbers?: number[];
}

// Função para determinar a cor com base no número
const getNumberColor = (num: number): string => {
  if (num === 0) return 'bg-green-600 text-white';
  
  // Números vermelhos na roleta
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  
  return redNumbers.includes(num) 
    ? 'bg-red-600 text-white' 
    : 'bg-zinc-900 text-white';
};

// Função para obter classe de estilo com base nas colunas
const getColumnStyle = (num: number): string => {
  if (num === 0) return '';
  
  const column = num % 3;
  if (column === 0) return 'col-3';
  if (column === 1) return 'col-1';
  return 'col-2';
};

// Tipos de visualização
type ViewMode = 'grid' | 'list' | 'stats';

const RouletteHistory: React.FC<RouletteHistoryProps> = ({ 
  roletaId, 
  roletaNome, 
  initialNumbers = [] 
}) => {
  const [historyNumbers, setHistoryNumbers] = useState<number[]>(initialNumbers);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Log inicial para diagnóstico
  console.log(`[RouletteHistory] Inicializando com ${initialNumbers.length} números para ${roletaNome}`);
  
  // Stats
  const [stats, setStats] = useState({
    red: 0,
    black: 0,
    green: 0,
    odd: 0,
    even: 0,
    high: 0,  // 19-36
    low: 0,   // 1-18
    dozens: [0, 0, 0],  // [1-12, 13-24, 25-36]
    columns: [0, 0, 0]  // [col1, col2, col3]
  });
  
  // Atualizar estatísticas quando o histórico muda
  useEffect(() => {
    if (historyNumbers.length === 0) return;
    
    const newStats = {
      red: 0,
      black: 0,
      green: 0,
      odd: 0,
      even: 0,
      high: 0,
      low: 0,
      dozens: [0, 0, 0],
      columns: [0, 0, 0]
    };
    
    historyNumbers.forEach(num => {
      // Verde (zero)
      if (num === 0) {
        newStats.green++;
        return;
      }
      
      // Vermelho ou preto
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      if (redNumbers.includes(num)) {
        newStats.red++;
      } else {
        newStats.black++;
      }
      
      // Par ou ímpar
      if (num % 2 === 0) {
        newStats.even++;
      } else {
        newStats.odd++;
      }
      
      // Alto ou baixo
      if (num >= 1 && num <= 18) {
        newStats.low++;
      } else if (num >= 19 && num <= 36) {
        newStats.high++;
      }
      
      // Dúzias
      if (num >= 1 && num <= 12) {
        newStats.dozens[0]++;
      } else if (num >= 13 && num <= 24) {
        newStats.dozens[1]++;
      } else if (num >= 25 && num <= 36) {
        newStats.dozens[2]++;
      }
      
      // Colunas
      const column = num % 3;
      if (column === 1) {
        newStats.columns[0]++;
      } else if (column === 2) {
        newStats.columns[1]++;
      } else if (column === 0) {
        newStats.columns[2]++;
      }
    });
    
    setStats(newStats);
  }, [historyNumbers]);
  
  // Inscrever-se para receber atualizações de números
  useEffect(() => {
    // Handler para novos números
    const handleNewNumber = (event: RouletteNumberEvent) => {
      if (event.roleta_id === roletaId && typeof event.numero === 'number') {
        console.log(`[RouletteHistory] Novo número recebido para ${roletaNome}: ${event.numero}`);
        setHistoryNumbers(prev => {
          // Verificar se o número já existe no início do array
          if (prev.length > 0 && prev[0] === event.numero) {
            return prev;
          }
          
          // Adicionar no início e limitar a 1000 números
          const newHistory = [event.numero, ...prev].slice(0, 1000);
          return newHistory;
        });
      }
    };
    
    // Inscrever-se para eventos de novos números
    EventService.getInstance().subscribe('new_number', handleNewNumber);
    
    // Buscar histórico inicial se não fornecido
    if (initialNumbers.length === 0) {
      console.log(`[RouletteHistory] Não há números iniciais, buscando para ${roletaId}`);
      SocketService.getInstance().fetchRouletteNumbersREST(roletaId, 200)
        .then(success => {
          if (success) {
            const history = SocketService.getInstance().getRouletteHistory(roletaId);
            console.log(`[RouletteHistory] Dados obtidos com sucesso: ${history.length} números`);
            setHistoryNumbers(history);
          } else {
            console.warn(`[RouletteHistory] Falha ao buscar histórico para ${roletaNome}`);
          }
        })
        .catch(err => {
          console.error(`[RouletteHistory] Erro ao buscar histórico:`, err);
        });
    }
    
    return () => {
      // Limpar inscrição ao desmontar
      EventService.getInstance().unsubscribe('new_number', handleNewNumber);
    };
  }, [roletaId, roletaNome, initialNumbers]);
  
  // Renderizar mensagem se não houver dados
  if (historyNumbers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 rounded-full bg-yellow-100 p-3 text-yellow-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-medium">Nenhum número registrado</h3>
        <p className="mb-4 text-sm text-gray-500">
          Não há histórico disponível para esta roleta no momento.
        </p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => SocketService.getInstance().fetchRouletteNumbersREST(roletaId, 200)}
        >
          Tentar Carregar Novamente
        </Button>
      </div>
    );
  }
  
  // Renderizar grade de números
  const renderGrid = () => {
    return (
      <div className="round-history w-full flex flex-col space-y-2">
        <div className="flex space-x-2">
          <div className="w-full">
            <div className="grid-row flex flex-1 flex-row items-center justify-start gap-2" style={{ minHeight: '50px' }}>
              {/* Células de grade agrupadas em linhas de 15 */}
              {Array.from({ length: Math.min(15, historyNumbers.length) }).map((_, index) => (
                <div key={index} className="group relative flex items-center justify-center" style={{ minWidth: '40px', minHeight: '40px' }}>
                  <div
                    className={`${getNumberColor(historyNumbers[index])} cell-number-${historyNumbers[index]} cell-state-default flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium`}
                  >
                    {historyNumbers[index]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Mostrar mais linhas se expandido */}
        {isExpanded && Array.from({ length: Math.ceil(historyNumbers.length / 15) - 1 }).map((_, rowIndex) => (
          <div key={`row-${rowIndex + 1}`} className="flex space-x-2">
            <div className="w-full">
              <div className="grid-row flex flex-1 flex-row items-center justify-start gap-2" style={{ minHeight: '50px' }}>
                {Array.from({ length: 15 }).map((_, colIndex) => {
                  const numIndex = (rowIndex + 1) * 15 + colIndex;
                  if (numIndex >= historyNumbers.length) return null;
                  
                  return (
                    <div key={numIndex} className="group relative flex items-center justify-center" style={{ minWidth: '40px', minHeight: '40px' }}>
                      <div
                        className={`${getNumberColor(historyNumbers[numIndex])} cell-number-${historyNumbers[numIndex]} cell-state-default flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium`}
                      >
                        {historyNumbers[numIndex]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        
        {historyNumbers.length > 15 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 w-full"
          >
            {isExpanded ? "Mostrar Menos" : `Mostrar Mais (${historyNumbers.length} números)`}
          </Button>
        )}
      </div>
    );
  };
  
  // Renderizar lista simples de números
  const renderList = () => {
    return (
      <ScrollArea className="h-[400px] rounded-md border">
        <div className="grid grid-cols-12 gap-1 p-2">
          {historyNumbers.map((num, index) => (
            <div 
              key={`list-${index}`} 
              className={`${getNumberColor(num)} flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium`}
            >
              {num}
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  };
  
  // Renderizar estatísticas
  const renderStats = () => {
    return (
      <div className="grid grid-cols-2 gap-4 p-4">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium">Cores</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="bg-red-600 text-white px-2 py-1 w-full text-center">
                  Vermelho
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.red}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.red / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="bg-zinc-900 text-white px-2 py-1 w-full text-center">
                  Preto
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.black}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.black / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="bg-green-600 text-white px-2 py-1 w-full text-center">
                  Verde
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.green}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.green / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium">Par/Ímpar</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="px-2 py-1 w-full text-center">
                  Pares
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.even}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.even / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="px-2 py-1 w-full text-center">
                  Ímpares
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.odd}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.odd / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium">Baixo/Alto</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="px-2 py-1 w-full text-center">
                  1-18
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.low}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.low / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="px-2 py-1 w-full text-center">
                  19-36
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.high}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.high / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-sm font-medium">Dúzias</h3>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="px-2 py-1 w-full text-center">
                  1-12
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.dozens[0]}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.dozens[0] / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="px-2 py-1 w-full text-center">
                  13-24
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.dozens[1]}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.dozens[1] / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <Badge variant="outline" className="px-2 py-1 w-full text-center">
                  25-36
                </Badge>
                <span className="mt-1 text-lg font-bold">{stats.dozens[2]}</span>
                <span className="text-xs text-muted-foreground">
                  {historyNumbers.length > 0 ? `${Math.round((stats.dozens[2] / historyNumbers.length) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  
  return (
    <div className="w-full">
      <h2 className="mb-4 text-xl font-bold">Histórico de {roletaNome}</h2>
      <div className="mb-4 flex justify-between items-center">
        <Badge variant="outline" className="px-2 py-1">
          {historyNumbers.length} números registrados
        </Badge>
        <Tabs defaultValue="grid" onValueChange={(value) => setViewMode(value as ViewMode)}>
          <TabsList>
            <TabsTrigger value="grid">Grade</TabsTrigger>
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {viewMode === 'grid' && renderGrid()}
      {viewMode === 'list' && renderList()}
      {viewMode === 'stats' && renderStats()}
    </div>
  );
};

export default RouletteHistory; 