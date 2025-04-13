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
        <div className="flex items-center">
          <span className="bg-green-500 w-6 h-6 rounded-full flex items-center justify-center mr-1">
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11.5 7V9H11C10.45 9 10 9.45 10 10C10 10.55 10.45 11 11 11H13V13H10V15H13C13.55 15 14 14.55 14 14V12C14 11.45 13.55 11 13 11H11V9H14V7H11.5Z" fill="currentColor"/>
            </svg>
          </span>
          <span className="text-white text-sm">2.500,00</span>
        </div>
        
        {/* Avatar do usuário com Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full bg-transparent">
              <div className="bg-transparent text-white h-8 w-8 rounded-full flex items-center justify-center">
                U
              </div>
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
