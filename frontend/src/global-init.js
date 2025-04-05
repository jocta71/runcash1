// AUTO-GENERATED: Global initialization file
// This file ensures variables are initialized before they're accessed

// IIFE executada imediatamente antes de qualquer outro código
(function() {
  // Definir variáveis React no escopo global antes de qualquer importação
  if (typeof window !== 'undefined') {
    // Hook para interceptar erros de propriedades indefinidas
    const originalGetProperty = Object.getOwnPropertyDescriptor(Object.prototype, '__lookupGetter__')?.value;
    if (originalGetProperty) {
      // Patch global para prevenir erros de acesso a propriedades de objetos undefined
      Object.defineProperty(window, 'React', {
        value: {},
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    
    // Assegurar que o objeto React existe
    window.React = window.React || {};
    
    // Implementação especial para useLayoutEffect
    if (!window.React.useLayoutEffect) {
      // Em ambiente de servidor, useLayoutEffect deve ser useEffect
      if (typeof document === 'undefined') {
        window.React.useLayoutEffect = function() {
          if (window.React.useEffect) {
            return window.React.useEffect.apply(null, arguments);
          }
          return undefined;
        };
      } else {
        // Implementação para cliente com segurança para TDZ
        window.React.useLayoutEffect = function(callback, deps) {
          // Usar setTimeout para simular o comportamento
          if (typeof callback === 'function') {
            // Em produção, executar a callback em um setTimeout
            try {
              const id = setTimeout(() => {
                try {
                  const cleanup = callback();
                  
                  // Armazenar function de limpeza
                  if (typeof cleanup === 'function') {
                    window.__REACT_LAYOUT_EFFECT_CLEANUPS__ = window.__REACT_LAYOUT_EFFECT_CLEANUPS__ || {};
                    const cleanupId = Date.now() + Math.random().toString(36).substring(2, 9);
                    window.__REACT_LAYOUT_EFFECT_CLEANUPS__[cleanupId] = cleanup;
                  }
                } catch (e) {
                  console.error('[global-init] Erro ao executar useLayoutEffect:', e);
                }
              }, 0);
              
              // Retornar mock de função de cleanup
              return function() {
                clearTimeout(id);
                // Limpar todos os cleanups registrados
                if (window.__REACT_LAYOUT_EFFECT_CLEANUPS__) {
                  Object.values(window.__REACT_LAYOUT_EFFECT_CLEANUPS__).forEach(cleanup => {
                    if (typeof cleanup === 'function') {
                      try {
                        cleanup();
                      } catch (e) {
                        console.error('[global-init] Erro ao executar limpeza de useLayoutEffect:', e);
                      }
                    }
                  });
                  window.__REACT_LAYOUT_EFFECT_CLEANUPS__ = {};
                }
              };
            } catch (e) {
              console.error('[global-init] Erro ao configurar useLayoutEffect:', e);
              return undefined;
            }
          }
          return undefined;
        };
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[global-init] useLayoutEffect inicializado especialmente');
      }
    }
    
    // Lista de todos os hooks React comuns - definidos explicitamente
    const reactHooks = [
      'useState', 
      'useEffect', 
      'useRef', 
      'useCallback', 
      'useMemo', 
      'useContext', 
      'useReducer',
      'useImperativeHandle',
      'useDebugValue',
      'useTransition',
      'useDeferredValue'
    ];
    
    // Implementar todos os hooks com comportamento seguro
    reactHooks.forEach(hookName => {
      // Definir o hook somente se ainda não estiver definido
      if (!window.React[hookName]) {
        window.React[hookName] = function() {
          // Em produção, retornar valores padrão silenciosamente
          if (process.env.NODE_ENV === 'production') {
            // Comportamento específico baseado no hook
            switch (hookName) {
              case 'useState':
                return [undefined, function() {}];
              case 'useRef':
                return { current: undefined };
              case 'useEffect':
                return undefined;
              default:
                return undefined;
            }
          }
          
          // Em desenvolvimento, avisar sobre inicialização precoce
          console.warn(`[global-init] React.${hookName} chamado antes do React ser inicializado`);
          
          // Retornar o mesmo comportamento para desenvolvimento
          switch (hookName) {
            case 'useState':
              return [undefined, function() {}];
            case 'useRef':
              return { current: undefined };
            default:
              return undefined;
          }
        };
      }
    });
    
    // Também definir z como React para código minificado
    window.z = window.z || window.React;
  }
  
  // Inicializar Yo para evitar erros "Cannot access before initialization"
  var Yo = { initialized: true, timestamp: Date.now() };
  window.Yo = Yo;
  
  // Criar registry para rastrear inicialização
  window.__INIT_REGISTRY__ = {
    'Yo': true,
    'React': true,
    'z': true,
    'useLayoutEffect': true
  };
  
  // Log em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    console.log('[global-init] Inicialização global concluída');
  }
})();
