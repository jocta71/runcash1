import { useLoginNavigation } from './useLoginNavigation';
import { getSessionExpiredMessage } from '@/constants/auth-messages';

/**
 * Hook para gerenciar o comportamento quando uma sessão expirou
 * Centraliza a lógica para garantir um comportamento consistente em toda a aplicação
 */
export const useSessionExpiration = () => {
  const { showLoginWithRedirect, navigateToShowLogin } = useLoginNavigation();

  /**
   * Trata a expiração de sessão, mostrando o modal de login com a mensagem adequada
   * 
   * @param redirectPath Caminho para redirecionar após o login
   * @param context Contexto da expiração para personalizar a mensagem
   * @param useNavigate Se true, usa navegação em vez de mostrar o modal diretamente
   */
  const handleSessionExpired = (
    redirectPath?: string,
    context?: 'payment' | 'subscription' | 'account' | 'generic',
    useNavigate = false
  ) => {
    const message = getSessionExpiredMessage(context);
    
    if (useNavigate) {
      navigateToShowLogin(redirectPath, message);
    } else {
      showLoginWithRedirect(redirectPath, message);
    }
  };

  return {
    handleSessionExpired
  };
};

export default useSessionExpiration; 