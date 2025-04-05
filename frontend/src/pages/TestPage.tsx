import React, { useEffect, useState } from 'react';
import { fetchRoulettesWithNumbers } from '../integrations/api/rouletteApi';
import SafeLayoutExample from '../components/SafeLayoutExample';
import { SafeThirdPartyWrapper } from '../components';
import styles from '../styles/TestPage.module.css';

interface RouletteData {
  id: string;
  nome: string;
  _id?: string;
  name?: string;
  numero?: any[];
  canonicalId?: string;
  estado_estrategia?: string;
  vitorias?: number;
  derrotas?: number;
}

interface MockThirdPartyProps {
  text?: string;
}

/**
 * Este componente simula um componente de terceiros que usa useLayoutEffect
 * Na vida real, esse componente estaria em uma biblioteca externa
 */
const MockThirdPartyComponent: React.FC<MockThirdPartyProps> = ({ text = "Componente de terceiros carregado!" }) => {
  // Simulando um componente que usa useLayoutEffect
  return (
    <div className={styles.mockComponent}>
      <h3>Componente de Biblioteca de Terceiros</h3>
      <p>{text}</p>
      <p><small>Este componente simula um que usaria useLayoutEffect internamente</small></p>
    </div>
  );
};

const TestPage: React.FC = () => {
  const [roulettes, setRoulettes] = useState<RouletteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLayoutTest, setShowLayoutTest] = useState(false);
  const [showThirdPartyTest, setShowThirdPartyTest] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscar as roletas com números incluídos
        console.log('Buscando dados das roletas com números incluídos...');
        const data = await fetchRoulettesWithNumbers(20); // Buscar 20 números por roleta
        
        if (Array.isArray(data)) {
          setRoulettes(data);
          console.log('Dados recebidos com sucesso:', data);
        } else {
          setError('Formato de resposta inválido');
        }
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setError('Falha ao carregar dados. Verifique o console para mais detalhes.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  if (loading) {
    return <div>Carregando dados...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  return (
    <div className={styles.container}>
      <h1>Página de Teste</h1>
      
      {/* Demonstração da solução para useLayoutEffect */}
      <div className={styles.demoSection}>
        <h2>Demonstração de Solução para useLayoutEffect</h2>
        <p>Esta seção demonstra o uso do componente <code>SafeLayoutExample</code> para resolver o problema do useLayoutEffect em componentes de terceiros.</p>
        
        <div className={styles.demoControls}>
          <button 
            onClick={() => setShowLayoutTest(!showLayoutTest)}
            className={styles.demoButton}
          >
            {showLayoutTest ? 'Esconder' : 'Mostrar'} Demonstração
          </button>
        </div>

        {showLayoutTest && (
          <div className={styles.demoContainer}>
            <h3>Exemplo de Wrapper para Componentes de Terceiros</h3>
            <p>Este wrapper garante que componentes de terceiros que usam useLayoutEffect sejam renderizados apenas quando for seguro:</p>
            
            <SafeLayoutExample />
          </div>
        )}
      </div>
      
      <h2 className="text-xl font-semibold mt-6 mb-2">Roletas com Números Incluídos:</h2>
      
      {roulettes.map(roleta => (
        <div key={roleta.id} className="mb-6 border p-4 rounded">
          <h3 className="font-semibold">{roleta.nome || roleta.name}</h3>
          <div className="mb-2">
            <p>ID: {roleta.id}</p>
            <p>ID Canônico: {roleta.canonicalId}</p>
          </div>
          
          <h4 className="text-lg font-medium mb-2">Informações da Roleta:</h4>
          <pre className="bg-gray-100 p-4 rounded overflow-auto mb-4">
            {JSON.stringify({
              id: roleta.id,
              nome: roleta.nome || roleta.name,
              canonicalId: roleta.canonicalId,
              estado_estrategia: roleta.estado_estrategia,
              vitorias: roleta.vitorias,
              derrotas: roleta.derrotas
            }, null, 2)}
          </pre>
          
          <h4 className="text-lg font-medium mb-2">Números da Roleta:</h4>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(roleta.numero || [], null, 2)}
          </pre>
        </div>
      ))}

      <div className={styles.demoSection}>
        <h2>Demonstração da Solução para useLayoutEffect</h2>
        <p>Esta seção demonstra o uso do componente <code>SafeThirdPartyWrapper</code> para resolver o problema do useLayoutEffect em componentes de terceiros.</p>
        
        <div className={styles.demoControls}>
          <button 
            onClick={() => setShowThirdPartyTest(!showThirdPartyTest)}
            className={styles.demoButton}
          >
            {showThirdPartyTest ? 'Esconder' : 'Mostrar'} Demonstração
          </button>
        </div>

        {showThirdPartyTest && (
          <div className={styles.demoContainer}>
            <h3>Exemplo de Wrapper para Componentes de Terceiros</h3>
            <p>Este wrapper garante que componentes de terceiros que usam useLayoutEffect sejam renderizados apenas quando for seguro:</p>
            
            <SafeThirdPartyWrapper 
              loadingMessage="Carregando componente de terceiros de forma segura..."
              delay={1500} // Delay maior para demonstração
            >
              <MockThirdPartyComponent />
            </SafeThirdPartyWrapper>
          </div>
        )}
      </div>
    </div>
  );
};

export default TestPage; 