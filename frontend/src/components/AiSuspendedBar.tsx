import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, RotateCcw, X, MessageSquare, Send } from 'lucide-react';

interface AIMessage {
  id: number;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const LoadingIndicator = () => {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-75"></div>
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-150"></div>
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse delay-300"></div>
      </div>
    </div>
  );
};

const AiSuspendedBar: React.FC = () => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Efeito para rolar para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Efeito para focar no input quando expandir
  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus();
    }
  }, [expanded]);

  // Efeito para lidar com o efeito de partículas
  useEffect(() => {
    if (expanded) {
      const canvas = document.getElementById('particle-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Configurar o canvas para ocupar todo o espaço do contêiner
      const resizeCanvas = () => {
        const container = canvas.parentElement;
        if (container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      // Configurações das partículas
      const particles: {
        x: number;
        y: number;
        size: number;
        speedX: number;
        speedY: number;
        color: string;
      }[] = [];

      const createParticles = () => {
        const particleCount = 15;
        for (let i = 0; i < particleCount; i++) {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            speedX: (Math.random() - 0.5) * 0.5,
            speedY: (Math.random() - 0.5) * 0.5,
            color: `rgba(${Math.floor(Math.random() * 100 + 155)}, 255, ${Math.floor(
              Math.random() * 100 + 155
            )}, ${Math.random() * 0.6 + 0.1})`,
          });
        }
      };

      createParticles();

      // Animar as partículas
      const animateParticles = () => {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach((particle) => {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = particle.color;
          ctx.fill();

          // Mover partículas
          particle.x += particle.speedX;
          particle.y += particle.speedY;

          // Manter partículas dentro do canvas
          if (particle.x < 0 || particle.x > canvas.width) {
            particle.speedX *= -1;
          }
          if (particle.y < 0 || particle.y > canvas.height) {
            particle.speedY *= -1;
          }
        });

        requestAnimationFrame(animateParticles);
      };

      animateParticles();

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [expanded]);

  const processMessageContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/\n/g, '<br>');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: AIMessage = {
      id: Math.floor(Math.random() * 1000000),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Simulação de resposta da API (substitua por sua implementação real)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const aiResponse = "Esta é uma resposta de demonstração da IA. Em uma implementação real, este seria o resultado da chamada à API.";
      
      const aiMessage: AIMessage = {
        id: Math.floor(Math.random() * 1000000),
        role: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      
      const errorMessage: AIMessage = {
        id: Math.floor(Math.random() * 1000000),
        role: 'ai',
        content: 'Desculpe, ocorreu um erro ao processar sua consulta. Por favor, tente novamente mais tarde.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const clearChat = () => {
    setMessages([]);
  };

  // A interface recolhida mostra apenas um botão flutuante
  if (!expanded) {
    return (
      <div className="fixed top-24 right-8 z-50">
        <button
          onClick={toggleExpand}
          className="relative group"
          aria-label="Abrir assistente IA"
        >
          <div className="absolute inset-0 rounded-full bg-green-500 blur-md opacity-70 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-black/80 to-black/60 backdrop-blur-xl border border-green-500/30 rounded-full shadow-lg shadow-green-500/20 hover:shadow-green-500/40 transition-all">
            <div className="absolute inset-0 rounded-full border border-green-400/20"></div>
            <span className="text-green-400 group-hover:text-green-300 transition-colors">
              <Sparkles size={20} />
            </span>
          </div>
        </button>
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full bg-green-500/10 animate-ping opacity-75"></div>
        </div>
      </div>
    );
  }

  // A interface expandida mostra o histórico de mensagens e a entrada
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn">
      <div className="w-[95%] max-w-3xl h-[80vh] relative rounded-2xl overflow-hidden">
        {/* Canvas para efeito de partículas */}
        <canvas id="particle-canvas" className="absolute inset-0 pointer-events-none"></canvas>
        
        {/* Moldura externa com efeito glowing */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-2xl p-[1px]">
          <div className="absolute inset-0 rounded-2xl border border-green-400/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]"></div>
          
          {/* Conteúdo principal */}
          <div className="w-full h-full bg-black/80 backdrop-blur-xl rounded-2xl flex flex-col overflow-hidden relative">
            {/* Borda superior com efeito de luz */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-400/50 to-transparent"></div>
            
            {/* Cabeçalho futurista */}
            <div className="px-6 py-4 border-b border-white/10 bg-black/60 backdrop-blur-md relative">
              <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-green-500/20 to-transparent"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400/20 to-emerald-600/20 border border-green-500/30 flex items-center justify-center shadow-inner relative overflow-hidden">
                    <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
                    <img src="/assets/icon-rabbit.svg" alt="RunCash" className="w-5 h-5 relative z-10" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-lg">Assistente IA</h2>
                    <div className="flex items-center">
                      <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                      <p className="text-green-300/80 text-xs">Tecnologia Avançada</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={clearChat}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-green-300 hover:text-white transition-all border border-white/5"
                    title="Limpar conversa"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button 
                    onClick={toggleExpand}
                    className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-green-300 hover:text-white transition-all border border-white/5"
                    title="Fechar"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Área de mensagens */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gradient-to-b from-black/60 to-black/40 backdrop-blur-md">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400/10 to-emerald-600/10 border border-green-500/20 flex items-center justify-center mb-6 relative">
                    <div className="absolute inset-0 rounded-full bg-green-500/5 animate-pulse"></div>
                    <MessageSquare size={28} className="text-green-400" />
                  </div>
                  <h3 className="text-white font-medium text-lg mb-3">Como posso ajudar?</h3>
                  <p className="text-gray-300/70 text-center text-sm max-w-md mb-6">
                    Pergunte sobre análises, estratégias ou qualquer dúvida que tiver.
                  </p>
                  <div className="grid grid-cols-2 gap-3 w-full max-w-md">
                    <button 
                      onClick={() => {
                        setInput("Quais são as novidades?");
                        inputRef.current?.focus();
                      }}
                      className="p-3 rounded-lg bg-gradient-to-br from-black/80 to-black/60 hover:from-green-900/20 hover:to-black/60 text-green-300 hover:text-white text-left text-sm transition-all border border-green-500/20 hover:border-green-500/40 backdrop-blur-md"
                    >
                      Quais são as novidades?
                    </button>
                    <button 
                      onClick={() => {
                        setInput("Preciso de ajuda com estratégias");
                        inputRef.current?.focus();
                      }}
                      className="p-3 rounded-lg bg-gradient-to-br from-black/80 to-black/60 hover:from-green-900/20 hover:to-black/60 text-green-300 hover:text-white text-left text-sm transition-all border border-green-500/20 hover:border-green-500/40 backdrop-blur-md"
                    >
                      Preciso de ajuda com estratégias
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                  >
                    {msg.role === 'user' ? (
                      <div className="max-w-[85%] rounded-2xl p-3 shadow-md bg-gradient-to-r from-green-600/80 to-emerald-500/80 backdrop-blur-md border border-white/10 text-white">
                        <div 
                          className="prose prose-invert max-w-none text-sm whitespace-pre-wrap" 
                          dangerouslySetInnerHTML={{ 
                            __html: msg.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                              .replace(/\n/g, '<br>')
                          }} 
                        />
                      </div>
                    ) : (
                      <div className="max-w-[85%] text-white">
                        <div 
                          className="text-sm whitespace-pre-wrap text-left px-4 py-3 bg-black/50 backdrop-blur-md border border-green-500/20 rounded-2xl" 
                          style={{ textAlign: 'left' }}
                          dangerouslySetInnerHTML={{ 
                            __html: processMessageContent(msg.content)
                          }} 
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
              {loading && (
                <LoadingIndicator />
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Barra de entrada com efeito glass */}
            <div className="relative">
              {/* Borda superior com efeito de luz */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-green-400/30 to-transparent"></div>
              
              <form onSubmit={handleSubmit} className="p-4 bg-black/60 backdrop-blur-md relative">
                <div className="relative flex items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="w-full bg-black/40 border border-green-500/20 focus:border-green-500/50 rounded-full px-5 py-3 text-white text-sm focus:outline-none shadow-inner backdrop-blur-md placeholder-gray-400"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className={`absolute right-2 p-2 rounded-full ${
                      loading || !input.trim() 
                        ? 'bg-gray-600/30 text-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-green-500/90 to-emerald-600/90 text-white hover:shadow-lg hover:shadow-green-500/20'
                    } transition-all duration-200`}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiSuspendedBar; 