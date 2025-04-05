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
    window.React = window.React || {};
    
    // Garantir que useLayoutEffect e useEffect existam no objeto React
    if (!window.React.useLayoutEffect) {
      window.React.useLayoutEffect = function() {
        console.warn('[global-init] React.useLayoutEffect chamado antes do React ser inicializado');
        return null;
      };
    }
    
    if (!window.React.useEffect) {
      window.React.useEffect = function() {
        console.warn('[global-init] React.useEffect chamado antes do React ser inicializado');
        return null;
      };
    }
    
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
