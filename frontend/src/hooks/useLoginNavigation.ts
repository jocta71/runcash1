import { useNavigate } from 'react-router-dom';
import { useLoginModal } from '@/context/LoginModalContext';

/**
 * Hook para facilitar a navegação com autenticação
 * Permite mostrar o modal de login diretamente ou navegar para uma página que mostrará o modal
 */
export const useLoginNavigation = () => {
  const navigate = useNavigate();
  const { showLoginModal } = useLoginModal();

  /**
   * Mostra o modal de login com opções para redirecionamento após login
   */
  const showLoginWithRedirect = (
    redirectAfterLogin?: string,
    message?: string
  ) => {
    const options: Record<string, string> = {};
    
    if (redirectAfterLogin) {
      options.redirectAfterLogin = redirectAfterLogin;
    }
    
    if (message) {
      options.message = message;
    }
    
    if (Object.keys(options).length > 0) {
      showLoginModal(options);
    } else {
      showLoginModal();
    }
  };

  /**
   * Navega para a página inicial com estado para mostrar o modal de login
   * Útil quando não podemos mostrar o modal diretamente (por exemplo, em uma página que não existe)
   */
  const navigateToShowLogin = (
    redirectAfterLogin?: string,
    message?: string,
    targetPath: string = '/'
  ) => {
    const state: Record<string, any> = {
      showLoginModal: true
    };
    
    if (redirectAfterLogin) {
      state.redirectAfterLogin = redirectAfterLogin;
    }
    
    if (message) {
      state.message = message;
    }
    
    navigate(targetPath, { state });
  };

  return {
    showLoginWithRedirect,
    navigateToShowLogin
  };
};

export default useLoginNavigation; 