import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Componente que exibe um banner de status da API
 * Verifica a disponibilidade da API e exibe uma mensagem amigável se estiver offline
 */
export default function ApiStatusBanner() {
  const [apiStatus, setApiStatus] = useState('checking'); // 'checking', 'online', 'offline'
  const [showBanner, setShowBanner] = useState(false);
  const [mode, setMode] = useState('normal'); // 'normal', 'simulation', 'fallback'

  useEffect(() => {
    checkApiStatus();
  }, []);

  // Verificar status da API
  const checkApiStatus = async () => {
    try {
      // Tentar vários endpoints básicos para ver se a API está funcionando
      const endpoints = [
        '/api/health',
        '/api/status',
        '/api',
        'https://backendapi-production-36b5.up.railway.app/api/health'
      ];

      let isAnyEndpointWorking = false;
      let isFallbackWorking = false;

      // Primeiro verificar endpoints principais
      for (const endpoint of endpoints) {
        try {
          await axios.get(endpoint, { timeout: 3000 });
          isAnyEndpointWorking = true;
          break; // Se algum endpoint responder, a API está online
        } catch (err) {
          console.warn(`Endpoint ${endpoint} falhou: ${err.message}`);
          // Continuar tentando outros endpoints
        }
      }

      // Se nenhum endpoint principal funcionar, verificar fallback
      if (!isAnyEndpointWorking) {
        try {
          const fallbackResponse = await axios.get('/api/subscription/fallback?check=true', { timeout: 2000 });
          if (fallbackResponse.data && fallbackResponse.data.status === 'ok') {
            isFallbackWorking = true;
          }
        } catch (fallbackErr) {
          console.warn('Endpoint de fallback também falhou:', fallbackErr.message);
        }
      }

      // Definir status com base nos resultados
      if (isAnyEndpointWorking) {
        setApiStatus('online');
        setMode('normal');
        setShowBanner(false);
      } else if (isFallbackWorking) {
        setApiStatus('offline');
        setMode('fallback');
        setShowBanner(true);
      } else {
        setApiStatus('offline');
        setMode('simulation');
        setShowBanner(true);
      }
    } catch (err) {
      console.error('Erro ao verificar status da API:', err);
      setApiStatus('offline');
      setMode('simulation');
      setShowBanner(true);
    }
  };

  // Se não devemos mostrar o banner, retornar null
  if (!showBanner) {
    return null;
  }

  // Determinar estilo do banner com base no modo
  let bannerStyles = {
    simulation: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-400',
      icon: 'text-yellow-400',
      text: 'text-yellow-700'
    },
    fallback: {
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      icon: 'text-blue-400',
      text: 'text-blue-700'
    }
  };

  const styles = bannerStyles[mode] || bannerStyles.simulation;

  return (
    <div className={`${styles.bg} border-l-4 ${styles.border} p-4 mb-6`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {mode === 'simulation' ? (
            <svg className={`h-5 w-5 ${styles.icon}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className={`h-5 w-5 ${styles.icon}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        <div className="ml-3">
          <p className={`text-sm ${styles.text} font-medium`}>
            {mode === 'simulation' ? (
              'Modo de Simulação Ativo - Servidores Indisponíveis'
            ) : (
              'Modo Fallback Ativo - Conectividade Parcial'
            )}
          </p>
          <p className={`text-sm ${styles.text} mt-1`}>
            {mode === 'simulation' ? (
              'Estamos com problemas de conexão com nossos servidores. Os planos estão sendo exibidos localmente e os pagamentos serão simulados.'
            ) : (
              'A conexão com nossos servidores está parcialmente disponível. Algumas funcionalidades estão usando dados locais de backup.'
            )}
          </p>
          <div className="mt-2 flex space-x-3">
            <button 
              className={`text-xs ${styles.text} font-medium underline`}
              onClick={() => {
                checkApiStatus();
              }}
            >
              Verificar novamente
            </button>
            <span className={`text-xs ${styles.text}`}>|</span>
            <button 
              className={`text-xs ${styles.text} font-medium underline`}
              onClick={() => {
                window.location.reload();
              }}
            >
              Recarregar página
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 