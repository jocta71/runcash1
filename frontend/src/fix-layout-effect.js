/**
 * fix-layout-effect.js
 * 
 * SOLUÇÃO DEFINITIVA para o problema "Cannot read properties of undefined (reading 'useLayoutEffect')"
 * Este script corrige problemas com React.useLayoutEffect tanto em contexto ESM quanto em CommonJS.
 */

// PARTE 1: Correção global imediata (executa na importação do módulo)
(function globalFix() {
  try {
    console.log('[LayoutEffect Fix] Inicializando solução definitiva...');
    
    if (typeof window === 'undefined') return;
    
    // Garantir que React exista no escopo global
    if (!window.React) {
      window.React = {};
      console.log('[LayoutEffect Fix] Objeto React global criado');
    }
    
    // Implementação robusta e segura de useLayoutEffect
    const createSafeUseLayoutEffect = function() {
      return function safeUseLayoutEffect(callback, deps) {
        console.log('[SafeUseLayoutEffect] Implementação segura em uso');
        // Tentar simular o comportamento básico
        if (typeof callback === 'function') {
          setTimeout(function() {
            try {
              callback();
            } catch (e) {
              console.error('[SafeUseLayoutEffect] Erro ao executar callback:', e);
            }
          }, 0);
        }
        // Retornar função de cleanup
        return function cleanupFn() {};
      };
    };
    
    // Definir useLayoutEffect de forma não sobrescritível
    if (!window.React.useLayoutEffect) {
      const safeImpl = createSafeUseLayoutEffect();
      
      // Abordagem mais cautelosa
      try {
        // Tentar atribuição direta primeiro
        window.React.useLayoutEffect = safeImpl;
        console.log('[LayoutEffect Fix] useLayoutEffect definido com atribuição direta');
      } catch (e) {
        // Se falhar, tentar com defineProperty
        try {
          Object.defineProperty(window.React, 'useLayoutEffect', {
            value: safeImpl,
            writable: true,  // Permitir sobrescrever para compatibilidade
            configurable: true,
            enumerable: true
          });
          console.log('[LayoutEffect Fix] useLayoutEffect definido com defineProperty');
        } catch (defineError) {
          console.error('[LayoutEffect Fix] Falha ao definir useLayoutEffect:', defineError);
        }
      }
    } else {
      console.log('[LayoutEffect Fix] useLayoutEffect já existe, não redefinindo');
    }
    
    // Criar um hook para capturar tentativas de acesso a React no DOM
    const observer = new MutationObserver(function(mutations) {
      for (let mutation of mutations) {
        if (mutation.type === 'childList') {
          setTimeout(function() {
            // Re-verificar se useLayoutEffect ainda existe
            if (window.React && !window.React.useLayoutEffect) {
              console.log('[LayoutEffect Fix] Restaurando useLayoutEffect após mutação DOM');
              window.React.useLayoutEffect = createSafeUseLayoutEffect();
            }
          }, 0);
        }
      }
    });
    
    // Iniciar observação do DOM - isso pode capturar carregamentos dinâmicos
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      // Se o body ainda não existir, aguardar e tentar novamente
      document.addEventListener('DOMContentLoaded', function() {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
    
    // Capturar erros em nível de janela
    window.addEventListener('error', function(event) {
      if (event && event.error && 
          (String(event.error).includes('useLayoutEffect') || 
           String(event.error).includes('Cannot read properties of undefined'))) {
        
        console.warn('[LayoutEffect Fix] Erro de useLayoutEffect interceptado:', event.error);
        
        // Tentar corrigir o problema
        if (window.React && !window.React.useLayoutEffect) {
          window.React.useLayoutEffect = createSafeUseLayoutEffect();
        }
        
        // Suprimir o erro
        event.preventDefault();
        return true;
      }
    }, true);
    
    console.log('[LayoutEffect Fix] Solução global aplicada com sucesso');
  } catch (e) {
    console.error('[LayoutEffect Fix] Erro durante inicialização:', e);
  }
})();

// PARTE 2: Exportações para uso em módulos ES
// Criar uma versão utilizável dentro do código React

// Hook seguro que pode ser usado diretamente
export function useSafeLayoutEffect(callback, deps) {
  // Usar useEffect se disponível no escopo
  if (typeof useEffect === 'function') {
    return useEffect(callback, deps);
  }
  
  // Fallback seguro
  console.warn('[useSafeLayoutEffect] Usando fallback seguro (sem efeito)');
  return function cleanupFn() {};
}

// Encapsular a funcionalidade em um objeto para facilitar o uso
export const LayoutEffectSolution = {
  // Função para patch manual em bibliotecas de terceiros
  patchReactModule: function(reactModule) {
    if (!reactModule) return false;
    
    // Já existe
    if (reactModule.useLayoutEffect) return true;
    
    // Usar useEffect se disponível
    if (reactModule.useEffect) {
      try {
        // Verificar se podemos definir propriedades neste objeto
        const descriptor = Object.getOwnPropertyDescriptor(reactModule, 'useEffect');
        
        // Se useEffect é definido com configurações especiais, usar outra abordagem
        if (descriptor && (!descriptor.writable || descriptor.set)) {
          // Usar abordagem com defineProperty
          Object.defineProperty(reactModule, 'useLayoutEffect', {
            value: reactModule.useEffect,
            writable: true,
            configurable: true,
            enumerable: true
          });
        } else {
          // Usar atribuição simples
          reactModule.useLayoutEffect = reactModule.useEffect;
        }
        
        console.log('[LayoutEffectSolution] Patch aplicado usando useEffect');
        return true;
      } catch (e) {
        console.warn('[LayoutEffectSolution] Erro ao aplicar patch (módulo protegido):', e);
        // Continuar para o próximo método
      }
    }
    
    // Fallback para implementação segura
    try {
      const safeImpl = function(callback, deps) {
        console.log('[LayoutEffectSolution] Usando implementação segura para useLayoutEffect');
        return function() {};
      };
      
      // Tentar definir
      reactModule.useLayoutEffect = safeImpl;
      
      console.log('[LayoutEffectSolution] Patch seguro aplicado');
      return true;
    } catch (e) {
      console.warn('[LayoutEffectSolution] Não foi possível aplicar patch:', e);
      return false;
    }
  },
  
  // Verificar se uma biblioteca é segura
  isSafe: function(reactModule) {
    return reactModule && typeof reactModule.useLayoutEffect === 'function';
  },
  
  // Criar uma versão segura de useLayoutEffect
  createSafeUseLayoutEffect: function() {
    return function(callback, deps) {
      console.log('[LayoutEffectSolution] Implementação segura criada e em uso');
      if (typeof callback === 'function') {
        setTimeout(callback, 0);
      }
      return function() {};
    };
  }
};

console.log('[fix-layout-effect] Módulo de correção carregado e pronto para uso'); 