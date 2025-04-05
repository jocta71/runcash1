// react-polyfill.js
// Este arquivo fornece implementações temporárias para os hooks do React
// para evitar erros quando eles são acessados antes do React ser carregado

// Verifica se estamos no navegador
if (typeof window !== 'undefined') {
  // Garante que o objeto React exista
  window.React = window.React || {};
  
  // Lista de hooks comuns do React que podem ser acessados
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
  
  // Implementa cada hook se não estiver definido ainda
  reactHooks.forEach(hookName => {
    if (!window.React[hookName]) {
      window.React[hookName] = function() {
        // Em produção, retornamos silenciosamente valores padrão
        if (process.env.NODE_ENV === 'production') {
          return hookName === 'useRef' || hookName === 'useState' ? {} : undefined;
        }
        
        // Em desenvolvimento, avisamos que o hook foi chamado antes do React estar disponível
        console.warn(`[react-polyfill] ${hookName} chamado antes do React ser inicializado`);
        
        // Retornar valores diferentes dependendo do hook
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
  
  // Também definimos z como React para código minificado que pode usar essa variável
  window.z = window.z || window.React;
  
  // Registrar que inicializamos
  if (window.__INIT_REGISTRY__) {
    window.__INIT_REGISTRY__['react-polyfill'] = true;
  }
  
  // Log em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    console.log('[react-polyfill] Hooks do React polyfilled:', reactHooks);
  }
} 