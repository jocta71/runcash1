/**
 * API de roletas protegida por autenticação JWT e verificação de assinatura Asaas
 */

const express = require('express');
const axios = require('axios');
const { verificarAutenticacaoEAssinatura } = require('../middleware/authAsaasMiddleware');

const app = express();

// Configuração de CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Aplicar middleware de autenticação e verificação de assinatura em todas as rotas
app.use(verificarAutenticacaoEAssinatura);

// URL base da API interna de roletas
const ROLETAS_API_BASE_URL = process.env.ROLETAS_API_URL || 'http://localhost:5000';

/**
 * Proxy para a API de listagem de roletas
 */
app.get('/api/roletas', async (req, res) => {
  try {
    const response = await axios.get(`${ROLETAS_API_BASE_URL}/api/roletas`);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Erro ao acessar API de roletas:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro ao acessar dados de roletas',
      message: error.message
    });
  }
});

/**
 * Proxy para a API de detalhes de roleta específica
 */
app.get('/api/roletas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${ROLETAS_API_BASE_URL}/api/roletas/${id}`);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error(`Erro ao acessar API de roleta ${req.params.id}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro ao acessar dados da roleta',
      message: error.message
    });
  }
});

/**
 * Proxy para a API de estatísticas de roleta
 */
app.get('/api/roulette/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(
      `${ROLETAS_API_BASE_URL}/api/roulette/${id}/stats`,
      { params: req.query }
    );
    return res.status(200).json(response.data);
  } catch (error) {
    console.error(`Erro ao acessar estatísticas da roleta ${req.params.id}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro ao acessar estatísticas da roleta',
      message: error.message
    });
  }
});

/**
 * Proxy para a API de números de roleta
 */
app.get('/api/roulette/:id/numbers', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(
      `${ROLETAS_API_BASE_URL}/api/roulette/${id}/numbers`,
      { params: req.query }
    );
    return res.status(200).json(response.data);
  } catch (error) {
    console.error(`Erro ao acessar números da roleta ${req.params.id}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro ao acessar números da roleta',
      message: error.message
    });
  }
});

/**
 * Proxy para a API de estratégias de roleta
 */
app.get('/api/roulette/:id/strategies', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(
      `${ROLETAS_API_BASE_URL}/api/roulette/${id}/strategies`,
      { params: req.query }
    );
    return res.status(200).json(response.data);
  } catch (error) {
    console.error(`Erro ao acessar estratégias da roleta ${req.params.id}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro ao acessar estratégias da roleta',
      message: error.message
    });
  }
});

/**
 * Proxy para a API de status de roleta
 */
app.get('/api/roulette/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${ROLETAS_API_BASE_URL}/api/roulette/${id}/status`);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error(`Erro ao acessar status da roleta ${req.params.id}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Erro ao acessar status da roleta',
      message: error.message
    });
  }
});

module.exports = app; 