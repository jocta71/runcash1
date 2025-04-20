import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useLoginModal } from '@/context/LoginModalContext';
import { LogOut, LogIn, UserPlus } from 'lucide-react';
import { useEffect } from 'react';

const NavbarAuth = () => {
  const { user, signOut } = useAuth();
  const { showLoginModal, resetModalClosed } = useLoginModal();
  const navigate = useNavigate();

  // Log para depuração do estado de autenticação
  useEffect(() => {
    console.log('[NavbarAuth] Estado de autenticação:', user ? 'Autenticado' : 'Não autenticado');
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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