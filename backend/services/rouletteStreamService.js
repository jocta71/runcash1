/**
 * Serviço de streaming de dados de roletas usando SSE (Server-Sent Events)
 * Similar ao modelo usado por tipminer e outros concorrentes
 */

const Iron = require('@hapi/iron');
const crypto = require('crypto');

class RouletteStreamService {
  constructor() {
    this.clients = new Map(); // Mapa de clientes conectados
    this.eventId = 0; // ID sequencial para os eventos
    this.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'runcash_default_encryption_key_2024';
    this.lastBroadcastTime = 0;
    this.lastBroadcastData = null;
    
    // Inicializar monitoramento de conexões
    this.setupConnectionMonitoring();
  }

  /**
   * Configura o monitoramento de conexões
   */
  setupConnectionMonitoring() {
    // A cada 30 segundos, verificar se há clientes desconectados
    setInterval(() => {
      this.checkConnections();
    }, 30000);
  }

  /**
   * Verifica conexões para remover clientes desconectados
   */
  checkConnections() {
    const initialCount = this.clients.size;
    
    if (initialCount === 0) return;
    
    console.log(`[SSE] Verificando ${initialCount} conexões...`);
    
    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (client.res.writableEnded || !client.res.writable) {
          console.log(`[SSE] Removendo cliente desconectado: ${clientId}`);
          this.clients.delete(clientId);
        }
      } catch (error) {
        console.error(`[SSE] Erro ao verificar cliente ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
    
    const removedCount = initialCount - this.clients.size;
    if (removedCount > 0) {
      console.log(`[SSE] Removidos ${removedCount} clientes desconectados.`);
    }
  }

  /**
   * Adiciona um novo cliente à lista de conexões
   * @param {Object} client - Objeto com informações do cliente
   * @param {Response} client.res - Objeto de resposta Express
   * @param {Object} client.user - Informações do usuário (se autenticado)
   * @param {boolean} client.needsEncryption - Se os dados precisam ser criptografados
   */
  addClient(client) {
    const clientId = crypto.randomUUID();
    
    console.log(`[SSE] Novo cliente conectado: ${clientId}`);
    console.log(`[SSE] Tipo de cliente: ${client.user?.role || 'anônimo'}`);
    
    // Configurar o cabeçalho para SSE
    client.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'  // Ajustar conforme necessário
    });
    
    // Enviar evento inicial para confirmar conexão
    client.res.write(`id: 0\n`);
    client.res.write(`event: connected\n`);
    client.res.write(`data: ${JSON.stringify({ message: 'Conectado ao stream de roletas' })}\n\n`);
    
    // Armazenar o cliente
    this.clients.set(clientId, client);
    
    // Configurar evento de fechamento para limpar quando o cliente desconectar
    client.res.on('close', () => {
      console.log(`[SSE] Cliente desconectado: ${clientId}`);
      this.clients.delete(clientId);
    });
    
    // Se tivermos dados recentes, enviar imediatamente para o novo cliente
    if (this.lastBroadcastData && Date.now() - this.lastBroadcastTime < 60000) {
      try {
        console.log(`[SSE] Enviando dados recentes para novo cliente ${clientId}`);
        setTimeout(() => {
          this.sendUpdateToClient(client, this.lastBroadcastData, this.eventId + 1);
        }, 1000); // Pequeno atraso para garantir que o cliente esteja pronto
      } catch (error) {
        console.error(`[SSE] Erro ao enviar dados iniciais para ${clientId}:`, error);
      }
    }
    
    return clientId;
  }

  /**
   * Envia dados para todos os clientes conectados
   * @param {Object} data - Dados a serem enviados
   */
  broadcastUpdate(data) {
    this.eventId++;
    this.lastBroadcastTime = Date.now();
    this.lastBroadcastData = data;
    
    if (this.clients.size === 0) {
      return; // Nenhum cliente conectado
    }
    
    console.log(`[SSE] Enviando atualização para ${this.clients.size} clientes. EventID: ${this.eventId}`);
    
    // Contador para sucesso/falha
    let successCount = 0;
    let failCount = 0;
    
    // Processar cada cliente
    for (const [clientId, client] of this.clients.entries()) {
      try {
        // Verificar se o cliente ainda está conectado
        if (client.res.writableEnded || !client.res.writable) {
          console.log(`[SSE] Removendo cliente desconectado: ${clientId}`);
          this.clients.delete(clientId);
          failCount++;
          continue;
        }
        
        // Processar dados conforme tipo de cliente
        this.sendUpdateToClient(client, data, this.eventId);
        successCount++;
      } catch (error) {
        console.error(`[SSE] Erro ao enviar para cliente ${clientId}:`, error);
        // Remover cliente em caso de erro
        this.clients.delete(clientId);
        failCount++;
      }
    }
    
    console.log(`[SSE] Broadcast concluído: ${successCount} sucesso, ${failCount} falhas`);
  }

  /**
   * Envia atualização para um cliente específico, aplicando criptografia se necessário
   * @param {Object} client - Objeto do cliente
   * @param {Object} data - Dados a serem enviados
   * @param {number} eventId - ID do evento
   */
  async sendUpdateToClient(client, data, eventId) {
    // Os dados agora são sempre enviados descriptografados via SSE
    let finalData = data;
    
    try {
      // Adicionar timestamp para todos os eventos
      if (typeof finalData === 'object' && finalData !== null) {
        finalData._timestamp = Date.now();
      }
      
      // Formatar a mensagem no padrão SSE
      const dataString = JSON.stringify(finalData);
      client.res.write(`id: ${eventId}\n`);
      client.res.write(`event: update\n`);
      client.res.write(`data: ${dataString}\n\n`);
    } catch (error) {
      console.error('[SSE] Erro ao processar/enviar dados:', error);
      // Tentar enviar um evento de erro como fallback
      try {
        client.res.write(`id: ${eventId}\n`);
        client.res.write(`event: error\n`);
        client.res.write(`data: ${JSON.stringify({ error: 'Erro ao processar dados' })}\n\n`);
      } catch (e) {
        // Se falhar ao enviar o erro, provavelmente a conexão está morta
        throw new Error('Falha completa na conexão');
      }
    }
  }

  /**
   * Determina se os dados devem ser criptografados para um cliente específico
   * @param {Object} client - Objeto do cliente
   * @returns {boolean} - Se os dados devem ser criptografados
   */
  shouldEncryptForClient(client) {
    // Admin ou clientes com chave de acesso válida não precisam de criptografia
    if (client.user && client.user.role === 'admin') {
      return false;
    }
    
    // Usuários com assinatura ativa e chave de acesso válida não precisam de criptografia
    if (client.user && 
        client.user.subscription && 
        client.user.subscription.status === 'active' && 
        client.user.hasValidAccessKey) {
      return false;
    }
    
    // Para todos os outros, criptografar
    return true;
  }

  /**
   * Criptografa os dados no formato similar ao observado no concorrente
   * @param {Object} data - Dados a serem criptografados
   * @returns {string} - Dados criptografados
   */
  async encryptData(data) {
    try {
      // Adicionar timestamp e validade para prevenir ataques de replay
      const dataWithMeta = {
        data: data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (1000 * 60 * 10) // 10 minutos
      };
      
      // Método 1: Usar Iron (como estava no encryptRouletteData)
      // const encryptedData = await Iron.seal(dataWithMeta, this.ENCRYPTION_KEY, Iron.defaults);
      
      // Método 2: Criptografia mais simples para emular o formato visto no concorrente
      // Gerar um formato de string similar ao visto na imagem do concorrente
      const jsonStr = JSON.stringify(dataWithMeta);
      const buffer = Buffer.from(jsonStr, 'utf8');
      const key = crypto.createHash('sha256').update(this.ENCRYPTION_KEY).digest();
      
      // Criar um IV único para cada mensagem
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Criptografar
      let encrypted = cipher.update(buffer);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Formato semelhante ao do concorrente: "Fe26.2*[dados crypto]*[iv]*[hash]"
      return `Fe26.2*${iv.toString('hex')}*${encrypted.toString('base64')}`;
    } catch (error) {
      console.error('[SSE] Erro ao criptografar dados:', error);
      return JSON.stringify({ error: 'Falha na criptografia' });
    }
  }

  /**
   * Recupera o número de clientes conectados
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * Retorna o timestamp da última transmissão
   */
  getLastBroadcastTime() {
    return this.lastBroadcastTime;
  }

  /**
   * Envia um evento de teste para verificar se o sistema está funcionando
   */
  sendTestEvent() {
    const testData = {
      type: 'test',
      timestamp: Date.now(),
      message: 'Teste de funcionamento do sistema'
    };
    
    this.broadcastUpdate(testData);
    return true;
  }

  /**
   * Fecha todas as conexões
   */
  closeAllConnections() {
    console.log(`[SSE] Fechando todas as ${this.clients.size} conexões`);
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.res.end();
      } catch (error) {
        console.error(`[SSE] Erro ao fechar conexão ${clientId}:`, error);
      }
    }
    this.clients.clear();
  }
}

// Exportar instância única (singleton)
const rouletteStreamService = new RouletteStreamService();
module.exports = rouletteStreamService; 