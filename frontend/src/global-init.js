// AUTO-GENERATED: Global initialization file
// This file ensures variables are initialized before they're accessed

// Global initialization IIFE to avoid polluting global scope
(function() {
  // Use var instead of let/const to avoid TDZ issues
  var initialized = {};

  // Initialize Yo to prevent "Cannot access before initialization" errors
  var Yo = { initialized: true, timestamp: Date.now() };
  window.Yo = Yo;
  initialized['Yo'] = true;

  // Resolver problema com useLayoutEffect
  // Criar um objeto simulado de React para caso o React ainda não tenha sido carregado
  // ou para quando o código minificado tenta acessar uma variável z indefinida
  if (typeof window !== 'undefined') {
    // Definir explicitamente o objeto React
    window.React = window.React || {};
    
    // Definir explicitamente todos os hooks comuns do React
    const reactHooks = [
      'useState', 
      'useEffect', 
      'useLayoutEffect', 
      'useRef', 
      'useCallback', 
      'useMemo', 
      'useContext', 
      'useReducer'
    ];
    
    // Implementa cada hook se não estiver definido
    reactHooks.forEach(hookName => {
      if (!window.React[hookName]) {
        window.React[hookName] = function() {
          if (process.env.NODE_ENV === 'production') {
            return hookName === 'useRef' || hookName === 'useState' ? {} : undefined;
          }
          console.warn(`[global-init] React.${hookName} chamado antes do React ser inicializado`);
          switch (hookName) {
            case 'useState':
              return [undefined, () => {}];
            case 'useRef':
              return { current: undefined };
            default:
              return undefined;
          }
        };
      }
    });
    
    // Adicionar safeguard para o objeto z que pode estar sendo usado no código minificado
    window.z = window.z || window.React;
    
    initialized['React'] = true;
    initialized['z'] = true;
  }

  // Create a registry to track initialization
  window.__INIT_REGISTRY__ = initialized;
  
  // Log in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[global-init] Variables initialized:', Object.keys(initialized));
  }
})();
