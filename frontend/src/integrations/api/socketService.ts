import io, { Socket } from 'socket.io-client';
import { cache } from './cache';
import { apiBaseUrl } from './config';

// Armazena a instância do socket para reutilização
let socket: Socket | null = null;

/**
 * Conecta ao serviço de socket.io para receber atualizações em tempo real das roletas
 * @returns O id da conexão ou null se falhar
 */
export const connectToSocketService = async (): Promise<string | null> => {
  try {
    // Verificar se já estamos conectados
    if (socket && socket.connected) {
      console.log('[SOCKET] ✅ Já conectado, reutilizando conexão: ' + socket.id);
      return socket.id;
    }

    // Obter token de autenticação
    const authToken = getAuthToken();

    // Definir URL do socket
    const socketUrl = `${apiBaseUrl.replace(/^https?:/, '')}/socket`;
    
    console.log(`[SOCKET] Conectando a ${socketUrl}`);
    
    // Criar opções da conexão socket.io
    const socketOptions = {
      transports: ['websocket'],
      path: '/socket.io',
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 3,
      timeout: 5000,
      query: {
        auth_token: authToken
      }
    };
    
    // Criar nova conexão
    socket = io(socketUrl, socketOptions);
    
    // Registrar handlers para eventos do socket
    socket.on('connect', () => {
      console.log(`[SOCKET] ✅ Conectado com ID: ${socket.id}`);
    });
    
    socket.on('roulette_update', (data: any) => {
      console.log(`[SOCKET] Recebida atualização para roleta: ${data.id}`);
      // Implementar lógica para atualizar dados com cache aqui
      cache.invalidate('roulettes');
      
      // Disparar evento customizado no DOM para notificar todos os componentes
      document.dispatchEvent(new CustomEvent('roulette_data_updated', { detail: data }));
    });
    
    socket.on('disconnect', (reason: string) => {
      console.log(`[SOCKET] Desconectado. Motivo: ${reason}`);
    });
    
    socket.on('error', (error: any) => {
      console.error('[SOCKET] Erro na conexão:', error);
    });
    
    // Retorna o ID da conexão se estiver conectado
    return socket.connected ? socket.id : null;
  } catch (error) {
    console.error('[SOCKET] Erro ao conectar socket:', error);
    return null;
  }
};

/**
 * Obtém o token de autenticação do localStorage ou cookies
 */
function getAuthToken(): string | null {
  // Tentar obter do localStorage
  let token = localStorage.getItem('auth_token');
  
  // Se não encontrar no localStorage, tentar obter dos cookies
  if (!token) {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'auth_token' || name === 'token') {
        token = value;
        break;
      }
    }
  }
  
  return token;
} 