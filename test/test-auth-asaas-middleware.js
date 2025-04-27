/**
 * Teste do middleware de autenticação com JWT e verificação de assinatura Asaas
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');

// URL base da API de roletas protegida
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

// Segredo para geração de tokens JWT
const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto';

/**
 * Testa o acesso à API com diferentes cenários
 */
async function testarAPI() {
  console.log('🔒 Iniciando testes de autenticação e verificação de assinatura...');
  
  try {
    // Teste 1: Sem token de autenticação
    console.log('\n📋 Teste 1: Tentativa de acesso sem token');
    try {
      await axios.get(`${API_BASE_URL}/api/roletas`);
      console.log('❌ Erro: API permitiu acesso sem token!');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Sucesso: API bloqueou corretamente o acesso sem token');
      } else {
        console.log(`❌ Resultado inesperado: ${error.message}`);
      }
    }
    
    // Teste 2: Token inválido
    console.log('\n📋 Teste 2: Tentativa de acesso com token inválido');
    try {
      await axios.get(`${API_BASE_URL}/api/roletas`, {
        headers: { Authorization: 'Bearer token_invalido' }
      });
      console.log('❌ Erro: API permitiu acesso com token inválido!');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Sucesso: API bloqueou corretamente o acesso com token inválido');
      } else {
        console.log(`❌ Resultado inesperado: ${error.message}`);
      }
    }
    
    // Teste 3: Token sem customer ID do Asaas
    console.log('\n📋 Teste 3: Token sem customer ID do Asaas');
    const tokenSemCustomerId = jwt.sign(
      { id: 'user123', email: 'teste@exemplo.com' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    try {
      await axios.get(`${API_BASE_URL}/api/roletas`, {
        headers: { Authorization: `Bearer ${tokenSemCustomerId}` }
      });
      console.log('❌ Erro: API permitiu acesso sem customer ID!');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log('✅ Sucesso: API bloqueou corretamente o acesso sem customer ID');
      } else {
        console.log(`❌ Resultado inesperado: ${error.message}`);
      }
    }
    
    // Teste 4: Token com customer ID, mas sem assinatura ativa
    console.log('\n📋 Teste 4: Token com customer ID mas sem assinatura ativa');
    // Este teste requer que a API do Asaas esteja configurada e acessível
    // Usar um customer ID real que não tenha assinaturas ativas
    const customerIdSemAssinatura = 'cus_sem_assinatura';
    const tokenComCustomerIdInativo = jwt.sign(
      { id: 'user456', email: 'teste@exemplo.com', asaasCustomerId: customerIdSemAssinatura },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    try {
      await axios.get(`${API_BASE_URL}/api/roletas`, {
        headers: { Authorization: `Bearer ${tokenComCustomerIdInativo}` }
      });
      console.log('⚠️ Aviso: API permitiu acesso com customer ID sem assinatura ativa');
      console.log('   Isso pode ser esperado se a API_KEY do Asaas não estiver configurada');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log('✅ Sucesso: API bloqueou corretamente o acesso sem assinatura ativa');
      } else {
        console.log(`❌ Resultado inesperado: ${error.message}`);
      }
    }
    
    // Teste 5: Token com customer ID e assinatura ativa
    console.log('\n📋 Teste 5: Token com customer ID e assinatura ativa');
    // Este teste requer que a API do Asaas esteja configurada e acessível
    // Usar um customer ID real que tenha assinatura ativa
    const customerIdComAssinatura = 'cus_com_assinatura';
    const tokenValido = jwt.sign(
      { id: 'user789', email: 'premium@exemplo.com', asaasCustomerId: customerIdComAssinatura },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/roletas`, {
        headers: { Authorization: `Bearer ${tokenValido}` }
      });
      
      if (response.status === 200) {
        console.log('✅ Sucesso: API permitiu acesso com assinatura ativa');
      } else {
        console.log(`❌ Resultado inesperado: status ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Erro: API bloqueou acesso com assinatura ativa: ${error.message}`);
      if (error.response && error.response.data) {
        console.log('Detalhes:', error.response.data);
      }
    }
    
    console.log('\n🏁 Testes concluídos!');
    
  } catch (error) {
    console.error('\n❌ Erro geral nos testes:', error.message);
  }
}

// Executar testes
testarAPI(); 