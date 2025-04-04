import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import LiveRoulettesDisplay from '@/components/roulette/LiveRoulettesDisplay';
import CasinoAPIAdapter from '@/services/CasinoAPIAdapter';

const LiveRoulettePage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Configurar e iniciar o adaptador da API
    const apiAdapter = CasinoAPIAdapter.getInstance();
    
    // Configurar o adaptador com os endpoints corretos baseados no site de referência
    apiAdapter.configure({
      baseUrl: 'https://cgp.safe-iplay.com',
      endpoint: '/cgpapi/liveFeed/GetLiveTables',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      pollInterval: 5000
    });
    
    // Marcar como carregado após um breve delay para dar tempo do primeiro fetch
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    // O adaptador já é iniciado dentro do LiveRoulettesDisplay
    
    // Limpar ao desmontar (NÃO parar o polling aqui, deixar que o componente LiveRoulettesDisplay gerencie isso)
    return () => {};
  }, []);

  return (
    <Layout>
      <div className="relative min-h-screen bg-gray-900">
        <header className="bg-gray-800 py-4 shadow-lg">
          <div className="container mx-auto px-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white">Roletas ao Vivo</h1>
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Voltar
            </button>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              <span className="ml-3 text-white">Conectando às mesas de roleta...</span>
            </div>
          ) : (
            <LiveRoulettesDisplay />
          )}
        </main>
        
        <footer className="bg-gray-800 py-4 mt-12">
          <div className="container mx-auto px-4 text-center text-gray-400 text-sm">
            Os dados exibidos são obtidos em tempo real do servidor remoto.
          </div>
        </footer>
      </div>
    </Layout>
  );
};

export default LiveRoulettePage; 