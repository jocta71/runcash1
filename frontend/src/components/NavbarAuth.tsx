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
  
  // Caso esteja logado, mostrar o saldo e menu do usuário
  if (isLoggedIn && user) {
    return (
      <div className="flex items-center gap-3">
        {/* Saldo */}
        <div className="flex items-center space-x-1">
          <svg width="20" height="20" viewBox="0 0 20 20" className="text-[#00ff00]" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" />
          </svg>
          <span className="text-white text-sm font-medium">R$ 2.500,00</span>
        </div>
        
        {/* Avatar do usuário com Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="h-8 w-8 rounded-full p-0 bg-[#00ff00] hover:bg-[#00cc00] text-black font-medium"
            >
              U
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
