import React, { useState } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import { MessageSquare, Search, Wallet } from 'lucide-react';
import ProfileDropdown from './ProfileDropdown';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="min-h-screen bg-[#100f13] text-white">
      {/* Barra de navegação superior */}
      <nav className="sticky top-0 z-50 w-full bg-[#141318] border-b border-[#2a2a2e] px-4 py-3">
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
      
      <div className="flex">
        <div className="hidden md:block w-64 min-h-screen">
          <Sidebar />
        </div>
        
        <main className="flex-1 p-0 relative">
          {children}
          
          {/* Botão Chat Flutuante */}
          <button 
            onClick={() => setChatOpen(!chatOpen)}
            className="fixed bottom-6 right-6 bg-green-600 text-white p-4 rounded-full shadow-lg hover:bg-green-700 z-50"
            aria-label="Abrir chat"
          >
            <MessageSquare size={24} />
          </button>
          
          {/* Chat UI */}
          <div className={`fixed top-0 right-0 h-full w-80 transform transition-transform duration-300 ease-in-out ${chatOpen ? 'translate-x-0' : 'translate-x-full'} z-40`}>
            <ChatUI isOpen={chatOpen} onClose={() => setChatOpen(false)} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout; 