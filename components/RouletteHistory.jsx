import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export default function RouletteHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
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
        
        setHistory(data.data);
        setError(null);
      } catch (err) {
        console.error('Erro ao carregar histórico inicial:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    // Buscar histórico inicial
    fetchInitialHistory();

    // Configurar conexão WebSocket
    const socketURL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'https://runcash-websocket.up.railway.app/';
    const newSocket = io(socketURL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Conectado ao servidor WebSocket!');
    });

    newSocket.on('connect_error', (err) => {
      console.error('Erro de conexão WebSocket:', err);
    });

    newSocket.on('roulette_number', (newData) => {
      console.log('Novo número recebido via WebSocket:', newData);
      setHistory((prevHistory) => [newData, ...prevHistory]);
    });

    setSocket(newSocket);

    // Limpar conexão quando o componente for desmontado
    return () => {
      if (newSocket) {
        console.log('Desconectando do WebSocket...');
        newSocket.disconnect();
      }
    };
  }, []);
  
  // Função para formatar data
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
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
      {socket ? (
        <p className="text-green-500 mb-4">Conectado para atualizações em tempo real</p>
      ) : (
        <p className="text-yellow-500 mb-4">Aguardando conexão em tempo real...</p>
      )}
      
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
              <tr key={`${item.timestamp}-${index}`} className="hover:bg-gray-50">
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