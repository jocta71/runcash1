import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import { Search, Wallet, Loader2 } from 'lucide-react';
import ProfileDropdown from './ProfileDropdown';
import { Link } from 'react-router-dom';
import { RouletteRepository } from '../services/data/rouletteRepository';

interface LayoutProps {
  children: React.ReactNode;
  preloadData?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, preloadData = false }) => {
  const [searchQuery, setSearchQuery] = useState('');
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
      {/* Barra de navegação superior - z-index mais baixo (20) para ficar abaixo dos sidebars */}
      <nav className="sticky top-0 z-20 w-full bg-[#141318] border-b border-[#2a2a2e] px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="font-bold text-xl text-green-500">RunCash</span>
          </Link>

          {/* Barra de pesquisa central */}
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar..."
                className="bg-[#1e1e24] border border-[#2a2a2e] rounded-full px-4 py-2 pl-10 w-full text-sm text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Itens da direita */}
          <div className="flex items-center space-x-4">
            {/* Saldo */}
            <div className="hidden md:flex items-center bg-[#1e1e24] px-3 py-1.5 rounded-lg border border-[#2a2a2e]">
              <Wallet className="h-4 w-4 text-green-500 mr-2" />
              <span className="text-sm font-medium">R$ 2.500,00</span>
            </div>
            
            {/* Perfil */}
            <ProfileDropdown />
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
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <ChatUI isOpen={true} />
        </div>
      </div>
    </div>
  );
};

export default Layout; 