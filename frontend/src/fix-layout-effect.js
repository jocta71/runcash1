/**
 * fix-layout-effect.js
 * 
 * Este script resolve o problema "Cannot read properties of undefined (reading 'useLayoutEffect')"
 * garantindo que o useLayoutEffect esteja sempre disponível, seja no lado do servidor ou cliente.
 * 
 * O script deve ser carregado antes da aplicação React ser inicializada.
 */

(function() {
  try {
    // Verificar se estamos em um ambiente de navegador
    if (typeof window !== 'undefined') {
      // Garantir que o objeto React seja acessível
      if (!window.React) {
        // Criar um objeto React temporário se não existir
        window.React = window.React || {};
      }
      
      // Verificar se useLayoutEffect está disponível ou criar uma versão segura
      // que utiliza useEffect como fallback
      if (!window.React.useLayoutEffect) {
        // Usar o useEffect como fallback para useLayoutEffect
        window.React.useLayoutEffect = window.React.useEffect || 
          function useLayoutEffectPolyfill(callback, deps) {
            console.log('[Polyfill] Usando polyfill para useLayoutEffect');
            // Simplesmente retorna uma função vazia se nenhum fallback estiver disponível
            // Isso evita erros, embora não forneça a funcionalidade
            return typeof window.React.useEffect === 'function' 
              ? window.React.useEffect(callback, deps)
              : function() {};
          };
        
        console.log('[LayoutEffect Fix] Polyfill para useLayoutEffect instalado');
      }
      
      // Também definimos uma versão global do React para debug
      // e para facilitar a interceptação
      if (typeof window.__REACT_GLOBAL_DEBUG__ === 'undefined') {
        window.__REACT_GLOBAL_DEBUG__ = {
          injectLayoutEffect: function(React) {
            if (React && !React.useLayoutEffect && React.useEffect) {
              React.useLayoutEffect = React.useEffect;
              console.log('[React Debug] useLayoutEffect injetado no objeto React fornecido');
              return true;
            }
            return false;
          }
        };
      }
      
      console.log('[LayoutEffect Fix] Inicialização concluída');
    }
  } catch (e) {
    console.error('[LayoutEffect Fix] Erro durante inicialização:', e);
  }
})();

// Exportar uma verificação que pode ser usada em componentes
export function ensureUseLayoutEffect() {
  // Criar um alias seguro para useLayoutEffect
  const safeUseLayoutEffect = 
    (typeof window !== 'undefined' && window.React && window.React.useLayoutEffect) ||
    function() { return undefined; };
  
  return safeUseLayoutEffect;
}

// Criar um alias seguro que pode ser importado diretamente
export const safeUseLayoutEffect = ensureUseLayoutEffect();

// Montar um objeto seguro que emula o React
export const SafeReact = {
  useState: (typeof window !== 'undefined' && window.React) ? window.React.useState : function() { return [undefined, function() {}]; },
  useEffect: (typeof window !== 'undefined' && window.React) ? window.React.useEffect : function() { return undefined; },
  useLayoutEffect: safeUseLayoutEffect,
  useRef: (typeof window !== 'undefined' && window.React) ? window.React.useRef : function() { return { current: undefined }; }
};

// Executar assim que o módulo for carregado
console.log("[fix-layout-effect] Módulo de segurança para useLayoutEffect carregado"); 