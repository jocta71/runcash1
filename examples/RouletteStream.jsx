import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Utilitário de criptografia
const decryptData = async (encryptedData) => {
  try {
    // Em produção, esta função seria importada do módulo de criptografia
    // Aqui é apenas um placeholder que simula a descriptografia
    // A implementação real depende do seu backend
    
    // Analisar o formato "Fe26.2*..."
    const parts = encryptedData.split('*');
    if (parts.length < 6 || parts[0] !== 'Fe26.2') {
      throw new Error('Formato de dados inválido');
    }
    
    // Em produção, você descriptografaria os dados aqui
    // Por simplicidade, retornamos um objeto simulado
    return {
      id: 'exemplo-roleta-id',
      type: 'ROULETTE',
      update_type: 'new_number',
      number: {
        value: Math.floor(Math.random() * 36), // Simular número aleatório
        color: ['red', 'black', 'green'][Math.floor(Math.random() * 3)],
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Erro ao descriptografar dados:', error);
    throw error;
  }
};

/**
 * Hook personalizado para conectar ao stream SSE da roleta
 */
function useRouletteStream(gameId, token) {
  const [numbers, setNumbers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  
  useEffect(() => {
    // Verificar se temos os parâmetros necessários
    if (!gameId || !token) {
      setError('ID do jogo e token são obrigatórios');
      return;
    }
    
    // URL do stream
    const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/stream/rounds/ROULETTE/${gameId}/v2/live?k=3`;
    
    let eventSource = null;
    
    try {
      // Criar objeto EventSource com cabeçalhos personalizados
      // Nota: EventSource nativo não suporta cabeçalhos, então usamos um proxy ou biblioteca
      
      // OPÇÃO 1: Usando biblioteca externa como 'event-source-polyfill'
      // const EventSourcePolyfill = require('event-source-polyfill').EventSourcePolyfill;
      // eventSource = new EventSourcePolyfill(url, {
      //   headers: {
      //     'Authorization': `Bearer ${token}`
      //   }
      // });
      
      // OPÇÃO 2: Para simplificar este exemplo, usamos EventSource padrão
      // e passamos o token como parâmetro de consulta (não ideal para produção)
      eventSource = new EventSource(`${url}&token=${encodeURIComponent(token)}`);
      
      // Manipulador de conexão aberta
      eventSource.onopen = () => {
        console.log('Conexão SSE estabelecida');
        setIsConnected(true);
        setError(null);
      };
      
      // Manipulador de eventos 'update'
      eventSource.addEventListener('update', async (event) => {
        try {
          console.log('Evento recebido:', event.data.substring(0, 50) + '...');
          
          // Descriptografar os dados
          const decryptedData = await decryptData(event.data);
          
          // Processar os dados recebidos
          if (decryptedData.update_type === 'new_number') {
            // Adicionar novo número ao início da lista
            setNumbers(prev => {
              const newNumbers = [decryptedData.number, ...prev];
              // Manter apenas os últimos 50 números para performance
              return newNumbers.slice(0, 50);
            });
            
            // Atualizar timestamp da última atualização
            setLastUpdate(new Date());
          }
        } catch (error) {
          console.error('Erro ao processar evento:', error);
          setError(`Erro ao processar dados: ${error.message}`);
        }
      });
      
      // Manipulador de erros
      eventSource.onerror = (error) => {
        console.error('Erro na conexão SSE:', error);
        setIsConnected(false);
        setError(`Erro na conexão: ${error.message || 'Desconhecido'}`);
        
        // Tentar reconectar automaticamente
        if (eventSource) {
          eventSource.close();
        }
      };
    } catch (error) {
      console.error('Erro ao configurar EventSource:', error);
      setError(`Erro ao configurar conexão: ${error.message}`);
    }
    
    // Limpar ao desmontar componente
    return () => {
      if (eventSource) {
        console.log('Fechando conexão SSE...');
        eventSource.close();
      }
    };
  }, [gameId, token]); // Reconectar se gameId ou token mudarem
  
  return { numbers, isConnected, error, lastUpdate };
}

/**
 * Componente para exibir números da roleta em tempo real
 */
function RouletteStream({ gameId, token }) {
  const { numbers, isConnected, error, lastUpdate } = useRouletteStream(gameId, token);
  
  return (
    <div className="roulette-stream">
      <div className="stream-status">
        <span 
          className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
        />
        Status: {isConnected ? 'Conectado' : 'Desconectado'}
        {lastUpdate && (
          <span className="last-update">
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>
      
      {error && (
        <div className="stream-error">
          Erro: {error}
        </div>
      )}
      
      <div className="numbers-container">
        <h3>Últimos números</h3>
        {numbers.length === 0 ? (
          <p>Aguardando dados...</p>
        ) : (
          <div className="numbers-grid">
            {numbers.map((number, index) => (
              <div 
                key={index} 
                className={`number-box ${number.color}`}
                title={new Date(number.timestamp).toLocaleString()}
              >
                {number.value}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <style jsx>{`
        .roulette-stream {
          padding: 20px;
          border-radius: 8px;
          background: #f5f5f5;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .stream-status {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .status-indicator {
          display: inline-block;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 8px;
        }
        
        .connected {
          background: #4CAF50;
          box-shadow: 0 0 5px #4CAF50;
        }
        
        .disconnected {
          background: #F44336;
          box-shadow: 0 0 5px #F44336;
        }
        
        .last-update {
          margin-left: 15px;
          font-size: 0.9em;
          color: #666;
        }
        
        .stream-error {
          padding: 10px;
          border-radius: 4px;
          background: #ffebee;
          color: #c62828;
          margin-bottom: 15px;
        }
        
        .numbers-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .number-box {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
        }
        
        .red {
          background: #D32F2F;
        }
        
        .black {
          background: #212121;
        }
        
        .green {
          background: #388E3C;
        }
      `}</style>
    </div>
  );
}

/**
 * Exemplo de uso no App:
 * 
 * function App() {
 *   const [token, setToken] = useState('');
 *   const [gameId, setGameId] = useState('');
 *   
 *   // Função de login simplificada
 *   const login = async () => {
 *     try {
 *       const response = await axios.post('/api/auth/login', {
 *         email: 'usuario@exemplo.com',
 *         password: 'senha123'
 *       });
 *       
 *       if (response.data && response.data.token) {
 *         setToken(response.data.token);
 *       }
 *     } catch (error) {
 *       console.error('Erro ao fazer login:', error);
 *     }
 *   };
 *   
 *   // Carregar roletas disponíveis
 *   const loadRoulettes = async () => {
 *     try {
 *       const response = await axios.get('/api/roulettes', {
 *         headers: { Authorization: `Bearer ${token}` }
 *       });
 *       
 *       if (response.data && response.data.data && response.data.data.length > 0) {
 *         setGameId(response.data.data[0].id);
 *       }
 *     } catch (error) {
 *       console.error('Erro ao carregar roletas:', error);
 *     }
 *   };
 *   
 *   useEffect(() => {
 *     if (token) {
 *       loadRoulettes();
 *     }
 *   }, [token]);
 *   
 *   return (
 *     <div className="App">
 *       <header>
 *         <h1>App de Roleta</h1>
 *         {!token && (
 *           <button onClick={login}>Login</button>
 *         )}
 *       </header>
 *       
 *       <main>
 *         {token && gameId ? (
 *           <RouletteStream gameId={gameId} token={token} />
 *         ) : (
 *           <p>Faça login para ver os dados da roleta</p>
 *         )}
 *       </main>
 *     </div>
 *   );
 * }
 */

export default RouletteStream; 