import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, Moon, Bell, User, Lock, Settings, Download, Upload, CreditCard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    
    // Formatar o valor do saldo
    const formatCurrency = (value) => {
      return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value || 0);
    };

    return (
      <div className="flex items-center space-x-4">
        {/* Saldo */}
        <div className="flex items-center text-white bg-blue-600 rounded-full px-3 py-1">
          <span className="text-sm font-medium">{formatCurrency(1346.34)}</span>
        </div>
        
        {/* Botão de Saldo */}
        <Button 
          variant="default" 
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <CreditCard className="h-4 w-4 mr-2" />
          <span>Saldo</span>
        </Button>

        {/* Perfil do usuário com Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 rounded-full flex items-center space-x-2 p-1">
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
              <span className="text-white font-medium text-sm">{displayName}</span>
              <span className="bg-green-600 h-6 w-6 rounded-full flex items-center justify-center text-white ml-1">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent className="w-56 bg-gray-900 border-gray-800" align="end">
            <DropdownMenuLabel className="text-white">Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-800" />
            
            <DropdownMenuItem className="text-white hover:bg-gray-800">
              <User className="mr-2 h-4 w-4" />
              <span>Editar Perfil</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem className="text-white hover:bg-gray-800">
              <Lock className="mr-2 h-4 w-4" />
              <span>Alterar Senha</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem className="text-white hover:bg-gray-800">
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-gray-800" />
            
            <DropdownMenuItem className="text-white hover:bg-gray-800">
              <Download className="mr-2 h-4 w-4" />
              <span>Depositar</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem className="text-white hover:bg-gray-800">
              <Upload className="mr-2 h-4 w-4" />
              <span>Sacar</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-gray-800" />
            
            <DropdownMenuItem onClick={signOut} className="text-white hover:bg-gray-800">
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
        variant="default" 
        size="sm" 
        asChild
        className="text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white"
      >
        <Link to="/login">
          <LogOut className="h-4 w-4 mr-1" />
          <span>Entrar</span>
        </Link>
      </Button>
    </div>
  );
};

export default NavbarAuth;
