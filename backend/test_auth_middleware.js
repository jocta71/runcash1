/**
 * Script para testar o middleware de autenticação simplificado
 * Execute com: node test_auth_middleware.js
 */

// Configurar variáveis de ambiente para teste
process.env.NODE_ENV = 'development';
process.env.ALLOW_PUBLIC_ACCESS = 'true';

// Imports
const jwt = require('jsonwebtoken');

// Mock para o objeto de requisição
const mockRequest = () => {
  return {
    headers: {
      authorization: null
    },
    usuario: null,
    user: null
  };
};

// Mock para o objeto de resposta
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Função de teste
async function runTests() {
  console.log('=== Teste do Middleware de Autenticação Simplificado ===');
  
  // Tentar carregar middlewares
  let simpleAuthMiddleware, authMiddleware;
  
  // Tentar carregar o middleware simplificado
  try {
    simpleAuthMiddleware = require('./middlewares/simpleAuthMiddleware');
    console.log('✅ Middleware simplificado carregado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao carregar middleware simplificado:', error.message);
  }
  
  // Tentar carregar o middleware normal
  try {
    authMiddleware = require('./middlewares/authMiddleware');
    console.log('✅ Middleware padrão carregado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao carregar middleware padrão:', error.message);
  }
  
  // Verificar qual middleware usar para testes
  const middleware = simpleAuthMiddleware || authMiddleware;
  
  if (!middleware) {
    console.error('❌ Nenhum middleware disponível para teste');
    return;
  }
  
  console.log('\n=== Testando função de geração de token ===');
  
  // Testar geração de token
  try {
    const usuario = {
      id: 'test123',
      email: 'teste@example.com',
      nome: 'Usuário Teste',
      role: 'user'
    };
    
    const token = middleware.gerarToken(usuario);
    console.log('✅ Token gerado com sucesso:', token);
    
    // Verificar o token gerado
    const decoded = jwt.decode(token);
    console.log('✅ Token decodificado:', decoded);
  } catch (error) {
    console.error('❌ Erro ao gerar token:', error);
  }
  
  console.log('\n=== Testando middleware "proteger" ===');
  
  // Testar o middleware proteger sem token
  const req1 = mockRequest();
  const res1 = mockResponse();
  const next1 = jest.fn();
  
  try {
    console.log('Teste: Chamada sem token');
    middleware.proteger(req1, res1, next1);
    
    if (next1.mock.calls.length > 0) {
      console.log('✅ Próxima função chamada mesmo sem token (modo desenvolvimento)');
      console.log('✅ Usuario definido:', req1.usuario);
    } else {
      console.log('❌ Próxima função não chamada');
      console.log('Status:', res1.status.mock.calls);
      console.log('JSON:', res1.json.mock.calls);
    }
  } catch (error) {
    console.error('❌ Erro ao executar middleware proteger:', error);
  }
  
  console.log('\n=== Testando middleware "authenticate" ===');
  
  // Testar o middleware authenticate
  const req2 = mockRequest();
  const res2 = mockResponse();
  const next2 = jest.fn();
  
  try {
    console.log('Teste: Chamada sem token (authenticate)');
    const authenticateMiddleware = middleware.authenticate({ required: true });
    authenticateMiddleware(req2, res2, next2);
    
    if (next2.mock.calls.length > 0) {
      console.log('✅ Próxima função chamada mesmo sem token (modo desenvolvimento)');
      console.log('✅ Usuario definido:', req2.usuario || req2.user);
    } else {
      console.log('❌ Próxima função não chamada');
      console.log('Status:', res2.status.mock.calls);
      console.log('JSON:', res2.json.mock.calls);
    }
  } catch (error) {
    console.error('❌ Erro ao executar middleware authenticate:', error);
  }
  
  console.log('\n=== Testes Concluídos ===');
}

// Mock para o jest.fn
function mockJestFn() {
  const mockFn = (...args) => {
    mockFn.mock.calls.push(args);
    return mockFn.mockReturnValueOnce || mockFn.mockReturnValue;
  };
  mockFn.mock = { calls: [] };
  mockFn.mockReturnValue = function(val) {
    mockFn.mockReturnValue = val;
    return mockFn;
  };
  mockFn.mockReturnValueOnce = null;
  
  return mockFn;
}

// Polyfill para jest.fn se não estiver em ambiente de teste
if (typeof jest === 'undefined') {
  global.jest = {
    fn: mockJestFn
  };
}

// Executar os testes
runTests().catch(error => {
  console.error('Erro ao executar testes:', error);
}); 