/**
 * Rotas para API de roletas - Requer autenticação JWT e assinatura ativa no Asaas
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const axios = require('axios');

// Configurações do Asaas
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';

/**
 * Middleware de verificação de assinatura ativa no Asaas
 */
const verificarAssinaturaAtiva = async (req, res, next) => {
  try {
    // Se não há usuário autenticado, negar acesso
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Não autorizado - usuário não autenticado',
        error: 'ERROR_UNAUTHORIZED'
      });
    }
    
    // Se não há ID de cliente no Asaas, negar acesso
    if (!req.user.asaasCustomerId) {
      return res.status(403).json({
        success: false,
        message: 'Usuário não possui assinatura cadastrada',
        error: 'ERROR_NO_SUBSCRIPTION',
        requiresSubscription: true
      });
    }
    
    // Verificar se é um usuário administrativo (bypass verificação Asaas)
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      // Adicionar log de auditoria
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'verificacao_assinatura',
        status: 'bypass',
        userId: req.user.id,
        motivo: 'Usuário administrativo'
      }));
      
      return next();
    }
    
    // Verificar assinaturas ativas do cliente no Asaas
    try {
      const response = await axios.get(
        `${ASAAS_API_URL}/subscriptions`,
        {
          params: { customer: req.user.asaasCustomerId },
          headers: { 
            'access_token': ASAAS_API_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5 segundos
        }
      );
      
      // Verificar se há alguma assinatura ativa
      const assinaturas = response.data.data || [];
      const assinaturaAtiva = assinaturas.find(ass => ass.status === 'ACTIVE');
      
      if (!assinaturaAtiva) {
        // Adicionar log de auditoria
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          action: 'verificacao_assinatura',
          status: 'falha',
          userId: req.user.id,
          customerId: req.user.asaasCustomerId,
          motivo: 'Nenhuma assinatura ativa encontrada',
          erro: 'ERROR_INACTIVE_SUBSCRIPTION'
        }));
        
        return res.status(403).json({
          success: false,
          message: 'Assinatura inativa ou cancelada',
          error: 'ERROR_INACTIVE_SUBSCRIPTION',
          requiresSubscription: true
        });
      }
      
      // Adicionar informações da assinatura à requisição
      req.assinatura = {
        id: assinaturaAtiva.id,
        status: assinaturaAtiva.status,
        valor: assinaturaAtiva.value,
        proxPagamento: assinaturaAtiva.nextDueDate,
        plano: assinaturaAtiva.billingType || 'UNDEFINED'
      };
      
      // Adicionar log de auditoria de sucesso
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'verificacao_assinatura',
        status: 'sucesso',
        userId: req.user.id,
        assinaturaId: assinaturaAtiva.id,
        proxPagamento: assinaturaAtiva.nextDueDate
      }));
      
      next();
    } catch (error) {
      console.error('Erro ao verificar assinatura no Asaas:', error.message);
      
      // Adicionar log de auditoria
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'verificacao_assinatura',
        status: 'erro',
        userId: req.user.id,
        customerId: req.user.asaasCustomerId,
        erro: error.code || 'ERROR_CHECKING_SUBSCRIPTION',
        mensagem: error.message
      }));
      
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar assinatura',
        error: 'ERROR_CHECKING_SUBSCRIPTION'
      });
    }
  } catch (error) {
    console.error('Erro não tratado:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno no servidor',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};

// Aplicar autenticação JWT e verificação de assinatura em todas as rotas
router.use(passport.authenticate('jwt', { session: false }));
router.use(verificarAssinaturaAtiva);

/**
 * @route GET /api/roletas
 * @desc Obter lista de roletas disponíveis
 * @access Privado (requer JWT válido e assinatura ativa)
 */
router.get('/', async (req, res) => {
  try {
    // Obter banco de dados da aplicação
    const db = req.app.locals.db;
    
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Serviço de banco de dados indisponível',
        error: 'DATABASE_UNAVAILABLE'
      });
    }
    
    // Buscar roletas disponíveis no banco de dados MongoDB
    const roletas = await db.collection('roletas')
      .find({})
      .sort({ nome: 1 })
      .toArray();
    
    // Mapear para o formato esperado pelo frontend
    const dadosFormatados = roletas.map(roleta => ({
      id: roleta._id.toString(),
      nome: roleta.nome,
      provedor: roleta.provedor || 'Desconhecido',
      ultimosNumeros: roleta.ultimosNumeros || [],
      estrategia: roleta.estrategia || null
    }));
    
    res.json({
      success: true,
      message: 'Dados das roletas recuperados com sucesso',
      usuario: {
        id: req.user.id,
        nome: req.user.name || req.user.email
      },
      assinatura: req.assinatura,
      total: dadosFormatados.length,
      data: dadosFormatados
    });
  } catch (error) {
    console.error('Erro ao buscar roletas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar dados das roletas',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/roletas/:id
 * @desc Obter detalhes de uma roleta específica
 * @access Privado (requer JWT válido e assinatura ativa)
 */
router.get('/:id', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const roletaId = req.params.id;
    
    // Converter para ObjectId se não for uma string de filtro
    let filtro;
    if (roletaId.match(/^[0-9a-fA-F]{24}$/)) {
      filtro = { _id: req.app.locals.mapToCanonicalId(roletaId) };
    } else {
      filtro = { nome: new RegExp(roletaId, 'i') };
    }
    
    // Buscar roleta específica no banco de dados
    const roleta = await db.collection('roletas').findOne(filtro);
    
    if (!roleta) {
      return res.status(404).json({
        success: false,
        message: 'Roleta não encontrada',
        error: 'ROULETTE_NOT_FOUND'
      });
    }
    
    // Buscar histórico de números para esta roleta
    const historicoNumeros = await db.collection('numeros')
      .find({ roleta_id: roleta._id.toString() })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();
    
    // Mapear para o formato esperado
    const roletaFormatada = {
      id: roleta._id.toString(),
      nome: roleta.nome,
      provedor: roleta.provedor || 'Desconhecido',
      ultimosNumeros: historicoNumeros.map(h => h.numero),
      ultimosNumerosDetalhado: historicoNumeros.map(h => ({
        numero: h.numero,
        timestamp: h.timestamp,
        cor: getRouletteNumberColor(h.numero)
      })),
      estatisticas: calculateRouletteStats(historicoNumeros.map(h => h.numero))
    };
    
    res.json({
      success: true,
      message: 'Detalhes da roleta recuperados com sucesso',
      data: roletaFormatada
    });
  } catch (error) {
    console.error('Erro ao buscar detalhes da roleta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar detalhes da roleta',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @route GET /api/roletas/:id/historico
 * @desc Obter histórico completo de números de uma roleta
 * @access Privado (requer JWT válido e assinatura ativa)
 */
router.get('/:id/historico', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const roletaId = req.params.id;
    
    // Parâmetros de paginação
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = parseInt(req.query.limite) || 100;
    const skip = (pagina - 1) * limite;
    
    // Converter para ObjectId se não for uma string de filtro
    let filtro;
    if (roletaId.match(/^[0-9a-fA-F]{24}$/)) {
      filtro = { roleta_id: roletaId };
    } else {
      // Primeiro encontrar a roleta pelo nome
      const roleta = await db.collection('roletas').findOne({ 
        nome: new RegExp(roletaId, 'i') 
      });
      
      if (!roleta) {
        return res.status(404).json({
          success: false,
          message: 'Roleta não encontrada',
          error: 'ROULETTE_NOT_FOUND'
        });
      }
      
      filtro = { roleta_id: roleta._id.toString() };
    }
    
    // Contar total de resultados para paginação
    const total = await db.collection('numeros').countDocuments(filtro);
    
    // Buscar histórico de números
    const historicoNumeros = await db.collection('numeros')
      .find(filtro)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limite)
      .toArray();
    
    // Obter informações da roleta
    const roleta = await db.collection('roletas').findOne({ 
      _id: req.app.locals.mapToCanonicalId(historicoNumeros[0]?.roleta_id || roletaId) 
    });
    
    res.json({
      success: true,
      message: 'Histórico da roleta recuperado com sucesso',
      paginacao: {
        total,
        pagina,
        limite,
        paginas: Math.ceil(total / limite)
      },
      roleta: {
        id: roleta?._id.toString(),
        nome: roleta?.nome || 'Desconhecido'
      },
      data: historicoNumeros.map(h => ({
        numero: h.numero,
        timestamp: h.timestamp,
        cor: getRouletteNumberColor(h.numero)
      }))
    });
  } catch (error) {
    console.error('Erro ao buscar histórico da roleta:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar histórico da roleta',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * Função utilitária para obter a cor de um número da roleta
 * @param {number} numero - Número da roleta
 * @returns {string} Cor do número (vermelho, preto ou verde)
 */
function getRouletteNumberColor(numero) {
  if (numero === 0) return 'verde';
  
  const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return vermelhos.includes(numero) ? 'vermelho' : 'preto';
}

/**
 * Função utilitária para calcular estatísticas da roleta
 * @param {Array<number>} numeros - Lista de números da roleta
 * @returns {Object} Estatísticas calculadas
 */
function calculateRouletteStats(numeros) {
  // Contagem de ocorrências de cada número
  const contagem = {};
  numeros.forEach(n => {
    contagem[n] = (contagem[n] || 0) + 1;
  });
  
  // Lista de todos os números possíveis na roleta
  const todosNumeros = Array.from({ length: 37 }, (_, i) => i);
  
  // Encontrar números quentes (mais frequentes)
  const numerosPorFrequencia = Object.entries(contagem)
    .map(([numero, count]) => ({ numero: parseInt(numero), count }))
    .sort((a, b) => b.count - a.count);
  
  const quentes = numerosPorFrequencia.slice(0, 5).map(item => item.numero);
  
  // Encontrar números frios (menos frequentes entre os que apareceram)
  const frios = numerosPorFrequencia
    .slice(-5)
    .map(item => item.numero)
    .sort((a, b) => a - b);
  
  // Encontrar números ausentes (que não apareceram)
  const numerosPresentes = Object.keys(contagem).map(n => parseInt(n));
  const ausentes = todosNumeros.filter(n => !numerosPresentes.includes(n));
  
  // Calcular outras estatísticas
  const parImpar = {
    par: numeros.filter(n => n !== 0 && n % 2 === 0).length,
    impar: numeros.filter(n => n % 2 === 1).length
  };
  
  const altosBaixos = {
    baixos: numeros.filter(n => n >= 1 && n <= 18).length,
    altos: numeros.filter(n => n >= 19 && n <= 36).length
  };
  
  const duzias = {
    primeira: numeros.filter(n => n >= 1 && n <= 12).length,
    segunda: numeros.filter(n => n >= 13 && n <= 24).length,
    terceira: numeros.filter(n => n >= 25 && n <= 36).length
  };
  
  return {
    quentes,
    frios,
    ausentes: ausentes.slice(0, 10),
    parImpar,
    altosBaixos,
    duzias,
    zeros: numeros.filter(n => n === 0).length,
    total: numeros.length
  };
}

module.exports = router; 