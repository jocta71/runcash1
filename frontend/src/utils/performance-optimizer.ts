/**
 * Utilitários para otimização de desempenho da aplicação
 */

/**
 * Marca um ponto de performance para medição
 * @param name Nome da marcação
 */
export const markPerformance = (name: string): void => {
  try {
    if (window.performance && window.performance.mark) {
      window.performance.mark(name);
      console.log(`[Performance] Marca: ${name}`);
    }
  } catch (e) {
    console.error('[Performance] Erro ao marcar performance:', e);
  }
};

/**
 * Mede o tempo entre duas marcações de performance
 * @param startMark Nome da marcação inicial
 * @param endMark Nome da marcação final
 * @param measureName Nome da medição
 */
export const measurePerformance = (
  startMark: string,
  endMark: string,
  measureName: string
): void => {
  try {
    if (window.performance && window.performance.measure) {
      window.performance.measure(measureName, startMark, endMark);
      const measures = window.performance.getEntriesByName(measureName);
      if (measures.length > 0) {
        console.log(
          `[Performance] Medição ${measureName}: ${measures[0].duration.toFixed(2)}ms`
        );
      }
    }
  } catch (e) {
    console.error('[Performance] Erro ao medir performance:', e);
  }
};

/**
 * Executa uma função de forma assíncrona para não bloquear a UI
 * @param fn Função a ser executada
 * @param delay Tempo de atraso (ms)
 */
export const runAsync = <T>(fn: () => T, delay = 0): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const result = fn();
        resolve(result);
      } catch (error) {
        console.error('[runAsync] Erro durante execução assíncrona:', error);
        throw error;
      }
    }, delay);
  });
};

/**
 * Inicializa e aplica otimizações no carregamento de recursos
 */
export const initPerformanceOptimizations = (): void => {
  // Iniciar medição de performance da aplicação
  markPerformance('app_init');
  
  // Otimização de imagens com carregamento preguiçoso
  document.addEventListener('DOMContentLoaded', () => {
    const images = document.querySelectorAll('img[data-src]');
    const options = {
      rootMargin: '0px 0px 50px 0px',
      threshold: 0.1
    };
    
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.getAttribute('data-src');
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
          }
          imageObserver.unobserve(img);
        }
      });
    }, options);
    
    images.forEach(img => {
      imageObserver.observe(img);
    });
    
    markPerformance('dom_optimizations_applied');
  });
  
  // Detectar e reportar problemas de desempenho
  detectPerformanceIssues();
};

/**
 * Detecta problemas comuns de desempenho
 */
export const detectPerformanceIssues = (): void => {
  // Monitorar tempos de renderização longos
  let lastFrameTime = performance.now();
  
  const checkFrameTimes = () => {
    const now = performance.now();
    const frameDuration = now - lastFrameTime;
    
    // Detectar frames que demoram mais de 100ms (potencial congelamento)
    if (frameDuration > 100) {
      console.warn(`[Performance] Frame demorado detectado: ${frameDuration.toFixed(2)}ms`);
    }
    
    lastFrameTime = now;
    requestAnimationFrame(checkFrameTimes);
  };
  
  // Iniciar monitoramento
  requestAnimationFrame(checkFrameTimes);
};

/**
 * Otimização de roteamento e navegação
 */
export const optimizeRouting = (): void => {
  // Pré-carregar rotas comuns
  const preloadRoutes = () => {
    // Lista de arquivos a serem pré-carregados
    const routesToPreload = [
      '/pages/Index.js',
      '/pages/AuthPage.js'
    ];
    
    // Adicionar preload links dinamicamente
    routesToPreload.forEach(route => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = route;
      link.as = 'script';
      document.head.appendChild(link);
    });
  };
  
  // Executar pré-carregamento após carregamento inicial
  runAsync(preloadRoutes, 5000);
};

/**
 * Desfragmenta a memória para reduzir o consumo de recursos
 */
export const optimizeMemory = (): void => {
  // Otimizar uso de memória periodicamente
  const gcInterval = 60000; // 1 minuto
  
  setInterval(() => {
    try {
      if (window.gc) {
        // @ts-ignore - gc é uma função de depuração disponível apenas em alguns ambientes
        window.gc();
        console.log('[Performance] Coleta de lixo solicitada');
      }
    } catch (e) {
      // Ignorar erro - gc não está disponível em todos os ambientes
    }
  }, gcInterval);
};

// Exportar uma função de utilidade para diagnóstico de performance
export const diagnosePerformance = (): void => {
  if (!window.performance) {
    console.warn('[Performance] API de Performance não está disponível neste navegador');
    return;
  }
  
  console.group('Diagnóstico de Performance');
  
  // Exibir timing de navegação
  if (window.performance.timing) {
    const timing = window.performance.timing;
    console.log('Tempo de carregamento da página:', 
      (timing.loadEventEnd - timing.navigationStart) + 'ms');
    console.log('Tempo de resposta do servidor:', 
      (timing.responseEnd - timing.requestStart) + 'ms');
    console.log('Tempo de renderização DOM:', 
      (timing.domComplete - timing.domLoading) + 'ms');
  }
  
  // Exibir todas as medições de performance
  const measures = window.performance.getEntriesByType('measure');
  if (measures.length > 0) {
    console.table(measures.map(m => ({
      name: m.name,
      duration: m.duration.toFixed(2) + 'ms'
    })));
  } else {
    console.log('Nenhuma medição de performance registrada');
  }
  
  console.groupEnd();
}; 