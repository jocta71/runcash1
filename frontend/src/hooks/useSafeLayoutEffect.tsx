import { useEffect, useLayoutEffect, useRef } from 'react';

// Verifica se estamos em ambiente cliente ou servidor
const isClient = typeof window !== 'undefined';

/**
 * Hook seguro para substituir useLayoutEffect
 * 
 * Este hook usa useLayoutEffect no cliente e cai para useEffect em SSR,
 * também verifica se o componente está montado antes de executar o efeito
 * 
 * @param callback Função a ser executada após layout
 * @param deps Array de dependências
 */
const useSafeLayoutEffect = (callback: () => void | (() => void), deps?: React.DependencyList) => {
  // Referência para rastrear se o componente está montado
  const isMounted = useRef(false);
  
  // Escolhe entre useLayoutEffect e useEffect com base no ambiente
  const useLayoutEffectSafe = isClient ? useLayoutEffect : useEffect;
  
  // Efeito para rastrear montagem/desmontagem
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Usa o efeito apropriado e verifica se está montado
  useLayoutEffectSafe(() => {
    // Não executa o efeito se não estiver montado
    if (!isMounted.current) return;
    
    try {
      // Executa o callback e captura a função de limpeza
      const cleanup = callback();
      return cleanup;
    } catch (error) {
      console.error('[useSafeLayoutEffect] Erro ao executar callback:', error);
    }
  }, deps);
};

export default useSafeLayoutEffect; 