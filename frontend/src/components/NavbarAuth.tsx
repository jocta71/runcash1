import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useLoginModal } from '@/context/LoginModalContext';
import { LogOut, LogIn, UserPlus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie'; // Certifique-se de que js-cookie está instalado

const NavbarAuth = () => {
  const { user, signOut, setUser } = useAuth();
  const { showLoginModal, resetModalClosed } = useLoginModal();
  const navigate = useNavigate();
  // Estado para controlar a visibilidade do botão de depuração
  const [showDebug] = useState(true); // Definir como false após resolver o problema

  // Log para depuração do estado de autenticação
  useEffect(() => {
    console.log('[NavbarAuth] Estado de autenticação:', user ? 'Autenticado' : 'Não autenticado');
    if (user) {
      console.log('[NavbarAuth] Detalhes do usuário:', user);
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Função para forçar a limpeza completa de dados
  const forceCleanup = () => {
    console.log('[NavbarAuth] Forçando limpeza completa de dados de autenticação');
    
    // Limpar cookies
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
    }
    
    // Limpar js-cookie
    Cookies.remove('token', { path: '/' });
    
    // Limpar localStorage
    localStorage.clear();
    
    // Limpar sessionStorage
    sessionStorage.clear();
    
    // Forçar estado a null
    setUser(null);
    
    // Recarregar a página para garantir
    window.location.reload();
  };

  const handleLoginClick = (activeTab = 'login') => {
    // Resetar o estado de fechamento manual e mostrar o modal
    resetModalClosed();
    // Mostrar o modal com a aba selecionada (login ou register)
    showLoginModal();
    // A mudança de aba pode ser implementada através de um estado no contexto
    // ou passando um parâmetro para showLoginModal
    
    // Emitir um evento personalizado para o LoginModal mudar para a aba desejada
    window.dispatchEvent(new CustomEvent('set-login-tab', { detail: activeTab }));
  };

  // Se houver um usuário autenticado, mostrar informações do usuário e botão de sair
  if (user) {
    return (
      <div className="flex items-center gap-2">
        {showDebug && (
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={forceCleanup}
            className="text-xs sm:text-sm bg-red-500 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Forçar Logout</span>
          </Button>
        )}
        <span className="text-sm hidden md:inline-block">
          {user.email?.split('@')[0]}
        </span>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSignOut}
          className="text-xs sm:text-sm"
        >
          <LogOut className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Sair</span>
        </Button>
      </div>
    );
  }

  // Caso contrário, mostrar botões de registro e login
  return (
    <div className="flex items-center gap-2">
      {showDebug && (
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={forceCleanup}
          className="text-xs sm:text-sm bg-red-500 text-white"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Limpar Dados</span>
        </Button>
      )}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => handleLoginClick('register')}
        className="text-xs sm:text-sm"
      >
        <UserPlus className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Registrar</span>
      </Button>
      
      <Button 
        variant="default" 
        size="sm" 
        onClick={() => handleLoginClick('login')}
        className="text-xs sm:text-sm bg-vegas-green text-gray-900 hover:bg-vegas-green/90"
      >
        <LogIn className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Entrar</span>
      </Button>
    </div>
  );
};

export default NavbarAuth; 