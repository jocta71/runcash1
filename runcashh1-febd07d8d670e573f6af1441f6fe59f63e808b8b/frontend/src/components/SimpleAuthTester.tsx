import React, { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../config/env';

/**
 * Interface para dados do usuário
 */
interface User {
  id: string;
  username: string;
  roles: string[];
}

/**
 * Interface para resposta de login
 */
interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
  error?: string;
}

/**
 * Componente para testar a autenticação JWT simplificada
 */
const SimpleAuthTester: React.FC = () => {
  // Estados para armazenar dados
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [protectedData, setProtectedData] = useState<string | null>(null);
  
  // Carregar usuário do localStorage ao iniciar
  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Erro ao parsear dados do usuário:', e);
      }
    }
  }, []);
  
  /**
   * Função para fazer login
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    const apiUrl = `${getApiBaseUrl()}/simple-auth/login`;
    console.log(`Tentando login em: ${apiUrl}`);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      console.log(`Resposta do servidor - Status: ${response.status}`);
      const data: AuthResponse = await response.json();
      console.log('Dados da resposta:', data);
      
      if (response.ok && data.success && data.token) {
        // Armazenar token e dados do usuário
        localStorage.setItem('auth_token', data.token);
        if (data.user) {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
          setUser(data.user);
        }
        
        setToken(data.token);
        setMessage(data.message || 'Login realizado com sucesso!');
        
        // Limpar campos do formulário
        setUsername('');
        setPassword('');
      } else {
        setError(data.message || 'Erro ao fazer login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Função para fazer logout
   */
  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
    setProtectedData(null);
    setMessage('Logout realizado com sucesso!');
  };
  
  /**
   * Função para acessar rota protegida
   */
  const accessProtectedRoute = async () => {
    if (!token) {
      setError('Você precisa estar autenticado para acessar esta rota');
      return;
    }
    
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const response = await fetch(`${getApiBaseUrl()}/protected`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setProtectedData(JSON.stringify(data, null, 2));
        setMessage('Rota protegida acessada com sucesso!');
      } else {
        setError(data.message || 'Erro ao acessar rota protegida');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Função para acessar rota de admin
   */
  const accessAdminRoute = async () => {
    if (!token) {
      setError('Você precisa estar autenticado para acessar esta rota');
      return;
    }
    
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const response = await fetch(`${getApiBaseUrl()}/admin`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setProtectedData(JSON.stringify(data, null, 2));
        setMessage('Rota de admin acessada com sucesso!');
      } else {
        setError(data.message || 'Erro ao acessar rota de admin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Função para verificar token
   */
  const verifyToken = async () => {
    if (!token) {
      setError('Nenhum token para verificar');
      return;
    }
    
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const response = await fetch(`${getApiBaseUrl()}/simple-auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setMessage('Token é válido!');
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        }
      } else {
        setError(data.message || 'Token inválido');
        // Se token for inválido, fazer logout
        handleLogout();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Função para acessar a rota de roletas com JWT
   */
  const accessJwtRoulettes = async () => {
    if (!token) {
      setError('Você precisa estar autenticado para acessar esta rota');
      return;
    }
    
    setLoading(true);
    setError(null);
    setMessage(null);
    
    const apiUrl = `${getApiBaseUrl()}/jwt-roulettes`;
    console.log(`Tentando acessar roletas JWT em: ${apiUrl}`);
    console.log(`Token de autorização: ${token.substring(0, 20)}...`);
    
    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log(`Resposta do servidor - Status: ${response.status}`);
      const data = await response.json();
      console.log('Dados da resposta:', data);
      
      if (response.ok) {
        setProtectedData(JSON.stringify(data, null, 2));
        setMessage(`Rota de roletas acessada com sucesso! Encontradas ${data.data?.length || 0} roletas.`);
      } else {
        setError(data.message || 'Erro ao acessar rota de roletas');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Função para verificar o status da API
   */
  const checkApiStatus = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    
    const apiUrl = `${getApiBaseUrl()}/health`;
    console.log(`Verificando status da API em: ${apiUrl}`);
    
    try {
      const response = await fetch(apiUrl);
      console.log(`Resposta do servidor - Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dados da resposta:', data);
        setProtectedData(JSON.stringify(data, null, 2));
        setMessage('API está online e funcionando corretamente!');
      } else {
        setError(`API não respondeu corretamente: HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('Erro ao verificar status da API:', err);
      setError(err instanceof Error ? err.message : 'Não foi possível conectar à API');
    } finally {
      setLoading(false);
    }
  };
  
  // Estilos para o componente
  const containerStyle: React.CSSProperties = {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  };
  
  const cardStyle: React.CSSProperties = {
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    marginBottom: '20px',
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };
  
  const buttonStyle: React.CSSProperties = {
    padding: '10px 15px',
    backgroundColor: '#4285F4',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: loading ? 'not-allowed' : 'pointer',
    marginRight: '10px',
    marginBottom: '10px'
  };
  
  const inputStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    width: '100%',
    marginBottom: '10px'
  };
  
  const errorStyle: React.CSSProperties = {
    backgroundColor: '#ffebee',
    padding: '10px',
    borderRadius: '4px',
    color: '#c62828',
    marginBottom: '10px'
  };
  
  const successStyle: React.CSSProperties = {
    backgroundColor: '#e8f5e9',
    padding: '10px',
    borderRadius: '4px',
    color: '#2e7d32',
    marginBottom: '10px'
  };
  
  return (
    <div style={containerStyle}>
      <h1>Teste de Autenticação JWT</h1>
      
      {/* Exibir mensagens */}
      {error && <div style={errorStyle}>{error}</div>}
      {message && <div style={successStyle}>{message}</div>}
      
      {/* Diagnóstico */}
      <div style={cardStyle}>
        <h2>Diagnóstico</h2>
        <div>
          <p><strong>URL Base da API:</strong> {getApiBaseUrl()}</p>
          <p><strong>Ambiente:</strong> {import.meta.env.MODE || 'development'}</p>
          <button 
            style={buttonStyle} 
            onClick={checkApiStatus}
            disabled={loading}
          >
            Verificar Status da API
          </button>
        </div>
      </div>
      
      {/* Formulário de login ou informações do usuário */}
      <div style={cardStyle}>
        {token ? (
          <div>
            <h2>Usuário Autenticado</h2>
            {user && (
              <div>
                <p><strong>ID:</strong> {user.id}</p>
                <p><strong>Username:</strong> {user.username}</p>
                <p><strong>Roles:</strong> {user.roles.join(', ')}</p>
                <p><strong>Token:</strong> {token.substring(0, 20)}...</p>
              </div>
            )}
            <button 
              style={buttonStyle} 
              onClick={handleLogout}
              disabled={loading}
            >
              Logout
            </button>
            <button 
              style={buttonStyle} 
              onClick={verifyToken}
              disabled={loading}
            >
              Verificar Token
            </button>
          </div>
        ) : (
          <div>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
              <div>
                <label>Username</label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required
                  style={inputStyle}
                  placeholder="Dica: admin ou user"
                />
              </div>
              <div>
                <label>Password</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required
                  style={inputStyle}
                  placeholder="Dica: senha123 ou senha456"
                />
              </div>
              <button 
                type="submit" 
                style={buttonStyle}
                disabled={loading}
              >
                {loading ? 'Carregando...' : 'Login'}
              </button>
            </form>
          </div>
        )}
      </div>
      
      {/* Testes de rotas protegidas */}
      {token && (
        <div style={cardStyle}>
          <h2>Testes de Rotas Protegidas</h2>
          <div>
            <button 
              style={buttonStyle} 
              onClick={accessProtectedRoute}
              disabled={loading}
            >
              Acessar Rota Protegida
            </button>
            <button 
              style={buttonStyle} 
              onClick={accessAdminRoute}
              disabled={loading}
            >
              Acessar Rota de Admin
            </button>
            <button 
              style={buttonStyle} 
              onClick={accessJwtRoulettes}
              disabled={loading}
            >
              Listar Roletas (JWT)
            </button>
          </div>
          
          {protectedData && (
            <div style={{ marginTop: '15px' }}>
              <h3>Resposta do Servidor:</h3>
              <pre style={{ 
                backgroundColor: '#f5f5f5',
                padding: '10px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '300px'
              }}>
                {protectedData}
              </pre>
            </div>
          )}
        </div>
      )}
      
      {/* Instruções */}
      <div style={cardStyle}>
        <h2>Instruções</h2>
        <ul>
          <li>Use <code>admin/senha123</code> para login com role de admin</li>
          <li>Use <code>user/senha456</code> para login com role básico</li>
          <li>Clique em "Verificar Token" para checar se seu token ainda é válido</li>
          <li>Usuários com role "admin" podem acessar a rota de admin</li>
          <li>Qualquer usuário autenticado pode acessar a rota protegida básica</li>
        </ul>
      </div>
    </div>
  );
};

export default SimpleAuthTester; 