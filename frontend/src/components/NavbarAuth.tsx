import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn, Moon, Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

// Versão melhorada do NavbarAuth que mostra status do plano para usuários logados
const NavbarAuth = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isLoggedIn = !!user;
  
  const handleSignOut = () => {
    signOut();
    navigate('/login');
  };
  
  // Caso esteja logado, mostrar a interface completa
  if (isLoggedIn && user) {
    // Obter iniciais do nome de usuário para o avatar fallback
    const initials = user.username ? user.username.substring(0, 2).toUpperCase() : 'U';
    
    return (
      <div className="flex items-center space-x-4">
        {/* Modo escuro */}
        <button className="text-gray-300 hover:text-white">
          <Moon className="h-5 w-5" />
        </button>
        
        {/* Notificações */}
        <div className="relative">
          <button className="text-gray-300 hover:text-white">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
              2
            </span>
          </button>
        </div>
        
        {/* Bandeira do país */}
        <div className="flex items-center">
          <img src="/img/br-flag.svg" alt="Brasil" className="h-5 w-5 rounded-full" />
        </div>
        
        {/* Status do plano */}
        <div className="hidden md:block px-2 py-1 bg-green-500 text-white text-xs rounded">
          Premium
        </div>
        
        {/* Perfil do usuário com dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center space-x-2 cursor-pointer hover:opacity-80">
              <Avatar className="h-8 w-8 border border-green-500">
                {user.profilePicture ? (
                  <AvatarImage src={user.profilePicture} alt={user.username} />
                ) : (
                  <AvatarFallback className="bg-green-600 text-white">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex items-center">
                <span className="text-white text-sm font-medium">{user.username}</span>
                <ChevronDown className="h-4 w-4 text-gray-400 ml-1" />
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut} className="text-red-500">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
  
  // Caso não esteja logado, mostrar apenas o botão de entrar
  return (
    <div className="flex items-center space-x-4">
      {/* Modo escuro */}
      <button className="text-gray-300 hover:text-white">
        <Moon className="h-5 w-5" />
      </button>
      
      {/* Bandeira do país */}
      <div className="flex items-center">
        <img src="/img/br-flag.svg" alt="Brasil" className="h-5 w-5 rounded-full" />
      </div>
      
      {/* Botão de login */}
      <Button 
        variant="primary" 
        size="sm" 
        asChild
        className="text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white"
      >
        <Link to="/login">
          <LogIn className="h-4 w-4 mr-1" />
          <span>Entrar</span>
        </Link>
      </Button>
    </div>
  );
};

export default NavbarAuth;
