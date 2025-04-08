/**
 * Rota de proxy para o 888casino
 * Este proxy permite fazer requisições para o 888casino sem problemas de CORS
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * Rota para fazer proxy de requisições para o 888casino
 * @route POST /api/proxy/888casino
 */
router.post('/888casino', async (req, res) => {
  try {
    console.log('[ProxyAPI] Recebendo requisição para proxy do 888casino');
    
    // URL do endpoint de mesas ao vivo do 888casino
    const targetUrl = 'https://cgp.safe-iplay.com/cgpapi/riverFeed/GetLiveTables';
    
    // Enviar requisição para o 888casino
    const response = await axios.post(targetUrl, req.body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://es.888casino.com',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
      }
    });
    
    // Retornar os dados recebidos do 888casino
    return res.json(response.data);
  } catch (error) {
    console.error('[ProxyAPI] Erro ao fazer proxy para 888casino:', error);
    
    // Retornar erro com detalhes
    return res.status(500).json({
      error: 'Erro ao fazer proxy para 888casino',
      details: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null
    });
  }
});

/**
 * Rota para buscar feeds de jackpot do 888casino
 * @route GET /api/proxy/jackpotFeeds
 */
router.get('/jackpotFeeds/:currency', async (req, res) => {
  try {
    console.log('[ProxyAPI] Recebendo requisição para proxy de jackpotFeeds');
    
    // Obter a moeda da URL ou usar BRL como padrão
    const currency = req.params.currency || 'BRL';
    
    // URL do endpoint de jackpots do 888casino
    const targetUrl = `https://casino-orbit-feeds-cdn.888casino.com/api/jackpotFeeds/0/${currency}`;
    
    // Enviar requisição para o 888casino
    const response = await axios.get(targetUrl, {
      headers: {
        'Origin': 'https://es.888casino.com',
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
      }
    });
    
    // Retornar os dados recebidos do 888casino
    return res.json(response.data);
  } catch (error) {
    console.error('[ProxyAPI] Erro ao buscar jackpotFeeds:', error);
    
    // Retornar erro com detalhes
    return res.status(500).json({
      error: 'Erro ao buscar jackpotFeeds',
      details: error.message,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : null
    });
  }
});

module.exports = router; 