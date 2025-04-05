import { useEffect, useRef, useState } from 'react';
import { LayoutEffectSolution } from '../fix-layout-effect';

// Importar React de forma direta para ter acesso direto
import * as React from 'react';

/**
 * Hook para trabalhar com segurança com componentes de terceiros
 * que possam estar usando useLayoutEffect de forma não segura
 * 
 * Este hook ajuda a garantir que o componente seja renderizado
 * apenas no ambiente cliente, após o React ser totalmente inicializado.
 * 
 * @param options Opções de configuração
 * @returns Objeto com flags de segurança
 */
const useSafeThirdPartyComponent = (options: {
  delay?: number;
  skipClientCheck?: boolean;
  debug?: boolean;
} = {}) => {
  const { delay = 50, skipClientCheck = false, debug = false } = options;
  
  // Referência para rastrear se o componente está seguro para renderizar
  const isSafeToRender = useRef(false);
  const [isClient, setIsClient] = useState(false);
  const [isReactReady, setIsReactReady] = useState(false);
  const [reactErrors, setReactErrors] = useState<string[]>([]);
  
  // Garantir que React.useLayoutEffect exista - patch imediato
  useEffect(() => {
    if (typeof window !== 'undefined' && window.React) {
      // Tentar corrigir o React global
      LayoutEffectSolution.patchReactModule(window.React);
    }
    
    // Tentar corrigir o React importado
    if (React && !React.useLayoutEffect && React.useEffect) {
      // @ts-ignore - isso é um patch de segurança
      React.useLayoutEffect = React.useEffect;
      debug && console.log('[useSafeThirdPartyComponent] React.useLayoutEffect patch aplicado ao módulo importado');
    }
  }, [debug]);
  
  // Verificar se estamos no cliente
  useEffect(() => {
    if (skipClientCheck) {
      setIsClient(true);
      return;
    }
    
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, [skipClientCheck]);
  
  // Verificar se o React está completamente inicializado
  useEffect(() => {
    if (!isClient) return;
    
    // Contador de tentativas
    let attempts = 0;
    const maxAttempts = 5;
    
    // Uma abordagem mais robusta para verificar se o React está pronto
    const checkReactReady = () => {
      try {
        attempts++;
        
        // Verificar se podemos usar React e seus hooks
        const isUseEffectAvailable = typeof React.useEffect === 'function';
        const isUseStateAvailable = typeof React.useState === 'function';
        
        // Verificar o React global também
        const isGlobalReactAvailable = typeof window.React !== 'undefined';
        const isGlobalUseLayoutEffectAvailable = 
          isGlobalReactAvailable && 
          typeof window.React.useLayoutEffect === 'function';
        
        // Se houve patching, registrar isso
        if (isGlobalReactAvailable && !isGlobalUseLayoutEffectAvailable) {
          // Tentar patch automaticamente
          LayoutEffectSolution.patchReactModule(window.React);
          setReactErrors(prev => [...prev, 'React global sem useLayoutEffect - patch aplicado']);
        }
        
        // Se os hooks básicos estão disponíveis, provavelmente é seguro renderizar
        if (isUseEffectAvailable && isUseStateAvailable) {
          setIsReactReady(true);
          isSafeToRender.current = true;
          debug && console.log('[useSafeThirdPartyComponent] React considerado pronto após verificação');
          return;
        }
        
        // Se atingimos o número máximo de tentativas, considerar pronto mesmo assim
        if (attempts >= maxAttempts) {
          debug && console.log('[useSafeThirdPartyComponent] Máximo de tentativas atingido, considerando React pronto');
          setIsReactReady(true);
          isSafeToRender.current = true;
          return;
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        setReactErrors(prev => [...prev, errorMsg]);
        debug && console.debug('[useSafeThirdPartyComponent] Erro ao verificar React:', e);
      }
      
      // Se chegamos aqui, o React ainda não está pronto, verificar novamente após um breve delay
      setTimeout(checkReactReady, delay);
    };
    
    checkReactReady();
  }, [isClient, delay, debug]);
  
  // Função utilitária para envolver componentes possivelmente inseguros
  const renderSafely = (component: React.ReactNode, fallback: React.ReactNode = null) => {
    if (isSafeToRender.current && isClient && isReactReady) {
      return component;
    }
    return fallback;
  };
  
  return {
    isClient,
    isReactReady,
    isSafeToRender: isSafeToRender.current,
    reactErrors,
    renderSafely
  };
};

export default useSafeThirdPartyComponent; 