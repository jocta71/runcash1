import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useLoginModal } from '@/context/LoginModalContext';
import { LogOut, LogIn } from 'lucide-react';
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

  const handleLoginClick = () => {
    // Resetar o estado de fechamento manual e mostrar o modal
    resetModalClosed();
    showLoginModal();
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

  // Caso contrário, mostrar botão de login
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleLoginClick}
      className="text-xs sm:text-sm"
    >
      <LogIn className="h-4 w-4 mr-1" />
      <span className="hidden sm:inline">Login</span>
    </Button>
  );
};

export default NavbarAuth; 