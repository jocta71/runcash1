import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import { Loader2, LogOut } from 'lucide-react';
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
      <nav className="bg-[#0B0A0F] border-b border-[#33333359] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center">
                <span className="font-bold text-xl text-[#00ff00]">RunCash</span>
              </Link>
            </div>

            {/* Autenticação do usuário */}
            <div>
              {user ? (
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
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  asChild
                  className="text-xs sm:text-sm"
                >
                  <Link to="/auth">
                    <span>Login</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>
      
      {/* Conteúdo principal */}
      <div className="flex flex-1 relative">
        {/* Sidebar esquerdo */}
        <div className="hidden md:block w-64 fixed left-0 top-16 bottom-0 z-30 overflow-y-auto">
          <Sidebar />
        </div>
        
        {/* Área do conteúdo principal */}
        <main className="flex-1 p-0 md:ml-64 relative min-h-[calc(100vh-4rem)]">
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