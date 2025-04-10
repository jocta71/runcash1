import React, { useState, useEffect, useRef } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';
import { ChatMessage } from './chat/types';

interface ChatUIProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

// Mensagens simuladas para alternar aleatoriamente
const simulatedMessages = [
  { sender: 'Zóio', message: 'Eae fi, qnd q isso vai tá ON? 🤔', isModerator: false, isAdmin: false },
  { sender: 'Nandinha', message: 'Toh mó ansiozaaaa pra jogar vei', isModerator: false, isAdmin: false },
  { sender: 'Mod Luizão', message: 'Suaviza tropa, já já vamo subir o bagui 🚀', isModerator: true, isAdmin: false },
  { sender: 'Bibi Cria', message: 'Toh nem aí, só qro embolsar os pix msm 💸', isModerator: false, isAdmin: false },
  { sender: 'Jhowzin', message: 'Viu meu msgm aê ou n?', isModerator: false, isAdmin: false },
  { sender: 'Adm TH', message: 'Alguém deu um salve no motoca? vacilão sumiu faz tempão 😤', isModerator: false, isAdmin: true },
  { sender: 'Rob Dog', message: 'Cê tá doido mlk, appzão brabo demais 🔥', isModerator: false, isAdmin: false },
  { sender: 'Paty do Grau', message: 'Manoo, mt style o trem, curti d+ 😍', isModerator: false, isAdmin: false },
  { sender: 'Duda 13', message: 'Tranquilo', isModerator: false, isAdmin: false },
  { sender: 'Teuzin', message: 'E aí, q hora q solta a roletinha nova? 🎰', isModerator: false, isAdmin: false },
  { sender: 'Mandinha', message: 'Sou nova aq, qm dá um help? 🥺', isModerator: false, isAdmin: false },
  { sender: 'Bru Cria', message: 'Sai com 2 conto da última vez fi 🔥', isModerator: false, isAdmin: false },
];


const ChatUI = ({ isOpen = true, onClose, isMobile = false }: ChatUIProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: 'Zé das Couves',
      message: 'Quando que vai ficar pronto, mano?',
      timestamp: new Date(Date.now() - 1000 * 60 * 5)
    },
    {
      id: 2,
      sender: 'Fernandinha',
      message: 'Tô mó ansiedade pra jogar, viu?',
      timestamp: new Date(Date.now() - 1000 * 60 * 4)
    },
    {
      id: 3,
      sender: 'Moderador',
      message: 'Galera, calma que já vai rolar!',
      isModerator: true,
      timestamp: new Date(Date.now() - 1000 * 60 * 3)
    },
    {
      id: 4,
      sender: 'Bia',
      message: 'Tô nem aí, só quero ganhar uma grana!',
      timestamp: new Date(Date.now() - 1000 * 60 * 2)
    },
    {
      id: 5,
      sender: 'Juninho',
      message: 'Recebeu minha mensagem?',
      timestamp: new Date(Date.now() - 1000 * 60 * 1)
    },
    {
      id: 6,
      sender: 'Admin',
      message: 'Cês falaram com o entregador? Mó vacilo, tá atrasado mais de uma hora!',
      isAdmin: true,
      timestamp: new Date(Date.now() - 1000 * 30)
    },
    {
      id: 7,
      sender: 'Amanda',
      message: 'Primeira vez aqui, alguém me ajuda?',
      timestamp: new Date(Date.now() - 1000 * 20)
    },
    {
      id: 8,
      sender: 'Bruna',
      message: 'Ganhei 200 na última vez',
      timestamp: new Date(Date.now() - 1000 * 10)
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
      timestamp: new Date(),
      isModerator: randomMessage.isModerator,
      isAdmin: randomMessage.isAdmin
    };
    
    // Adicionar a nova mensagem ao chat
    setMessages(prevMessages => [...prevMessages, newMsg]);
    
    // Limitar o número de mensagens para não sobrecarregar a interface
    if (messages.length > 30) {
      setMessages(prevMessages => prevMessages.slice(prevMessages.length - 30));
    }
  };
  
  // Efeito para iniciar a simulação de mensagens
  useEffect(() => {
    // Adicionar uma mensagem imediatamente após a montagem do componente
    addSimulatedMessage();
    
    // Intervalo para adicionar mensagens a cada 2-5 segundos
    const intervalTime = Math.floor(Math.random() * 3000) + 2000;
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
    <div className="fixed inset-0 lg:inset-auto lg:right-4 lg:bottom-4 lg:top-auto lg:left-auto lg:w-96 lg:h-[600px] z-50 flex flex-col bg-[#100f13] rounded-lg shadow-xl overflow-hidden border border-[#2a2a2e]">
      {/* Header do Chat */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-[#141318] border-b border-[#2a2a2e]">
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

      {/* Container que engloba mensagens e input */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Lista de Mensagens */}
        <div 
          ref={chatContainerRef} 
          className="flex-1 overflow-y-auto p-4 space-y-4 pb-20"
        >
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

        {/* Input de Mensagem - posição absoluta em relação ao container */}
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

