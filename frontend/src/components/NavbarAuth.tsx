import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogIn, Moon, Bell, ChevronDown, User } from 'lucide-react';
import { useContext } from 'react';
import { useAuth } from '@/context/AuthContext';

// Versão melhorada do NavbarAuth que mostra status do plano para usuários logados
const NavbarAuth = () => {
  const { user, signOut } = useAuth();
  const isLoggedIn = !!user;
  
  // Caso esteja logado, mostrar a interface completa
  if (isLoggedIn && user) {
    // Obter iniciais do nome de usuário para o avatar
    const initials = user.username ? user.username.substring(0, 2).toLowerCase() : 'u';
    
    // Formatar nome de exibição (remover números e formatação específica)
    const displayName = user.username 
      ? user.username
          .replace(/\d+$/, '') // Remove números ao final do username
          .replace(/^(\w)/, m => m.toUpperCase()) // Capitaliza a primeira letra
      : 'Usuário';
    
    return (
      <div className="flex items-center space-x-4">
        {/* Alternador de tema */}
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
        
        {/* Perfil do usuário */}
        <div className="flex items-center space-x-2 cursor-pointer group">
          {/* Avatar com foto de perfil ou iniciais */}
          {user.profilePicture ? (
            <img 
              src={user.profilePicture} 
              alt={displayName}
              className="h-8 w-8 rounded-full object-cover border border-green-500" 
            />
          ) : (
            <div className="bg-green-600 h-8 w-8 rounded-full flex items-center justify-center text-white">
              {initials}
            </div>
          )}
          
          {/* Nome do usuário */}
          <div className="flex items-center">
            <span className="text-white font-medium text-sm">{displayName}</span>
            <ChevronDown className="h-4 w-4 text-gray-400 ml-1" />
          </div>
          
          {/* Menu dropdown (visível apenas no hover) */}
          <div className="absolute top-16 right-4 bg-background border border-border rounded-md shadow-lg p-2 hidden group-hover:block z-50">
            <div className="px-3 py-2 border-b border-gray-700 mb-2">
              <div className="font-medium text-white">{displayName}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
            </div>
            <Link to="/profile" className="text-white hover:text-primary text-sm block w-full text-left px-3 py-2 rounded hover:bg-secondary">
              <User className="h-4 w-4 inline mr-2" />
              Meu Perfil
            </Link>
            <button onClick={signOut} className="text-white hover:text-primary text-sm block w-full text-left px-3 py-2 rounded hover:bg-secondary">
              <LogIn className="h-4 w-4 inline mr-2 rotate-180" />
              Sair
            </button>
          </div>
        </div>
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
        variant="default" 
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
