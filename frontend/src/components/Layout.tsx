import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import { Wallet, Loader2, User, Lock, Settings, Download, Upload, LogOut } from 'lucide-react';
import ProfileDropdown from './ProfileDropdown';
import { Link } from 'react-router-dom';
import { RouletteRepository } from '../services/data/rouletteRepository';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  preloadData?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, preloadData = false }) => {
  const { user, signOut } = useAuth();
  // Estado da busca removido
  const [isLoading, setIsLoading] = useState(preloadData);
  const [error, setError] = useState<string | null>(null);

  // Pré-carregar dados das roletas se preloadData for verdadeiro
  useEffect(() => {
    const preloadRouletteData = async () => {
      if (!preloadData) return;
      
      try {
        setIsLoading(true);
        console.log('[Layout] Pré-carregando dados da API...');
        
        // Buscar todas as roletas usando o novo repositório
        const data = await RouletteRepository.fetchAllRoulettesWithNumbers();
        
        if (!data || !Array.isArray(data)) {
          throw new Error('Dados inválidos retornados pela API');
        }
        
        console.log(`[Layout] Dados pré-carregados com sucesso (${data.length} roletas)`);
      } catch (err) {
        console.error('[Layout] Erro ao pré-carregar dados:', err);
        setError('Não foi possível carregar os dados. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };
    
    preloadRouletteData();
  }, [preloadData]);

  // Renderizar tela de carregamento se estiver carregando
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#100f13] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-16 h-16 text-green-500 animate-spin mb-4" />
        <h2 className="text-2xl font-bold mb-2">Carregando dados</h2>
        <p className="text-gray-400">Aguarde enquanto carregamos os dados da API...</p>
      </div>
    );
  }

  // Renderizar tela de erro
  if (error) {
    return (
      <div className="min-h-screen bg-[#100f13] flex flex-col items-center justify-center text-white">
        <div className="bg-red-900/30 p-6 rounded-lg max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Erro ao carregar dados</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#100f13] text-white">
      {/* Barra de navegação superior */}
      <nav className="sticky top-0 z-20 w-full bg-black border-b border-[#111] px-6 py-2">
        <div className="flex items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-[#00ff00] font-bold text-xl">
              RunCash
            </Link>
          </div>
          
          {/* Menu de navegação (lado esquerdo) */}
          <div className="ml-4 text-xs text-gray-400">
            <span>Jogos</span>
          </div>
          
          {/* Espaço flexível */}
          <div className="flex-grow"></div>
          
          {/* Itens da direita */}
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
                
                <DropdownMenuItem className="text-white hover:bg-gray-800" asChild>
                  <Link to="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Editar Perfil</span>
                  </Link>
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
                
                <DropdownMenuItem onClick={() => signOut()} className="text-white hover:bg-gray-800">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>
      
      <div className="flex relative">
        {/* Sidebar esquerdo fixo com z-index alto (30) */}
        <div className="hidden md:block w-64 min-h-screen fixed left-0 top-0 z-30">
          <Sidebar />
        </div>
        
        {/* Área do conteúdo principal com padding à esquerda para compensar o sidebar fixo */}
        <main className="flex-1 p-0 md:ml-64 relative">
          {children}
        </main>
        
        {/* Chat fixo na parte inferior */}
        <div className="fixed bottom-0 right-0 w-[400px] h-[600px] z-50">
          <ChatUI isOpen={true} />
        </div>
      </div>
    </div>
  );
};

export default Layout; 