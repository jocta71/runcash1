import { EventSourcePolyfill } from 'event-source-polyfill';
import { decrypt } from '../../utils/encryption';

// Chave para descriptografia dos dados (deve ser a mesma usada no servidor)
// Em produção, esta chave deve ser obtida de forma segura durante o build
const DECRYPTION_KEY = process.env.REACT_APP_DECRYPTION_KEY || 'runcash_secret_encryption_key_32_chars';

// Interface para callbacks de eventos
interface EventCallbacks {
  onInitial?: (data: any) => void;
  onUpdate?: (data: any) => void;
  onHeartbeat?: (data: any) => void;
  onError?: (error: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

// Classe para gerenciar conexões SSE
class StreamingService {
  private eventSource: EventSourcePolyfill | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private url: string;
  private callbacks: EventCallbacks;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000; // ms

  constructor(url: string, callbacks: EventCallbacks) {
    this.url = url;
    this.callbacks = callbacks;
  }

  // Iniciar conexão
  connect() {
    if (this.eventSource) {
      this.disconnect();
    }

    const token = localStorage.getItem('token');
    if (!token) {
      if (this.callbacks.onError) {
        this.callbacks.onError(new Error('No authentication token found'));
      }
      return;
    }

    try {
      // Criar conexão SSE com token de autenticação
      this.eventSource = new EventSourcePolyfill(this.url, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        withCredentials: true,
      });

      // Configurar handlers de eventos
      this.setupEventHandlers();

      // Callback de conexão
      if (this.callbacks.onConnect) {
        this.callbacks.onConnect();
      }

      console.log(`[Streaming] Connected to ${this.url}`);
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('[Streaming] Error connecting:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      this.scheduleReconnect();
    }
  }

  // Configurar handlers de eventos
  private setupEventHandlers() {
    if (!this.eventSource) return;

    // Handler para evento de atualização
    this.eventSource.addEventListener('update', async (event: any) => {
      try {
        // Decifrar dados
        const decryptedData = await this.decryptEventData(event.data);
        console.log('[Streaming] Received update event:', decryptedData);
        
        if (decryptedData.type === 'initial' && this.callbacks.onInitial) {
          this.callbacks.onInitial(decryptedData);
        } else if (this.callbacks.onUpdate) {
          this.callbacks.onUpdate(decryptedData);
        }
      } catch (error) {
        console.error('[Streaming] Error processing update event:', error);
        if (this.callbacks.onError) {
          this.callbacks.onError(error);
        }
      }
    });

    // Handler para heartbeat (manter conexão ativa)
    this.eventSource.addEventListener('heartbeat', async (event: any) => {
      try {
        const decryptedData = await this.decryptEventData(event.data);
        console.log('[Streaming] Heartbeat received:', decryptedData);
        if (this.callbacks.onHeartbeat) {
          this.callbacks.onHeartbeat(decryptedData);
        }
      } catch (error) {
        console.error('[Streaming] Error processing heartbeat:', error);
      }
    });

    // Handler para erros
    this.eventSource.addEventListener('error', (error: any) => {
      console.error('[Streaming] Connection error:', error);
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
      
      // Tentar reconectar
      this.disconnect();
      this.scheduleReconnect();
    });
  }

  // Decifrar dados do evento
  private async decryptEventData(encryptedData: string): Promise<any> {
    try {
      // Usar a biblioteca de criptografia para decifrar os dados
      // Neste exemplo, estamos usando uma função fictícia "decrypt"
      // que deve ser implementada usando a mesma tecnologia do servidor
      const decryptedData = await decrypt(encryptedData, DECRYPTION_KEY);
      return decryptedData;
    } catch (error) {
      console.error('[Streaming] Error decrypting data:', error);
      throw new Error('Failed to decrypt server data. Please refresh or login again.');
    }
  }

  // Agendar reconexão
  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Verificar se excedeu o número máximo de tentativas
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[Streaming] Max reconnect attempts reached');
      return;
    }

    // Aumentar contador de tentativas
    this.reconnectAttempts++;

    // Calcular delay com backoff exponencial
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    console.log(`[Streaming] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    // Agendar reconexão
    this.reconnectTimer = setTimeout(() => {
      console.log('[Streaming] Attempting to reconnect...');
      this.connect();
    }, delay);
  }

  // Desconectar
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[Streaming] Disconnected');
      
      if (this.callbacks.onDisconnect) {
        this.callbacks.onDisconnect();
      }
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Exportar funções para criar conexões de streaming

/**
 * Cria uma conexão de streaming para todas as roletas
 * @param callbacks Funções de callback para eventos
 * @returns Instância do serviço de streaming
 */
export function connectToAllRoulettesStream(callbacks: EventCallbacks) {
  const service = new StreamingService('/api/stream/roulettes', callbacks);
  service.connect();
  return service;
}

/**
 * Cria uma conexão de streaming para uma roleta específica
 * @param rouletteId ID da roleta
 * @param callbacks Funções de callback para eventos
 * @returns Instância do serviço de streaming
 */
export function connectToRouletteStream(rouletteId: string, callbacks: EventCallbacks) {
  const service = new StreamingService(`/api/stream/roulettes/${rouletteId}`, callbacks);
  service.connect();
  return service;
} 