/**
 * Este arquivo agora reexporta o UnifiedRouletteClient
 * para manter compatibilidade com o código existente
 * 
 * Isso nos permite usar um único cliente unificado para todos os dados de roleta
 */

import UnifiedRouletteClient from "./UnifiedRouletteClient";

// Re-exportar UnifiedRouletteClient como SocketService para manter compatibilidade
export default UnifiedRouletteClient;

// Reexportar tipos compatíveis para manter retrocompatibilidade
// Criando interfaces compatíveis com o antigo SocketService/RESTSocketService
export interface HistoryRequest {
  roleId: string;
  limit?: number;
}

export interface HistoryData {
  numbers: number[];
  timestamps?: string[];
}

// Note: Os tipos HistoryRequest e HistoryData são mantidos para retrocompatibilidade
// com o antigo SocketService/RESTSocketService