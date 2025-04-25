/**
 * Utilitário para testar e comparar diferentes endpoints da API
 * Este módulo é útil para validar a performance dos endpoints otimizados
 */

import { fetchWithCorsSupport } from './api-helpers';

/**
 * Interface para os resultados de teste de endpoint
 */
interface EndpointTestResult {
  endpoint: string;
  successful: boolean;
  responseTime: number;
  dataSize: number;
  itemCount: number;
  error?: string;
}

/**
 * Interface para os resultados completos de teste
 */
interface ComparisonResults {
  timestamp: string;
  results: EndpointTestResult[];
  fastestEndpoint: string;
  smallestResponse: string;
  summary: string;
}

/**
 * Lista de endpoints para teste comparativo
 */
const ENDPOINTS_TO_TEST = [
  {
    name: 'Legacy Endpoint',
    url: '/api/ROULETTES?limit=800&_t={timestamp}&subject=test'
  },
  {
    name: 'Optimized Batch Endpoint',
    url: '/api/roulettes-batch?limit=800&_t={timestamp}&subject=test'
  },
  {
    name: 'Optimized List Endpoint',
    url: '/api/roulettes-list?_t={timestamp}&subject=test'
  }
];

/**
 * Testa um endpoint específico e retorna métricas de performance
 * @param endpointName Nome do endpoint
 * @param endpointUrl URL do endpoint
 * @returns Resultado do teste
 */
async function testarEndpoint(endpointName: string, endpointUrl: string): Promise<EndpointTestResult> {
  console.log(`Testando endpoint: ${endpointName} (${endpointUrl})`);
  
  // Preparar resultado padrão
  const result: EndpointTestResult = {
    endpoint: endpointName,
    successful: false,
    responseTime: 0,
    dataSize: 0,
    itemCount: 0
  };
  
  try {
    // Substituir timestamp
    const url = endpointUrl.replace('{timestamp}', Date.now().toString());
    
    // Medir tempo de início
    const startTime = performance.now();
    
    // Requisição com timeout de 10 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // Fazer requisição
    const response = await fetchWithCorsSupport(url, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'x-test-request': 'true'
      }
    });
    
    clearTimeout(timeoutId);
    
    // Calcular tempo de resposta
    const endTime = performance.now();
    result.responseTime = Math.round(endTime - startTime);
    
    // Verificar se há dados
    if (response) {
      result.successful = true;
      
      // Estimar tamanho da resposta
      const responseText = JSON.stringify(response);
      result.dataSize = new Blob([responseText]).size;
      
      // Contar itens se for um array
      if (Array.isArray(response)) {
        result.itemCount = response.length;
      } else if (typeof response === 'object' && response !== null && 'data' in response && Array.isArray((response as any).data)) {
        result.itemCount = (response as any).data.length;
      }
      
      console.log(`✅ Teste concluído para ${endpointName}: ${result.responseTime}ms, ${result.dataSize} bytes, ${result.itemCount} itens`);
    } else {
      result.error = 'Resposta vazia';
      console.warn(`⚠️ Teste para ${endpointName} retornou resposta vazia`);
    }
  } catch (error: any) {
    result.error = error.message || 'Erro desconhecido';
    console.error(`❌ Erro ao testar ${endpointName}:`, error);
  }
  
  return result;
}

/**
 * Executa testes comparativos entre os endpoints disponíveis
 * @returns Resultados da comparação
 */
export async function compararEndpoints(): Promise<ComparisonResults> {
  console.group('🔍 TESTE COMPARATIVO DE ENDPOINTS');
  console.log('Iniciando testes de performance dos endpoints...');
  
  const results: EndpointTestResult[] = [];
  
  // Testar cada endpoint
  for (const endpoint of ENDPOINTS_TO_TEST) {
    try {
      const result = await testarEndpoint(endpoint.name, endpoint.url);
      results.push(result);
    } catch (error) {
      console.error(`Erro ao testar ${endpoint.name}:`, error);
      results.push({
        endpoint: endpoint.name,
        successful: false,
        responseTime: 0,
        dataSize: 0,
        itemCount: 0,
        error: error.message || 'Erro inesperado'
      });
    }
  }
  
  // Encontrar o endpoint mais rápido e com menor resposta
  const successfulResults = results.filter(r => r.successful);
  
  let fastestEndpoint = 'Nenhum';
  let smallestResponse = 'Nenhum';
  
  if (successfulResults.length > 0) {
    const fastest = successfulResults.reduce((prev, current) => 
      prev.responseTime < current.responseTime ? prev : current
    );
    
    const smallest = successfulResults.reduce((prev, current) => 
      prev.dataSize < current.dataSize ? prev : current
    );
    
    fastestEndpoint = fastest.endpoint;
    smallestResponse = smallest.endpoint;
  }
  
  // Preparar resumo
  let summary = `${successfulResults.length} de ${ENDPOINTS_TO_TEST.length} endpoints funcionaram corretamente.\n`;
  
  if (successfulResults.length > 0) {
    summary += `O endpoint mais rápido foi ${fastestEndpoint}.\n`;
    summary += `O endpoint com menor resposta foi ${smallestResponse}.`;
  } else {
    summary += 'Nenhum endpoint respondeu corretamente.';
  }
  
  console.log('Resultados da comparação:');
  console.table(results);
  console.log(summary);
  console.groupEnd();
  
  return {
    timestamp: new Date().toISOString(),
    results,
    fastestEndpoint,
    smallestResponse,
    summary
  };
}

/**
 * Verifica qual endpoint está sendo usado atualmente pelo sistema
 * Esta função tenta fazer requisições para ambos os endpoints e compara os resultados
 * @returns Informações sobre qual endpoint está sendo usado
 */
export async function verificarEndpointAtual(): Promise<{
  endpointUsado: string;
  status: 'otimizado' | 'legado' | 'fallback' | 'erro';
  mensagem: string;
  tempoResposta: { otimizado?: number; legado?: number };
}> {
  console.group('🔍 VERIFICAÇÃO DE ENDPOINT ATUAL');
  console.log('Verificando qual endpoint está sendo usado atualmente...');
  
  const timestamp = Date.now();
  const resultado = {
    endpointUsado: 'Desconhecido',
    status: 'erro' as 'otimizado' | 'legado' | 'fallback' | 'erro',
    mensagem: '',
    tempoResposta: {} as { otimizado?: number; legado?: number }
  };
  
  // Testar endpoint otimizado
  console.log('Testando endpoint otimizado /api/roulettes-batch...');
  const startTimeOtimizado = performance.now();
  let endpointOtimizadoFuncionando = false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`/api/roulettes-batch?limit=1&_t=${timestamp}&subject=test`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    resultado.tempoResposta.otimizado = Math.round(performance.now() - startTimeOtimizado);
    
    if (response.ok) {
      endpointOtimizadoFuncionando = true;
      console.log(`✅ Endpoint otimizado funcionou! (${resultado.tempoResposta.otimizado}ms)`);
    } else {
      console.log(`❌ Endpoint otimizado retornou status ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Erro ao testar endpoint otimizado: ${error.message}`);
    resultado.tempoResposta.otimizado = Math.round(performance.now() - startTimeOtimizado);
  }
  
  // Testar endpoint legado
  console.log('Testando endpoint legado /api/ROULETTES...');
  const startTimeLegado = performance.now();
  let endpointLegadoFuncionando = false;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`/api/ROULETTES?limit=1&_t=${timestamp}&subject=test`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    resultado.tempoResposta.legado = Math.round(performance.now() - startTimeLegado);
    
    if (response.ok) {
      endpointLegadoFuncionando = true;
      console.log(`✅ Endpoint legado funcionou! (${resultado.tempoResposta.legado}ms)`);
    } else {
      console.log(`❌ Endpoint legado retornou status ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ Erro ao testar endpoint legado: ${error.message}`);
    resultado.tempoResposta.legado = Math.round(performance.now() - startTimeLegado);
  }
  
  // Determinar qual endpoint está sendo usado
  if (endpointOtimizadoFuncionando) {
    resultado.endpointUsado = '/api/roulettes-batch';
    resultado.status = 'otimizado';
    resultado.mensagem = 'O sistema está usando o endpoint otimizado.';
  } else if (endpointLegadoFuncionando) {
    resultado.endpointUsado = '/api/ROULETTES';
    
    if (endpointOtimizadoFuncionando === false) {
      resultado.status = 'fallback';
      resultado.mensagem = 'O sistema está usando o endpoint legado como fallback (o endpoint otimizado falhou).';
    } else {
      resultado.status = 'legado';
      resultado.mensagem = 'O sistema está usando o endpoint legado.';
    }
  } else {
    resultado.endpointUsado = 'Nenhum';
    resultado.status = 'erro';
    resultado.mensagem = 'Nenhum dos endpoints está funcionando! Verifique a conexão com o backend.';
  }
  
  console.log(`📊 Resultado: ${resultado.mensagem}`);
  console.groupEnd();
  
  return resultado;
}

// Expor função para testes via console
(window as any).__compareEndpoints = compararEndpoints;
(window as any).__verificarEndpointAtual = verificarEndpointAtual; 