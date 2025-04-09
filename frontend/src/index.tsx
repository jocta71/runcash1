import { DH } from './services/SocketServiceWrapper';

// Tornar o DH disponível globalmente
(window as any).DH = DH; 