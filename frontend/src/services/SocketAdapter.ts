/**
 * SocketAdapter.ts
 * 
 * Este adaptador permite a troca entre implementações de socket
 * Agora utiliza UnifiedRouletteClient que combina streaming e REST API
 */

import UnifiedRouletteClient from './UnifiedRouletteClient';

// Exportar o serviço UnifiedRouletteClient como implementação padrão
export default UnifiedRouletteClient;

// Nota: Este arquivo serve como ponto de entrada único para os serviços de roleta.
// Importe este arquivo em vez de acessar UnifiedRouletteClient diretamente. 