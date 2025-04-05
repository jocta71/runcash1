(function() {
  console.log('===== DIAGNÓSTICO DE HOOKS DO REACT =====');
  console.log('Verificando a disponibilidade de hooks React no escopo global');
  
  if (typeof window === 'undefined') {
    console.log('⚠️ Ambiente sem window detectado (provavelmente servidor)');
    return;
  }
  
  // Verificar se React existe
  if (!window.React) {
    console.error('❌ window.React não está definido!');
    return;
  }
  
  console.log('✅ window.React está disponível');
  
  // Verificar hooks específicos
  const hooksParaVerificar = [
    'useState',
    'useEffect',
    'useLayoutEffect',
    'useRef',
    'useCallback',
    'useMemo',
    'useContext',
    'useReducer'
  ];
  
  // Verificação detalhada de cada hook
  hooksParaVerificar.forEach(hook => {
    const status = typeof window.React[hook] === 'function' 
      ? '✅ Disponível' 
      : '❌ Não implementado';
    
    console.log(`${hook}: ${status}`);
  });
  
  // Verificação específica para useLayoutEffect
  if (typeof window.React.useLayoutEffect === 'function') {
    console.log('✅ useLayoutEffect está implementado com o tipo correto');
    // Verificar se a implementação é a esperada
    try {
      const mockEffect = () => {
        console.log('Teste de useLayoutEffect executado com sucesso');
        return () => console.log('Cleanup de useLayoutEffect testado');
      };
      
      const cleanup = window.React.useLayoutEffect(mockEffect, []);
      console.log('✅ useLayoutEffect aceitou argumentos sem erro');
      
      if (typeof cleanup === 'function') {
        console.log('✅ useLayoutEffect retornou função de cleanup');
        try {
          cleanup();
          console.log('✅ Função de cleanup executada com sucesso');
        } catch (e) {
          console.error('❌ Erro ao executar função de cleanup:', e);
        }
      } else {
        console.log('ℹ️ useLayoutEffect não retornou função de cleanup');
      }
    } catch (e) {
      console.error('❌ Erro ao testar useLayoutEffect:', e);
    }
  } else {
    console.error('❌ useLayoutEffect não está implementado corretamente!');
  }
  
  // Verificar registros de inicialização
  if (window.__INIT_REGISTRY__) {
    console.log('Registro de inicialização:', window.__INIT_REGISTRY__);
  } else {
    console.log('⚠️ Registro de inicialização não encontrado');
  }
  
  console.log('===== FIM DO DIAGNÓSTICO =====');
})(); 