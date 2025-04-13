import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LogOut, User, Lock, Settings, Download, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NavbarAuth = () => {
  const { user, signOut } = useAuth();
  const isLoggedIn = !!user;
  
  // Caso esteja logado, mostrar apenas o saldo e o avatar
  if (isLoggedIn && user) {
    // Obter iniciais do nome de usuário para o avatar
    const initials = user.username ? user.username.substring(0, 1).toUpperCase() : 'U';
    
    // Formatar o valor do saldo
    const formatCurrency = (value) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(value || 0);
    };

    return (
      <div className="flex items-center space-x-4">
        {/* Saldo */}
        <div className="flex items-center">
          <Button variant="ghost" className="text-white bg-transparent hover:bg-transparent">
            <span className="text-sm font-medium">{formatCurrency(2500)}</span>
          </Button>
        </div>
        
        {/* Perfil do usuário com Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="h-8 w-8 rounded-full p-0 bg-transparent hover:bg-transparent"
            >
              {user.profilePicture ? (
                <img 
                  src={user.profilePicture} 
                  alt="Avatar" 
                  className="h-8 w-8 rounded-full object-cover" 
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-white">
                  {initials}
                </div>
              )}
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
  
  // Caso não esteja logado, mostrar apenas um link para login
  return (
    <div className="flex items-center">
      <Button 
        variant="ghost" 
        size="sm" 
        asChild
        className="text-sm bg-transparent hover:bg-transparent text-white"
      >
        <Link to="/login">
          Entrar
        </Link>
      </Button>
    </div>
  );
};

export default NavbarAuth;
