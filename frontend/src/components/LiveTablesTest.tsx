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
 */
const LiveTablesTest: React.FC = () => {
  // Estado para armazenar os dados das roletas
  const [tableData, setTableData] = useState<LiveTablesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Função para buscar dados
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await getLiveTables();
      setTableData(data);
      console.log('Dados recebidos com sucesso:', data);
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
      <h2>Teste de API LiveFeed</h2>
      <p>Este componente testa a comunicação com o endpoint LiveFeed que só aceita método POST.</p>
      
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
      
      {tableData && (
        <div>
          <div style={{ 
            backgroundColor: '#e8f5e9', 
            padding: '15px', 
            borderRadius: '5px', 
            marginBottom: '20px' 
          }}>
            <p><strong>Total de Roletas:</strong> {tableData.TotalTables}</p>
            <p><strong>Atualizado em:</strong> {new Date(tableData.UpdateTime).toLocaleString()}</p>
            <p><strong>Request ID:</strong> {tableData.RequestId}</p>
            <p><strong>IP do Cliente:</strong> {tableData.ClientIP}</p>
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
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTablesTest; 