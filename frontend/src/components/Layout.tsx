import React, { useState } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import { MessageSquare } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#100f13] text-white">
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