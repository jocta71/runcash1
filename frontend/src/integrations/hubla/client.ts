/**
 * Cliente para integração com Hubla
 */
import Cookies from 'js-cookie';

// Links de pagamento da Hubla (configurados no painel)
// Estas constantes servem como fallback caso as variáveis de ambiente não estejam definidas
const DEFAULT_CHECKOUT_URLS: Record<string, string> = {
  basic: 'https://pay.hub.la/sD6k3KyqLtK7Kyyyl5YA',
  pro: 'https://pay.hub.la/5dYVW0YLLn8qC3dPQDFf'
};

// Função para obter os URLs de checkout, priorizando variáveis de ambiente
const getCheckoutUrls = (): Record<string, string> => {
  // Verificar se as variáveis de ambiente estão definidas
  const basicUrl = process.env.NEXT_PUBLIC_HUBLA_CHECKOUT_URL_BASIC;
  const proUrl = process.env.NEXT_PUBLIC_HUBLA_CHECKOUT_URL_PRO;
  
  // Verificar se estamos em modo sandbox
  const isSandbox = process.env.NEXT_PUBLIC_HUBLA_SANDBOX_MODE === 'true';
  
  // Se estamos em modo sandbox, usar URLs de sandbox se disponíveis
  if (isSandbox) {
    const sandboxBasicUrl = process.env.NEXT_PUBLIC_HUBLA_SANDBOX_URL_BASIC;
    const sandboxProUrl = process.env.NEXT_PUBLIC_HUBLA_SANDBOX_URL_PRO;
    
    return {
      basic: sandboxBasicUrl || basicUrl || DEFAULT_CHECKOUT_URLS.basic,
      pro: sandboxProUrl || proUrl || DEFAULT_CHECKOUT_URLS.pro
    };
  }
  
  // Se não estamos em modo sandbox, usar URLs de produção se disponíveis
  return {
    basic: basicUrl || DEFAULT_CHECKOUT_URLS.basic,
    pro: proUrl || DEFAULT_CHECKOUT_URLS.pro
  };
};

// Obter URLs de checkout
const HUBLA_CHECKOUT_URLS = getCheckoutUrls();

/**
 * Verifica se o usuário está em condições de prosseguir com o checkout
 * @param user Objeto do usuário atual
 * @returns Objeto com status da verificação e mensagem de erro, se houver
 */
export const verifyCheckoutEligibility = (user: any): { isEligible: boolean; message?: string } => {
  // Verificar se o usuário existe
  if (!user) {
    console.error('Usuário não encontrado');
    return { isEligible: false, message: 'Usuário não encontrado. Por favor, faça login.' };
  }

  // Verificar se o ID do usuário está presente (pode estar em user.id ou user._id)
  const userId = user.id || user._id;
  if (!userId) {
    console.error('ID do usuário não encontrado:', user);
    return { isEligible: false, message: 'ID do usuário não disponível. Por favor, faça login novamente.' };
  }

  // Verificar se o token de autenticação está presente (verificando cookie primeiro, depois localStorage como fallback)
  const tokenCookie = Cookies.get('token');
  
  if (!tokenCookie) {
    // Se não encontrar o token no cookie, verificar o localStorage
    try {
      const authData = localStorage.getItem('auth');
      if (!authData) {
        console.warn('Dados de autenticação não encontrados no cookie nem no localStorage');
        return { isEligible: false, message: 'Sessão expirada. Por favor, faça login novamente.' };
      }
    } catch (error) {
      // Em caso de erro ao acessar localStorage (ex: navegação privada)
      console.warn('Erro ao verificar autenticação no localStorage:', error);
      
      // Se tem um ID de usuário válido, consideramos elegível mesmo sem token no storage
      // já que o token pode estar sendo gerenciado de outra forma (ex: HttpOnly cookie)
      if (userId) {
        console.log('Usuário possui ID válido, prosseguindo mesmo sem token no storage');
        return { isEligible: true };
      }
      
      return { isEligible: false, message: 'Não foi possível verificar sua sessão. Por favor, faça login novamente.' };
    }
  }

  // Se passou por todas as verificações, o usuário está elegível
  return { isEligible: true };
};

/**
 * Redireciona para checkout da Hubla com metadados do usuário
 * @param planId ID do plano a ser assinado ('basic' ou 'pro')
 * @param userId ID do usuário que está assinando (obrigatório para segurança)
 * @returns URL de redirecionamento para o checkout
 */
export const redirectToHublaCheckout = (planId: string, userId: string): string => {
  // Verificar se temos um link para este plano
  if (!HUBLA_CHECKOUT_URLS[planId]) {
    console.error(`Link de checkout não encontrado para o plano: ${planId}`);
    throw new Error(`Plano não suportado: ${planId}`);
  }

  // Verificar se o userId foi fornecido
  if (!userId) {
    console.error('ID do usuário é obrigatório para checkout');
    throw new Error('ID do usuário não fornecido');
  }
  
  // Adicionar metadados à URL do checkout
  const baseUrl = HUBLA_CHECKOUT_URLS[planId];
  
  // Antes de redirecionar, garantir que temos o token salvo no cookie para evitar perda de login
  const token = Cookies.get('token');
  if (token) {
    try {
      // Tentar reforçar o cookie (aumentar a validade)
      Cookies.set('token', token, { expires: 30, path: '/' });
      console.log('Token reforçado no cookie antes do redirecionamento');
    } catch (error) {
      console.warn('Não foi possível reforçar o token no cookie:', error);
    }
  }
  
  const checkoutUrl = `${baseUrl}?metadata[userId]=${encodeURIComponent(userId)}&metadata[planId]=${encodeURIComponent(planId)}`;
  
  console.log(`Redirecionando para checkout com metadados: userId=${userId}, planId=${planId}`);
  return checkoutUrl;
}; 