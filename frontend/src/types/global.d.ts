import RouletteFeedService from '../services/RouletteFeedService';
import SocketService from '../services/SocketService';
import EventService from '../services/EventService';

// Adiciona propriedades personalizadas ao objeto Window global
interface Window {
  // Flag para controlar a inicialização do sistema de roletas
  ROULETTE_SYSTEM_INITIALIZED: boolean;
  
  // Funções para verificar e obter o sistema de roletas
  isRouletteSystemInitialized: () => boolean;
  getRouletteSystem: () => {
    socketService: SocketService;
    rouletteFeedService: RouletteFeedService;
    eventService: EventService;
  } | null;
}

// Interfaces para dados de roleta
export interface RouletteNumber {
  numero: number;
  cor?: string;
  timestamp?: string;
}

export interface RouletteData {
  id: string;
  _id?: string;
  canonicalId?: string;
  nome: string;
  name?: string;
  numero?: any[];
  lastNumbers?: number[];
  estado_estrategia?: string;
  vitorias?: number;
  derrotas?: number;
}

// Evento de número de roleta
export interface RouletteNumberEvent {
  type: string;
  roleta_id: string;
  roleta_nome: string;
  numero: any;
  timestamp: string;
} 