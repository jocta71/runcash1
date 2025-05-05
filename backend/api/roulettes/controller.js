const {
  processRouletteResult,
  getLastResult,
  getResultHistory,
  generateRandomResult
} = require('./service');
const { generateClientKey } = require('./utils/crypto');
const { setupSSEHeaders, addConnection } = require('./utils/stream');

/**
 * Estabelece uma conexão SSE para receber atualizações da roleta
 */
const streamRouletteUpdates = async (req, res) => {
  try {
    const tableId = req.params.tableId;
    
    if (!tableId) {
      return res.status(400).json({
        error: 'Parâmetro inválido',
        message: 'O ID da mesa é obrigatório'
      });
    }
    
    // Configura cabeçalhos para SSE
    setupSSEHeaders(res);
    
    // Adiciona conexão ao gerenciador de streams
    const removeConnection = addConnection(tableId, res);
    
    // Envia um comentário inicial para confirmar conexão
    res.write(': connected to roulette stream\n\n');
    
    // Configura o tratamento de fechamento da conexão
    req.on('close', () => {
      removeConnection();
      console.log(`Conexão SSE fechada para mesa ${tableId}`);
    });
  } catch (error) {
    console.error('Erro ao estabelecer stream da roleta:', error);
    
    // Se os cabeçalhos ainda não foram enviados, retorna erro
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Erro de servidor',
        message: 'Falha ao estabelecer conexão de streaming'
      });
    }
    
    // Caso contrário, tenta encerrar a conexão
    try {
      res.end();
    } catch (e) {
      console.error('Erro ao encerrar conexão SSE:', e);
    }
  }
};

/**
 * Gera uma nova chave de cliente para acesso aos dados da roleta
 */
const generateClientKeyController = async (req, res) => {
  try {
    // Verifica se o usuário está autenticado (isso vem do middleware)
    if (!req.user) {
      return res.status(401).json({
        error: 'Não autorizado',
        message: 'Você precisa estar autenticado para gerar uma chave'
      });
    }
    
    // Define as permissões com base no papel do usuário
    const permissions = ['view_roulette'];
    
    // Se o usuário for admin, adiciona permissão de administração
    if (req.user.role === 'admin') {
      permissions.push('admin_roulette');
    }
    
    // Gera a chave de cliente
    const clientKey = await generateClientKey(req.user.id, permissions);
    
    return res.status(200).json({
      key: clientKey,
      message: 'Chave de cliente gerada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao gerar chave de cliente:', error);
    return res.status(500).json({
      error: 'Erro de servidor',
      message: 'Falha ao gerar chave de cliente'
    });
  }
};

/**
 * Submete manualmente um resultado da roleta (apenas para administradores)
 */
const submitRouletteResult = async (req, res) => {
  try {
    const { tableId } = req.params;
    const resultData = req.body;
    
    if (!tableId || !resultData) {
      return res.status(400).json({
        error: 'Dados inválidos',
        message: 'ID da mesa e dados do resultado são obrigatórios'
      });
    }
    
    // Processa e transmite o resultado
    const result = await processRouletteResult(tableId, resultData);
    
    return res.status(200).json({
      message: 'Resultado da roleta processado com sucesso',
      eventId: result.eventId
    });
  } catch (error) {
    console.error('Erro ao submeter resultado da roleta:', error);
    return res.status(500).json({
      error: 'Erro de servidor',
      message: 'Falha ao processar resultado da roleta'
    });
  }
};

/**
 * Obtém o histórico de resultados da roleta
 */
const getRouletteHistory = async (req, res) => {
  try {
    const { tableId } = req.params;
    const { limit = 20 } = req.query;
    
    if (!tableId) {
      return res.status(400).json({
        error: 'Parâmetro inválido',
        message: 'O ID da mesa é obrigatório'
      });
    }
    
    // Obtém o histórico de resultados
    const history = await getResultHistory(tableId, parseInt(limit));
    
    return res.status(200).json({
      tableId,
      results: history
    });
  } catch (error) {
    console.error('Erro ao obter histórico da roleta:', error);
    return res.status(500).json({
      error: 'Erro de servidor',
      message: 'Falha ao obter histórico da roleta'
    });
  }
};

/**
 * Simula um resultado aleatório e o transmite (apenas para desenvolvimento)
 */
const simulateRandomResult = async (req, res) => {
  try {
    const { tableId } = req.params;
    
    if (!tableId) {
      return res.status(400).json({
        error: 'Parâmetro inválido',
        message: 'O ID da mesa é obrigatório'
      });
    }
    
    // Gera um resultado aleatório
    const randomResult = generateRandomResult();
    
    // Processa e transmite o resultado
    const result = await processRouletteResult(tableId, randomResult);
    
    return res.status(200).json({
      message: 'Resultado aleatório gerado e transmitido com sucesso',
      result: randomResult,
      eventId: result.eventId
    });
  } catch (error) {
    console.error('Erro ao simular resultado aleatório:', error);
    return res.status(500).json({
      error: 'Erro de servidor',
      message: 'Falha ao simular resultado aleatório'
    });
  }
};

module.exports = {
  streamRouletteUpdates,
  generateClientKeyController,
  submitRouletteResult,
  getRouletteHistory,
  simulateRandomResult
}; 