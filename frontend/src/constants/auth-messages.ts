/**
 * Constantes para mensagens relacionadas à autenticação
 * Centraliza todas as mensagens para garantir consistência em toda a aplicação
 */

export const AUTH_MESSAGES = {
  SESSION_EXPIRED: 'Sessão expirada. Por favor, faça login novamente.',
  SESSION_EXPIRED_PAYMENT: 'Sua sessão expirou durante o processamento do pagamento. Por favor, faça login novamente para ver sua assinatura.',
  LOGIN_REQUIRED: 'Por favor, faça login para continuar.',
  LOGIN_TO_VIEW_SUBSCRIPTION: 'Por favor, faça login para acessar sua conta e verificar sua assinatura.',
  LOGIN_TO_CONTINUE: 'Por favor, faça login para continuar utilizando o RunCash.',
  AUTHENTICATION_ERROR: 'Houve um problema com sua autenticação. Por favor, faça login novamente.'
};

/**
 * Seleciona a mensagem adequada com base no contexto da expiração da sessão
 * @param context O contexto em que a sessão expirou
 * @returns A mensagem apropriada para o contexto
 */
export const getSessionExpiredMessage = (context?: 'payment' | 'subscription' | 'account' | 'generic') => {
  switch (context) {
    case 'payment':
      return AUTH_MESSAGES.SESSION_EXPIRED_PAYMENT;
    case 'subscription':
      return AUTH_MESSAGES.LOGIN_TO_VIEW_SUBSCRIPTION;
    case 'account':
      return AUTH_MESSAGES.LOGIN_TO_CONTINUE;
    case 'generic':
    default:
      return AUTH_MESSAGES.SESSION_EXPIRED;
  }
};

export default AUTH_MESSAGES; 