/**
 * RouletteHistory.js
 * Modelo para gerenciar o histórico de números de roletas
 * Armazena até 1000 entradas para cada roleta
 */

class RouletteHistory {
  /**
   * Inicializa o modelo de histórico de roletas
   * @param {Object} db - Instância do MongoDB
   */
  constructor(db) {
    if (!db) {
      throw new Error('Instância de banco de dados obrigatória');
    }
    
    this.db = db;
    this.collection = db.collection('roulette_history');
    
    // Garantir que temos índices necessários
    this.ensureIndexes();
  }
  
  /**
   * Cria índices necessários na coleção
   */
  async ensureIndexes() {
    try {
      await this.collection.createIndex({ roletaId: 1 });
      await this.collection.createIndex({ timestamp: -1 });
      console.log('[RouletteHistory] Índices criados com sucesso');
    } catch (error) {
      console.error('[RouletteHistory] Erro ao criar índices:', error);
    }
  }
  
  /**
   * Adiciona um novo número ao histórico de uma roleta
   * @param {string} roletaId - ID da roleta
   * @param {string} roletaNome - Nome da roleta
   * @param {number} numero - Número sorteado
   * @returns {Promise<boolean>} - Sucesso da operação
   */
  async addNumberToHistory(roletaId, roletaNome, numero) {
    try {
      if (!roletaId || numero === undefined) {
        console.error('[RouletteHistory] ID da roleta e número são obrigatórios');
        return false;
      }
      
      // Converte para número se necessário
      const numeroInt = parseInt(numero, 10);
      
      if (isNaN(numeroInt)) {
        console.error(`[RouletteHistory] Número inválido: ${numero}`);
        return false;
      }
      
      // Encontra o documento de histórico da roleta
      const historyDoc = await this.collection.findOne({ roletaId });
      
      const timestamp = new Date();
      
      if (!historyDoc) {
        // Primeiro registro para esta roleta
        await this.collection.insertOne({
          roletaId,
          roletaNome,
          createdAt: timestamp,
          updatedAt: timestamp,
          numeros: [{ 
            numero: numeroInt, 
            timestamp 
          }]
        });
        
        console.log(`[RouletteHistory] Criado histórico para roleta ${roletaId} com primeiro número ${numeroInt}`);
      } else {
        // Adicionar ao histórico existente
        await this.collection.updateOne(
          { roletaId },
          { 
            $push: { 
              numeros: { 
                $each: [{ numero: numeroInt, timestamp }],
                $position: 0,  // Adiciona no início do array
                $slice: 1000   // Mantém apenas os 1000 mais recentes
              } 
            },
            $set: { 
              updatedAt: timestamp,
              roletaNome: roletaNome || historyDoc.roletaNome // Atualiza o nome da roleta se fornecido
            }
          }
        );
        
        console.log(`[RouletteHistory] Adicionado número ${numeroInt} ao histórico da roleta ${roletaId}`);
      }
      
      return true;
    } catch (error) {
      console.error('[RouletteHistory] Erro ao adicionar número:', error);
      return false;
    }
  }
  
  /**
   * Importa múltiplos números para o histórico de uma roleta
   * @param {string} roletaId - ID da roleta
   * @param {string} roletaNome - Nome da roleta
   * @param {Array<number>} numeros - Array de números sorteados
   * @returns {Promise<boolean>} - Sucesso da operação
   */
  async importNumbers(roletaId, roletaNome, numeros) {
    try {
      if (!roletaId || !Array.isArray(numeros)) {
        console.error('[RouletteHistory] ID da roleta e array de números são obrigatórios');
        return false;
      }
      
      // Validar e converter todos os números
      const numerosValidos = numeros
        .map(num => parseInt(num, 10))
        .filter(num => !isNaN(num));
      
      if (numerosValidos.length === 0) {
        console.error('[RouletteHistory] Nenhum número válido para importar');
        return false;
      }
      
      const timestamp = new Date();
      
      // Mapear números para o formato de armazenamento
      // Criamos timestamps artificiais com diferença de 1ms entre os números
      const numerosFormatados = numerosValidos.map((numero, index) => ({
        numero,
        timestamp: new Date(timestamp.getTime() - (index * 1000)) // 1 segundo de diferença entre cada número
      }));
      
      // Verificar se já existe histórico para esta roleta
      const historyDoc = await this.collection.findOne({ roletaId });
      
      if (!historyDoc) {
        // Primeiro registro para esta roleta
        await this.collection.insertOne({
          roletaId,
          roletaNome,
          createdAt: timestamp,
          updatedAt: timestamp,
          numeros: numerosFormatados.slice(0, 1000) // Limitar a 1000 números
        });
        
        console.log(`[RouletteHistory] Criado histórico para roleta ${roletaId} com ${numerosFormatados.length} números importados`);
      } else {
        // Combinar histórico existente com novos números
        const historicoExistente = historyDoc.numeros || [];
        
        // Unir os arrays de números e ordenar por timestamp (mais recente primeiro)
        const todosNumeros = [...numerosFormatados, ...historicoExistente]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 1000); // Limitar a 1000 números
        
        // Atualizar o documento com os números combinados
        await this.collection.updateOne(
          { roletaId },
          { 
            $set: { 
              numeros: todosNumeros,
              updatedAt: timestamp,
              roletaNome: roletaNome || historyDoc.roletaNome // Atualiza o nome da roleta se fornecido
            }
          }
        );
        
        console.log(`[RouletteHistory] Importados ${numerosFormatados.length} números para roleta ${roletaId}`);
      }
      
      return true;
    } catch (error) {
      console.error('[RouletteHistory] Erro ao importar números:', error);
      return false;
    }
  }
  
  /**
   * Obtém todo o histórico de uma roleta
   * @param {string} roletaId - ID da roleta
   * @returns {Promise<Object>} - Objeto com os dados do histórico
   */
  async getHistoryByRouletteId(roletaId) {
    try {
      if (!roletaId) {
        console.error('[RouletteHistory] ID da roleta é obrigatório');
        return { error: 'ID da roleta não fornecido' };
      }
      
      const historyDoc = await this.collection.findOne({ roletaId });
      
      if (!historyDoc) {
        return {
          roletaId,
          numeros: [],
          message: 'Nenhum histórico encontrado para esta roleta'
        };
      }
      
      return {
        roletaId: historyDoc.roletaId,
        roletaNome: historyDoc.roletaNome,
        numeros: historyDoc.numeros || [],
        createdAt: historyDoc.createdAt,
        updatedAt: historyDoc.updatedAt,
        totalRegistros: historyDoc.numeros ? historyDoc.numeros.length : 0
      };
    } catch (error) {
      console.error('[RouletteHistory] Erro ao buscar histórico:', error);
      return { error: 'Erro ao buscar histórico', details: error.message };
    }
  }
  
  /**
   * Limpa o histórico de uma roleta específica
   * @param {string} roletaId - ID da roleta
   * @returns {Promise<boolean>} - Sucesso da operação
   */
  async clearHistory(roletaId) {
    try {
      if (!roletaId) {
        console.error('[RouletteHistory] ID da roleta é obrigatório');
        return false;
      }
      
      const resultado = await this.collection.updateOne(
        { roletaId },
        { 
          $set: { 
            numeros: [],
            updatedAt: new Date() 
          }
        }
      );
      
      if (resultado.matchedCount === 0) {
        console.log(`[RouletteHistory] Nenhum histórico encontrado para roleta ${roletaId}`);
        return true; // Considerar sucesso se não havia histórico
      }
      
      console.log(`[RouletteHistory] Histórico da roleta ${roletaId} foi limpo`);
      return true;
    } catch (error) {
      console.error('[RouletteHistory] Erro ao limpar histórico:', error);
      return false;
    }
  }
  
  /**
   * Obtém estatísticas básicas sobre as roletas com histórico
   * @returns {Promise<Object>} - Estatísticas das roletas
   */
  async getHistoryStats() {
    try {
      const totalDocs = await this.collection.countDocuments();
      
      // Agregação para estatísticas básicas
      const stats = await this.collection.aggregate([
        {
          $project: {
            roletaId: 1,
            roletaNome: 1,
            totalNumeros: { $size: { $ifNull: ["$numeros", []] } },
            ultimaAtualizacao: "$updatedAt"
          }
        },
        { $sort: { ultimaAtualizacao: -1 } }
      ]).toArray();
      
      return {
        totalRoletas: totalDocs,
        roletas: stats
      };
    } catch (error) {
      console.error('[RouletteHistory] Erro ao buscar estatísticas:', error);
      return { error: 'Erro ao buscar estatísticas', details: error.message };
    }
  }
}

module.exports = RouletteHistory; 