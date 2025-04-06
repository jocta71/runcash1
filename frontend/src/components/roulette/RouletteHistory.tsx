import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SocketService from '@/services/SocketService';
import EventService from '@/services/EventService';
import { RouletteNumberEvent } from '@/types';
import RouletteStatsModal from '@/components/RouletteStatsModal';
import { BarChart } from 'lucide-react';

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

const RouletteHistory: React.FC<RouletteHistoryProps> = ({ 
  roletaId, 
  roletaNome, 
  initialNumbers = [] 
}) => {
  const [historyNumbers, setHistoryNumbers] = useState<number[]>(initialNumbers);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  
  // Log inicial para diagnóstico
  console.log(`[RouletteHistory] Inicializando com ${initialNumbers.length} números para ${roletaNome}`);
  
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
  
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Histórico de {roletaNome}</h2>
        <button 
          onClick={() => setIsStatsModalOpen(true)}
          className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
          title="Abrir estatísticas avançadas"
        >
          <BarChart className="h-5 w-5 text-primary" />
        </button>
      </div>

      <Badge variant="outline" className="px-2 py-1 mb-4 inline-block">
        {historyNumbers.length} números registrados
      </Badge>
      
      <div className="flex flex-wrap gap-2">
        {historyNumbers.slice(0, 200).map((num, index) => (
          <div 
            key={index}
            className={`${getNumberColor(num)} flex h-10 w-10 items-center justify-center rounded-full font-medium`}
          >
            {num}
          </div>
        ))}
      </div>
      
      <RouletteStatsModal
        open={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        roletaNome={roletaNome}
        lastNumbers={historyNumbers}
        wins={0}
        losses={0}
      />
    </div>
  );
};

export default RouletteHistory; 