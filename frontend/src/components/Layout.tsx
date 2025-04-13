import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RouletteRepository } from '../services/data/rouletteRepository';
import Navbar from './Navbar';
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
      {/* Usando o componente Navbar */}
      <Navbar />
      
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