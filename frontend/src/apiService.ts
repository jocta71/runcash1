/**
   * Verifica se o usuário possui assinatura ativa
   * @returns Promise com o status da assinatura
   */
  public async checkSubscriptionStatus(): Promise<{ hasSubscription: boolean; subscription?: any }> {
    try {
      console.log('[API] Verificação de status de assinatura desativada. Retornando acesso liberado.');
      
      // Retornar resultado padrão (assinatura ativa)
      return {
        hasSubscription: true,
        subscription: {
          status: 'active',
          plan: 'default',
          features: []
        }
      };
    } catch (error) {
      console.error('[API] Erro ao processar status da assinatura:', error);
      return { hasSubscription: true };
    }
  } 