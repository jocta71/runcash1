import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CreditCard, CheckCircle, AlertCircle, ArrowLeft, Lock, Calendar, User } from 'lucide-react';

interface PlanoDetalhes {
  id: string;
  nome: string;
  valor: number;
  intervalo: string;
  descricao: string;
}

interface DadosPagamento {
  nome: string;
  email: string;
  cpf: string;
  numeroCartao: string;
  validade: string;
  cvv: string;
}

const CheckoutPage = () => {
  const { planoId } = useParams<{ planoId: string }>();
  const navigate = useNavigate();
  
  const [plano, setPlano] = useState<PlanoDetalhes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processandoPagamento, setProcessandoPagamento] = useState(false);
  const [statusPagamento, setStatusPagamento] = useState<'aguardando' | 'processando' | 'sucesso' | 'erro'>('aguardando');
  const [mensagemPagamento, setMensagemPagamento] = useState('');
  
  const [dadosPagamento, setDadosPagamento] = useState<DadosPagamento>({
    nome: '',
    email: '',
    cpf: '',
    numeroCartao: '',
    validade: '',
    cvv: ''
  });
  
  const [errosValidacao, setErrosValidacao] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const fetchPlanoDetalhes = async () => {
      if (!planoId) return;
      
      try {
        setLoading(true);
        const response = await axios.get('/api/assinatura/planos');
        
        if (response.data.success && response.data.data.planos) {
          const planoEncontrado = response.data.data.planos.find((p: any) => p.id === planoId);
          
          if (planoEncontrado) {
            setPlano(planoEncontrado);
          } else {
            setError('Plano não encontrado. Por favor, selecione um plano válido.');
            setTimeout(() => navigate('/planos'), 3000);
          }
        } else {
          setError('Não foi possível obter os detalhes do plano.');
        }
      } catch (error) {
        console.error('Erro ao buscar detalhes do plano:', error);
        setError('Erro ao carregar detalhes do plano. Por favor, tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };
    
    const carregarDadosUsuario = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await axios.get('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.success && response.data.user) {
          setDadosPagamento(prev => ({
            ...prev,
            nome: response.data.user.nome || '',
            email: response.data.user.email || ''
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
      }
    };
    
    fetchPlanoDetalhes();
    carregarDadosUsuario();
  }, [planoId, navigate]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Formatação específica para cada campo
    let formattedValue = value;
    
    if (name === 'numeroCartao') {
      // Formatar número do cartão (grupos de 4 dígitos)
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{4})(?=\d)/g, '$1 ')
        .substring(0, 19);
    } else if (name === 'validade') {
      // Formatar validade do cartão (MM/AA)
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{2})(?=\d)/g, '$1/')
        .substring(0, 5);
    } else if (name === 'cvv') {
      // Limitar CVV a 3 ou 4 dígitos
      formattedValue = value.replace(/\D/g, '').substring(0, 4);
    } else if (name === 'cpf') {
      // Formatar CPF (XXX.XXX.XXX-XX)
      formattedValue = value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
        .substring(0, 14);
    }
    
    setDadosPagamento(prev => ({
      ...prev,
      [name]: formattedValue
    }));
    
    // Limpar erro de validação ao editar
    if (errosValidacao[name]) {
      setErrosValidacao(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  const validarFormulario = () => {
    const novosErros: Record<string, string> = {};
    
    // Validar nome
    if (!dadosPagamento.nome.trim()) {
      novosErros.nome = 'Nome é obrigatório';
    }
    
    // Validar email
    if (!dadosPagamento.email.trim()) {
      novosErros.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dadosPagamento.email)) {
      novosErros.email = 'Email inválido';
    }
    
    // Validar CPF
    if (!dadosPagamento.cpf.trim()) {
      novosErros.cpf = 'CPF é obrigatório';
    } else if (dadosPagamento.cpf.replace(/\D/g, '').length !== 11) {
      novosErros.cpf = 'CPF inválido';
    }
    
    // Validar número do cartão
    if (!dadosPagamento.numeroCartao.trim()) {
      novosErros.numeroCartao = 'Número do cartão é obrigatório';
    } else if (dadosPagamento.numeroCartao.replace(/\D/g, '').length < 16) {
      novosErros.numeroCartao = 'Número de cartão inválido';
    }
    
    // Validar validade
    if (!dadosPagamento.validade.trim()) {
      novosErros.validade = 'Data de validade é obrigatória';
    } else if (!/^\d{2}\/\d{2}$/.test(dadosPagamento.validade)) {
      novosErros.validade = 'Formato inválido (MM/AA)';
    } else {
      // Validar se a data está no futuro
      const [month, year] = dadosPagamento.validade.split('/');
      const expiryDate = new Date(2000 + parseInt(year), parseInt(month) - 1);
      const currentDate = new Date();
      
      if (expiryDate < currentDate) {
        novosErros.validade = 'Cartão expirado';
      }
    }
    
    // Validar CVV
    if (!dadosPagamento.cvv.trim()) {
      novosErros.cvv = 'CVV é obrigatório';
    } else if (!/^\d{3,4}$/.test(dadosPagamento.cvv)) {
      novosErros.cvv = 'CVV inválido';
    }
    
    setErrosValidacao(novosErros);
    return Object.keys(novosErros).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validarFormulario()) {
      return;
    }
    
    try {
      setProcessandoPagamento(true);
      setStatusPagamento('processando');
      setMensagemPagamento('Processando pagamento. Por favor, aguarde...');
      
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Você precisa estar logado para realizar uma assinatura');
      }
      
      // Preparar dados para API Asaas
      const dadosAssinatura = {
        planoId,
        cartao: {
          holderName: dadosPagamento.nome,
          number: dadosPagamento.numeroCartao.replace(/\D/g, ''),
          expiryMonth: dadosPagamento.validade.split('/')[0],
          expiryYear: '20' + dadosPagamento.validade.split('/')[1],
          ccv: dadosPagamento.cvv
        },
        customer: {
          cpfCnpj: dadosPagamento.cpf.replace(/\D/g, ''),
          email: dadosPagamento.email
        }
      };
      
      // Enviar para backend processar com Asaas
      const response = await axios.post('/api/assinatura/processar', dadosAssinatura, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Simular delay para processamento (remover em produção)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (response.data.success) {
        setStatusPagamento('sucesso');
        setMensagemPagamento('Pagamento processado com sucesso! Sua assinatura está ativa.');
        
        // Redirecionar após alguns segundos
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setStatusPagamento('erro');
        setMensagemPagamento(response.data.message || 'Erro ao processar pagamento. Tente novamente.');
      }
    } catch (error: any) {
      console.error('Erro ao processar pagamento:', error);
      setStatusPagamento('erro');
      setMensagemPagamento(
        error.response?.data?.message || error.message || 'Erro ao processar pagamento. Tente novamente.'
      );
    } finally {
      setProcessandoPagamento(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 bg-gray-700 rounded w-64 mb-8"></div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-2xl">
            <div className="h-8 bg-gray-700 rounded w-1/2 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-gray-700 rounded w-full"></div>
              ))}
            </div>
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
          <h2 className="text-xl font-semibold mb-2">Erro</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/planos')}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Voltar para planos
          </button>
        </div>
      </div>
    );
  }
  
  if (statusPagamento === 'sucesso') {
    return (
      <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
        <div className="bg-green-900/30 border border-green-700 p-8 rounded-lg max-w-lg w-full text-center">
          <CheckCircle className="w-20 h-20 mx-auto text-green-500 mb-6" />
          <h2 className="text-2xl font-semibold mb-4">Pagamento Confirmado!</h2>
          <p className="text-gray-300 mb-8">{mensagemPagamento}</p>
          <p className="text-gray-400 mb-4">Você será redirecionado automaticamente...</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-md transition-colors"
          >
            Ir para o Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  if (statusPagamento === 'erro') {
    return (
      <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-700 p-8 rounded-lg max-w-lg w-full text-center">
          <AlertCircle className="w-20 h-20 mx-auto text-red-500 mb-6" />
          <h2 className="text-2xl font-semibold mb-4">Erro no Pagamento</h2>
          <p className="text-gray-300 mb-8">{mensagemPagamento}</p>
          <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 justify-center">
            <button 
              onClick={() => setStatusPagamento('aguardando')}
              className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-md transition-colors"
            >
              Tentar novamente
            </button>
            <button 
              onClick={() => navigate('/planos')}
              className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-md transition-colors"
            >
              Voltar para planos
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (statusPagamento === 'processando') {
    return (
      <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
        <div className="bg-blue-900/30 border border-blue-700 p-8 rounded-lg max-w-lg w-full text-center">
          <div className="animate-spin w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6"></div>
          <h2 className="text-2xl font-semibold mb-4">Processando Pagamento</h2>
          <p className="text-gray-300">Por favor, aguarde enquanto processamos seu pagamento...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <button 
          onClick={() => navigate('/planos')}
          className="flex items-center text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para planos
        </button>
        
        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-700 p-4 border-b border-gray-600">
            <h1 className="text-xl font-bold">Checkout - {plano?.nome}</h1>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-700">
            <div className="p-6 col-span-2">
              <h2 className="text-lg font-semibold mb-6">Dados de Pagamento</h2>
              
              <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="nome" className="block text-sm font-medium text-gray-400 mb-1">
                      Nome no Cartão
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-500" />
                      </div>
                      <input
                        type="text"
                        id="nome"
                        name="nome"
                        value={dadosPagamento.nome}
                        onChange={handleInputChange}
                        className={`bg-gray-700 block w-full pl-10 pr-3 py-2.5 rounded-md border ${
                          errosValidacao.nome 
                            ? 'border-red-500 focus:border-red-500' 
                            : 'border-gray-600 focus:border-blue-500'
                        } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                        placeholder="Nome como aparece no cartão"
                      />
                    </div>
                    {errosValidacao.nome && (
                      <p className="mt-1 text-sm text-red-500">{errosValidacao.nome}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={dadosPagamento.email}
                      onChange={handleInputChange}
                      className={`bg-gray-700 block w-full px-3 py-2.5 rounded-md border ${
                        errosValidacao.email 
                          ? 'border-red-500 focus:border-red-500' 
                          : 'border-gray-600 focus:border-blue-500'
                      } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                      placeholder="seu-email@exemplo.com"
                    />
                    {errosValidacao.email && (
                      <p className="mt-1 text-sm text-red-500">{errosValidacao.email}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="cpf" className="block text-sm font-medium text-gray-400 mb-1">
                      CPF
                    </label>
                    <input
                      type="text"
                      id="cpf"
                      name="cpf"
                      value={dadosPagamento.cpf}
                      onChange={handleInputChange}
                      className={`bg-gray-700 block w-full px-3 py-2.5 rounded-md border ${
                        errosValidacao.cpf 
                          ? 'border-red-500 focus:border-red-500' 
                          : 'border-gray-600 focus:border-blue-500'
                      } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                      placeholder="123.456.789-00"
                    />
                    {errosValidacao.cpf && (
                      <p className="mt-1 text-sm text-red-500">{errosValidacao.cpf}</p>
                    )}
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700">
                    <h3 className="text-md font-medium mb-3">Informações do Cartão</h3>
                    
                    <div>
                      <label htmlFor="numeroCartao" className="block text-sm font-medium text-gray-400 mb-1">
                        Número do Cartão
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <CreditCard className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                          type="text"
                          id="numeroCartao"
                          name="numeroCartao"
                          value={dadosPagamento.numeroCartao}
                          onChange={handleInputChange}
                          className={`bg-gray-700 block w-full pl-10 pr-3 py-2.5 rounded-md border ${
                            errosValidacao.numeroCartao 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'border-gray-600 focus:border-blue-500'
                          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                          placeholder="1234 5678 9012 3456"
                        />
                      </div>
                      {errosValidacao.numeroCartao && (
                        <p className="mt-1 text-sm text-red-500">{errosValidacao.numeroCartao}</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label htmlFor="validade" className="block text-sm font-medium text-gray-400 mb-1">
                          Validade
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Calendar className="h-5 w-5 text-gray-500" />
                          </div>
                          <input
                            type="text"
                            id="validade"
                            name="validade"
                            value={dadosPagamento.validade}
                            onChange={handleInputChange}
                            className={`bg-gray-700 block w-full pl-10 pr-3 py-2.5 rounded-md border ${
                              errosValidacao.validade 
                                ? 'border-red-500 focus:border-red-500' 
                                : 'border-gray-600 focus:border-blue-500'
                            } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                            placeholder="MM/AA"
                          />
                        </div>
                        {errosValidacao.validade && (
                          <p className="mt-1 text-sm text-red-500">{errosValidacao.validade}</p>
                        )}
                      </div>
                      
                      <div>
                        <label htmlFor="cvv" className="block text-sm font-medium text-gray-400 mb-1">
                          CVV
                        </label>
                        <input
                          type="text"
                          id="cvv"
                          name="cvv"
                          value={dadosPagamento.cvv}
                          onChange={handleInputChange}
                          className={`bg-gray-700 block w-full px-3 py-2.5 rounded-md border ${
                            errosValidacao.cvv 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'border-gray-600 focus:border-blue-500'
                          } focus:outline-none focus:ring-1 focus:ring-blue-500`}
                          placeholder="123"
                        />
                        {errosValidacao.cvv && (
                          <p className="mt-1 text-sm text-red-500">{errosValidacao.cvv}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8">
                  <button
                    type="submit"
                    disabled={processandoPagamento}
                    className={`
                      w-full flex items-center justify-center px-6 py-3 rounded-md text-white font-medium
                      ${processandoPagamento
                        ? 'bg-gray-600 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                      }
                      transition-colors
                    `}
                  >
                    {processandoPagamento ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Processando...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5 mr-2" />
                        Finalizar Pagamento
                      </>
                    )}
                  </button>
                </div>
                
                <div className="mt-4 text-center text-gray-400 text-sm">
                  <p className="flex items-center justify-center">
                    <Lock className="w-4 h-4 mr-1 text-green-500" />
                    Seus dados estão protegidos com criptografia SSL
                  </p>
                </div>
              </form>
            </div>
            
            <div className="p-6 bg-gray-800">
              <h2 className="text-lg font-semibold mb-4">Resumo do Pedido</h2>
              
              <div className="border-t border-b border-gray-700 py-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Plano</span>
                  <span className="font-medium">{plano?.nome}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Período</span>
                  <span className="font-medium">{plano?.intervalo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Renovação</span>
                  <span className="font-medium">Automática</span>
                </div>
              </div>
              
              <div className="mb-6">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>R$ {plano?.valor.toFixed(2).replace('.', ',')}</span>
                </div>
                <p className="text-gray-400 text-sm mt-1">
                  Cobrado a cada {plano?.intervalo === 'mensal' 
                    ? 'mês' 
                    : plano?.intervalo === 'trimestral' 
                      ? '3 meses' 
                      : '12 meses'}
                </p>
              </div>
              
              <div className="bg-gray-700/50 p-3 rounded-md text-sm text-gray-300">
                <p>Ao finalizar o pagamento, você concorda com os termos de serviço e política de privacidade.</p>
                <p className="mt-2">Você pode cancelar sua assinatura a qualquer momento pela área de perfil.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage; 