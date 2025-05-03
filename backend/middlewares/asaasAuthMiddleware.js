/**
 * Middleware para autenticação JWT e verificação de assinatura no Asaas
 * Integra validação de token JWT e consulta ao status de assinatura via API Asaas
 */

const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../config/config');
const getDb = require('../services/database');
const { ObjectId } = require('mongodb');
const { JWT_SECRET } = require('./jwtAuthMiddleware');

// Configuração do Asaas API
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

// Log de configuração
console.log(`[ASAAS-AUTH] Usando JWT_SECRET: ${JWT_SECRET ? '******' : 'Não definido'} (importado do jwtAuthMiddleware)`);

/**
 * Middleware para verificar JWT e status de assinatura Asaas
 * @param {Object} options - Opções de configuração
 * @param {boolean} options.required - Define se autenticação é obrigatória (true) ou opcional (false)
 * @param {Array<string>} options.allowedPlans - Lista de planos permitidos
 * @returns {Function} Express middleware
 */
function verifyTokenAndSubscription(options = { required: true, allowedPlans: ['BASIC', 'PRO', 'PREMIUM'] }) {
  return async (req, res, next) => {
    const requestId = req.requestId || Math.random().toString(36).substring(2, 15);
    const path = req.originalUrl || req.url || req.path;
    
    console.log(`[AUTH ${requestId}] Verificando autenticação em ${path}`);
    console.log(`[AUTH ${requestId}] Autenticação obrigatória: ${options.required ? 'SIM' : 'NÃO'}`);
    console.log(`[AUTH ${requestId}] Headers: ${JSON.stringify(req.headers)}`);
    
    // BLOQUEIO ABSOLUTO: Verificar se é um endpoint de roleta
    const isRouletteEndpoint = (
      path.includes('/api/roulettes') || 
      path.includes('/api/ROULETTES') || 
      path.includes('/api/roletas') ||
      /\/api\/roulettes.*/.test(path) ||
      /\/api\/ROULETTES.*/.test(path) ||
      /\/api\/roletas.*/.test(path)
    );
    
    // Verificar se a requisição tem um token de autorização
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log(`[AUTH ${requestId}] Requisição sem token de autorização`);
      
      // BLOQUEIO ABSOLUTO: Se for endpoint de roleta, SEMPRE bloquear se não tiver autorização
      if (isRouletteEndpoint) {
        console.log(`[AUTH ${requestId}] BLOQUEIO ABSOLUTO: Endpoint de roleta sem autorização: ${path}`);
        return res.status(401).json({
          success: false,
          message: 'Acesso negado - Autenticação obrigatória',
          code: 'ABSOLUTE_BLOCK',
          path: path,
          requestId: requestId
        });
      }
      
      // Se autenticação é obrigatória, retornar erro
      if (options.required) {
        console.log(`[AUTH ${requestId}] Autenticação obrigatória, retornando 401`);
        return res.status(401).json({ 
          success: false,
          message: 'Token de autenticação não fornecido',
          code: 'AUTH_REQUIRED',
          path: path,
          requestId: requestId 
        });
      }
      
      // Se autenticação é opcional, continuar sem definir req.usuario
      console.log(`[AUTH ${requestId}] Autenticação opcional, continuando sem usuário`);
      return next();
    }
    
    // Extrair o token da string "Bearer TOKEN"
    const bearerPrefix = 'Bearer ';
    if (!authHeader.startsWith(bearerPrefix)) {
      console.log(`[AUTH ${requestId}] Formato de token inválido (não começa com Bearer)`);
      return res.status(401).json({
        success: false, 
        message: 'Formato de token inválido',
        code: 'INVALID_TOKEN_FORMAT',
        path: path,
        requestId: requestId
      });
    }
    
    const token = authHeader.slice(bearerPrefix.length);
    console.log(`[AUTH ${requestId}] Token extraído com sucesso`);
    
    try {
      // Verificar se o token é válido usando JWT e a constante JWT_SECRET importada
      const decoded = jwt.verify(token, JWT_SECRET);
      
      console.log(`[AUTH ${requestId}] Token JWT verificado com sucesso`);
      console.log(`[AUTH ${requestId}] Usuário ID: ${decoded.id}, Email: ${decoded.email}`);
      
      // Definir informações do usuário na requisição
      req.usuario = decoded;
      
      // Verificar assinatura ASAAS
      console.log(`[AUTH ${requestId}] Verificando assinatura Asaas para usuário ${decoded.id}`);
      
      try {
        // Obter informações de assinatura
        const AsaasClient = require('../api/libs/asaasClient');
        const asaasClient = new AsaasClient();
        
        // Verificar se o parâmetro customerId existe no token
        if (!decoded.customerId) {
          console.log(`[AUTH ${requestId}] JWT válido, mas sem customerId. Verificando se há customerId persistido`);
          
          // Verificar se há customerId persistido no banco de dados
          const mongodb = require('../api/libs/mongodb');
          if (!mongodb.isConnected()) {
            await mongodb.connect();
          }
          
          const db = mongodb.getDb();
          if (!db) {
            throw new Error('Não foi possível conectar ao MongoDB');
          }
          
          const user = await db.collection('users').findOne({ id: decoded.id });
          if (user && user.customerId) {
            console.log(`[AUTH ${requestId}] Encontrado customerId persistido: ${user.customerId}`);
            decoded.customerId = user.customerId;
        } else {
            console.log(`[AUTH ${requestId}] Não foi encontrado customerId para o usuário`);
          }
        }
        
        // Se temos o customerId, verificar assinatura
        if (decoded.customerId) {
          console.log(`[AUTH ${requestId}] Verificando assinaturas para customerId: ${decoded.customerId}`);
          
          // Obter assinaturas ativas
          const subscriptions = await asaasClient.getActiveSubscriptions(decoded.customerId);
          
          console.log(`[AUTH ${requestId}] Número de assinaturas encontradas: ${subscriptions.length}`);
          
          if (subscriptions.length > 0) {
            // Filtrar assinaturas ativas
            const activeSubscriptions = subscriptions.filter(sub => 
              sub.status === 'ACTIVE' && new Date(sub.nextDueDate) > new Date()
            );
            
            if (activeSubscriptions.length > 0) {
              // Definir a assinatura na requisição
              const subscription = activeSubscriptions[0];
              console.log(`[AUTH ${requestId}] Assinatura ativa encontrada: ${subscription.id}`);
              
              // Obter o plano da assinatura
              const plan = subscription.subscription?.split('_')[0] || 'basic';
              console.log(`[AUTH ${requestId}] Plano da assinatura: ${plan}`);
              
              // Verificar se o plano é permitido
              const normalizedAllowedPlans = options.allowedPlans.map(p => p.toLowerCase());
              if (normalizedAllowedPlans.includes(plan.toLowerCase())) {
                console.log(`[AUTH ${requestId}] Plano ${plan} é permitido para esta rota`);
                
                // Salvar informações na requisição
                req.subscription = subscription;
                req.userPlan = { type: plan.toUpperCase() };
                
                // BLOQUEIO ABSOLUTO: Dupla verificação para endpoints de roleta
                if (isRouletteEndpoint) {
                  console.log(`[AUTH ${requestId}] VERIFICAÇÃO DUPLA: Endpoint de roleta com autenticação e assinatura válida`);
                } else {
                  console.log(`[AUTH ${requestId}] Assinatura verificada para endpoint regular`);
                }
                
                // Continuar com a requisição
                return next();
              } else {
                console.log(`[AUTH ${requestId}] Plano ${plan} NÃO está na lista de planos permitidos: ${options.allowedPlans.join(', ')}`);
                
                // BLOQUEIO ABSOLUTO: Bloqueio total para endpoints de roleta
                if (isRouletteEndpoint) {
                  console.log(`[AUTH ${requestId}] BLOQUEIO ABSOLUTO: Endpoint de roleta com plano inválido: ${path}`);
                  return res.status(403).json({
                    success: false,
                    message: 'Seu plano atual não permite acesso a este recurso',
                    code: 'PLAN_NOT_ALLOWED',
                    path: path,
                    currentPlan: plan,
                    allowedPlans: options.allowedPlans,
                    requestId: requestId
                  });
                }
                
                // Se autenticação é obrigatória, bloquear acesso
                if (options.required) {
                  console.log(`[AUTH ${requestId}] Plano não permitido, retornando 403`);
                  return res.status(403).json({
                    success: false,
                    message: 'Seu plano atual não permite acesso a este recurso',
                    code: 'PLAN_NOT_ALLOWED',
                    path: path,
                    currentPlan: plan,
                    allowedPlans: options.allowedPlans,
                    requestId: requestId
                  });
                }
                
                // Se autenticação é opcional, continuar mesmo com plano não permitido
                console.log(`[AUTH ${requestId}] Autenticação opcional, continuando mesmo com plano não permitido`);
                req.subscription = null;
                req.userPlan = { type: 'FREE' };
                return next();
              }
            } else {
              console.log(`[AUTH ${requestId}] Nenhuma assinatura ATIVA encontrada para o usuário`);
              
              // BLOQUEIO ABSOLUTO: Se for endpoint de roleta, SEMPRE bloquear se não tiver assinatura ativa
              if (isRouletteEndpoint) {
                console.log(`[AUTH ${requestId}] BLOQUEIO ABSOLUTO: Endpoint de roleta sem assinatura ativa: ${path}`);
                return res.status(403).json({
                  success: false,
                  message: 'Você precisa de uma assinatura ativa para acessar este recurso',
                  code: 'SUBSCRIPTION_REQUIRED',
                  path: path,
                  requestId: requestId
                });
              }
              
              // Se autenticação é obrigatória, verificar se assinatura também é
              if (options.required) {
                console.log(`[AUTH ${requestId}] Autenticação obrigatória sem assinatura ativa, retornando 403`);
                return res.status(403).json({
                  success: false,
                  message: 'Você precisa de uma assinatura ativa para acessar este recurso',
                  code: 'SUBSCRIPTION_REQUIRED',
                  path: path,
                  requestId: requestId
                });
              }
              
              // Se autenticação é opcional, continuar sem definir req.subscription
              console.log(`[AUTH ${requestId}] Autenticação opcional, continuando sem assinatura`);
              req.subscription = null;
              req.userPlan = { type: 'FREE' };
          return next();
        }
          } else {
            console.log(`[AUTH ${requestId}] Nenhuma assinatura encontrada para o usuário`);
            
            // BLOQUEIO ABSOLUTO: Se for endpoint de roleta, SEMPRE bloquear se não tiver assinatura
            if (isRouletteEndpoint) {
              console.log(`[AUTH ${requestId}] BLOQUEIO ABSOLUTO: Endpoint de roleta sem assinatura: ${path}`);
              return res.status(403).json({
                success: false,
                message: 'Você precisa de uma assinatura ativa para acessar este recurso',
                code: 'SUBSCRIPTION_REQUIRED',
                path: path,
                requestId: requestId
              });
            }
            
            // Se autenticação é obrigatória, verificar se assinatura também é
            if (options.required) {
              console.log(`[AUTH ${requestId}] Autenticação obrigatória sem assinatura, retornando 403`);
              return res.status(403).json({
                success: false,
                message: 'Você precisa de uma assinatura ativa para acessar este recurso',
                code: 'SUBSCRIPTION_REQUIRED',
                path: path,
                requestId: requestId
              });
            }
            
            // Se autenticação é opcional, continuar sem definir req.subscription
            console.log(`[AUTH ${requestId}] Autenticação opcional, continuando sem assinatura`);
            req.subscription = null;
            req.userPlan = { type: 'FREE' };
            return next();
          }
        } else {
          console.log(`[AUTH ${requestId}] Não foi possível obter customerId para verificar assinatura`);
          
          // BLOQUEIO ABSOLUTO: Se for endpoint de roleta, SEMPRE bloquear se não tiver customerId
          if (isRouletteEndpoint) {
            console.log(`[AUTH ${requestId}] BLOQUEIO ABSOLUTO: Endpoint de roleta sem customerId: ${path}`);
            return res.status(403).json({
              success: false,
              message: 'Você precisa de uma assinatura ativa para acessar este recurso',
              code: 'CUSTOMER_ID_MISSING',
              path: path,
              requestId: requestId
            });
          }
          
          // Se autenticação é obrigatória, verificar se assinatura também é
          if (options.required) {
            console.log(`[AUTH ${requestId}] Autenticação obrigatória sem customerId, retornando 403`);
            return res.status(403).json({
              success: false,
              message: 'Não foi possível verificar sua assinatura. Por favor, tente novamente ou contate o suporte.',
              code: 'CUSTOMER_ID_MISSING',
              path: path,
              requestId: requestId
            });
          }
          
          // Se autenticação é opcional, continuar sem definir req.subscription
          console.log(`[AUTH ${requestId}] Autenticação opcional, continuando sem customerId`);
          req.subscription = null;
          req.userPlan = { type: 'FREE' };
          return next();
        }
      } catch (asaasError) {
        console.error(`[AUTH ${requestId}] Erro ao verificar assinatura Asaas:`, asaasError);
        
        // BLOQUEIO ABSOLUTO: Se for endpoint de roleta, SEMPRE bloquear em caso de erro na verificação
        if (isRouletteEndpoint) {
          console.log(`[AUTH ${requestId}] BLOQUEIO ABSOLUTO: Endpoint de roleta com erro na verificação: ${path}`);
          return res.status(500).json({
            success: false,
            message: 'Erro ao verificar sua assinatura. Por favor, tente novamente mais tarde.',
            code: 'SUBSCRIPTION_VERIFICATION_ERROR',
            path: path,
            requestId: requestId
          });
        }
        
        // Se autenticação é obrigatória, retornar erro
        if (options.required) {
          console.log(`[AUTH ${requestId}] Autenticação obrigatória com erro na verificação, retornando 500`);
          return res.status(500).json({
            success: false,
            message: 'Erro ao verificar sua assinatura. Por favor, tente novamente mais tarde.',
            code: 'SUBSCRIPTION_VERIFICATION_ERROR',
            path: path,
            requestId: requestId
          });
        }
        
        // Se autenticação é opcional, continuar sem definir req.subscription
        console.log(`[AUTH ${requestId}] Autenticação opcional, continuando após erro na verificação`);
        req.subscription = null;
        req.userPlan = { type: 'FREE' };
        return next();
      }
    } catch (error) {
      console.error(`[AUTH ${requestId}] Erro ao verificar token JWT:`, error);
      
      // BLOQUEIO ABSOLUTO: Se for endpoint de roleta, SEMPRE bloquear em caso de erro no token
      if (isRouletteEndpoint) {
        console.log(`[AUTH ${requestId}] BLOQUEIO ABSOLUTO: Endpoint de roleta com token inválido: ${path}`);
        return res.status(401).json({
          success: false,
          message: 'Token de autenticação inválido ou expirado',
          code: 'INVALID_TOKEN',
          path: path,
          requestId: requestId
        });
      }
      
      // Se autenticação é obrigatória, retornar erro
      if (options.required) {
        console.log(`[AUTH ${requestId}] Autenticação obrigatória com token inválido, retornando 401`);
        return res.status(401).json({
          success: false,
          message: 'Token de autenticação inválido ou expirado',
          code: 'INVALID_TOKEN',
          path: path,
          requestId: requestId
        });
      }
      
      // Se autenticação é opcional, continuar sem definir req.usuario
      console.log(`[AUTH ${requestId}] Autenticação opcional, continuando após erro no token`);
      return next();
    }
  };
}

// Middlewares adicionais para requisitos específicos de recursos
function requireResourceAccess(resourceType) {
  return (req, res, next) => {
    console.log(`[ACCESS] Verificando acesso ao recurso: ${resourceType}`);
    
    // Verificar se usuário está autenticado
    if (!req.usuario) {
      return res.status(401).json({ error: 'Autenticação necessária para acessar este recurso' });
    }
    
    // Verificar se usuário tem assinatura ativa
    if (!req.subscription) {
      return res.status(403).json({ error: 'Assinatura necessária para acessar este recurso' });
    }
    
    // Verificar permissões específicas de recurso
    switch (resourceType) {
      case 'premium_data':
        // Verificar se o plano é PRO ou PREMIUM
        if (req.userPlan?.type === 'PRO' || req.userPlan?.type === 'PREMIUM') {
          return next();
        }
        break;
        
      case 'basic_data':
        // Qualquer plano pago pode acessar
        if (req.userPlan?.type === 'BASIC' || req.userPlan?.type === 'PRO' || req.userPlan?.type === 'PREMIUM') {
          return next();
        }
        break;
        
      default:
        // Para outros tipos de recurso, permitir qualquer assinatura ativa
    return next();
    }
    
    // Se chegou aqui, o acesso não é permitido
    return res.status(403).json({ 
      error: 'Seu plano atual não permite acesso a este recurso',
      planoAtual: req.userPlan?.type,
      recursoSolicitado: resourceType 
    });
  };
}

module.exports = {
  verifyTokenAndSubscription,
  requireResourceAccess
}; 