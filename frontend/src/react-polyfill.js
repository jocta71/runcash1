// react-polyfill.js
// Este arquivo fornece implementações temporárias para os hooks do React
// para evitar erros quando eles são acessados antes do React ser carregado

// Verifica se estamos no navegador
if (typeof window !== 'undefined') {
  // Garante que o objeto React exista
  window.React = window.React || {};
  
  // Implementação específica para useLayoutEffect - verificação mais rigorosa
  if (!window.React.useLayoutEffect) {
    // Se estamos no ambiente de servidor, useLayoutEffect deve se comportar como useEffect
    if (typeof document === 'undefined') {
      window.React.useLayoutEffect = function(effect, deps) {
        if (window.React.useEffect) {
          return window.React.useEffect(effect, deps);
        }
        return undefined;
      };
    } else {
      // Implementação simplificada para cliente
      window.React.useLayoutEffect = function(effect, deps) {
        // Simular o comportamento básico no cliente
        if (typeof effect === 'function') {
          // Executar o efeito de forma assíncrona para evitar bloqueio
          const cleanup = setTimeout(() => {
            try {
              const cleanupFn = effect();
              if (typeof cleanupFn === 'function') {
                // Armazenar a função de limpeza para possível uso posterior
                window.__REACT_LAYOUT_EFFECT_CLEANUP__ = cleanupFn;
              }
            } catch (e) {
              console.error('[react-polyfill] Erro ao executar useLayoutEffect:', e);
            }
          }, 0);
          
          // Retornar uma função de limpeza stub
          return function() {
            clearTimeout(cleanup);
            if (typeof window.__REACT_LAYOUT_EFFECT_CLEANUP__ === 'function') {
              try {
                window.__REACT_LAYOUT_EFFECT_CLEANUP__();
              } catch (e) {
                console.error('[react-polyfill] Erro ao executar limpeza de useLayoutEffect:', e);
              }
              window.__REACT_LAYOUT_EFFECT_CLEANUP__ = null;
            }
          };
        }
        return undefined;
      };
    }
    
    console.log('[react-polyfill] useLayoutEffect polyfilled');
  }
  
  // Lista de hooks comuns do React que podem ser acessados
  const reactHooks = [
    'useState', 
    'useEffect', 
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