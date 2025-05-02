import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiCheckCircle, FiAlertTriangle, FiLoader } from 'react-icons/fi';
import { Toaster, toast } from 'react-hot-toast';

// URL da API do Railway
const API_URL = "https://backendapi-production-36b5.up.railway.app/api";

/**
 * Página de redirecionamento após o checkout do Asaas
 * Processa os parâmetros de retorno e exibe mensagem apropriada
 */
const CheckoutRedirect = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processando seu pagamento...');

  useEffect(() => {
    // Função para processar os parâmetros de retorno
    const processCheckoutReturn = async () => {
      try {
        // Obter os parâmetros da URL
        const params = new URLSearchParams(location.search);
        const checkoutId = params.get('checkoutId');
        const result = params.get('result');
        
        if (!checkoutId) {
          setStatus('error');
          setMessage('ID do checkout não encontrado');
          toast.error('Parâmetros inválidos no retorno do pagamento');
          return;
        }
        
        console.log('Checkout ID:', checkoutId, 'Result:', result);
        
        // Verificar o status no backend
        if (result === 'success') {
          // Verificar o status do checkout no backend
          const response = await axios.get(`${API_URL}/checkout/${checkoutId}/status`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (response.data.success) {
            setStatus('success');
            setMessage('Pagamento processado com sucesso! Sua assinatura está ativa.');
            toast.success('Assinatura ativada com sucesso!');
            
            // Redirecionar após 3 segundos
            setTimeout(() => {
              navigate('/dashboard');
            }, 3000);
          } else {
            setStatus('error');
            setMessage('Não foi possível confirmar seu pagamento. Por favor, entre em contato com o suporte.');
            toast.error('Erro ao verificar status do pagamento');
          }
        } else {
          setStatus('error');
          setMessage('Houve um problema com seu pagamento. Por favor, tente novamente ou entre em contato com o suporte.');
          toast.error('Pagamento não concluído');
        }
      } catch (error) {
        console.error('Erro ao processar retorno do checkout:', error);
        setStatus('error');
        setMessage('Erro ao processar o retorno do pagamento');
        toast.error('Ocorreu um erro ao verificar seu pagamento');
      }
    };
    
    processCheckoutReturn();
  }, [location, navigate]);
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="flex flex-col items-center justify-center">
          {status === 'loading' && (
            <div className="text-blue-500 animate-spin mb-4">
              <FiLoader size={64} />
            </div>
          )}
          
          {status === 'success' && (
            <div className="text-green-500 mb-4">
              <FiCheckCircle size={64} />
            </div>
          )}
          
          {status === 'error' && (
            <div className="text-red-500 mb-4">
              <FiAlertTriangle size={64} />
            </div>
          )}
          
          <h1 className={`text-2xl font-bold mb-2 text-center ${
            status === 'loading' ? 'text-blue-700' : 
            status === 'success' ? 'text-green-700' : 
            'text-red-700'
          }`}>
            {status === 'loading' ? 'Processando' : 
             status === 'success' ? 'Pagamento Concluído' : 
             'Falha no Pagamento'}
          </h1>
          
          <p className="text-gray-700 text-center mb-6">{message}</p>
          
          {status === 'error' && (
            <div className="flex flex-col space-y-4 w-full">
              <button
                onClick={() => navigate('/plans')}
                className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition duration-200"
              >
                Tentar Novamente
              </button>
              
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition duration-200"
              >
                Voltar ao Dashboard
              </button>
            </div>
          )}
          
          {status === 'loading' && (
            <p className="text-sm text-gray-500 mt-4">
              Isso pode levar alguns instantes...
            </p>
          )}
        </div>
      </div>
      
      <Toaster position="top-center" />
    </div>
  );
};

export default CheckoutRedirect; 