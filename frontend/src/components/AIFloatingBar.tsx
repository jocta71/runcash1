import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, X, RotateCcw, MessageSquare, Sparkles } from 'lucide-react';
import { RouletteRepository } from '../services/data/rouletteRepository';

interface AIMessage {
  id: number;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// Componente de carregamento com leap-frog estilizado
const LoadingIndicator = () => {
  return (
    <div className="flex justify-start">
      <div className="leap-frog">
        <div className="leap-frog__dot"></div>
        <div className="leap-frog__dot"></div>
        <div className="leap-frog__dot"></div>
      </div>
    </div>
  );
};

const AIFloatingBar: React.FC = () => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showRoulettesDropdown, setShowRoulettesDropdown] = useState(false);
  const [availableRoulettes, setAvailableRoulettes] = useState<{id: string, name: string}[]>([]);
  const [selectedRoulette, setSelectedRoulette] = useState<{id: string, name: string} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Carregar roletas disponíveis ao iniciar
  useEffect(() => {
    const loadRoulettes = async () => {
      try {
        console.log('Iniciando carregamento de roletas para dropdown...');
        
        // Tentar buscar roletas diretamente do endpoint
        try {
          const response = await fetch('/api/roletas');
          const data = await response.json();
          
          if (data && Array.isArray(data) && data.length > 0) {
            console.log('Roletas carregadas da API:', data);
            
            // Processar roletas
            const processedRoulettes = [
              { id: 'all', name: 'Todas roletas' },
              ...data.map((r: any) => ({ 
                id: r.id || r.roleta_id || r._id || '', 
                name: r.name || r.nome || r.roleta_nome || `Roleta ${r.id || r.roleta_id || ''}`
              }))
            ];
            
            console.log('Lista de roletas processada da API:', processedRoulettes);
            setAvailableRoulettes(processedRoulettes);
            return;
          }
        } catch (apiError) {
          console.warn('Falha ao carregar roletas da API, tentando repositório:', apiError);
        }
        
        // Buscar roletas do repositório como fallback
        const roulettesData = await RouletteRepository.fetchAllRoulettes();
        console.log('Roletas carregadas do repositório:', roulettesData);
        
        if (roulettesData && roulettesData.length > 0) {
          // Adicionar opção "Todas roletas" no topo e tratar como any para evitar erros de tipo
          const allRoulettesList = [
            { id: 'all', name: 'Todas roletas' },
            ...roulettesData.map((r: any) => ({ 
              id: r.id || '', 
              name: r.name || `Roleta ${r.id || ''}`
            }))
          ];
          
          console.log('Lista de roletas processada do repositório:', allRoulettesList);
          setAvailableRoulettes(allRoulettesList);
        } else {
          throw new Error('Nenhuma roleta retornada pelo repositório');
        }
      } catch (error) {
        console.error('Erro ao carregar lista de roletas:', error);
        
        // Fallback com algumas roletas comuns
        const fallbackRoulettes = [
          { id: 'all', name: 'Todas roletas' },
          { id: '2010016', name: 'Immersive Roulette' },
          { id: '2010033', name: 'Lightning Roulette' },
          { id: '2380335', name: 'Brazilian Mega Roulette' },
          { id: '2010096', name: 'Speed Auto Roulette' },
          { id: '2010098', name: 'Auto-Roulette VIP' }
        ];
        
        console.log('Usando lista de fallback:', fallbackRoulettes);
        setAvailableRoulettes(fallbackRoulettes);
      }
    };
    
    loadRoulettes();
  }, []);

  // Fechar dropdown quando clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRoulettesDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current && expanded) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, expanded]);

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  // Selecionar roleta do dropdown
  const handleRouletteSelect = (roulette: {id: string, name: string}) => {
    setSelectedRoulette(roulette);
    
    // Se não for "Todas roletas", adicionar ao input
    if (roulette.id !== 'all') {
      // Preservar o texto atual e adicionar referência à roleta
      const currentQuery = input.replace(/na roleta .+?(?=\?|$|\s\s)/, '').trim();
      const newQuery = currentQuery.includes(roulette.name) 
        ? currentQuery 
        : `${currentQuery} na roleta ${roulette.name}`.trim();
      
      setInput(newQuery);
    }
    
    setShowRoulettesDropdown(false);
    
    // Focar no input após selecionar
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const sendMessageToGemini = async (query: string) => {
    try {
      // Buscar dados da roleta
      const roletaData = await fetchRouletteData();
      
      // Determinar se há uma roleta específica selecionada
      const roletaId = selectedRoulette && selectedRoulette.id !== 'all' ? selectedRoulette.id : null;
      const roletaNome = selectedRoulette && selectedRoulette.id !== 'all' ? selectedRoulette.name : null;
      
      // Usar o endpoint do backend para evitar problemas de CORS
      const apiUrl = '/api/ai/query';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query, 
          roletaData,
          roletaId,
          roletaNome
        }),
      });
      
      const data = await response.json();
      return data.response;
    } catch (error) {
      console.error('Erro ao consultar API de IA:', error);
      return 'Erro ao processar consulta. Tente novamente.';
    }
  };
  
  // Função para buscar dados da roleta
  const fetchRouletteData = async () => {
    try {
      // Buscar dados reais do repositório
      const roulettesWithNumbers = await RouletteRepository.fetchAllRoulettesWithNumbers();
      
      if (!roulettesWithNumbers || !Array.isArray(roulettesWithNumbers) || roulettesWithNumbers.length === 0) {
        throw new Error('Não foi possível obter dados das roletas');
      }
      
      // Extrair números recentes
      const allNumbers = [];
      const numerosPorRoleta = {};
      
      // Organizar dados por roleta
      for (const roleta of roulettesWithNumbers) {
        if (roleta.numbers && Array.isArray(roleta.numbers)) {
          // Adicionar todos os números à lista geral
          allNumbers.push(...roleta.numbers.map(n => n.number));
          
          // Organizar números por roleta
          numerosPorRoleta[roleta.name] = roleta.numbers.map(n => n.number);
        }
      }
      
      // Limitar a 50 números mais recentes
      const recentNumbers = allNumbers.slice(0, 50);
      
      // Classificar números por cor
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
      
      let redCount = 0;
      let blackCount = 0;
      let greenCount = 0;
      let evenCount = 0;
      let oddCount = 0;
      const dozenCounts = [0, 0, 0];
      
      recentNumbers.forEach(num => {
        if (num === 0) {
          greenCount++;
          return;
        }
        
        if (redNumbers.includes(num)) redCount++;
        if (blackNumbers.includes(num)) blackCount++;
        
        if (num % 2 === 0) evenCount++;
        else oddCount++;
        
        if (num >= 1 && num <= 12) dozenCounts[0]++;
        else if (num >= 13 && num <= 24) dozenCounts[1]++;
        else if (num >= 25 && num <= 36) dozenCounts[2]++;
      });
      
      // Calcular frequências para números quentes/frios
      const numFrequency = {};
      recentNumbers.forEach(num => {
        numFrequency[num] = (numFrequency[num] || 0) + 1;
      });
      
      // Ordenar por frequência
      const sortedNumbers = Object.entries(numFrequency)
        .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
        .map(entry => parseInt(entry[0]));
      
      const hotNumbers = sortedNumbers.slice(0, 4);
      const coldNumbers = sortedNumbers.slice(-4).reverse();
      
      // Identificar tendências
      const trends = [];
      const colorStreak = { color: null, count: 0 };
      const parityStreak = { parity: null, count: 0 };
      const dozenStreak = { dozen: null, count: 0 };
      
      // Tendências de cor
      for (let i = 0; i < Math.min(10, recentNumbers.length); i++) {
        const num = recentNumbers[i];
        let color = 'green';
        if (redNumbers.includes(num)) color = 'red';
        else if (blackNumbers.includes(num)) color = 'black';
        
        if (i === 0) {
          colorStreak.color = color;
          colorStreak.count = 1;
        } else if (color === colorStreak.color) {
          colorStreak.count++;
        } else {
          break;
        }
      }
      
      if (colorStreak.count >= 3) {
        trends.push({ type: 'color', value: colorStreak.color, count: colorStreak.count });
      }
      
      // Organizar dados formatados para a IA
      return {
        numbers: {
          recent: recentNumbers,
          raw: recentNumbers,
          redCount,
          blackCount,
          greenCount,
          redPercentage: Number(((redCount / (Number(recentNumbers.length) || 1)) * 100).toFixed(2)),
          blackPercentage: Number(((blackCount / (Number(recentNumbers.length) || 1)) * 100).toFixed(2)),
          greenPercentage: Number(((greenCount / (Number(recentNumbers.length) || 1)) * 100).toFixed(2)),
          evenCount,
          oddCount,
          evenPercentage: Number(((evenCount / (Number(recentNumbers.length) || 1)) * 100).toFixed(2)),
          oddPercentage: Number(((oddCount / (Number(recentNumbers.length) || 1)) * 100).toFixed(2)),
          dozenCounts,
          dozenPercentages: dozenCounts.map(count => 
            Number(((count / (Number(recentNumbers.length) || 1)) * 100).toFixed(2))
          ),
          hotNumbers,
          coldNumbers
        },
        trends,
        roletas: roulettesWithNumbers.map(r => ({
          id: r.id,
          name: r.name,
          online: true // Substitui status
        })),
        numerosPorRoleta
      };
    } catch (error) {
      console.error('Erro ao buscar dados da roleta:', error);
      
      // Em caso de erro, retornar dados simulados como fallback
      return {
        numbers: {
          recent: [12, 35, 0, 26, 3, 15, 4, 0, 32, 15],
          redCount: 45,
          blackCount: 42,
          evenCount: 38,
          oddCount: 49,
          hotNumbers: [32, 15, 0, 26],
          coldNumbers: [6, 13, 33, 1]
        },
        trends: [
          { type: 'color', value: 'red', count: 3 },
          { type: 'parity', value: 'odd', count: 5 },
          { type: 'dozen', value: '2nd', count: 4 }
        ]
      };
    }
  };

  // Função para processar o conteúdo da mensagem, garantindo alinhamento à esquerda
  const processMessageContent = (content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-green-300">$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/<div/g, '<div style="text-align: left;"')
      .replace(/<p/g, '<p style="text-align: left;"')
      .replace(/•\s(.*?)(?=\n|$)/g, '<div style="display: flex; align-items: start; text-align: left;"><span style="margin-right: 0.5rem;" class="text-green-400">•</span><span>$1</span></div>');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMessage: AIMessage = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    try {
      const aiResponse = await sendMessageToGemini(input);
      
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

  // A interface recolhida mostra apenas a barra de entrada
  if (!expanded) {
    return (
      <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50">
        <div className="w-[95%] max-w-xl bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg overflow-hidden p-3">
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-inner">
                <img src="/assets/icon-rabbit.svg" alt="RunCash" className="w-4 h-4" />
              </div>
              <h3 className="text-white font-medium text-sm">Descubra tendências & padrões lucrativos</h3>
            </div>
            <p className="text-green-300/80 text-xs px-1">Pergunte ao RunCash IA sobre estratégias, números quentes e padrões de roleta</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); toggleExpand(); }} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="O que você quer saber sobre as roletas?"
              className="w-full bg-white/5 border border-white/10 focus:border-green-500/50 rounded-full px-5 py-2.5 text-white text-sm focus:outline-none focus:ring-0 shadow-inner"
              onFocus={toggleExpand}
            />
            <button
              type="button"
              onClick={toggleExpand}
              className="absolute right-2 p-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/20 transition-all"
            >
              <Sparkles size={16} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // A interface expandida mostra o histórico de mensagens e a entrada
  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50">
      <div className="w-[95%] max-w-3xl bg-black/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-green-500/20 flex flex-col overflow-hidden animate-slideUp transition-all">
        {/* Cabeçalho com efeito glass */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-green-600/20 to-emerald-500/20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-inner">
              <img src="/assets/icon-rabbit.svg" alt="RunCash" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-semibold">RunCash Assistente</h2>
              <div className="flex items-center">
                <span className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                <p className="text-green-300/80 text-xs">IA Avançada</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={clearChat}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-green-300 hover:text-white transition-all"
              title="Limpar conversa"
            >
              <RotateCcw size={16} />
            </button>
            <button 
              onClick={toggleExpand}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-green-300 hover:text-white transition-all"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-h-[60vh] bg-gradient-to-b from-black/20 to-black/30 backdrop-blur-md">
          {messages.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400/10 to-emerald-600/10 flex items-center justify-center mb-4">
                <MessageSquare size={24} className="text-green-400" />
              </div>
              <h3 className="text-white font-medium text-lg mb-2">Como posso ajudar?</h3>
              <p className="text-gray-300/70 text-center text-sm max-w-md mb-4">
                Pergunte sobre análises de roletas, tendências ou estratégias.
              </p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-md">
                <button 
                  onClick={() => setInput("Todas roletas disponíveis")}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-green-300 hover:text-white text-left text-xs transition-all border border-white/5"
                >
                  Todas roletas disponíveis?
                </button>
                <button 
                  onClick={() => setInput("Detectou algum padrão de cor nas últimas jogadas?")}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-green-300 hover:text-white text-left text-xs transition-all border border-white/5"
                >
                  Há padrões de cor recentes?
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
                  <div className="max-w-[85%] rounded-2xl p-3 shadow-md bg-gradient-to-r from-green-600 to-emerald-500 text-white">
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
                      className="text-sm whitespace-pre-wrap text-left px-4 py-3 bg-black/30 rounded-2xl" 
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
        <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 backdrop-blur-md bg-black/20">
          <div className="relative flex items-center">
            {/* Botão para mostrar dropdown de roletas */}
            <button
              type="button"
              onClick={() => setShowRoulettesDropdown(!showRoulettesDropdown)}
              className="absolute left-3 z-10 text-green-400 hover:text-green-300 transition-colors"
              title="Selecionar roleta"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            
            {/* Dropdown de roletas */}
            {showRoulettesDropdown && (
              <div 
                ref={dropdownRef}
                className="absolute left-0 bottom-full mb-2 w-72 max-h-[60vh] overflow-y-auto bg-black/95 backdrop-blur-xl border border-white/20 rounded-lg shadow-2xl shadow-green-500/20 z-50"
              >
                <div className="sticky top-0 bg-black/80 backdrop-blur-md p-2 border-b border-white/10">
                  <div className="flex items-center gap-2 px-2 pb-2">
                    <span className="text-xs text-green-400 font-medium">Selecionar roleta</span>
                    <span className="text-[10px] text-gray-400">{availableRoulettes.length} disponíveis</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar roleta..."
                    className="w-full bg-white/5 border border-white/10 focus:border-green-500/50 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      // Executar busca local no dropdown, sem precisar atualizar o estado
                      const searchTerm = e.target.value.toLowerCase();
                      
                      // Encontrar todos os elementos de botão na lista
                      const buttons = dropdownRef.current?.querySelectorAll('button[data-roulette-id]');
                      
                      if (buttons) {
                        buttons.forEach(button => {
                          const buttonText = button.textContent?.toLowerCase() || '';
                          const rouletteId = button.getAttribute('data-roulette-id');
                          
                          // Sempre mostrar a opção "Todas roletas"
                          if (rouletteId === 'all') {
                            button.parentElement?.classList.remove('hidden');
                            return;
                          }
                          
                          // Verificar se o texto do botão contém o termo de busca
                          if (buttonText.includes(searchTerm)) {
                            button.parentElement?.classList.remove('hidden');
                          } else {
                            button.parentElement?.classList.add('hidden');
                          }
                        });
                      }
                    }}
                  />
                </div>
                <div className="py-1">
                  {availableRoulettes.map((roulette) => (
                    <div key={roulette.id} className={roulette.id === 'all' ? 'border-b border-white/10' : ''}>
                      <button
                        data-roulette-id={roulette.id}
                        type="button"
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors ${
                          selectedRoulette?.id === roulette.id ? 'text-green-400 bg-green-900/20' : 'text-gray-200'
                        }`}
                        onClick={() => handleRouletteSelect(roulette)}
                      >
                        <div className="flex items-center">
                          {/* Ícone diferente para "Todas roletas" */}
                          {roulette.id === 'all' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
                              <line x1="8" x2="16" y1="12" y2="12"></line>
                              <line x1="8" x2="16" y1="8" y2="8"></line>
                              <line x1="8" x2="16" y1="16" y2="16"></line>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-2 text-green-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )}
                          <span>{roulette.name}</span>
                          {selectedRoulette?.id === roulette.id && (
                            <span className="ml-auto text-green-400">✓</span>
                          )}
                        </div>
                        {/* Mostrar ID da roleta em texto menor, menos para "Todas roletas" */}
                        {roulette.id !== 'all' && (
                          <div className="text-xs text-gray-400 mt-0.5 ml-6">ID: {roulette.id}</div>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo sobre as roletas..."
              className="w-full bg-white/5 border border-white/10 focus:border-green-500/50 rounded-full pl-11 pr-14 py-2 text-white text-sm focus:outline-none shadow-inner backdrop-blur-md"
              disabled={loading}
            />
            
            {/* Indicador de roleta selecionada */}
            {selectedRoulette && selectedRoulette.id !== 'all' && (
              <div className="absolute right-14 bg-green-900/30 border border-green-500/30 rounded-full px-2 py-0.5 text-xs text-green-300">
                {selectedRoulette.name}
                <button
                  type="button"
                  className="ml-1 text-green-400 hover:text-green-200"
                  onClick={() => setSelectedRoulette({ id: 'all', name: 'Todas roletas' })}
                >
                  ×
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`absolute right-1 p-2 rounded-full ${
                loading || !input.trim() 
                  ? 'bg-gray-600/30 text-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-green-500/20'
              } transition-all duration-200`}
            >
              <Send size={16} />
            </button>
          </div>
          
          {/* Sugestões rápidas */}
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => setInput("Quais os 5 números mais frequentes?")}
              className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 rounded-full px-3 py-1 transition-colors"
            >
              Números mais frequentes
            </button>
            <button
              type="button"
              onClick={() => setInput("Há alguma tendência nos últimos 20 giros?")}
              className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 rounded-full px-3 py-1 transition-colors"
            >
              Tendências recentes
            </button>
            <button
              type="button"
              onClick={() => setInput("Qual a melhor estratégia no momento?")}
              className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 rounded-full px-3 py-1 transition-colors"
            >
              Estratégia recomendada
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIFloatingBar; 