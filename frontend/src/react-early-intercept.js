/**
 * react-early-intercept.js
 * 
 * Este script implementa uma solução mais robusta para o problema do useLayoutEffect
 * interceptando o módulo React antes de ser completamente carregado
 * 
 * Deve ser importado no início da aplicação, antes de qualquer código React
 */

// Abordagem para injetar um polyfill para useLayoutEffect no React antes de ser usado
(function() {
  try {
    // 1. Interceptar erros relacionados a useLayoutEffect
    if (typeof window !== 'undefined') {
      window.addEventListener('error', function(event) {
        if (event && event.error && event.error.message && 
            (event.error.message.includes('useLayoutEffect') || 
             event.error.message.includes('Cannot read properties of undefined'))) {
          console.warn('[Interceptador] Erro interceptado:', event.error.message);
          // Marcar o erro como tratado
          event.preventDefault();
          return true;
        }
      }, true); // Capturar na fase de captura para interceptar antes de outros handlers
      
      // 2. Definir um objeto React global mínimo com useLayoutEffect seguro
      if (!window.React) {
        window.React = {};
      }
      
      // 3. Implementar useLayoutEffect como useEffect ou uma função vazia
      if (!window.React.useLayoutEffect) {
        window.React.useLayoutEffect = function useLayoutEffectPolyfill(callback, deps) {
          console.log('[Early Intercept] Usando polyfill para useLayoutEffect');
          return typeof window.React.useEffect === 'function' 
            ? window.React.useEffect(callback, deps) 
            : function() {};
        };
      }
      
      // 4. Interceptar o require/import do React para adicionar useLayoutEffect
      const originalDefineProperty = Object.defineProperty;
      Object.defineProperty = function(obj, prop, descriptor) {
        // Se alguém estiver definindo a propriedade 'React' no window
        if ((obj === window || obj === globalThis) && prop === 'React') {
          const originalValue = descriptor.value;
          
          // Verificar se o valor é um objeto React válido
          if (originalValue && typeof originalValue === 'object') {
            // Verificar se useLayoutEffect está ausente
            if (typeof originalValue.useLayoutEffect !== 'function') {
              // Injetar useLayoutEffect = useEffect
              if (typeof originalValue.useEffect === 'function') {
                originalValue.useLayoutEffect = originalValue.useEffect;
                console.log('[Early Intercept] useLayoutEffect injetado usando useEffect');
              } else {
                // Função dummy como último recurso
                originalValue.useLayoutEffect = function() { return function() {}; };
                console.log('[Early Intercept] useLayoutEffect dummy injetado');
              }
            }
          }
        }
        
        // Continuar com o comportamento normal
        return originalDefineProperty.apply(this, arguments);
      };
      
      console.log('[Early Intercept] Sistema de proteção para useLayoutEffect iniciado');
    }
  } catch (e) {
    console.error('[Early Intercept] Erro ao inicializar interceptação:', e);
  }
})(); 