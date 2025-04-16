import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Spinner, Container, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';

/**
 * Página de callback para autenticação
 * Esta página processa o token JWT após login com serviços externos
 */
const AuthCallback: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    // Extrair token da URL
    const query = new URLSearchParams(location.search);
    const token = query.get('token');

    if (token) {
      console.log('Token recebido no callback');
      
      // Armazenar token e redirecionar
      login(token)
        .then(() => {
          console.log('Login realizado com sucesso');
          navigate('/dashboard');
        })
        .catch(err => {
          console.error('Erro ao processar login:', err);
          setError('Falha ao autenticar usuário. Por favor, tente novamente.');
        });
    } else {
      setError('Nenhum token de autenticação encontrado');
    }
  }, [location, login, navigate]);

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
      <div className="text-center">
        {error ? (
          <Alert variant="danger">
            <h4>Erro na autenticação</h4>
            <p>{error}</p>
            <button 
              className="btn btn-primary mt-3" 
              onClick={() => navigate('/login')}
            >
              Voltar para o login
            </button>
          </Alert>
        ) : (
          <>
            <Spinner animation="border" role="status" />
            <h3 className="mt-3">Autenticando...</h3>
            <p>Você será redirecionado em instantes</p>
          </>
        )}
      </div>
    </Container>
  );
};

export default AuthCallback; 