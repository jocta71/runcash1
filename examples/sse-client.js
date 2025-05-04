/**
 * Exemplo de cliente para consumir eventos SSE (Server-Sent Events)
 * Este é um exemplo de como implementar um cliente para receber atualizações 
 * em tempo real do servidor
 * 
 * Para usar no frontend, você pode adaptar este código para seu framework favorito
 */

// Importar a biblioteca de descriptografia (em um projeto real, importaria do arquivo utils)
const { decryptData } = require('../backend/utils/encryption');

/**
 * Função que simula conexão ao servidor SSE e consumo de eventos
 * @param {String} gameType - Tipo de jogo (ex: 'ROULETTE')
 * @param {String} gameId - ID do jogo
 * @param {String} token - Token JWT de autenticação
 */
function conectarAoStream(gameType, gameId, token) {
  // URL do stream, similar ao concorrente
  const url = `http://localhost:5000/stream/rounds/${gameType}/${gameId}/v2/live?k=0`;
  
  console.log(`Conectando ao stream: ${url}`);
  
  // Criação da conexão SSE
  const eventSource = new EventSource(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  // Manipulador de conexão aberta
  eventSource.onopen = (event) => {
    console.log('Conexão estabelecida com o servidor SSE');
  };
  
  // Manipulador de eventos 'update'
  eventSource.addEventListener('update', async (event) => {
    try {
      console.log('Evento recebido:', event.data.substring(0, 50) + '...');
      
      // Descriptografar os dados (format Fe26.2)
      const decryptedData = decryptData(event.data);
      
      // Processar os dados recebidos
      console.log('Dados descriptografados:', JSON.stringify(decryptedData, null, 2));
      
      // Atualizar a interface do usuário com os novos dados
      // Exemplo:
      if (decryptedData.update_type === 'new_number') {
        console.log(`Novo número: ${decryptedData.number.value} (${decryptedData.number.color})`);
        // atualizarInterfaceComNovoNumero(decryptedData.number);
      }
    } catch (error) {
      console.error('Erro ao processar evento:', error);
    }
  });
  
  // Manipulador de erros
  eventSource.onerror = (error) => {
    console.error('Erro na conexão SSE:', error);
    
    // Fechar conexão atual
    eventSource.close();
    
    // Tentar reconectar após um tempo
    console.log('Tentando reconectar em 5 segundos...');
    setTimeout(() => conectarAoStream(gameType, gameId, token), 5000);
  };
  
  // Retornar o objeto EventSource para poder fechar a conexão se necessário
  return eventSource;
}

/**
 * Exemplo de uso:
 * 
 * // 1. Obter token de autenticação através do login
 * const login = async () => {
 *   const response = await fetch('http://localhost:5000/api/auth/login', {
 *     method: 'POST',
 *     headers: {
 *       'Content-Type': 'application/json'
 *     },
 *     body: JSON.stringify({
 *       email: 'usuario@exemplo.com',
 *       password: 'senha123'
 *     })
 *   });
 *   
 *   const data = await response.json();
 *   return data.token;
 * };
 * 
 * // 2. Conectar ao stream
 * login().then(token => {
 *   const stream = conectarAoStream('ROULETTE', '5f8a3e5b7c8d9b1c2d3e4f5a', token);
 *   
 *   // 3. Fechar conexão após um tempo (exemplo)
 *   setTimeout(() => {
 *     console.log('Fechando conexão...');
 *     stream.close();
 *   }, 60000); // 1 minuto
 * });
 */

// Para React, você poderia usar um hook como este:
/*
import { useState, useEffect } from 'react';
import { decryptData } from '../utils/encryption';

function useRouletteStream(gameId, token) {
  const [numbers, setNumbers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!gameId || !token) return;
    
    const url = `http://localhost:5000/stream/rounds/ROULETTE/${gameId}/v2/live?k=0`;
    const eventSource = new EventSource(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };
    
    eventSource.addEventListener('update', async (event) => {
      try {
        const decryptedData = decryptData(event.data);
        
        if (decryptedData.update_type === 'new_number') {
          setNumbers(prev => [decryptedData.number, ...prev].slice(0, 50));
        }
      } catch (error) {
        setError(`Erro ao processar dados: ${error.message}`);
      }
    });
    
    eventSource.onerror = (error) => {
      setIsConnected(false);
      setError(`Erro na conexão: ${error.message || 'Desconhecido'}`);
    };
    
    return () => {
      eventSource.close();
    };
  }, [gameId, token]);
  
  return { numbers, isConnected, error };
}

// No seu componente:
function RouletteComponent() {
  const { numbers, isConnected, error } = useRouletteStream('5f8a3e5b7c8d9b1c2d3e4f5a', userToken);
  
  return (
    <div>
      <div>Status: {isConnected ? 'Conectado' : 'Desconectado'}</div>
      {error && <div>Erro: {error}</div>}
      <ul>
        {numbers.map((number, index) => (
          <li key={index} style={{color: number.color}}>
            {number.value} ({new Date(number.timestamp).toLocaleTimeString()})
          </li>
        ))}
      </ul>
    </div>
  );
}
*/

module.exports = { conectarAoStream }; 