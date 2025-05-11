/**
 * Classe para padronizar respostas de erro na API
 * Estende a classe Error nativa do JavaScript para adicionar
 * um código de status HTTP à mensagem de erro
 */
class ErrorResponse extends Error {
  constructor(message, statusCode, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
  }
}

module.exports = ErrorResponse; 