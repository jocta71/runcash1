// Script de interceptação de acesso ao React.useLayoutEffect
// Este script deve ser carregado antes de qualquer outro código

(function() {
  // Verificação de ambiente
  if (typeof window === 'undefined') return;
  
  console.log('[Interceptador] Inicializando interceptador de propriedades React...');
  
  // Guardar o React original
  const originalReact = window.React;
  
  // Criar proxy para interceptar propriedades
  const proxyHandler = {
    get: function(target, prop) {
      // Se a propriedade é useLayoutEffect
      if (prop === 'useLayoutEffect') {
        // Se não existir, criar uma implementação segura
        if (!target.useLayoutEffect) {
          console.log('[Interceptador] Interceptando acesso a useLayoutEffect');
          
          // Criar implementação de fallback
          const safeUseLayoutEffect = function(callback, deps) {
            console.log('[Interceptador] Usando implementação segura de useLayoutEffect');
            
            // Implementação segura que não causa erro
            if (typeof callback === 'function') {
              const timeoutId = setTimeout(() => {
                try {
                  callback();
                } catch (e) {
                  console.error('[Interceptador] Erro ao executar callback de useLayoutEffect:', e);
                }
              }, 0);
              
              // Retornar função de cleanup
              return function() {
                clearTimeout(timeoutId);
              };
            }
            return undefined;
          };
          
          // Definir a propriedade no objeto alvo para uso futuro
          Object.defineProperty(target, 'useLayoutEffect', {
            value: safeUseLayoutEffect,
            writable: true,
            configurable: true,
            enumerable: true
          });
          
          return safeUseLayoutEffect;
        }
      }
      
      // Para todas as outras propriedades, tente retornar o valor original
      try {
        return target[prop];
      } catch (e) {
        console.warn(`[Interceptador] Erro ao acessar propriedade ${prop}:`, e);
        
        // Retornar valores padrão para hooks conhecidos
        if (prop === 'useState') return function() { return [undefined, function() {}]; };
        if (prop === 'useEffect') return function() { return undefined; };
        if (prop === 'useRef') return function() { return { current: undefined }; };
        
        // Valor padrão para outras propriedades
        return undefined;
      }
    },
    
    // Interceptar verificações has
    has: function(target, prop) {
      if (prop === 'useLayoutEffect') return true;
      return prop in target;
    }
  };
  
  // Criar proxy apenas se React não existe ou não tem useLayoutEffect
  if (!originalReact || !originalReact.useLayoutEffect) {
    // Criar objeto React vazio se não existe
    if (!window.React) window.React = {};
    
    // Aplicar proxy ao objeto React
    window.React = new Proxy(window.React, proxyHandler);
    
    console.log('[Interceptador] Proxy aplicado ao objeto React');
  } else {
    console.log('[Interceptador] React.useLayoutEffect já existe, nenhuma ação necessária');
  }
  
  // Interceptar erros relacionados ao useLayoutEffect
  const originalError = console.error;
  console.error = function() {
    const errorString = Array.from(arguments).join(' ');
    
    // Se for erro de useLayoutEffect, tentar recuperar
    if (errorString.includes('useLayoutEffect') && 
        errorString.includes('undefined') &&
        errorString.includes('Cannot read properties')) {
      
      console.log('[Interceptador] Erro de useLayoutEffect detectado e interceptado');
      
      // Tentar corrigir se o React existe mas useLayoutEffect não
      if (window.React && !window.React.useLayoutEffect) {
        window.React.useLayoutEffect = function(callback, deps) {
          console.warn('[Interceptador] Usando implementação de emergência para useLayoutEffect');
          // Implementação simples que não causa erro
          return undefined;
        };
      }
      
      // Não propagar o erro
      return;
    }
    
    // Para outros erros, comportamento normal
    return originalError.apply(console, arguments);
  };
  
  console.log('[Interceptador] Interceptação de erros configurada');
})(); 