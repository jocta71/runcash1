import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface RouletteData {
  id: string;
  nome: string;
  _id?: string;
  name?: string;
  numero?: any[];
}

const TestPage: React.FC = () => {
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [numbersData, setNumbersData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscar as roletas
        console.log('Buscando dados das roletas...');
        const response = await axios.get('/api/ROULETTES');
        console.log('Resposta da API:', response.data);
        
        if (Array.isArray(response.data)) {
          setRoulettes(response.data);
          
          // Para cada roleta, buscar seus números
          const numbersMap: Record<string, any[]> = {};
          
          for (const roleta of response.data) {
            try {
              console.log(`Buscando números para roleta ${roleta.id} (${roleta.nome || roleta.name})...`);
              const numbersResponse = await axios.get(`/api/roulette-numbers/${roleta.id}?limit=10`);
              console.log(`Números para ${roleta.nome || roleta.name}:`, numbersResponse.data);
              
              numbersMap[roleta.id] = Array.isArray(numbersResponse.data) 
                ? numbersResponse.data 
                : [];
            } catch (err) {
              console.error(`Erro ao buscar números para ${roleta.id}:`, err);
              numbersMap[roleta.id] = [];
            }
          }
          
          setNumbersData(numbersMap);
        } else {
          setError('Formato de resposta inválido');
        }
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setError('Falha ao carregar dados. Verifique o console para mais detalhes.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  if (loading) {
    return <div>Carregando dados...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Teste de Dados das Roletas</h1>
      
      <h2 className="text-xl font-semibold mt-6 mb-2">Dados das Roletas:</h2>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(roulettes, null, 2)}
      </pre>
      
      <h2 className="text-xl font-semibold mt-6 mb-2">Números por Roleta:</h2>
      {Object.keys(numbersData).map(roletaId => {
        const roleta = roulettes.find(r => r.id === roletaId);
        return (
          <div key={roletaId} className="mb-6 border p-4 rounded">
            <h3 className="font-semibold">{roleta?.nome || roleta?.name || roletaId}</h3>
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(numbersData[roletaId], null, 2)}
            </pre>
          </div>
        );
      })}
    </div>
  );
};

export default TestPage; 