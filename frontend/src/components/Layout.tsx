import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import { Loader2, LogOut, Search, Wallet, Menu, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RouletteRepository } from '../services/data/rouletteRepository';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import ProfileDropdown from './ProfileDropdown';
import AnimatedInsights from './AnimatedInsights';

// Interface estendida para o usuário com firstName e lastName
interface ExtendedUser {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  profilePicture?: string;
  firstName?: string;
  lastName?: string;
}

interface LayoutProps {
  children: React.ReactNode;
  preloadData?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, preloadData = false }) => {
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(preloadData);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Cast para o tipo estendido para acessar firstName e lastName
  const extUser = user as unknown as ExtendedUser;
  
  // Função para obter o nome de exibição (nome completo ou username como fallback)
  const getDisplayName = () => {
    if (extUser?.firstName || extUser?.lastName) {
      return `${extUser.firstName || ''} ${extUser.lastName || ''}`.trim();
    }
    return extUser?.username || 'Usuário';
  };

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

  const handleSignOut = async () => {
    if (signOut) {
      await signOut();
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen flex bg-vegas-black">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 min-h-screen fixed left-0 top-0 z-30 overflow-y-auto">
        <Sidebar />
      </div>
      
      {/* Mobile Sidebar (drawer) */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isMobile={true} />
      
      <div className="flex-1 relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-[#33333359] bg-[#131614]">
          <button 
            className="p-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} className="bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] bg-clip-text text-transparent" />
          </button>
          
          <button 
            className="p-2"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquare size={24} className="bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] bg-clip-text text-transparent" />
          </button>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden md:flex fixed top-0 left-0 right-0 md:left-64 z-40 h-[70px] items-center justify-between px-4 border-b border-[#33333359] bg-[#131614]">
          <div className="flex items-center gap-2">
            {/* Logo e caixa de pesquisa removidos conforme solicitado */}
          </div>
          
          <AnimatedInsights />
          
          <div className="flex items-center gap-3">
            <Button variant="default" size="sm" asChild className="h-8 text-white font-medium bg-gradient-to-b from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900">
              <Link to="/planos">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> Planos
              </Link>
            </Button>
            
            {/* Informações do usuário */}
            {user && (
              <div className="hidden lg:flex items-center bg-[#1A191F]/70 rounded-full px-3 py-1 text-white">
                <span className="text-xs font-medium">Olá, {getDisplayName()}</span>
              </div>
            )}
            
            <ProfileDropdown />
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="h-8 text-red-500 border-red-500 hover:bg-red-500/10"
            >
              <LogOut size={14} className="mr-1" /> Sair
            </Button>
          </div>
        </div>
        
        {/* Mobile User Info */}
        <div className="md:hidden flex justify-between items-center px-4 py-3">
          <div className="flex items-center gap-2">
            {user && (
              <div className="flex items-center bg-[#1A191F]/70 rounded-full px-3 py-1 text-white mr-2">
                <span className="text-xs font-medium">Olá, {getDisplayName()}</span>
              </div>
            )}
            <ProfileDropdown />
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="h-8 text-red-500 border-red-500 hover:bg-red-500/10"
            >
              <LogOut size={14} className="mr-1" /> Sair
            </Button>
          </div>
          
          <Button variant="default" size="sm" asChild className="h-8 text-white font-medium bg-gradient-to-b from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900">
            <Link to="/planos">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> Planos
            </Link>
          </Button>
        </div>
        
        {/* Mobile Insights */}
        <div className="md:hidden px-4 py-2">
          <div className="bg-[#1A191F]/50 rounded-lg p-3">
            <AnimatedInsights />
          </div>
        </div>
        
        {/* Área do conteúdo principal */}
        <main className="pt-4 md:pt-[70px] pb-8 px-4 md:px-6 md:pl-[280px] w-full min-h-screen bg-[#131614]">
          {children}
        </main>
      </div>
      
      {/* Chat fixo na parte inferior */}
      <div className="fixed bottom-0 right-0 w-[400px] h-[600px] z-40">
        <ChatUI isOpen={true} />
      </div>
      
      {/* Mobile Chat (drawer) */}
      <ChatUI isOpen={chatOpen} onClose={() => setChatOpen(false)} isMobile={true} />
    </div>
  );
};

export default Layout; 