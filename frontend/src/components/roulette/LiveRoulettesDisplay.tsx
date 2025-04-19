import React, { useEffect, useState, useRef, useMemo } from 'react';
import RouletteCard from '@/components/RouletteCard';
import { RouletteData } from '@/types';
import RouletteFeedService from '@/services/RouletteFeedService';
import LastNumbersBar from './LastNumbersBar';
import EventService from '@/services/EventService';
import CasinoAPIAdapter from '@/services/CasinoAPIAdapter';
import RouletteMiniStats from '@/components/RouletteMiniStats';
import RouletteStatsModal from '@/components/RouletteStatsModal';
import RouletteStatsInline from './RouletteStatsInline';

interface RouletteTable {
  tableId: string;
  tableName: string;
  numbers: string[];
  dealer?: string;
  players?: number;
}

interface LiveRoulettesDisplayProps {
  roulettesData?: RouletteData[]; // Opcional para manter compatibilidade retroativa
}

const LiveRoulettesDisplay: React.FC<LiveRoulettesDisplayProps> = ({ roulettesData }) => {
  const [tables, setTables] = useState<RouletteTable[]>([]);
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRoulette, setSelectedRoulette] = useState<RouletteData | null>(null);
  const [showStatsInline, setShowStatsInline] = useState(false);
  const rouletteCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Novos estados para filtros e layout
  const [providerFilter, setProviderFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'nome' | 'atividade' | 'provedor'>('nome');
  
  // Referência ao serviço de feed centralizado, sem iniciar novo polling
  const feedService = React.useMemo(() => {
    // Verificar se o sistema já foi inicializado globalmente
    if (window.isRouletteSystemInitialized && window.isRouletteSystemInitialized()) {
      console.log('[LiveRoulettesDisplay] Usando sistema de roletas já inicializado');
      // Recuperar o serviço do sistema global
      return window.getRouletteSystem 
        ? window.getRouletteSystem().rouletteFeedService 
        : RouletteFeedService.getInstance();
    }
    
    // Fallback para o comportamento padrão
    console.log('[LiveRoulettesDisplay] Sistema global não detectado, usando instância padrão');
    return RouletteFeedService.getInstance();
  }, []);

  // Usar os dados passados como prop ou obter do feedService
  useEffect(() => {
    if (roulettesData && Array.isArray(roulettesData) && roulettesData.length > 0) {
      console.log(`[LiveRoulettesDisplay] Usando ${roulettesData.length} roletas fornecidas via props`);
      setRoulettes(roulettesData);
      setIsLoading(false);
      
      // Em vez de definir diretamente, vamos simular um clique mais tarde
    } else {
      // Obter dados do feed service em vez de fazer requisições diretas
      console.log('[LiveRoulettesDisplay] Buscando dados de roletas do serviço centralizado');
      
      // Verificar se o serviço já tem dados em cache
      const cachedRoulettes = feedService.getAllRoulettes();
      
      if (cachedRoulettes && cachedRoulettes.length > 0) {
        console.log(`[LiveRoulettesDisplay] Usando ${cachedRoulettes.length} roletas do cache centralizado`);
        setRoulettes(cachedRoulettes);
        setIsLoading(false);
        
        // Em vez de definir diretamente, vamos simular um clique mais tarde
      } else {
        // Não inicializar mais o polling aqui - isso agora é responsabilidade do sistema centralizado
        console.log('[LiveRoulettesDisplay] Aguardando dados serem carregados pela inicialização central');
        
        // Definir timeout de fallback caso demore muito
        setTimeout(() => {
          // Verificar novamente após alguns segundos
          const delayedRoulettes = feedService.getAllRoulettes();
          if (delayedRoulettes && delayedRoulettes.length > 0) {
            console.log(`[LiveRoulettesDisplay] Dados recebidos após espera: ${delayedRoulettes.length} roletas`);
            setRoulettes(delayedRoulettes);
            setIsLoading(false);
            
            // Em vez de definir diretamente, vamos simular um clique mais tarde
          }
        }, 3000); // Timeout mais curto, pois já temos um timeout na página
      }
    }
  }, [feedService, roulettesData]);
  
  // Efeito para simular clique automático quando os dados são carregados
  useEffect(() => {
    // Verificar se temos roletas carregadas, não temos roleta selecionada,
    // e a segunda roleta existe
    if (roulettes.length > 1 && !selectedRoulette && !isLoading) {
      console.log('[LiveRoulettesDisplay] Simulando clique na segunda roleta');
      // Pequeno delay para garantir que a UI já renderizou
      setTimeout(() => {
        // Simular clique usando a função de manipulação de clique existente
        handleRouletteSelect(roulettes[1]);
      }, 100);
    }
  }, [roulettes, selectedRoulette, isLoading]);

  // Inscrever-se para atualizações de dados do feed service
  useEffect(() => {
    const handleDataUpdated = (updateData: any) => {
      console.log('[LiveRoulettesDisplay] Recebida atualização de dados');
      
      // Obter dados atualizados do cache
      const updatedRoulettes = feedService.getAllRoulettes();
      
      if (updatedRoulettes && updatedRoulettes.length > 0) {
        console.log(`[LiveRoulettesDisplay] Atualizando com ${updatedRoulettes.length} roletas`);
        setRoulettes(updatedRoulettes);
        setIsLoading(false); // Garantir que o loading seja desativado
        
        // Se ainda não houver roleta selecionada, selecionar a segunda
        if (!selectedRoulette && updatedRoulettes.length > 1) {
          setSelectedRoulette(updatedRoulettes[1]);
          setShowStatsInline(true);
        } else if (selectedRoulette) {
          // Atualizar a roleta selecionada com dados mais recentes
          const updatedSelectedRoulette = updatedRoulettes.find(r => 
            r.id === selectedRoulette.id || r._id === selectedRoulette._id || r.nome === selectedRoulette.nome
          );
          
          if (updatedSelectedRoulette) {
            setSelectedRoulette(updatedSelectedRoulette);
          }
        }
      }
    };
    
    // Inscrever-se no evento de atualização de dados
    EventService.on('roulette:data-updated', handleDataUpdated);
    
    // Limpar ao desmontar
    return () => {
      EventService.off('roulette:data-updated', handleDataUpdated);
    };
  }, [feedService, selectedRoulette]);

  // Função para selecionar uma roleta e mostrar estatísticas ao lado
  const handleRouletteSelect = (roleta: RouletteData) => {
    setSelectedRoulette(roleta);
    setShowStatsInline(true);
  };

  // Função para fechar a visualização de estatísticas
  const handleCloseStats = () => {
    setSelectedRoulette(null);
    setShowStatsInline(false);
  };

  // Obter todos os provedores únicos para criar o filtro
  const availableProviders = useMemo(() => {
    if (!roulettes.length) return [];
    
    const providers = new Set<string>();
    
    // Adicionar todos os provedores encontrados
    roulettes.forEach(roleta => {
      if (roleta.provedor) {
        providers.add(roleta.provedor);
      } else {
        providers.add('Desconhecido');
      }
    });
    
    // Converter para array e ordenar
    return Array.from(providers).sort();
  }, [roulettes]);
  
  // Contar roletas por provedor para exibir as contagens
  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = { todos: roulettes.length };
    
    roulettes.forEach(roleta => {
      const provider = roleta.provedor || 'Desconhecido';
      counts[provider] = (counts[provider] || 0) + 1;
    });
    
    return counts;
  }, [roulettes]);
  
  // Roletas filtradas por provedor e termo de busca
  const filteredRoulettes = useMemo(() => {
    let filtered = [...roulettes];
    
    // Aplicar filtro de provedor
    if (providerFilter !== 'todos') {
      filtered = filtered.filter(roleta => {
        const provider = roleta.provedor || 'Desconhecido';
        return provider === providerFilter;
      });
    }
    
    // Aplicar busca por texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(roleta => {
        const name = (roleta.nome || roleta.name || '').toLowerCase();
        const provider = (roleta.provedor || 'Desconhecido').toLowerCase();
        return name.includes(term) || provider.includes(term);
      });
    }
    
    // Ordenar os resultados
    return filtered.sort((a, b) => {
      if (sortBy === 'nome') {
        return (a.nome || a.name || '').localeCompare(b.nome || b.name || '');
      } else if (sortBy === 'provedor') {
        return (a.provedor || 'Desconhecido').localeCompare(b.provedor || 'Desconhecido');
      } else if (sortBy === 'atividade') {
        // Ordenar por número de jogadores online ou atividade recente
        const aCount = a.jogadores_online || 0;
        const bCount = b.jogadores_online || 0;
        return bCount - aCount;
      }
      return 0;
    });
  }, [roulettes, providerFilter, searchTerm, sortBy]);

  // Se temos dados passados por props, mostrar eles diretamente
  if (roulettesData && roulettesData.length > 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Roletas Disponíveis</h2>
            <p className="text-gray-400">Escolha uma roleta para começar a jogar</p>
          </div>
          
          {/* Barra de ferramentas de filtros/busca */}
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            {/* Campo de busca */}
            <div className="relative w-full md:w-64">
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar roleta..." 
                className="w-full bg-gray-800 text-white py-2 px-4 pl-10 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <svg 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            
            {/* Seletor de ordenação */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'nome' | 'atividade' | 'provedor')}
              className="bg-gray-800 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="nome">Ordenar: Nome</option>
              <option value="provedor">Ordenar: Provedor</option>
              <option value="atividade">Ordenar: Atividade</option>
            </select>
            
            {/* Botões de layout */}
            <div className="flex gap-2 bg-gray-800 rounded-md p-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-700' : ''}`}
                title="Visualização em grade"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-gray-700' : ''}`}
                title="Visualização em lista"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Filtros de provedor */}
        <div className="mb-6 overflow-auto">
          <div className="flex gap-2 pb-2">
            <button
              onClick={() => setProviderFilter('todos')}
              className={`px-4 py-2 rounded-md transition whitespace-nowrap ${
                providerFilter === 'todos'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Todos ({providerCounts.todos || 0})
            </button>
            
            {availableProviders.map(provider => (
              <button
                key={provider}
                onClick={() => setProviderFilter(provider)}
                className={`px-4 py-2 rounded-md transition whitespace-nowrap ${
                  providerFilter === provider
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {provider} ({providerCounts[provider] || 0})
              </button>
            ))}
          </div>
        </div>
        
        {/* Layout flexbox: roletas à esquerda, estatísticas à direita */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Lista de roletas à esquerda */}
          <div className="w-full md:w-1/2 overflow-y-auto max-h-[calc(100vh-200px)]">
            {filteredRoulettes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 bg-gray-900 rounded-lg p-6">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 mb-4">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <p className="text-gray-400 text-center">Nenhuma roleta encontrada com os filtros atuais</p>
                <button 
                  onClick={() => {
                    setProviderFilter('todos');
                    setSearchTerm('');
                  }}
                  className="mt-3 text-green-500 hover:text-green-400"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
                {filteredRoulettes.map((roleta, index) => (
                  <div 
                    key={roleta.id} 
                    ref={el => rouletteCardRefs.current[index] = el}
                    className={`bg-gray-900 rounded-lg overflow-hidden shadow-lg cursor-pointer hover:bg-gray-800 transition-colors border ${
                      selectedRoulette?.id === roleta.id ? 'border-2 border-[#00ff00]' : 'border-gray-800'
                    }`}
                    onClick={() => handleRouletteSelect(roleta)}
                  >
                    <div className="p-3">
                      {/* Cabeçalho do card */}
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Nome da roleta com contagem de atualizações */}
                          <h3 className="text-lg font-semibold text-white">{roleta.nome || roleta.name}</h3>
                          
                          {/* Badge de provedor */}
                          {roleta.provedor && (
                            <span className="bg-gray-700 text-xs text-gray-300 px-2 py-0.5 rounded-full">
                              {roleta.provedor}
                            </span>
                          )}
                          
                          {/* Ícone do número de atualizações */}
                          <div className="flex items-center">
                            <span className="bg-gray-800 text-xs text-gray-300 px-2 py-0.5 rounded">
                              {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? roleta.numero.length : 0} números
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Número atual e últimos números em linha */}
                      <div className="flex items-center gap-2">
                        {/* Número atual */}
                        <div className="flex-shrink-0">
                          {Array.isArray(roleta.numero) && roleta.numero.length > 0 ? (
                            (() => {
                              // Extrair o número principal
                              const numero = typeof roleta.numero[0] === 'number' 
                                ? roleta.numero[0] 
                                : roleta.numero[0].numero;
                              
                              return (
                                <div 
                                  className={`${
                                    numero === 0 
                                      ? "bg-green-600" 
                                      : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero)
                                        ? "bg-red-600"
                                        : "bg-black"
                                  } w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-bold`}
                                >
                                  {numero}
                                </div>
                              );
                            })()
                          ) : (
                            <div className="bg-gray-700 text-gray-400 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                              ?
                            </div>
                          )}
                        </div>
                        
                        {/* Últimos números recentes em linha */}
                        <div className="overflow-hidden">
                          <div className="flex space-x-1">
                            {Array.isArray(roleta.numero) && roleta.numero.slice(1, 8).map((num, idx) => {
                              // Extrair o número, independente do formato
                              const numeroValue = typeof num === 'number' ? num : num.numero;
                              
                              return (
                                <div 
                                  key={idx}
                                  className={`${
                                    numeroValue === 0 
                                      ? "bg-green-600" 
                                      : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numeroValue)
                                        ? "bg-red-600"
                                        : "bg-black"
                                  } w-7 h-7 rounded-full flex items-center justify-center text-white text-sm`}
                                >
                                  {numeroValue}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Informações adicionais da roleta se estiver em modo lista */}
                      {viewMode === 'list' && (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-400">
                          <div>
                            <span className="block">Jogadores:</span>
                            <span className="text-white font-medium">{roleta.jogadores_online || '-'}</span>
                          </div>
                          <div>
                            <span className="block">Dealer:</span>
                            <span className="text-white font-medium">{roleta.dealer || '-'}</span>
                          </div>
                          <div>
                            <span className="block">Status:</span>
                            <span className={`font-medium ${roleta.online ? 'text-green-500' : 'text-gray-500'}`}>
                              {roleta.online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Estatísticas à direita */}
          {showStatsInline && selectedRoulette && (
            <div className="w-full md:w-1/2 bg-gray-900 rounded-lg overflow-hidden shadow-xl">
              <div className="flex justify-between items-center p-4 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white">{selectedRoulette.nome || selectedRoulette.name}</h3>
                <button 
                  onClick={handleCloseStats}
                  className="text-gray-400 hover:text-white"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <RouletteStatsInline 
                roletaNome={selectedRoulette.nome || selectedRoulette.name || ''} 
                lastNumbers={(selectedRoulette.numero || []).map(n => typeof n === 'number' ? n : n.numero)} 
              />
            </div>
          )}
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8 h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        <span className="ml-2 text-white">Carregando mesas de roleta...</span>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="text-center p-4 text-gray-400">
        Nenhuma mesa de roleta ativa no momento.
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-16 h-16 border-4 border-gray-300 border-t-green-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-400">Carregando roletas...</p>
        </div>
      ) : (
        <>
          {/* Adicionando filtros também nesta visualização */}
          <div className="mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Roletas Disponíveis</h2>
                <p className="text-gray-400">Escolha uma roleta para começar a jogar</p>
              </div>
              
              {/* Barra de ferramentas de filtros/busca */}
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                {/* Campo de busca */}
                <div className="relative w-full md:w-64">
                  <input 
                    type="text" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar roleta..." 
                    className="w-full bg-gray-800 text-white py-2 px-4 pl-10 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <svg 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                
                {/* Seletor de ordenação */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'nome' | 'atividade' | 'provedor')}
                  className="bg-gray-800 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="nome">Ordenar: Nome</option>
                  <option value="provedor">Ordenar: Provedor</option>
                  <option value="atividade">Ordenar: Atividade</option>
                </select>
              </div>
            </div>
            
            {/* Filtros de provedor */}
            <div className="mb-4 overflow-auto">
              <div className="flex gap-2 pb-2">
                <button
                  onClick={() => setProviderFilter('todos')}
                  className={`px-4 py-2 rounded-md transition whitespace-nowrap ${
                    providerFilter === 'todos'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Todos ({providerCounts.todos || 0})
                </button>
                
                {availableProviders.map(provider => (
                  <button
                    key={provider}
                    onClick={() => setProviderFilter(provider)}
                    className={`px-4 py-2 rounded-md transition whitespace-nowrap ${
                      providerFilter === provider
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {provider} ({providerCounts[provider] || 0})
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {filteredRoulettes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 bg-gray-900 rounded-lg p-6">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 mb-4">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <p className="text-gray-400 text-center">Nenhuma roleta encontrada com os filtros atuais</p>
              <button 
                onClick={() => {
                  setProviderFilter('todos');
                  setSearchTerm('');
                }}
                className="mt-3 text-green-500 hover:text-green-400"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRoulettes.map((roleta) => (
                <RouletteCard key={roleta.id} data={roleta} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LiveRoulettesDisplay; 