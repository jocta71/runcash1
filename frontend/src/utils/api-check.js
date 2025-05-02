/**
 * Script para verificar o funcionamento da API
 * 
 * Este script tenta acessar diferentes endpoints para verificar
 * se as modificações feitas estão funcionando corretamente.
 */

import axios from 'axios';

// Obter o token do armazenamento local
const getToken = () => {
  try {
    return localStorage.getItem('auth_token') || 
           localStorage.getItem('auth_token_backup') || 
           document.cookie.split(';').find(c => c.trim().startsWith('auth_token='))?.split('=')[1];
  } catch (error) {
    console.error('Erro ao obter token:', error);
    return null;
  }
};

// Verificar status da assinatura
const checkSubscriptionStatus = async () => {
  try {
    console.log('[API-CHECK] Verificando status da assinatura...');
    
    const token = getToken();
    if (!token) {
      console.warn('[API-CHECK] Token não encontrado, usuário não autenticado');
      return null;
    }
    
    const response = await axios.get('/subscription/status', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('[API-CHECK] Resposta do status da assinatura:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API-CHECK] Erro ao verificar status da assinatura:', error);
    
    if (error.response) {
      console.error('Status de erro:', error.response.status);
      console.error('Dados de erro:', error.response.data);
    }
    
    return null;
  }
};

// Verificar acesso à API de roletas
const checkRoulettesAccess = async () => {
  try {
    console.log('[API-CHECK] Verificando acesso à API de roletas...');
    
    const token = getToken();
    if (!token) {
      console.warn('[API-CHECK] Token não encontrado, usuário não autenticado');
      return null;
    }
    
    // Tentar vários endpoints para ver qual funciona
    const endpoints = [
      '/api/ROULETTES',
      '/api/roulettes',
      '/api/roletas'
    ];
    
    let successResponse = null;
    
    for (const endpoint of endpoints) {
      try {
        console.log(`[API-CHECK] Tentando endpoint: ${endpoint}`);
        
        const response = await axios.get(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.status === 200 && Array.isArray(response.data)) {
          console.log(`[API-CHECK] ✅ Endpoint ${endpoint} funcionando: ${response.data.length} roletas`);
          successResponse = {
            endpoint,
            data: response.data,
            message: `Endpoint ${endpoint} funcionando`
          };
          break;
        } else {
          console.warn(`[API-CHECK] ⚠️ Endpoint ${endpoint} respondeu, mas formato inválido:`, response.data);
        }
      } catch (error) {
        console.error(`[API-CHECK] ❌ Erro no endpoint ${endpoint}:`, error.message);
      }
    }
    
    return successResponse;
  } catch (error) {
    console.error('[API-CHECK] Erro ao verificar acesso à API de roletas:', error);
    return null;
  }
};

// Executar verificações e exibir relatório
const runApiCheck = async () => {
  console.log('==========================================');
  console.log('  VERIFICAÇÃO DE ACESSO À API DE ROLETAS  ');
  console.log('==========================================');
  
  // Verificar autenticação
  const token = getToken();
  console.log(`[API-CHECK] Status de autenticação: ${token ? '✅ Autenticado' : '❌ Não autenticado'}`);
  
  // Verificar status da assinatura
  const subscriptionStatus = await checkSubscriptionStatus();
  if (subscriptionStatus) {
    console.log(`[API-CHECK] Status da assinatura: ${
      subscriptionStatus.hasSubscription 
        ? `✅ Ativa (${subscriptionStatus.subscription?.status})`
        : '❌ Inativa'
    }`);
  } else {
    console.log('[API-CHECK] Status da assinatura: ❌ Erro ao verificar');
  }
  
  // Verificar acesso à API de roletas
  const roulettesAccess = await checkRoulettesAccess();
  if (roulettesAccess) {
    console.log(`[API-CHECK] Acesso à API de roletas: ✅ Funcionando (${roulettesAccess.endpoint})`);
    console.log(`[API-CHECK] Quantidade de roletas: ${roulettesAccess.data.length}`);
    
    if (roulettesAccess.data.length > 0) {
      const firstRoulette = roulettesAccess.data[0];
      console.log('[API-CHECK] Primeira roleta:', {
        id: firstRoulette.id,
        nome: firstRoulette.nome || firstRoulette.name,
        numeroCount: firstRoulette.numero?.length || 0
      });
    }
  } else {
    console.log('[API-CHECK] Acesso à API de roletas: ❌ Erro ao verificar');
  }
  
  console.log('==========================================');
  console.log('  RESUMO DA VERIFICAÇÃO  ');
  console.log('==========================================');
  
  console.log(`Autenticação: ${token ? '✅' : '❌'}`);
  console.log(`Status da assinatura: ${subscriptionStatus?.hasSubscription ? '✅' : '❌'}`);
  console.log(`Acesso à API de roletas: ${roulettesAccess ? '✅' : '❌'}`);
  
  console.log('==========================================');
};

// Executar a verificação
runApiCheck();

// Exportar para uso em outros módulos
export { checkSubscriptionStatus, checkRoulettesAccess, runApiCheck }; 