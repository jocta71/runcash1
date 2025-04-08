import React, { useState } from 'react';
import ChatHeader from './chat/ChatHeader';
import ChatMessageList from './chat/ChatMessageList';
import ChatInput from './chat/ChatInput';
import { ChatMessage } from './chat/types';
import { X } from 'lucide-react';

interface ChatUIProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

const ChatUI = ({ isOpen = false, onClose, isMobile = false }: ChatUIProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: 'Zé das Couves',
      message: 'Quando que vai ficar pronto, mano?',
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 5)
    },
    {
      id: 2,
      sender: 'Fernandinha',
      message: 'Tô mó ansiedade pra jogar, viu?',
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 4)
    },
    {
      id: 3,
      sender: 'Moderador',
      message: 'Galera, calma que já vai rolar!',
      isModerator: true,
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 3)
    },
    {
      id: 4,
      sender: 'Bia',
      message: 'Tô nem aí, só quero ganhar uma grana!',
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 2)
    },
    {
      id: 5,
      sender: 'Juninho',
      message: 'Recebeu minha mensagem?',
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 1)
    },
    {
      id: 6,
      sender: 'Admin',
      message: 'Cês falaram com o entregador? Mó vacilo, tá atrasado mais de uma hora!',
      isAdmin: true,
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 30)
    },
    {
      id: 7,
      sender: 'Robertão',
      message: 'Mano, esse app é show de bola!',
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 20)
    },
    {
      id: 8,
      sender: 'Paty',
      message: 'Tá top demais, curti mesmo!',
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 15)
    },
    {
      id: 9,
      sender: 'Dudinha',
      message: 'Blz',
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 10)
    },
    {
      id: 10,
      sender: 'Matheuzinho',
      message: 'Fala aí, quando vai rolar a nova roleta?',
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date(Date.now() - 1000 * 5)
    },
    {
      id: 11,
      sender: 'Você',
      message: 'Fala galera! Qual a boa?',
      avatar: '/lovable-uploads/433b5fd4-2378-47fe-9d10-276fead4ebce.png',
      timestamp: new Date()
    }
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    setMessages([
      ...messages,
      {
        id: Date.now(),
        sender: 'Você',
        message: newMessage,
        timestamp: new Date()
      }
    ]);
    
    setNewMessage('');
  };

  // Styles for mobile vs desktop
  const chatClasses = isMobile
    ? "h-full w-full mobile-chat-inner animate-slide-left"
    : "h-screen w-full flex flex-col bg-vegas-darkgray z-40 border-l border-[#33333359]";
  
  // For mobile, if it's not open, don't render
  if (isMobile && !isOpen) return null;
  
  return (
    <div className="flex flex-col bg-[#100f13] h-screen">
      {/* Header do Chat */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#141318] border-b border-[#2a2a2e]">
        <div className="flex items-center space-x-2">
          <span className="text-white font-semibold">Chat ao Vivo</span>
          <div className="flex items-center space-x-1">
            <span className="text-green-500">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="4"/>
              </svg>
            </span>
            <span className="text-green-500 text-sm">128</span>
          </div>
        </div>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#1e1e24] flex-shrink-0 overflow-hidden">
              {message.avatar && (
                <img src={message.avatar} alt={message.sender} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-white">{message.sender}</span>
                {message.isModerator && (
                  <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">
                    Moderator
                  </span>
                )}
                {message.isAdmin && (
                  <span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-300 mt-1">{message.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input de Mensagem */}
      <div className="p-4 border-t border-[#2a2a2e] bg-[#141318]">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-[#1e1e24] border border-[#2a2a2e] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-green-500"
            placeholder="Digite sua mensagem..."
          />
          <button
            type="submit"
            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatUI;

