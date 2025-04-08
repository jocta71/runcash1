import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ErrorPageProps {
  error?: Error;
  resetErrorBoundary?: () => void;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ error, resetErrorBoundary }) => {
  const navigate = useNavigate();
  
  const handleReset = () => {
    if (resetErrorBoundary) {
      resetErrorBoundary();
    } else {
      navigate('/', { replace: true });
    }
  };
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '800px',
        width: '100%',
        padding: '32px',
        borderRadius: '8px',
        backgroundColor: '#FEF2F2',
        border: '1px solid #FCA5A5',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h1 style={{ fontSize: '24px', color: '#DC2626' }}>
            Algo deu errado!
          </h1>
          
          <p style={{ fontSize: '18px' }}>
            Ocorreu um erro inesperado na aplicação. Isto pode ser um problema temporário.
          </p>
          
          {error && (
            <div style={{ 
              padding: '16px', 
              borderRadius: '6px', 
              backgroundColor: 'rgba(0, 0, 0, 0.05)', 
              border: '1px solid rgba(0, 0, 0, 0.1)',
              overflowX: 'auto'
            }}>
              <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Detalhes do erro:</h3>
              <p style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                {error.message || 'Erro desconhecido'}
              </p>
              
              {error.stack && (
                <pre style={{ 
                  marginTop: '16px', 
                  padding: '8px', 
                  display: 'block', 
                  whiteSpace: 'pre', 
                  fontSize: '12px',
                  overflowX: 'auto',
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  borderRadius: '4px'
                }}>
                  {error.stack}
                </pre>
              )}
            </div>
          )}
          
          <div style={{ 
            paddingTop: '16px', 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '16px' 
          }}>
            <button 
              onClick={handleReset}
              style={{
                backgroundColor: '#DC2626',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Tentar Novamente
            </button>
            
            <button 
              onClick={() => navigate('/')}
              style={{
                backgroundColor: 'transparent',
                color: '#111',
                padding: '8px 16px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                cursor: 'pointer'
              }}
            >
              Voltar para Início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage; 