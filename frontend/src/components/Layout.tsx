import React, { useState } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import { Search, Wallet } from 'lucide-react';
import ProfileDropdown from './ProfileDropdown';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');

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
        
        {/* Chat fixo à direita com z-index alto (30) */}
        <div className="hidden md:block w-80 min-h-screen fixed right-0 top-0 z-30 border-l border-[#2a2a2e]">
          <ChatUI isOpen={true} />
        </div>
        
        {/* Área do conteúdo principal com padding à esquerda e direita para compensar os sidebars fixos */}
        <main className="flex-1 p-0 md:ml-64 md:mr-80 relative">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout; 