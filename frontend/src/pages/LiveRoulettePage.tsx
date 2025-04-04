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
    
    // Configurar o adaptador com os endpoints corretos
    apiAdapter.configure({
      baseUrl: 'https://cgp.safe-iplay.com',
      endpoint: '/cgpapi/liveFeed/GetLiveTables',
      method: 'POST',
      requestData: {},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      pollInterval: 5000
    });
    
    // Iniciar o polling
    apiAdapter.startPolling();
    
    // Marcar como carregado após um breve delay para dar tempo do primeiro fetch
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    // Limpar ao desmontar
    return () => {
      apiAdapter.stopPolling();
    };
  }, []);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Roletas ao Vivo</h1>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Voltar
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            <span className="ml-3 text-white">Conectando às mesas...</span>
          </div>
        ) : (
          <LiveRoulettesDisplay />
        )}
      </div>
    </Layout>
  );
};

export default LiveRoulettePage; 