import React, { useState, useEffect } from 'react';
import SocketService from '@/services/SocketService';
import EventService from '@/services/EventService';
import { RouletteNumberEvent } from '@/types';
import RouletteSidePanelStats from '@/components/RouletteSidePanelStats';

interface RouletteHistoryProps {
  roletaId: string;
  roletaNome: string;
  initialNumbers?: number[];
  isOpen?: boolean;
  onClose?: () => void;
}

const RouletteHistory: React.FC<RouletteHistoryProps> = ({ 
  roletaId, 
  roletaNome, 
  initialNumbers = [],
  isOpen = false,
  onClose
}) => {
  const [historyNumbers, setHistoryNumbers] = useState<number[]>(initialNumbers);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(isOpen);

  // Sincronizar o estado do modal com o prop isOpen
  useEffect(() => {
    setIsStatsModalOpen(isOpen);
  }, [isOpen]);
  
  // Quando o modal é fechado, notificar o componente pai se onClose estiver definido
  const handleCloseModal = () => {
    setIsStatsModalOpen(false);
    if (onClose) {
      onClose();
    }
  };
  
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
  
  // Componente agora retorna um modal customizado com RouletteSidePanelStats
  return (
    <div className={`fixed inset-0 z-50 ${isStatsModalOpen ? 'flex' : 'hidden'} items-center justify-center bg-black/70`}>
      <div className="bg-gray-900 w-11/12 max-w-6xl h-[90vh] rounded-lg overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h2 className="text-[#00ff00] text-xl font-bold">Estatísticas da {roletaNome}</h2>
          <button 
            onClick={handleCloseModal}
            className="text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <RouletteSidePanelStats
            roletaNome={roletaNome}
            lastNumbers={historyNumbers}
            wins={0}
            losses={0}
          />
        </div>
      </div>
    </div>
  );
};

export default RouletteHistory; 
