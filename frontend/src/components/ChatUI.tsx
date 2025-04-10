import React, { useState, useEffect, useRef } from 'react';
import ChatHeader from './chat/ChatHeader';
import ChatMessageList from './chat/ChatMessageList';
import ChatInput from './chat/ChatInput';
import { ChatMessage } from './chat/types';
import { X, Minimize2, Maximize2 } from 'lucide-react';

interface ChatUIProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

// Mensagens simuladas para alternar aleatoriamente
const simulatedMessages = [
  { sender: 'Zé das Couves', message: 'Quando que vai ficar pronto, mano?', isModerator: false, isAdmin: false },
  { sender: 'Fernandinha', message: 'Tô mó ansiedade pra jogar, viu?', isModerator: false, isAdmin: false },
  { sender: 'Moderador', message: 'Galera, calma que já vai rolar!', isModerator: true, isAdmin: false },
  { sender: 'Bia', message: 'Tô nem aí, só quero ganhar uma grana!', isModerator: false, isAdmin: false },
  { sender: 'Juninho', message: 'Recebeu minha mensagem?', isModerator: false, isAdmin: false },
  { sender: 'Admin', message: 'Cês falaram com o entregador? Mó vacilo, tá atrasado mais de uma hora!', isModerator: false, isAdmin: true },
  { sender: 'Robertão', message: 'Mano, esse app é show de bola!', isModerator: false, isAdmin: false },
  { sender: 'Paty', message: 'Tá top demais, curti mesmo!', isModerator: false, isAdmin: false },
  { sender: 'Dudinha', message: 'Blz', isModerator: false, isAdmin: false },
  { sender: 'Matheuzinho', message: 'Fala aí, quando vai rolar a nova roleta?', isModerator: false, isAdmin: false },
  { sender: 'Zé das Couves', message: 'Quando que vai ficar pronto, mano?', isModerator: false, isAdmin: false },
  { sender: 'Moderador', message: 'Já vai rolar galera, mais uns minutos!', isModerator: true, isAdmin: false },
  { sender: 'Bia', message: 'Quero ver quem vai ganhar dessa vez!', isModerator: false, isAdmin: false },
  { sender: 'Amanda', message: 'Primeira vez aqui, alguém me ajuda?', isModerator: false, isAdmin: false },
  { sender: 'Rodrigo', message: 'Joga na vermelho que dá bom!', isModerator: false, isAdmin: false },
  { sender: 'Lucas', message: 'Zero é o melhor número', isModerator: false, isAdmin: false },
  { sender: 'Admin', message: 'Sistema atualizado com sucesso!', isModerator: false, isAdmin: true },
  { sender: 'Bruna', message: 'Ganhei 200 na última vez', isModerator: false, isAdmin: false },
  { sender: 'Carlos', message: 'Alguém pode me ajudar com o saque?', isModerator: false, isAdmin: false },
  { sender: 'Moderador', message: 'Por favor, mantenham o chat limpo!', isModerator: true, isAdmin: false },
];

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
  const [minimized, setMinimized] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Função para adicionar uma mensagem simulada ao chat
  const addSimulatedMessage = () => {
    // Escolher uma mensagem aleatória do array de mensagens simuladas
    const randomIndex = Math.floor(Math.random() * simulatedMessages.length);
    const randomMessage = simulatedMessages[randomIndex];
    
    // Criar um novo objeto de mensagem
    const newMsg = {
      id: Date.now(),
      sender: randomMessage.sender,
      message: randomMessage.message,
      avatar: '', // Não usamos mais imagens, usaremos iniciais
      timestamp: new Date(),
      isModerator: randomMessage.isModerator,
      isAdmin: randomMessage.isAdmin
    };
    
    // Adicionar a nova mensagem ao chat
    setMessages(prevMessages => [...prevMessages, newMsg]);
    
    // Limitar o número de mensagens para não sobrecarregar a interface
    if (messages.length > 20) {
      setMessages(prevMessages => prevMessages.slice(prevMessages.length - 20));
    }
  };
  
  // Efeito para iniciar a simulação de mensagens
  useEffect(() => {
    // Adicionar uma mensagem imediatamente após a montagem do componente
    addSimulatedMessage();
    
    // Intervalo para adicionar mensagens a cada 1-5 segundos (mais rápido que antes)
    const intervalTime = Math.floor(Math.random() * 4000) + 1000;
    const interval = setInterval(addSimulatedMessage, intervalTime);
    
    // Limpar o intervalo quando o componente for desmontado
    return () => clearInterval(interval);
  }, []);
  
  // Efeito para rolar para o final quando novas mensagens são adicionadas
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
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

  const toggleMinimize = () => {
    setMinimized(!minimized);
  };

  // Styles for mobile vs desktop
  const chatClasses = isMobile
    ? "h-full w-full mobile-chat-inner animate-slide-left"
    : "h-screen w-full flex flex-col bg-vegas-darkgray z-40 border-l border-[#33333359]";
  
  // For mobile, if it's not open, don't render
  if (isMobile && !isOpen) return null;
  
  // Se minimizado, mostrar apenas o cabeçalho minimizado na parte inferior
  if (minimized) {
    return (
      <div className="fixed bottom-0 right-4 z-50 bg-[#141318] border border-[#2a2a2e] rounded-t-lg shadow-lg w-80">
        <div className="flex items-center justify-between px-4 py-2">
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
          <div className="flex items-center space-x-2">
            <button 
              onClick={toggleMinimize} 
              className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
              title="Maximizar"
            >
              <Maximize2 size={18} />
            </button>
            {onClose && (
              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
                title="Fechar"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Chat expandido (não minimizado)
  return (
    <div className="flex flex-col bg-[#100f13] h-screen relative">
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
        <div className="flex items-center space-x-2">
          <button 
            onClick={toggleMinimize} 
            className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
            title="Minimizar"
          >
            <Minimize2 size={18} />
          </button>
          {onClose && (
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
              title="Fechar"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Container para área de rolagem e input */}
      <div className="flex-1 flex flex-col h-[calc(100%-60px)] relative">
        {/* Lista de Mensagens */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          {messages.map((message) => (
            <div key={message.id} className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center" 
                   style={{ 
                     backgroundColor: message.isAdmin 
                       ? '#10b981' 
                       : message.isModerator 
                         ? '#4f46e5' 
                         : `hsl(${message.sender.charCodeAt(0) * 10 % 360}, 70%, 45%)`
                   }}>
                <span className="text-white font-medium text-sm">
                  {message.sender.charAt(0).toUpperCase()}
                </span>
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
                <div className={`mt-1 px-3 py-2 rounded-lg text-left max-w-[85%] ${
                  message.sender === 'Você' 
                    ? 'bg-green-600 text-white ml-auto'
                    : message.isAdmin 
                      ? 'bg-[#1e293b] text-white' 
                      : message.isModerator
                        ? 'bg-[#1e1e3f] text-white'
                        : 'bg-[#2a2a36] text-gray-200'
                }`}>
                  <p className="text-sm">{message.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input de Mensagem */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-[#0f0e13] border-t border-[#2a2a2e]">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-[#1a191e] border border-[#2a2a2e] rounded-md px-4 py-2 text-white text-sm focus:outline-none focus:border-green-500"
              placeholder="Digite sua mensagem..."
            />
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 transition-colors"
            >
              Enviar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatUI;

