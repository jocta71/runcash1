import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import { Loader2, LogOut, Search, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RouletteRepository } from '../services/data/rouletteRepository';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';

interface LayoutProps {
  children: React.ReactNode;
  preloadData?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, preloadData = false }) => {
  const { user, signOut } = useAuth();
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

  const handleSignOut = async () => {
    if (signOut) {
      await signOut();
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-[#100f13] text-white flex flex-col">
      {/* Barra de navegação integrada */}
      <nav className="bg-black border-b border-[#33333359] sticky top-0 z-50">
        <div className="w-full px-4">
          <div className="flex items-center h-14 justify-between">
            {/* Lado esquerdo: Logo e busca */}
            <div className="flex items-center gap-4">
              {/* Logo */}
              <Link to="/" className="flex items-center">
                <span className="font-bold text-2xl text-white">RunCash</span>
              </Link>
              
              {/* Campo de busca */}
              <div className="relative hidden md:flex items-center">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  type="search" 
                  placeholder="Pesquisar roleta..." 
                  className="pl-10 pr-4 py-1.5 rounded-md border border-gray-800 bg-[#111111] text-sm text-gray-300 w-60 focus:outline-none focus:ring-1 focus:ring-[#00ff00] focus:border-[#00ff00]"
                />
              </div>
            </div>
            
            {/* Centro: Números quentes */}
            <div className="hidden md:flex items-center justify-center gap-2">
              <Star className="h-4 w-4 text-[#00ff00]" />
              <span className="text-gray-400 text-sm">Números quentes:</span>
              <span className="text-white font-medium">7, 11, 23</span>
            </div>
            
            {/* Lado direito: Saldo, Avatar e Botões */}
            <div className="flex items-center gap-3">
              {/* Saldo */}
              <div className="hidden md:flex items-center gap-2 bg-blue-900/20 px-3 py-1 rounded-full">
                <div className="h-5 w-5 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white font-bold">R$</div>
                <span className="text-white">1.346,34</span>
              </div>
              
              {/* Botão de Saldo */}
              <Button className="hidden md:flex bg-[#00ff00] hover:bg-[#00cc00] text-black font-medium px-4 h-8">
                Saldo
              </Button>
              
              {/* Avatar e nome do usuário */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="h-8 w-8 bg-purple-600 rounded-full flex items-center justify-center text-white">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-black"></div>
                </div>
                <span className="hidden md:inline-block text-sm font-medium">Usuário</span>
                <div className="text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Conteúdo principal */}
      <div className="flex flex-1 relative">
        {/* Sidebar esquerdo */}
        <div className="hidden md:block w-64 fixed left-0 top-14 bottom-0 z-30 overflow-y-auto">
          <Sidebar />
        </div>
        
        {/* Área do conteúdo principal */}
        <main className="flex-1 p-0 md:ml-64 relative min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
        
        {/* Chat fixo na parte inferior */}
        <div className="fixed bottom-0 right-0 w-[400px] h-[600px] z-40">
          <ChatUI isOpen={true} />
        </div>
      </div>
    </div>
  );
};

export default Layout; 