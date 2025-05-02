import { useState, useEffect } from 'react';
import { CheckCircle, CheckCircle2, AlertCircle, CreditCard, Calendar, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Plano {
  id: string;
  nome: string;
  valor: number;
  intervalo: string;
  descricao: string;
  recursos: string[];
  economia?: string;
}

const PlanosPage = () => {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [assinaturaAtual, setAssinaturaAtual] = useState<any>(null);
  const [mensagemFeedback, setMensagemFeedback] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);
  
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchPlanos = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/assinatura/planos');
        if (response.data.success && response.data.data.planos) {
          setPlanos(response.data.data.planos);
        } else {
          setError('Não foi possível obter os planos disponíveis.');
        }
      } catch (error) {
        console.error('Erro ao buscar planos:', error);
        setError('Erro ao carregar os planos. Por favor, tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };
    
    const fetchAssinaturaAtual = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await axios.get('/api/assinatura/status', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success && response.data.data) {
          setAssinaturaAtual(response.data.data);
        }
      } catch (error) {
        console.error('Erro ao buscar status da assinatura:', error);
      }
    };
    
    fetchPlanos();
    fetchAssinaturaAtual();
  }, []);
  
  const handleSelectPlan = (planoId: string) => {
    setSelectedPlan(planoId);
  };
  
  const handleAssinar = async () => {
    if (!selectedPlan) {
      setMensagemFeedback({
        tipo: 'erro',
        texto: 'Por favor, selecione um plano para continuar.'
      });
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setMensagemFeedback({
          tipo: 'erro',
          texto: 'Você precisa estar logado para assinar um plano.'
        });
        return;
      }
      
      // Redirecionar para a tela de checkout
      navigate(`/checkout/${selectedPlan}`);
      
    } catch (error) {
      console.error('Erro ao processar assinatura:', error);
      setMensagemFeedback({
        tipo: 'erro',
        texto: 'Ocorreu um erro ao processar sua assinatura. Por favor, tente novamente.'
      });
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 bg-gray-700 rounded w-64 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-800 p-6 rounded-lg shadow-lg h-96">
                <div className="h-8 bg-gray-700 rounded w-full mb-4"></div>
                <div className="h-6 bg-gray-700 rounded w-32 mb-8"></div>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((j) => (
                    <div key={j} className="h-4 bg-gray-700 rounded w-full"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-700 p-6 rounded-lg max-w-lg w-full text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Erro ao carregar planos</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 min-h-screen">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-3">Planos de Assinatura</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Escolha o plano ideal para suas necessidades e tenha acesso a todos os recursos e estatísticas de roletas em tempo real.
        </p>
      </div>
      
      {assinaturaAtual && assinaturaAtual.possuiAssinatura && (
        <div className="mb-8 bg-green-900/30 border border-green-700 p-4 rounded-lg max-w-3xl mx-auto">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
            <p className="text-green-300">
              Você já possui uma assinatura ativa do plano <strong>{assinaturaAtual.plano}</strong>. 
              Validade: {new Date(assinaturaAtual.validade).toLocaleDateString()}
              {assinaturaAtual.diasRestantes > 0 && ` (${assinaturaAtual.diasRestantes} dias restantes)`}
            </p>
          </div>
        </div>
      )}
      
      {mensagemFeedback && (
        <div className={`mb-8 p-4 rounded-lg max-w-3xl mx-auto ${
          mensagemFeedback.tipo === 'sucesso' 
            ? 'bg-green-900/30 border border-green-700 text-green-300' 
            : 'bg-red-900/30 border border-red-700 text-red-300'
        }`}>
          <div className="flex items-center">
            {mensagemFeedback.tipo === 'sucesso' ? (
              <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
            )}
            <p>{mensagemFeedback.texto}</p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {planos.map((plano) => (
          <div 
            key={plano.id}
            className={`
              bg-gray-800 border-2 rounded-lg shadow-lg overflow-hidden transition-all duration-300
              ${selectedPlan === plano.id 
                ? 'border-green-500 transform scale-105' 
                : 'border-gray-700 hover:border-gray-500'
              }
            `}
            onClick={() => handleSelectPlan(plano.id)}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">{plano.nome}</h3>
              <div className="mb-4">
                <span className="text-3xl font-bold">
                  R$ {plano.valor.toFixed(2).replace('.', ',')}
                </span>
                <span className="text-gray-400">/{plano.intervalo}</span>
              </div>
              <p className="text-gray-300 mb-6">{plano.descricao}</p>
              <div className="space-y-3 mb-6">
                {plano.recursos.map((recurso, index) => (
                  <div key={index} className="flex items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-300">{recurso}</span>
                  </div>
                ))}
              </div>
              {plano.economia && (
                <div className="bg-green-900/30 border border-green-700 p-2 rounded-md text-center text-green-300 text-sm mb-6">
                  {plano.economia}
                </div>
              )}
            </div>
            <div 
              className={`
                flex items-center justify-center p-4 border-t border-gray-700
                ${selectedPlan === plano.id ? 'bg-green-900/30' : 'bg-gray-700/30'}
              `}
            >
              <input 
                type="radio"
                name="planSelection"
                value={plano.id}
                checked={selectedPlan === plano.id}
                onChange={() => handleSelectPlan(plano.id)}
                className="w-4 h-4 mr-2 accent-green-500"
              />
              <span className="font-medium">
                {selectedPlan === plano.id ? 'Selecionado' : 'Selecionar plano'}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-12 flex justify-center">
        <button
          onClick={handleAssinar}
          disabled={!selectedPlan}
          className={`
            flex items-center justify-center px-8 py-3 rounded-lg text-lg font-medium transition-colors
            ${selectedPlan 
              ? 'bg-green-600 hover:bg-green-700 text-white' 
              : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          <CreditCard className="w-5 h-5 mr-2" />
          Prosseguir para pagamento
        </button>
      </div>
      
      <div className="mt-8 max-w-3xl mx-auto text-center text-gray-400 text-sm">
        <p className="mb-2">
          <Calendar className="w-4 h-4 inline-block mr-1" />
          Todas as assinaturas têm renovação automática, mas você pode cancelar a qualquer momento.
        </p>
        <p>
          <Package className="w-4 h-4 inline-block mr-1" />
          Ao assinar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  );
};

export default PlanosPage; 