import { useEffect } from 'react';

/**
 * Componente para garantir que o site mantenha uma escala constante em telas menores que 2048px
 * 
 * Este componente não renderiza nada na interface, apenas ajusta o viewport
 * quando a largura da tela é menor que 2048px
 */
const ViewportScaler = () => {
  useEffect(() => {
    const ajustarEscala = () => {
      const larguraTela = window.innerWidth;
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      
      if (larguraTela < 2048) {
        // Calcular escala proporcional baseada na largura da tela
        const escala = larguraTela / 2048;
        
        // Atualizar o viewport para manter tudo com a mesma escala visual
        viewportMeta?.setAttribute('content', `width=2048, initial-scale=${escala}`);
        
        // Adicionar classe auxiliar ao body
        document.body.classList.add('viewport-scaled');
      } else {
        // Em telas grandes, usar responsividade normal
        viewportMeta?.setAttribute('content', 'width=device-width, initial-scale=1.0');
        
        // Remover classe auxiliar
        document.body.classList.remove('viewport-scaled');
      }
    };
    
    // Ajustar escala inicialmente
    ajustarEscala();
    
    // Adicionar listener para redimensionamento
    window.addEventListener('resize', ajustarEscala);
    
    // Limpar listener quando componente for desmontado
    return () => {
      window.removeEventListener('resize', ajustarEscala);
    };
  }, []);
  
  // Este componente não renderiza nada visualmente
  return null;
};

export default ViewportScaler; 