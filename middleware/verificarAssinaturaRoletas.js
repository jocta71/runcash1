const jwt = require('jsonwebtoken');
const axios = require('axios');

/**
 * Middleware para verificar assinatura premium para acesso às roletas
 * Verifica status da assinatura no Asaas e define nível de acesso
 * 
 * Níveis de acesso:
 * - 'simulado': dados fictícios para usuários sem assinatura ou não autenticados
 * - 'premium': dados reais para usuários com assinatura ativa
 */
const verificarAssinaturaRoletas = async (req, res, next) => {
  try {
    console.log('[API] Iniciando verificação de assinatura para roletas');
    
    // Definir acesso padrão como 'simulado'
    req.nivelAcessoRoletas = 'simulado';
    
    // Verificar se o token está presente no header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    
    // Se não há token, continuar com acesso simulado
    if (!token) {
      console.log('[API] Acesso sem autenticação: usando dados simulados');
      return next();
    }
    
    try {
      // Verificar token JWT
      const JWT_SECRET = process.env.JWT_SECRET || 'secret_padrao_roleta';
      
      if (!JWT_SECRET) {
        console.error('[API] JWT_SECRET não configurada. Usando fallback padrão');
      }
      
      const decodificado = jwt.verify(token, JWT_SECRET);
      
      console.log(`[API] Token JWT válido para usuário: ${decodificado.email || 'desconhecido'}`);
      
      // Adicionar informações do usuário à requisição
      req.usuario = {
        id: decodificado.id,
        email: decodificado.email,
        asaasCustomerId: decodificado.asaasCustomerId
      };
      
      // Se não tem asaasCustomerId, manter acesso simulado
      if (!decodificado.asaasCustomerId) {
        console.log('[API] Usuário sem ID Asaas: usando dados simulados');
        return next();
      }
      
      // Verificar status da assinatura no Asaas com timeout
      try {
        const assinatura = await Promise.race([
          verificarAssinaturaAsaas(decodificado.asaasCustomerId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout ao consultar Asaas')), 5000)
          )
        ]);
        
        if (assinatura && assinatura.status === 'ACTIVE') {
          console.log(`[API] Assinatura premium ativa para usuário ${decodificado.email}`);
          req.nivelAcessoRoletas = 'premium';
          req.assinatura = assinatura;
        } else {
          console.log(`[API] Assinatura não ativa para usuário ${decodificado.email}: usando dados simulados`);
          // Garantir que o nível de acesso seja definido explicitamente
          req.nivelAcessoRoletas = 'simulado';
        }
      } catch (asaasError) {
        console.error('[API] Erro ao verificar assinatura no Asaas:', asaasError.message);
        // Em caso de erro na verificação com Asaas, manter acesso simulado
        req.nivelAcessoRoletas = 'simulado';
      }
      
      next();
    } catch (jwtError) {
      // Se houver erro na validação do token, manter acesso simulado
      console.log('[API] Erro na verificação do token: usando dados simulados', jwtError.message);
      req.nivelAcessoRoletas = 'simulado';
      next();
    }
  } catch (error) {
    console.error('[API] Erro ao verificar assinatura:', error);
    // Em caso de erro, continuar com acesso simulado
    req.nivelAcessoRoletas = 'simulado';
    next();
  }
};

/**
 * Verifica o status da assinatura do cliente no Asaas
 * @param {string} customerId ID do cliente no Asaas
 * @returns {Object|null} Dados da assinatura ou null se não encontrada/erro
 */
async function verificarAssinaturaAsaas(customerId) {
  try {
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3';
    
    if (!ASAAS_API_KEY) {
      console.error('[API] ASAAS_API_KEY não configurada');
      return null;
    }
    
    console.log(`[API] Verificando assinatura no Asaas para customer: ${customerId}`);
    
    // Criar instância do axios com timeout
    const axiosInstance = axios.create({
      timeout: 5000, // 5 segundos
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    // Buscar assinaturas do cliente com retry
    const maxRetries = 2;
    let retries = 0;
    let lastError = null;
    
    while (retries <= maxRetries) {
      try {
        const response = await axiosInstance.get(
          `${ASAAS_API_URL}/subscriptions?customer=${customerId}&status=ACTIVE`
        );
        
        // Verificar se há assinaturas ativas
        if (response.data && 
            response.data.data && 
            Array.isArray(response.data.data) && 
            response.data.data.length > 0) {
          
          console.log(`[API] Assinatura ativa encontrada no Asaas para customer: ${customerId}`);
          // Retornar a primeira assinatura ativa
          return response.data.data[0];
        }
        
        // Se chegou aqui, não encontrou assinaturas ativas
        console.log(`[API] Nenhuma assinatura ativa encontrada no Asaas para customer: ${customerId}`);
        return null;
      } catch (error) {
        lastError = error;
        retries++;
        
        if (retries <= maxRetries) {
          console.log(`[API] Tentativa ${retries}/${maxRetries} falhou, tentando novamente...`);
          // Esperar um tempo antes de tentar novamente (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
    }
    
    // Se todas as tentativas falharam, logar o erro e retornar null
    console.error('[API] Todas as tentativas de conexão com Asaas falharam:', lastError?.message);
    return null;
  } catch (error) {
    console.error('[API] Erro ao verificar assinatura no Asaas:', error.message);
    return null;
  }
}

module.exports = verificarAssinaturaRoletas; 