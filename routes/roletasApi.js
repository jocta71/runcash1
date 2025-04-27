/**
 * Rotas da API de roletas protegidas por autenticação JWT e assinatura ativa
 */

import express from 'express';
import { verificarAutenticacaoEAssinatura } from '../middleware/authAndAsaas.js';

const router = express.Router();

// Importar funções de acesso ao banco de dados (simulado)
// Na implementação real, substituir por acesso ao MongoDB
const obterRoletas = async () => {
  return [
    { id: '1', nome: 'Roleta Brasileira', ativa: true },
    { id: '2', nome: 'Roleta Europeia', ativa: true },
    { id: '3', nome: 'Roleta Americana', ativa: true }
  ];
};

const obterRoletaPorId = async (id) => {
  const roletas = await obterRoletas();
  return roletas.find(r => r.id === id);
};

const obterNumerosRoleta = async (roletaId, limite = 20) => {
  // Simulação de números - na implementação real, buscar do MongoDB
  const numeros = [];
  for (let i = 0; i < limite; i++) {
    const numero = Math.floor(Math.random() * 37); // 0-36
    const cor = numero === 0 ? 'verde' : (numero % 2 === 0 ? 'vermelho' : 'preto');
    const timestamp = new Date(Date.now() - i * 60000).toISOString(); // Cada número é 1 minuto mais antigo
    
    numeros.push({
      numero,
      cor,
      timestamp
    });
  }
  return numeros;
};

const obterEstatisticasRoleta = async (roletaId) => {
  // Simulação de estatísticas - na implementação real, calcular com base nos números armazenados
  return {
    cores: {
      vermelho: 45,
      preto: 43,
      verde: 5
    },
    paridade: {
      par: 44,
      impar: 44
    },
    duzias: {
      primeira: 30,
      segunda: 31,
      terceira: 32
    },
    colunas: {
      primeira: 32,
      segunda: 31,
      terceira: 30
    },
    metades: {
      primeira: 47,
      segunda: 46
    },
    baseadoEm: 93,
    ultimaAtualizacao: new Date().toISOString()
  };
};

const obterEstrategiasRoleta = async (roletaId) => {
  // Simulação de estratégias - na implementação real, calcular com base nos números armazenados
  return [
    {
      nome: 'Sequência de Cores',
      descricao: 'Baseado na análise dos últimos 50 números',
      previsao: 'Vermelho',
      confianca: 0.75
    },
    {
      nome: 'Dúzias',
      descricao: 'Baseado na análise de frequência',
      previsao: 'Primeira Dúzia (1-12)',
      confianca: 0.68
    }
  ];
};

// Rota pública - lista básica de roletas sem detalhes estratégicos
router.get('/roletas', async (req, res) => {
  try {
    const roletas = await obterRoletas();
    res.json({
      success: true,
      data: roletas.map(({ id, nome, ativa }) => ({ id, nome, ativa }))
    });
  } catch (error) {
    console.error('Erro ao listar roletas:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao buscar roletas',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Rota pública - detalhes básicos de uma roleta específica
router.get('/roletas/:id', async (req, res) => {
  try {
    const roleta = await obterRoletaPorId(req.params.id);
    if (!roleta) {
      return res.status(404).json({ 
        success: false, 
        message: 'Roleta não encontrada',
        error: 'ROULETTE_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: {
        id: roleta.id,
        nome: roleta.nome,
        ativa: roleta.ativa
      }
    });
  } catch (error) {
    console.error('Erro ao buscar roleta:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao buscar detalhes da roleta',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Aplicar middleware de autenticação e verificação de assinatura para rotas premium
router.use('/premium', verificarAutenticacaoEAssinatura);

// Rota protegida - números recentes de uma roleta específica
router.get('/premium/roletas/:id/numeros', async (req, res) => {
  try {
    const limite = parseInt(req.query.limite || 20, 10);
    const roleta = await obterRoletaPorId(req.params.id);
    
    if (!roleta) {
      return res.status(404).json({ 
        success: false, 
        message: 'Roleta não encontrada',
        error: 'ROULETTE_NOT_FOUND'
      });
    }
    
    const numeros = await obterNumerosRoleta(req.params.id, limite);
    
    res.json({
      success: true,
      data: {
        roleta_id: roleta.id,
        roleta_nome: roleta.nome,
        numeros: numeros,
        total: numeros.length,
        ultima_atualizacao: numeros.length > 0 ? numeros[0].timestamp : new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro ao buscar números da roleta:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao buscar números da roleta',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Rota protegida - estatísticas de uma roleta específica
router.get('/premium/roletas/:id/estatisticas', async (req, res) => {
  try {
    const roleta = await obterRoletaPorId(req.params.id);
    
    if (!roleta) {
      return res.status(404).json({ 
        success: false, 
        message: 'Roleta não encontrada',
        error: 'ROULETTE_NOT_FOUND'
      });
    }
    
    const estatisticas = await obterEstatisticasRoleta(req.params.id);
    
    res.json({
      success: true,
      data: {
        roleta_id: roleta.id,
        roleta_nome: roleta.nome,
        estatisticas: estatisticas,
        usuario: {
          id: req.usuario.id,
          nome: req.usuario.nome
        },
        assinatura: {
          id: req.assinatura.id,
          status: req.assinatura.status,
          proxPagamento: req.assinatura.proxPagamento
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas da roleta:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao buscar estatísticas da roleta',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Rota protegida - estratégias para uma roleta específica
router.get('/premium/roletas/:id/estrategias', async (req, res) => {
  try {
    const roleta = await obterRoletaPorId(req.params.id);
    
    if (!roleta) {
      return res.status(404).json({ 
        success: false, 
        message: 'Roleta não encontrada',
        error: 'ROULETTE_NOT_FOUND'
      });
    }
    
    const estrategias = await obterEstrategiasRoleta(req.params.id);
    
    res.json({
      success: true,
      data: {
        roleta_id: roleta.id,
        roleta_nome: roleta.nome,
        estrategias: estrategias,
        aviso: "Estas estratégias são baseadas em análise estatística e não garantem resultados",
        ultima_atualizacao: new Date().toISOString(),
        usuario: {
          id: req.usuario.id,
          nome: req.usuario.nome
        },
        assinatura: {
          id: req.assinatura.id,
          status: req.assinatura.status,
          proxPagamento: req.assinatura.proxPagamento
        }
      }
    });
  } catch (error) {
    console.error('Erro ao buscar estratégias da roleta:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erro interno ao buscar estratégias da roleta',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

export default router; 