import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, X, RotateCcw, Loader2 } from 'lucide-react';
import { RouletteRepository } from '../services/data/rouletteRepository';
import CustomLoader from './CustomLoader';

interface AIMessage {
  id: number;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const AIFloatingBar: React.FC = () => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const sendMessageToGemini = async (query: string) => {
    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY');
      
      if (!apiKey) {
        throw new Error('Chave da API Gemini não encontrada');
      }
      
      const model = 'gemini-2.0-flash';
      const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
      
      // Buscar dados da roleta - em um app real você obteria isso da sua API
      const roletaData = await fetchRouletteData();
      
      const response = await axios.post(
        apiUrl,
        {
          contents: [
            {
              role: "user",
              parts: [
                { 
                  text: `Instruções do sistema:
                  Você é um assistente especializado em análise de dados de roletas de cassino.
                  
                  DIRETRIZES PARA SUAS RESPOSTAS:
                  1. Seja EXTREMAMENTE DIRETO E OBJETIVO - vá direto ao ponto.
                  2. Use frases curtas e precisas.
                  3. Organize visualmente suas respostas com:
                     - Marcadores (•) para listas
                     - Texto em **negrito** para destacar números e informações importantes
                     - Tabelas simples quando necessário comparar dados
                     - Espaçamento adequado para melhor legibilidade
                  4. Forneça APENAS as informações solicitadas, sem explicações desnecessárias.
                  5. Se a resposta tiver estatísticas, apresente-as de forma estruturada e visualmente clara.
                  6. Sempre responda em português brasileiro.
                  7. Nunca mencione marcas de IA ou similar nas suas respostas.
                  8. Você é a IA RunCash, especializada em análise de roletas.
                  
                  Dados da roleta: ${JSON.stringify(roletaData)}
                  
                  Consulta do usuário: ${query}`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
            topP: 0.95,
            topK: 40
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000 // Timeout de 30 segundos
        }
      );
      
      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Erro ao consultar API Gemini:', error);
      return 'Desculpe, ocorreu um erro ao processar sua consulta. Por favor, tente novamente mais tarde.';
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
        .sort((a, b) => b[1] - a[1])
        .map(entry => parseInt(entry[0]));
      
      const hotNumbers = sortedNumbers.slice(0, 4);
      const coldNumbers = sortedNumbers.slice(-4).reverse();
      
      // Identificar tendências
      const trends = [];
      let colorStreak = { color: null, count: 0 };
      let parityStreak = { parity: null, count: 0 };
      let dozenStreak = { dozen: null, count: 0 };
      
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
          redPercentage: Number(((redCount / (recentNumbers.length || 1)) * 100).toFixed(2)),
          blackPercentage: Number(((blackCount / (recentNumbers.length || 1)) * 100).toFixed(2)),
          greenPercentage: Number(((greenCount / (recentNumbers.length || 1)) * 100).toFixed(2)),
          evenCount,
          oddCount,
          evenPercentage: Number(((evenCount / (recentNumbers.length || 1)) * 100).toFixed(2)),
          oddPercentage: Number(((oddCount / (recentNumbers.length || 1)) * 100).toFixed(2)),
          dozenCounts,
          dozenPercentages: dozenCounts.map(count => 
            Number(((count / (recentNumbers.length || 1)) * 100).toFixed(2))
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
        id: Date.now() + 1,
        role: 'ai',
        content: aiResponse,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      
      const errorMessage: AIMessage = {
        id: Date.now() + 1,
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
      <div className="fixed bottom-4 left-0 right-0 mx-auto z-50 w-[90%] max-w-lg">
        <div className="bg-[#141318] border border-[#2a2a2e] rounded-full shadow-lg p-2 flex items-center">
          <button 
            onClick={toggleExpand}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-green-600 text-white mr-2"
          >
            <RotateCcw size={16} />
          </button>
          <div 
            onClick={toggleExpand}
            className="flex-1 py-2 px-4 cursor-pointer text-gray-400"
          >
            Pergunte algo sobre as roletas...
          </div>
        </div>
      </div>
    );
  }

  // A interface expandida mostra o histórico de mensagens e a entrada
  return (
    <div className="fixed bottom-4 left-0 right-0 mx-auto z-50 w-[90%] max-w-2xl bg-[#141318] border border-[#2a2a2e] rounded-lg shadow-lg flex flex-col max-h-[70vh]">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between p-3 border-b border-[#2a2a2e]">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-green-700 flex items-center justify-center mr-2">
            <span className="text-white font-bold">R</span>
          </div>
          <span className="text-white font-medium">RunCash Assistente</span>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={clearChat}
            className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
            title="Limpar chat"
          >
            <RotateCcw size={16} />
          </button>
          <button 
            onClick={toggleExpand}
            className="text-gray-400 hover:text-white p-1 rounded-md transition-colors"
            title="Minimizar"
          >
            <X size={18} />
          </button>
        </div>
      </div>
      
      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[calc(70vh-120px)]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <p className="text-center mb-2">Olá! Como posso ajudar com análise de roletas hoje?</p>
            <p className="text-center text-sm">Experimente perguntar sobre números quentes, padrões recentes ou estratégias.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user' 
                    ? 'bg-green-600 text-white'
                    : 'bg-[#1e293b] text-white'
                }`}
              >
                <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1e293b] text-white max-w-[80%] rounded-lg p-4">
              <div className="flex flex-col items-center">
                <CustomLoader />
                <span className="mt-3 text-center text-sm text-green-400">Analisando dados das roletas...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Barra de entrada */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[#2a2a2e] flex items-center space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte algo sobre as roletas..."
          className="flex-1 bg-[#1a191e] border border-[#2a2a2e] rounded-md px-4 py-2 text-white text-sm focus:outline-none focus:border-green-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className={`p-2 rounded-md ${
            loading || !input.trim() 
              ? 'bg-green-600/50 text-white/50 cursor-not-allowed' 
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default AIFloatingBar; 