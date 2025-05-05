/**
 * Exemplo de cliente para consumir e descriptografar os dados da roleta
 * 
 * Este é um exemplo simples que ilustra como um cliente em JavaScript 
 * pode se conectar ao streaming de dados e descriptografar os resultados.
 */

// Biblioteca Iron para browser
// Na prática, você incluiria isto via npm/yarn/etc
// import * as Iron from '@hapi/iron/browser';
// Ou como um script: <script src="path/to/iron-browser.js"></script>

class RouletteClient {
  constructor(serverUrl, clientKey) {
    this.serverUrl = serverUrl;
    this.clientKey = clientKey;
    this.eventSource = null;
    this.masterKey = null; // Será derivado do clientKey
    this.onResultCallback = null;
    this.eventCounter = 0;
  }

  /**
   * Inicializa o cliente e se conecta ao servidor
   */
  async init() {
    try {
      // Derivar a chave mestra do clientKey
      // Na implementação real, você usaria o Iron.unseal para descriptografar
      // a chave mestra do clientKey recebido do servidor
      // Isso é apenas um placeholder para o exemplo
      this.masterKey = await this.deriveMasterKeyFromClientKey();
      
      console.log("Cliente de roleta inicializado");
    } catch (error) {
      console.error("Erro ao inicializar cliente de roleta:", error);
      throw error;
    }
  }

  /**
   * Método placeholder para derivar a chave mestra do clientKey
   * Na implementação real, isso seria feito usando a biblioteca Iron
   */
  async deriveMasterKeyFromClientKey() {
    // Simulação - na implementação real, você descriptografaria
    // o clientKey para obter a chave mestra
    return "wh4t3v3r-y0u-w4nt-th1s-t0-b3-32-ch4rs";
  }

  /**
   * Conecta ao stream de eventos da roleta
   * @param {string} tableId - ID da mesa da roleta
   */
  connect(tableId) {
    if (this.eventSource) {
      this.disconnect();
    }

    // Criar URL para conexão SSE
    const url = `${this.serverUrl}/api/roulettes/stream/rounds/ROULETTE/${tableId}/v2/live?k=${this.clientKey}`;
    
    this.eventSource = new EventSource(url);
    
    // Configurar handlers de eventos
    this.eventSource.onopen = () => {
      console.log(`Conectado ao stream da roleta: Mesa ${tableId}`);
    };
    
    this.eventSource.onerror = (error) => {
      console.error("Erro na conexão SSE:", error);
      this.reconnect(tableId);
    };
    
    // O evento 'update' contém os dados criptografados da roleta
    this.eventSource.addEventListener('update', async (event) => {
      try {
        this.eventCounter++;
        console.log(`Evento #${event.id || this.eventCounter} recebido`);
        
        // Descriptografar os dados
        const decryptedData = await this.decryptData(event.data);
        
        // Chamar o callback com os dados descriptografados
        if (this.onResultCallback) {
          this.onResultCallback(decryptedData);
        }
      } catch (error) {
        console.error("Erro ao processar evento da roleta:", error);
      }
    });
  }

  /**
   * Descriptografa os dados recebidos do servidor
   * @param {string} encryptedData - Dados criptografados no formato Fe26.2
   * @returns {Object} - Dados descriptografados
   */
  async decryptData(encryptedData) {
    try {
      // Na implementação real, você usaria o Iron.unseal
      // Simulação de descriptografia para o exemplo
      console.log("Descriptografando dados:", encryptedData.substring(0, 30) + "...");
      
      // Implementação fictícia - em produção use Iron.unseal
      // const decrypted = await Iron.unseal(encryptedData, this.masterKey, Iron.defaults);
      
      // Simulação para este exemplo
      const decrypted = {
        number: Math.floor(Math.random() * 37),
        color: ['red', 'black', 'green'][Math.floor(Math.random() * 3)],
        timestamp: new Date().toISOString()
      };
      
      return decrypted;
    } catch (error) {
      console.error("Erro ao descriptografar dados:", error);
      throw error;
    }
  }

  /**
   * Desconecta do stream de eventos
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log("Desconectado do stream da roleta");
    }
  }

  /**
   * Tenta reconectar em caso de erro
   * @param {string} tableId - ID da mesa
   */
  reconnect(tableId) {
    setTimeout(() => {
      console.log("Tentando reconectar...");
      this.connect(tableId);
    }, 3000); // Tenta reconectar após 3 segundos
  }

  /**
   * Registra um callback para ser chamado quando novos resultados forem recebidos
   * @param {Function} callback - Função a ser chamada com os dados descriptografados
   */
  onResult(callback) {
    this.onResultCallback = callback;
  }
}

// Exemplo de uso:
/*
async function main() {
  // Obter a chave de cliente do servidor (simulado aqui)
  const clientKey = "chave-obtida-do-servidor";
  
  // Criar e inicializar o cliente
  const rouletteClient = new RouletteClient("https://api.seusite.com", clientKey);
  await rouletteClient.init();
  
  // Registrar callback para novos resultados
  rouletteClient.onResult((result) => {
    console.log("Novo resultado da roleta:", result);
    updateUI(result); // Atualiza a interface do usuário
  });
  
  // Conectar ao stream de uma mesa específica
  rouletteClient.connect("mesa-id-123");
  
  // Para desconectar quando necessário:
  // rouletteClient.disconnect();
}

main().catch(console.error);
*/ 