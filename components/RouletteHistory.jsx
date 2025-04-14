import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export default function RouletteHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Usar ref para acompanhar o último número recebido e evitar duplicatas
  const lastReceivedNumber = useRef(null);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchInitialHistory() {
      try {
        setLoading(true);
        
        // Usar o proxy local em vez da API direta
        const response = await fetch('/api/roulette-history?limit=1000');
        
        if (!response.ok) {
          throw new Error(`Erro ao buscar histórico: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Recebidos ${data.data.length} registros históricos iniciais`);
        
        if (isMounted) {
        setHistory(data.data);
        setError(null);
          
          // Armazenar o último número recebido para evitar duplicatas
          if (data.data && data.data.length > 0) {
            lastReceivedNumber.current = {
              numero: data.data[0].numero,
              roleta: data.data[0].roleta_nome
            };
          }
        }
      } catch (err) {
        console.error('Erro ao carregar histórico inicial:', err);
        if (isMounted) {
        setError(err.message);
        }
      } finally {
        if (isMounted) {
        setLoading(false);
        }
      }
    }

    // Buscar histórico inicial
    fetchInitialHistory();

    // Configurar conexão WebSocket
    const socketURL = import.meta.env.VITE_WS_URL || 'https://backend-production-2f96.up.railway.app';
    console.log(`[RouletteHistory] Conectando ao WebSocket: ${socketURL}`);
    
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      forceNew: true
    });

    // Logger para todos os eventos recebidos (debug)
    const originalOnEvent = newSocket.onevent;
    newSocket.onevent = function(packet) {
      const args = packet.data || [];
      console.log(`[Socket Debug] Evento recebido: ${args[0]}`, args.slice(1));
      originalOnEvent.call(this, packet);
    };

    newSocket.on('connect', () => {
      console.log('[RouletteHistory] Conectado ao servidor WebSocket!');
      
      // Solicitar inscrição para receber atualizações de todas as roletas
      newSocket.emit('subscribe', { channel: 'roulette_updates' });
      
      // Também emitir um evento para solicitar o último número
      newSocket.emit('get_latest_numbers');
      
      if (isMounted) {
        setSocket(newSocket);
      }
    });

    newSocket.on('connect_error', (err) => {
      console.error('[RouletteHistory] Erro de conexão WebSocket:', err);
    });

    // Lidar com eventos específicos do servidor
    newSocket.on('roulette_number', (newData) => {
      console.log('[RouletteHistory] Novo número recebido via WebSocket (roulette_number):', newData);
      processNewNumber(newData);
    });
    
    // Também escutar o evento 'new_number' (nome alternativo)
    newSocket.on('new_number', (newData) => {
      console.log('[RouletteHistory] Novo número recebido via WebSocket (new_number):', newData);
      processNewNumber(newData);
    });
    
    // Escutar evento específico para números
    newSocket.on('number', (newData) => {
      console.log('[RouletteHistory] Novo número recebido via WebSocket (number):', newData);
      processNewNumber(newData);
    });
    
    // Manipular evento genérico 'update'
    newSocket.on('update', (data) => {
      console.log('[RouletteHistory] Atualização genérica recebida (update):', data);
      
      if (data && (data.type === 'roulette_number' || data.type === 'new_number')) {
        processNewNumber(data);
      }
    });
    
    // Manipular evento do backend do Railway
    newSocket.on('message', (data) => {
      console.log('[RouletteHistory] Mensagem recebida do WebSocket (message):', data);
      
      if (typeof data === 'string') {
        try {
          // Tentar interpretar como JSON se for string
          const jsonData = JSON.parse(data);
          processNewNumber(jsonData);
        } catch (e) {
          console.log('[RouletteHistory] Não foi possível analisar a mensagem como JSON');
        }
      } else {
        processNewNumber(data);
      }
    });

    // Função centralizada para processar novos números
    function processNewNumber(data) {
      if (!isMounted) return;
      
      // Registrar cada atualização para debug
      setLastUpdate(new Date().toISOString());
      
      // Garantir que o formato do objeto seja correto
      if (data && typeof data === 'object') {
        // Extrair número, tentando diferentes propriedades possíveis
        const numero = data.numero || data.number || data.value || data.num;
        
        // Se não conseguirmos extrair um número válido, ignorar
        if (numero === undefined || numero === null) {
          console.log('[RouletteHistory] Ignorando dados sem número válido');
          return;
        }
        
        // Extrair nome da roleta
        const roletaNome = 
          data.roleta_nome || 
          data.roulette_name || 
          data.roleta || 
          data.roulette || 
          'Desconhecida';
          
        // Criar objeto formatado
        const formattedData = {
          numero: parseInt(numero),
          cor: data.cor || data.color || getRouletteNumberColor(numero),
          roleta_nome: roletaNome,
          timestamp: data.timestamp || new Date().toISOString()
        };
        
        // Verificar se este é o mesmo número que já recebemos por último
        const isDuplicate = 
          lastReceivedNumber.current && 
          lastReceivedNumber.current.numero === formattedData.numero && 
          lastReceivedNumber.current.roleta === formattedData.roleta_nome;
          
        if (isDuplicate) {
          console.log('[RouletteHistory] Ignorando número duplicado:', formattedData.numero);
          return;
        }
        
        console.log('[RouletteHistory] Adicionando novo número ao histórico:', formattedData);
        
        // Atualizar o último número recebido
        lastReceivedNumber.current = {
          numero: formattedData.numero,
          roleta: formattedData.roleta_nome
        };
        
        // Atualizar o histórico com o novo número
        setHistory(prevHistory => {
          // Criar um novo array com o novo número no início
          const newHistory = [formattedData, ...prevHistory];
          console.log('[RouletteHistory] Novo tamanho do histórico:', newHistory.length);
          return newHistory;
        });
      }
    }

    // Limpar conexão quando o componente for desmontado
    return () => {
      isMounted = false;
      if (newSocket) {
        console.log('[RouletteHistory] Desconectando do WebSocket...');
        newSocket.disconnect();
      }
    };
  }, []);
  
  // Função para formatar data
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  // Função para determinar a cor do número da roleta
  const getRouletteNumberColor = (num) => {
    if (num === undefined || num === null) return 'cinza';
    
    num = parseInt(num);
    if (isNaN(num)) return 'cinza';
    
    if (num === 0) return 'verde';
    
    // Números vermelhos na roleta europeia
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return numerosVermelhos.includes(num) ? 'vermelho' : 'preto';
  };
  
  // Renderizar estado de carregamento
  if (loading && history.length === 0) {
    return <div className="text-center py-10">Carregando histórico...</div>;
  }
  
  // Renderizar erro
  if (error && history.length === 0) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>Erro ao carregar histórico: {error}</p>
        <p>Tente novamente mais tarde.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <h2 className="text-2xl font-bold mb-4">Histórico de Números ({history.length})</h2>
      
      {loading && <p className="text-gray-500 mb-4">Carregando dados iniciais...</p>}
      
      <div className="flex items-center space-x-2 mb-4">
        {socket ? (
          <p className="text-green-500 flex items-center">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Conectado em tempo real
          </p>
        ) : (
          <p className="text-yellow-500 flex items-center">
            <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
            Aguardando conexão...
          </p>
        )}
        
        {lastUpdate && (
          <p className="text-xs text-gray-500">
            Última atualização: {new Date(lastUpdate).toLocaleTimeString()}
          </p>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 border-b">Número</th>
              <th className="py-2 px-4 border-b">Cor</th>
              <th className="py-2 px-4 border-b">Roleta</th>
              <th className="py-2 px-4 border-b">Data/Hora</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item, index) => (
              <tr key={`${item.timestamp}-${index}`} className={index === 0 ? 'bg-green-50 animate-pulse' : 'hover:bg-gray-50'}>
                <td className="py-2 px-4 border-b text-center">
                  <span 
                    className={`inline-block w-8 h-8 rounded-full text-white font-bold flex items-center justify-center
                      ${item.cor === 'vermelho' ? 'bg-red-600' : 
                        item.cor === 'preto' ? 'bg-black' : 
                        item.cor === 'verde' ? 'bg-green-600' : 'bg-gray-600'}`}
                  >
                    {item.numero}
                  </span>
                </td>
                <td className="py-2 px-4 border-b capitalize">{item.cor}</td>
                <td className="py-2 px-4 border-b">{item.roleta_nome}</td>
                <td className="py-2 px-4 border-b">{formatDate(item.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {history.length === 0 && !loading && (
        <p className="text-center py-4">Nenhum histórico disponível.</p>
      )}
    </div>
  );
} 