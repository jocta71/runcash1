/**
 * Funções de tratamento de erros para API
 */

/**
 * Wrapper para funções assíncronas de API que trata erros automaticamente
 * 
 * @param {Function} fn - Função assíncrona de manipulação
 * @returns {Function} - Função com tratamento de erro
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    console.error('Erro na API:', error);
    
    // Enviar resposta de erro
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  });
};

module.exports = {
  asyncHandler
}; 