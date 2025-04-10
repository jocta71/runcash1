/**
 * CorsProxy.ts
 * Serviço que funciona como proxy para contornar problemas de CORS
 */

interface ProxyOptions {
  mode?: RequestMode;
  timeout?: number;
  retry?: number;
}

class CorsProxyService {
  // Serviços de proxy CORS públicos que podemos usar como alternativa
  private proxyUrls = [
    'https://corsproxy.io/?',
    'https://cors-anywhere.herokuapp.com/',
    'https://api.allorigins.win/raw?url='
  ];

  /**
   * Tenta fazer uma requisição usando vários métodos para contornar CORS
   * @param url URL original para fazer a requisição
   * @param options Opções adicionais
   * @returns Dados da resposta ou null em caso de erro
   */
  async fetch(url: string, options: ProxyOptions = {}): Promise<any> {
    const {
      mode = 'cors',
      timeout = 10000,
      retry = 3
    } = options;

    console.log(`[CORS-PROXY] Tentando acessar: ${url}`);

    // Primeira tentativa: Requisição direta com modo especificado
    try {
      console.log(`[CORS-PROXY] Tentativa direta com modo ${mode}`);
      const directResponse = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: this.getHeaders(),
        mode: mode,
        cache: 'no-store'
      }, timeout);

      if (directResponse.ok) {
        console.log('[CORS-PROXY] ✅ Requisição direta bem-sucedida');
        return await directResponse.json();
      }

      console.log(`[CORS-PROXY] ⚠️ Requisição direta falhou: ${directResponse.status}`);
    } catch (error) {
      console.log(`[CORS-PROXY] ❌ Erro na requisição direta: ${error}`);
    }

    // Segunda tentativa: Tentar usar serviços de proxy CORS públicos
    for (const proxyUrl of this.proxyUrls) {
      try {
        console.log(`[CORS-PROXY] Tentando via proxy: ${proxyUrl}`);
        const proxyResponse = await this.fetchWithTimeout(`${proxyUrl}${encodeURIComponent(url)}`, {
          method: 'GET',
          headers: this.getHeaders(),
          cache: 'no-store'
        }, timeout);

        if (proxyResponse.ok) {
          console.log(`[CORS-PROXY] ✅ Requisição via proxy ${proxyUrl} bem-sucedida`);
          return await proxyResponse.json();
        }

        console.log(`[CORS-PROXY] ⚠️ Proxy ${proxyUrl} falhou: ${proxyResponse.status}`);
      } catch (error) {
        console.log(`[CORS-PROXY] ❌ Erro no proxy ${proxyUrl}: ${error}`);
      }
    }

    // Terceira tentativa: no-cors como último recurso (apenas para saber se o servidor está online)
    if (mode !== 'no-cors') {
      try {
        console.log('[CORS-PROXY] Tentativa final com no-cors');
        const noCorsResponse = await this.fetchWithTimeout(url, {
          method: 'GET',
          headers: this.getHeaders(),
          mode: 'no-cors',
          cache: 'no-store'
        }, timeout);

        // Esta resposta não terá dados utilizáveis devido às restrições do modo no-cors,
        // mas podemos verificar se o servidor pelo menos respondeu
        console.log('[CORS-PROXY] ✅ Servidor respondeu, mas dados são inacessíveis devido a no-cors');
      } catch (error) {
        console.log(`[CORS-PROXY] ❌ Erro total: ${error}`);
      }
    }

    // Se chegamos aqui, todas as tentativas falharam
    console.log('[CORS-PROXY] ❌ Todas as tentativas falharam');
    throw new Error('Não foi possível acessar a API após múltiplas tentativas');
  }

  /**
   * Obtém os headers padrão para requisições
   */
  private getHeaders(): Record<string, string> {
    return {
      'Accept': 'application/json, */*',
      'User-Agent': 'RunCashh-Frontend/1.0',
      'Origin': window.location.origin,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
  }

  /**
   * Versão do fetch com timeout para evitar requisições que nunca terminam
   */
  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const { signal } = controller;

    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => {
        controller.abort();
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    return Promise.race([
      fetch(url, { ...options, signal }),
      timeoutPromise
    ]) as Promise<Response>;
  }
}

// Exportar uma instância única para uso em toda a aplicação
export const CorsProxy = new CorsProxyService();
