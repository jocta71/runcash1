// fix-layout-effect.js - Versão otimizada de segurança para useLayoutEffect
// Importar este arquivo em qualquer componente que use useLayoutEffect

// Função para fixar o useLayoutEffect
(function fixUseLayoutEffect() {
  // Verificação de ambiente
  if (typeof window === 'undefined' || typeof window.React === 'undefined') {
    console.warn("[fix-layout-effect] Ambiente sem window ou React detectado");
    return;
  }
  
  // Verificar se React.useLayoutEffect existe
  if (!window.React.useLayoutEffect) {
    console.warn("[fix-layout-effect] React.useLayoutEffect não encontrado, aplicando fix");
    
    // Implementação segura do useLayoutEffect
    window.React.useLayoutEffect = window.React.useEffect || function(callback, deps) {
      // Implementação mínima que não causa erro
      if (typeof callback === 'function') {
        setTimeout(() => {
          try {
            callback();
          } catch (e) {
            console.error("[fix-layout-effect] Erro ao executar callback:", e);
          }
        }, 0);
      }
      return undefined;
    };
    
    // Atualizar também a variável 'z' usada em código minificado
    if (window.z) {
      window.z.useLayoutEffect = window.React.useLayoutEffect;
    }
    
    console.log("[fix-layout-effect] Fix aplicado com sucesso");
  }
  
  // Aplicar monkey patch no React que será carregado posteriormente
  const originalDefineProperty = Object.defineProperty;
  Object.defineProperty = function(obj, prop, descriptor) {
    // Se estiver definindo o React no window
    if (obj === window && prop === 'React' && descriptor && descriptor.value) {
      const originalValue = descriptor.value;
      
      // Manter a implementação segura de useLayoutEffect
      if (!originalValue.useLayoutEffect) {
        originalValue.useLayoutEffect = window.React.useLayoutEffect;
      }
    }
    
    // Comportamento normal
    return originalDefineProperty.apply(this, arguments);
  };
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