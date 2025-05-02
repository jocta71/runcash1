import React, { useState, useEffect } from 'react';
import { getLiveTables } from '../config/endpoints';

/**
 * Interface para os dados de uma roleta retornada pela API
 */
interface TableData {
  TableId: string;
  TableName: string;
  LastNumber: number;
  LastColor: string;
  UpdateTime: string;
  TotalHistory: number;
  IsActive: boolean;
  DealerName: string;
  Status: string;
}

/**
 * Interface para a resposta completa da API
 */
interface LiveTablesResponse {
  Tables: TableData[];
  TotalTables: number;
  UpdateTime: string;
  ServerTime: number;
  RequestId: string;
  ClientIP: string;
}

/**
 * Componente de teste para o endpoint LiveFeed
 * Usando configurações idênticas a cgp.safe-iplay.com/cgpapi/liveFeed/GetLiveTables
 */
const LiveTablesTest: React.FC = () => {
  // Estado para armazenar os dados das roletas
  const [tableData, setTableData] = useState<LiveTablesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string> | null>(null);
  
  // Configuração para capturar cabeçalhos de resposta
  const captureResponseHeaders = (headers: Headers) => {
    const headerObj: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    setResponseHeaders(headerObj);
    return headerObj;
  };
  
  // Função para buscar dados
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setResponseHeaders(null);
    
    try {
      // Capturar o tempo de início para calcular latência
      const startTime = Date.now();
      
      // Usar uma implementação personalizada para capturar os cabeçalhos
      const url = `${window.location.origin}/api/liveFeed/GetLiveTables`;
      
      // Obter token de autenticação do localStorage
      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }
      
      // Criar form data
      const formData = new URLSearchParams();
      formData.append('ClientTime', Date.now().toString());
      formData.append('ClientId', 'runcashh-web');
      formData.append('SessionId', localStorage.getItem('sessionId') || 'new-session');
      formData.append('RequestId', Math.random().toString(36).substring(2, 15));
      formData.append('locale', 'pt-BR');
      
      // Fazer a requisição diretamente para capturar os cabeçalhos
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`,
          'accept': '*/*',
          'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7',
          'origin': window.location.origin,
          'referer': window.location.origin,
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        },
        body: formData
      });
      
      // Capturar os cabeçalhos da resposta
      captureResponseHeaders(response.headers);
      
      // Verificar se a resposta foi bem-sucedida
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao obter roletas em tempo real');
      }
      
      // Armazenar session ID se existir no cookie de resposta
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        console.log('Cookies recebidos:', cookies);
      }
      
      // Parsear a resposta JSON
      const data = await response.json();
      
      // Calcular latência
      const latency = Date.now() - startTime;
      
      // Atualizar dados
      setTableData(data);
      console.log(`Dados recebidos com sucesso em ${latency}ms:`, data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      console.error('Erro ao buscar dados:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Estilo para o cartão de roleta
  const tableCardStyle: React.CSSProperties = {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '15px',
    margin: '10px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    backgroundColor: 'white',
    maxWidth: '300px'
  };
  
  // Estilo para o número da roleta baseado na cor
  const getNumberStyle = (color: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-block',
      width: '30px',
      height: '30px',
      borderRadius: '50%',
      textAlign: 'center',
      lineHeight: '30px',
      color: 'white',
      fontWeight: 'bold'
    };
    
    if (color === 'vermelho' || color === 'red') {
      return { ...baseStyle, backgroundColor: '#e53935' };
    } else if (color === 'preto' || color === 'black') {
      return { ...baseStyle, backgroundColor: '#212121' };
    } else {
      return { ...baseStyle, backgroundColor: '#4CAF50' };
    }
  };
  
  return (
    <div style={{ padding: '20px' }}>
      <h2>Teste de API LiveFeed (cgp.safe-iplay.com)</h2>
      <p>Este componente testa a comunicação com o endpoint LiveFeed com as mesmas configurações que o site de origem.</p>
      <p>Método: <strong>POST</strong> | Content-Type: <strong>application/x-www-form-urlencoded</strong></p>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={fetchData} 
          disabled={loading} 
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#4285F4', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: loading ? 'not-allowed' : 'pointer' 
          }}
        >
          {loading ? 'Carregando...' : 'Buscar Dados'}
        </button>
      </div>
      
      {/* Informações sobre cookies armazenados */}
      <div style={{ 
        backgroundColor: '#e8f5e9', 
        padding: '15px', 
        borderRadius: '5px', 
        marginBottom: '20px' 
      }}>
        <h3>Cookies Armazenados</h3>
        <p><strong>Session ID:</strong> {localStorage.getItem('sessionId') || 'Nenhum'}</p>
        <p><strong>Visitor ID:</strong> {localStorage.getItem('visitorId') || 'Nenhum'}</p>
      </div>
      
      {/* Exibição de erros */}
      {error && (
        <div style={{ 
          backgroundColor: '#ffebee', 
          padding: '15px', 
          borderRadius: '5px', 
          borderLeft: '5px solid #f44336',
          marginBottom: '20px'
        }}>
          <strong>Erro:</strong> {error}
        </div>
      )}
      
      {/* Exibição dos cabeçalhos de resposta */}
      {responseHeaders && (
        <div style={{ 
          backgroundColor: '#f3e5f5', 
          padding: '15px', 
          borderRadius: '5px', 
          marginBottom: '20px' 
        }}>
          <h3>Cabeçalhos da Resposta</h3>
          <pre style={{ overflowX: 'auto', fontSize: '12px' }}>
            {JSON.stringify(responseHeaders, null, 2)}
          </pre>
        </div>
      )}
      
      {/* Exibição dos dados de roleta */}
      {tableData && (
        <div>
          <div style={{ 
            backgroundColor: '#e3f2fd', 
            padding: '15px', 
            borderRadius: '5px', 
            marginBottom: '20px' 
          }}>
            <h3>Dados da Resposta</h3>
            <p><strong>Total de Roletas:</strong> {tableData.TotalTables}</p>
            <p><strong>Atualizado em:</strong> {new Date(tableData.UpdateTime).toLocaleString()}</p>
            <p><strong>Request ID:</strong> {tableData.RequestId}</p>
            <p><strong>IP do Cliente:</strong> {tableData.ClientIP}</p>
            <p><strong>Horário do Servidor:</strong> {new Date(tableData.ServerTime).toLocaleString()}</p>
          </div>
          
          <h3>Roletas Ativas ({tableData.Tables.length})</h3>
          
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {tableData.Tables.map((table) => (
              <div key={table.TableId} style={tableCardStyle}>
                <h4>{table.TableName}</h4>
                <p><strong>Dealer:</strong> {table.DealerName}</p>
                <p><strong>Último número:</strong> <span style={getNumberStyle(table.LastColor)}>{table.LastNumber}</span></p>
                <p><strong>Status:</strong> <span style={{ 
                  color: table.Status === 'InPlay' ? 'green' : 'orange'
                }}>{table.Status}</span></p>
                <p><strong>Total de jogadas:</strong> {table.TotalHistory}</p>
                <p><strong>Atualizado:</strong> {new Date(table.UpdateTime).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTablesTest; 