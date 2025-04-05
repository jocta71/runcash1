import { useState, useRef } from 'react';
import { useSafeLayoutEffect } from '../hooks';

/**
 * Componente de exemplo que demonstra o uso seguro de useLayoutEffect
 * Usa nosso hook personalizado para evitar erros em diferentes ambientes
 */
const SafeLayoutExample: React.FC = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  
  // Usando nosso hook seguro em vez de useLayoutEffect diretamente
  useSafeLayoutEffect(() => {
    // Função que será executada após o layout, mas apenas no cliente
    // e somente quando o componente estiver montado
    console.log('SafeLayoutExample: Layout effect executado com segurança');
    
    if (elementRef.current) {
      // Medindo o tamanho do elemento após o layout
      const { width, height } = elementRef.current.getBoundingClientRect();
      setSize({ width, height });
    }
    
    // Cleanup function
    return () => {
      console.log('SafeLayoutExample: Cleanup do layout effect executado');
    };
  }, []);
  
  return (
    <div className="safe-layout-example">
      <h3>Exemplo de useLayoutEffect Seguro</h3>
      <div 
        ref={elementRef} 
        className="measured-element"
        style={{ 
          padding: '20px', 
          border: '1px solid #ccc',
          margin: '10px 0'
        }}
      >
        Este elemento é medido com useSafeLayoutEffect
      </div>
      
      <p>
        Dimensões: {size.width.toFixed(2)}px × {size.height.toFixed(2)}px
      </p>
      
      <div className="explanation">
        <h4>Como funciona:</h4>
        <ul>
          <li>Usa <code>useSafeLayoutEffect</code> em vez de <code>useLayoutEffect</code></li>
          <li>Verifica se estamos no ambiente cliente</li>
          <li>Certifica-se de que o componente está montado</li>
          <li>Captura e trata erros que possam ocorrer</li>
        </ul>
      </div>
    </div>
  );
};

export default SafeLayoutExample; 