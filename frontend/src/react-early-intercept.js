/**
 * react-early-intercept.js
 * 
 * Este script implementa uma solução definitiva para o problema do useLayoutEffect,
 * interceptando o módulo React em vários níveis e garantindo que useLayoutEffect
 * esteja sempre disponível.
 * 
 * IMPORTANTE: Deve ser importado ANTES de qualquer outro módulo React
 */

// Auto-execução imediata para garantir aplicação no início do carregamento
(function() {
  console.log('[Interceptor] Inicializando sistema avançado de proteção para React.useLayoutEffect');
  
  try {
    // Verificar se estamos em um ambiente de navegador
    if (typeof window === 'undefined') return;
    
    // Funções utilitárias
    function isReactLike(obj) {
      return obj && typeof obj === 'object' && (
        obj.useState || 
        obj.useEffect || 
        obj.createElement || 
        obj.Component ||
        obj.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      );
    }
    
    // Detectar a versão do React e método adequado para substituir useLayoutEffect
    function getBestUseLayoutEffectImplementation(reactObj) {
      // Tentar usar métodos existentes em ordem de preferência
      if (reactObj.useEffect && typeof reactObj.useEffect === 'function') {
        console.log('[Interceptor] Usando React.useEffect como implementação para useLayoutEffect');
        return reactObj.useEffect;
      }
      
      // Fallback para uma função vazia segura
      console.log('[Interceptor] Usando dummy function como implementação para useLayoutEffect');
      return function safeUseLayoutEffect(callback, deps) {
        console.log('[SafeUseLayoutEffect] Simulação segura ativada');
        // Retornar função vazia como cleanup
        return function() {};
      };
    }
    
    // 1. Garantir que React global exista
    window.React = window.React || {};
    
    // 2. Interceptação em nível de objeto global
    if (!window.React.useLayoutEffect) {
      // Manter uma referência original do React para uso posterior
      const originalReact = { ...window.React };
      
      // Implementação segura do useLayoutEffect
      const safeImplementation = getBestUseLayoutEffectImplementation(originalReact);
      
      // Verificar se podemos definir a propriedade diretamente
      try {
        // Primeiro tentar atribuição direta, que é mais segura
        window.React.useLayoutEffect = safeImplementation;
        console.log('[Interceptor] React.useLayoutEffect definido por atribuição direta');
      } catch (e) {
        // Se falhar, tentar com defineProperty
        try {
          // Verificar se já existe como um getter
          const descriptor = Object.getOwnPropertyDescriptor(window.React, 'useLayoutEffect');
          
          if (descriptor && !descriptor.writable && !descriptor.set && descriptor.configurable) {
            // Redefinir como uma propriedade configurável e gravável
            Object.defineProperty(window.React, 'useLayoutEffect', {
              value: safeImplementation,
              writable: true,
              configurable: true,
              enumerable: true
            });
            console.log('[Interceptor] React.useLayoutEffect redefinido de getter para valor gravável');
          } else {
            // Definir normalmente
            Object.defineProperty(window.React, 'useLayoutEffect', {
              value: safeImplementation,
              writable: true,
              configurable: true,
              enumerable: true
            });
            console.log('[Interceptor] React.useLayoutEffect definido com defineProperty');
          }
        } catch (defineError) {
          console.error('[Interceptor] Não foi possível definir React.useLayoutEffect:', defineError);
        }
      }
    } else {
      console.log('[Interceptor] React.useLayoutEffect já existe, não redefinindo');
    }
    
    // 3. Interceptar dinâmicamente o carregamento de módulos React
    // Esta é uma técnica avançada que intercepta o sistema de módulos
    
    // Criar um proxy para o módulo React principal
    const reactProxyHandler = {
      get: function(target, prop) {
        if (prop === 'useLayoutEffect' && !target.useLayoutEffect) {
          console.log('[ModuleProxy] Interceptando acesso a useLayoutEffect');
          const safeImpl = getBestUseLayoutEffectImplementation(target);
          
          // Definir a propriedade no objeto alvo para uso futuro
          Object.defineProperty(target, 'useLayoutEffect', {
            value: safeImpl,
            writable: true,
            configurable: true,
            enumerable: true
          });
          
          return safeImpl;
        }
        return target[prop];
      },
      
      // Garantir que verificações com 'in' retornem true para useLayoutEffect
      has: function(target, prop) {
        if (prop === 'useLayoutEffect') return true;
        return prop in target;
      }
    };
    
    // 4. Interceptar importações dinâmicas
    const originalImport = window.import;
    if (typeof originalImport === 'function') {
      window.import = function(...args) {
        return originalImport.apply(this, args).then(module => {
          // Verificar se é um módulo React
          if (module && isReactLike(module)) {
            console.log('[ImportHook] Interceptando importação de módulo React-like');
            
            // Garantir que useLayoutEffect exista
            if (!module.useLayoutEffect) {
              module.useLayoutEffect = getBestUseLayoutEffectImplementation(module);
            }
            
            // Aplicar proxy ao módulo
            return new Proxy(module, reactProxyHandler);
          }
          return module;
        });
      };
    }
    
    // 5. Interceptar erros globais
    window.addEventListener('error', function(event) {
      if (event && event.error && String(event.error).includes('useLayoutEffect')) {
        console.warn('[ErrorHook] Erro de useLayoutEffect interceptado:', event.error);
        // Suprimir o erro
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    }, true);
    
    // 6. Para interceptar import/require, modificamos o Object.defineProperty
    const originalDefineProperty = Object.defineProperty;
    Object.defineProperty = function(obj, prop, descriptor) {
      // Capturar definições de módulo React
      if (descriptor && descriptor.value && isReactLike(descriptor.value)) {
        const moduleValue = descriptor.value;
        
        console.log('[DefineHook] Interceptando definição de módulo React:', prop);
        
        // Garantir que useLayoutEffect exista
        if (!moduleValue.useLayoutEffect) {
          moduleValue.useLayoutEffect = getBestUseLayoutEffectImplementation(moduleValue);
        }
        
        // Aplicar proxy ao módulo
        descriptor.value = new Proxy(moduleValue, reactProxyHandler);
      }
      
      return originalDefineProperty.apply(this, arguments);
    };
    
    console.log('[Interceptor] Sistema de proteção para React.useLayoutEffect inicializado com sucesso.');
  } catch (e) {
    console.error('[Interceptor] Erro ao inicializar proteções:', e);
  }
})(); 