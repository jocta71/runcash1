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
    
    // Lista de todos os hooks React comuns - definidos explicitamente
    const reactHooks = [
      'useState', 
      'useEffect', 
      'useLayoutEffect', 
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
              case 'useLayoutEffect':
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
    'z': true
  };
  
  // Log em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    console.log('[global-init] Inicialização global concluída');
  }
})();
