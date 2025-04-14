import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
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
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

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
  
  // Configurar WebSocket e buscar dados históricos
  useEffect(() => {
    // Buscar histórico inicial se não fornecido
    const fetchInitialHistory = async () => {
      if (initialNumbers.length === 0) {
        console.log(`[RouletteHistory] Não há números iniciais, buscando para ${roletaId}`);
        try {
          const response = await fetch(`/api/roulette-history?roleta_id=${roletaId}&limit=200`);
          
          if (!response.ok) {
            throw new Error(`Erro ao buscar histórico: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`[RouletteHistory] Dados obtidos com sucesso: ${data.data?.length || 0} números`);
          
          if (data.data && Array.isArray(data.data)) {
            const numbers = data.data.map((item: any) => Number(item.numero)).filter((n: number) => !isNaN(n));
            setHistoryNumbers(numbers);
          }
        } catch (err) {
          console.error(`[RouletteHistory] Erro ao buscar histórico:`, err);
        }
      }
    };
    
    fetchInitialHistory();
    
    // Configurar conexão WebSocket
    const socketURL = import.meta.env.VITE_WEBSOCKET_URL || 'https://runcash-websocket.up.railway.app/';
    console.log(`[RouletteHistory] Conectando ao WebSocket: ${socketURL}`);
    
    const socket = io(socketURL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log(`[RouletteHistory] WebSocket conectado para ${roletaNome}`);
      setSocketConnected(true);
      
      // Inscrever-se para receber atualizações específicas para esta roleta
      socket.emit('subscribe_roulette', { roletaId });
    });
    
    socket.on('connect_error', (err) => {
      console.error(`[RouletteHistory] Erro de conexão WebSocket para ${roletaNome}:`, err);
      setSocketConnected(false);
    });
    
    socket.on('roulette_number', (event) => {
      // Verificar se o evento é para esta roleta
      if (event.roleta_id === roletaId && typeof event.numero === 'number') {
        console.log(`[RouletteHistory] Novo número recebido via WebSocket para ${roletaNome}: ${event.numero}`);
        
        setHistoryNumbers(prev => {
          // Verificar se o número já existe no início do array
          if (prev.length > 0 && prev[0] === event.numero) {
            return prev;
          }
          
          // Adicionar no início e limitar a 1000 números
          const newHistory = [event.numero, ...prev].slice(0, 1000);
          
          // Emitir evento para outros componentes que possam estar interessados
          EventService.getInstance().dispatchEvent({
            type: 'new_number',
            roleta_id: roletaId,
            roleta_nome: roletaNome,
            numero: event.numero,
            timestamp: new Date().toISOString()
          });
          
          return newHistory;
        });
      }
    });
    
    // Limpar conexões ao desmontar
    return () => {
      console.log(`[RouletteHistory] Desconectando WebSocket para ${roletaNome}`);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [roletaId, roletaNome, initialNumbers]);
  
  // Componente retorna um modal customizado com RouletteSidePanelStats
  return (
    <div className={`fixed inset-0 z-50 ${isStatsModalOpen ? 'flex' : 'hidden'} items-center justify-center bg-black/70`}>
      <div className="bg-gray-900 w-11/12 max-w-6xl h-[90vh] rounded-lg overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <div className="flex items-center">
            <h2 className="text-[#00ff00] text-xl font-bold">Estatísticas da {roletaNome}</h2>
            {socketConnected ? (
              <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 mr-1 bg-green-400 rounded-full animate-pulse"></span>
                Ao vivo
              </span>
            ) : (
              <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Offline
              </span>
            )}
          </div>
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