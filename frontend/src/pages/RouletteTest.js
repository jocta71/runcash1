import React, { useState, useEffect } from 'react';
import { processRouletteResponse } from '../utils/rouletteDecryptor';
import axios from 'axios';

/**
 * Página de teste para exibir dados de roletas com decodificação
 */
const RouletteTest = () => {
  const [roulettes, setRoulettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoulette, setSelectedRoulette] = useState(null);
  const [numbers, setNumbers] = useState([]);

  // Carregar todas as roletas
  useEffect(() => {
    const fetchRoulettes = async () => {
      try {
        setLoading(true);
        
        // Chamada para a API
        const response = await axios.get('/api/roulettes');
        
        // Processar resposta (decodificar se necessário)
        const processedData = await processRouletteResponse(response.data);
        
        // Atualizar estado
        setRoulettes(Array.isArray(processedData) ? processedData : []);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar roletas:', err);
        setError('Falha ao carregar dados de roletas. Por favor, tente novamente.');
        setLoading(false);
      }
    };

    fetchRoulettes();
  }, []);

  // Carregar números de uma roleta específica
  const loadRouletteNumbers = async (roletaId) => {
    try {
      setLoading(true);
      
      // Buscar roleta selecionada
      const roulette = roulettes.find(r => r.id === roletaId);
      setSelectedRoulette(roulette);
      
      // Se já temos números na roleta, não precisamos chamar a API
      if (roulette && roulette.numero && roulette.numero.length > 0) {
        setNumbers(roulette.numero);
        setLoading(false);
        return;
      }
      
      // Caso contrário, buscar na API
      const response = await axios.get(`/api/roulettes/${roletaId}/numbers`);
      
      // Processar resposta (decodificar se necessário)
      const processedData = await processRouletteResponse(response.data);
      
      // Atualizar estado
      setNumbers(processedData.numeros || []);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar números da roleta:', err);
      setError('Falha ao carregar números da roleta. Por favor, tente novamente.');
      setLoading(false);
    }
  };

  // Renderizar cor do número
  const renderColorBadge = (cor) => {
    const colorMap = {
      'vermelho': 'bg-red-600',
      'preto': 'bg-black',
      'verde': 'bg-green-600'
    };
    
    return (
      <span className={`inline-block w-3 h-3 rounded-full ${colorMap[cor] || 'bg-gray-400'} mr-2`}></span>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Teste de Roletas (Formato Concorrente)</h1>
      
      {loading && <p className="text-gray-500">Carregando dados...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coluna de lista de roletas */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4">Roletas Disponíveis</h2>
          
          {roulettes.length === 0 && !loading ? (
            <p className="text-gray-500">Nenhuma roleta encontrada.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {roulettes.map((roleta) => (
                <li key={roleta.id} className="py-2">
                  <button
                    onClick={() => loadRouletteNumbers(roleta.id)}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-gray-100 ${selectedRoulette?.id === roleta.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                  >
                    {roleta.nome}
                    {roleta.ativa && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        Ativa
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Coluna de números da roleta selecionada */}
        <div className="bg-white rounded-lg shadow p-4 md:col-span-2">
          <h2 className="text-lg font-semibold mb-4">
            {selectedRoulette ? `Números da ${selectedRoulette.nome}` : 'Selecione uma roleta'}
          </h2>
          
          {selectedRoulette ? (
            <>
              {numbers.length === 0 && !loading ? (
                <p className="text-gray-500">Nenhum número encontrado para esta roleta.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {numbers.map((num, index) => (
                    <div key={index} className="border rounded p-2 flex items-center justify-between">
                      <div className="flex items-center">
                        {renderColorBadge(num.cor)}
                        <span className="font-semibold text-lg">{num.numero}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(num.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Detalhes da Roleta</h3>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(selectedRoulette, null, 2)}
                </pre>
              </div>
            </>
          ) : (
            <p className="text-gray-500">Selecione uma roleta à esquerda para ver seus números.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouletteTest; 