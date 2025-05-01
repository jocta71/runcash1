/**
   * Verifica se o usuário possui assinatura ativa
   * @returns Promise com o status da assinatura
   */
  public async checkSubscriptionStatus(): Promise<{ hasSubscription: boolean; subscription?: any }> {
    try {
      console.log('[API] Verificando status da assinatura...');
      
      // URL da API com caminho completo para garantir que vai para o backend correto
      // Adicionar timestamp para evitar cache do navegador
      const endpoint = '/subscription/status?_t=' + Date.now();
      console.log(`[API] Chamando endpoint: ${endpoint}`);
      
      const response = await this.get<any>(endpoint);
      
      // Verificar se a resposta é válida
      const data = response.data || {};
      
      // Verificar se a resposta contém "<!DOCTYPE html>" - isso indica que recebemos HTML em vez de JSON
      if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
        console.error('[API] Erro: Recebida resposta HTML em vez de JSON do endpoint de assinatura');
        throw new Error('Resposta inválida do servidor');
      }
      
      // Log detalhado para diagnóstico
      console.log('[API] Resposta da verificação de assinatura:', JSON.stringify(data, null, 2));
      
      // Verificar se o usuário tem assinatura ativa baseado nos dados recebidos
      // Verificação explícita de status "active" para tornar mais robusto
      const hasActiveSubscription = !!(
        data.success && 
        data.hasSubscription && 
        data.subscription?.status?.toLowerCase() === 'active'
      );
      
      // Verificar se o usuário tem assinatura, mas não está ativa
      const hasInactiveSubscription = !!(
        data.success &&
        data.subscription &&
        data.subscription.status &&
        data.subscription.status.toLowerCase() !== 'active'
      );
      
      if (hasInactiveSubscription) {
        console.log(`[API] Usuário possui assinatura INATIVA com status: ${data.subscription.status}`);
        // Disparar evento informando que a assinatura existe mas está inativa
        window.dispatchEvent(new CustomEvent('subscription:inactive', { 
          detail: { 
            subscription: data.subscription,
            status: data.subscription.status,
            message: 'Sua assinatura existe mas não está ativa. Verifique o status do pagamento.'
          } 
        }));
      }
      
      console.log(`[API] Status da assinatura: ${hasActiveSubscription ? 'ATIVA' : 'INATIVA/INEXISTENTE'}`);
      if (data.subscription) {
        console.log(`[API] Tipo do plano: ${data.subscription.plan || data.subscription.type || 'Desconhecido'}, Status: ${data.subscription.status}`);
      }
      
      // Armazenar os dados da assinatura no cache local para uso como fallback
      if (data.subscription) {
        try {
          localStorage.setItem('api_subscription_cache', JSON.stringify({
            data: data.subscription,
            timestamp: Date.now()
          }));
          console.log('[API] Dados da assinatura armazenados em cache');
        } catch (cacheError) {
          console.warn('[API] Erro ao armazenar cache de assinatura:', cacheError);
        }
      }
      
      return {
        hasSubscription: hasActiveSubscription,
        subscription: data.subscription
      };
    } catch (error) {
      console.error('[API] Erro ao verificar status da assinatura:', error);
      
      // Tentar usar dados em cache como fallback
      try {
        // Verificar cache da API primeiro
        const apiCache = localStorage.getItem('api_subscription_cache');
        if (apiCache) {
          const cacheData = JSON.parse(apiCache);
          // Verificar se o cache não está muito antigo (menos de 1 hora)
          if (Date.now() - cacheData.timestamp < 3600000) {
            const subData = cacheData.data;
            const isActive = subData.status?.toLowerCase() === 'active' || 
                           subData.status?.toLowerCase() === 'ativo';
            
            console.log('[API] Usando dados de API em cache:', isActive ? 'ATIVA' : 'INATIVA');
            return { 
              hasSubscription: isActive,
              subscription: subData
            };
          }
        }
        
        // Tentar usar dados do SubscriptionContext como fallback secundário
        const storedSubscription = localStorage.getItem('user_subscription_cache');
        if (storedSubscription) {
          const subData = JSON.parse(storedSubscription);
          const isActive = subData.status?.toLowerCase() === 'active' || 
                         subData.status?.toLowerCase() === 'ativo';
          
          console.log('[API] Usando dados de assinatura em cache do contexto:', isActive ? 'ATIVA' : 'INATIVA');
          return { 
            hasSubscription: isActive,
            subscription: subData
          };
        }
      } catch (fallbackError) {
        console.error('[API] Erro ao usar fallback de assinatura:', fallbackError);
      }
      
      // Se nenhum cache estiver disponível, retornar resultado negativo
      return { hasSubscription: false };
    }
  } 