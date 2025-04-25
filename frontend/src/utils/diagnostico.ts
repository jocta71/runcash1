/**
 * Utilitário de diagnóstico para a aplicação RunCash
 * Este módulo fornece funções para verificar a configuração e o estado da aplicação
 */

import { fetchWithCorsSupport } from './api-helpers';

/**
 * Interface para o resultado do diagnóstico
 */
interface DiagnosticoResult {
  timestamp: string;
  status: 'success' | 'partial' | 'error';
  endpoints: EndpointStatus[];
  env: EnvVariables;
  services: ServiceStatus;
  errors: string[];
}

/**
 * Status de um endpoint específico
 */
interface EndpointStatus {
  endpoint: string;
  status: 'online' | 'offline' | 'unknown';
  responseTime?: number;
  error?: string;
}

/**
 * Variáveis de ambiente relevantes
 */
interface EnvVariables {
  apiBaseUrl: string;
  wsUrl: string;
  sseServerUrl: string;
  currentDomain: string;
}

/**
 * Status dos serviços internos
 */
interface ServiceStatus {
  globalRouletteService: {
    active: boolean;
    lastFetchTime: number | null;
    dataCount: number;
  };
}

/**
 * Lista de endpoints a serem verificados durante o diagnóstico
 */
const ENDPOINTS_TO_CHECK = [
  '/api/ROULETTES?limit=800&subject=filter',    // Endpoint padrão otimizado (atualmente em uso)
  '/api/roulettes-batch',                       // Endpoint otimizado futuro (em desenvolvimento)
  '/api/roulettes-list',                        // Endpoint otimizado futuro (em desenvolvimento)
  '/api/ROULETTES-optimized',
  '/api/health',
  '/api/diagnostico'
];

/**
 * Função principal de diagnóstico
 * @returns Resultado do diagnóstico
 */
export async function realizarDiagnostico(): Promise<DiagnosticoResult> {
  const resultado: DiagnosticoResult = {
    timestamp: new Date().toISOString(),
    status: 'success',
    endpoints: [],
    env: {
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'não definido',
      wsUrl: import.meta.env.VITE_WS_URL || 'não definido',
      sseServerUrl: import.meta.env.VITE_SSE_SERVER_URL || 'não definido',
      currentDomain: window.location.origin,
    },
    services: {
      globalRouletteService: {
        active: false,
        lastFetchTime: null,
        dataCount: 0
      }
    },
    errors: []
  };

  // Verificar serviços internos (se acessível)
  try {
    // Tentativa de acessar o GlobalRouletteService
    // Esta é uma abordagem que pode não funcionar diretamente, 
    // mas exemplifica como o diagnóstico poderia ser implementado
    const globalRouletteService = (window as any).__globalRouletteService;
    
    if (globalRouletteService) {
      resultado.services.globalRouletteService.active = true;
      resultado.services.globalRouletteService.lastFetchTime = globalRouletteService.lastFetchTime || null;
      resultado.services.globalRouletteService.dataCount = globalRouletteService.rouletteData?.length || 0;
    }
  } catch (error) {
    resultado.errors.push(`Erro ao verificar serviços internos: ${error}`);
  }

  // Verificar endpoints
  for (const endpoint of ENDPOINTS_TO_CHECK) {
    const endpointStatus: EndpointStatus = {
      endpoint,
      status: 'unknown'
    };
    
    try {
      const startTime = performance.now();
      
      // Tentar acessar o endpoint com um timeout de 5 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        await fetchWithCorsSupport(endpoint, {
          signal: controller.signal,
          method: 'GET'
        });
        
        clearTimeout(timeoutId);
        
        endpointStatus.status = 'online';
        endpointStatus.responseTime = Math.round(performance.now() - startTime);
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // Verificar se foi um erro de timeout
        if (error.name === 'AbortError') {
          endpointStatus.status = 'offline';
          endpointStatus.error = 'Timeout - O endpoint não respondeu em tempo hábil';
        } else {
          endpointStatus.status = 'offline';
          endpointStatus.error = error.message || 'Erro desconhecido';
        }
        
        resultado.errors.push(`Falha ao acessar ${endpoint}: ${endpointStatus.error}`);
      }
    } catch (error: any) {
      endpointStatus.status = 'offline';
      endpointStatus.error = error.message || 'Erro desconhecido durante a verificação';
      resultado.errors.push(`Erro ao verificar ${endpoint}: ${endpointStatus.error}`);
    }
    
    resultado.endpoints.push(endpointStatus);
  }

  // Determinar status geral
  const endpointsOnline = resultado.endpoints.filter(e => e.status === 'online').length;
  
  if (endpointsOnline === 0) {
    resultado.status = 'error';
  } else if (endpointsOnline < ENDPOINTS_TO_CHECK.length) {
    resultado.status = 'partial';
  }

  return resultado;
}

/**
 * Exibe o resultado do diagnóstico no console
 */
export async function exibirDiagnosticoNoConsole(): Promise<DiagnosticoResult> {
  try {
    console.group('🔍 DIAGNÓSTICO RUNCASH');
    console.log('Iniciando diagnóstico completo da aplicação...');
    console.log('NOTA: Usando endpoint padrão /api/ROULETTES com parâmetros otimizados (limit=800, timestamp, subject=filter)');
    
    const resultado = await realizarDiagnostico();
    
    console.log(`Timestamp: ${resultado.timestamp}`);
    console.log(`Status Geral: ${resultado.status.toUpperCase()}`);
    
    console.group('📡 Endpoints');
    resultado.endpoints.forEach(endpoint => {
      const statusEmoji = endpoint.status === 'online' ? '✅' : endpoint.status === 'offline' ? '❌' : '❓';
      console.log(`${statusEmoji} ${endpoint.endpoint}: ${endpoint.status.toUpperCase()}${endpoint.responseTime ? ` (${endpoint.responseTime}ms)` : ''}`);
      if (endpoint.error) {
        console.log(`   └ Erro: ${endpoint.error}`);
      }
    });
    console.groupEnd();
    
    console.group('🔧 Variáveis de Ambiente');
    console.log(`API Base URL: ${resultado.env.apiBaseUrl}`);
    console.log(`WebSocket URL: ${resultado.env.wsUrl}`);
    console.log(`SSE Server URL: ${resultado.env.sseServerUrl}`);
    console.log(`Domínio Atual: ${resultado.env.currentDomain}`);
    console.groupEnd();
    
    console.group('⚙️ Serviços');
    console.log(`GlobalRouletteService: ${resultado.services.globalRouletteService.active ? 'Ativo' : 'Inativo'}`);
    if (resultado.services.globalRouletteService.active) {
      const lastFetchTime = resultado.services.globalRouletteService.lastFetchTime;
      console.log(`  Última Atualização: ${lastFetchTime ? new Date(lastFetchTime).toLocaleTimeString() : 'Nunca'}`);
      console.log(`  Quantidade de Dados: ${resultado.services.globalRouletteService.dataCount} roletas`);
    }
    console.groupEnd();
    
    if (resultado.errors.length > 0) {
      console.group('❌ Erros');
      resultado.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      console.groupEnd();
    }
    
    console.log('Diagnóstico concluído.');
    console.groupEnd();
    
    return resultado;
  } catch (error) {
    console.error('Erro ao executar diagnóstico:', error);
    throw error;
  }
}

// Função para executar o diagnóstico e exportar os resultados
export async function exportarDiagnostico(): Promise<string> {
  const resultado = await realizarDiagnostico();
  return JSON.stringify(resultado, null, 2);
}

// Exportar uma função que permite iniciar o diagnóstico diretamente do console
(window as any).__runDiagnostic = exibirDiagnosticoNoConsole; 