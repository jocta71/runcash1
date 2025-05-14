/**
 * API de consulta de dados de roletas
 * Versão redesenhada - Arquitetura modular e simplificada
 */

const { MongoClient } = require('mongodb');

// -------------------- CONFIGURAÇÕES --------------------
const CONFIG = {
  // Configurações de IA
  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    timeout: 15000
  },
  
  // Configurações de banco de dados
  db: {
    uri: process.env.MONGODB_URI || "mongodb+srv://runcash:8867Jpp@runcash.gxi9yoz.mongodb.net/?retryWrites=true&w=majority&appName=runcash",
    name: process.env.ROLETAS_MONGODB_DB_NAME || 'roletas_db',
    metadataCollection: 'metadados_roletas',
    options: { 
      connectTimeoutMS: 10000, 
      socketTimeoutMS: 30000, 
      serverSelectionTimeoutMS: 10000 
    }
  },
  
  // Configurações de roleta
  roleta: {
    cores: {
      vermelhos: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
      pretos: [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]
    }
  }
};

// -------------------- SERVIÇO DE BANCO DE DADOS --------------------
class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.uri = CONFIG.db.uri;
    this.dbName = CONFIG.db.name;
    this.options = CONFIG.db.options;
  }
  
  async conectar() {
    if (this.db) return this.db;
    
    try {
      if (!this.client) {
        this.client = new MongoClient(this.uri, this.options);
        await this.client.connect();
      }
      
      this.db = this.client.db(this.dbName);
      return this.db;
    } catch (erro) {
      console.error('Erro ao conectar ao MongoDB:', erro.message);
      return null;
    }
  }
  
  async listarColecoes() {
    try {
      const collections = await this.db.listCollections().toArray();
      return collections.map(col => col.name);
    } catch (erro) {
      console.error('Erro ao listar coleções:', erro.message);
      return [];
    }
  }
  
  async obterColecao(nome) {
    return this.db.collection(nome);
  }
}

// -------------------- SERVIÇO DE ROLETAS --------------------
class RoletaService {
  constructor(db) {
    this.db = db;
    this.metadataCollection = CONFIG.db.metadataCollection;
  }
  
  // Extrai ID de roleta do texto da consulta
  extrairIdDaConsulta(texto) {
    if (!texto) return null;
    
    const padroes = [
      /roleta\s+(\d{7})/i,         // "roleta 2010011"
      /roulette\s+(\d{7})/i,       // "roulette 2010011"
      /\s(\d{7})(?![0-9])/,        // " 2010011" (com espaço antes)
      /^(\d{7})(?![0-9])/,         // "2010011" (início da string)
      /da\s+(\d{7})(?![0-9])/i,    // "da 2010011"
      /id[:\s]+(\d{7})(?![0-9])/i  // "id: 2010011" ou "ID 2010011"
    ];
    
    for (const padrao of padroes) {
      const match = texto.match(padrao);
      if (match && match[1]) return match[1];
    }
    
    return null;
  }
  
  // Extrai nome da roleta do texto da consulta
  extrairNomeDaConsulta(texto) {
    if (!texto) return null;
    
    // Lista de roletas comuns
    const nomesRoletas = [
      // Evolution Gaming
      "Immersive Roulette", "Lightning Roulette", "XXXtreme Lightning Roulette",
      "Speed Auto Roulette", "Auto-Roulette", "Bucharest Auto-Roulette",
      "Auto-Roulette VIP", "Gold Vault Roulette", "Deutsches Roulette",
      "American Roulette", "Jawhara Roulette", "Dansk Roulette",
      "Ruletka Live", "Bucharest Roulette", "Instant Roulette",
      "Football Studio Roulette", "Venezia Roulette", "Türkçe Rulet",
      "Dragonara Roulette", "Hippodrome Grand Casino", "Ruleta Relámpago en Vivo",
      "Roulette", "Lightning Roulette Italia", "Türkçe Lightning Rulet",
      
      // Pragmatic
      "Brazilian Mega Roulette", "Mega Roulette", "Speed Roulette 1",
      "Russian Roulette", "German Roulette", "Roulette Italia Tricolore",
      "Roulette Macao", "Turkish Roulette", "Roulette 1",
      "VIP Roulette", "Romanian Roulette", "VIP Auto Roulette",
      "Fortune Roulette", "Immersive Roulette Deluxe"
    ];
    
    // Verificar se algum nome de roleta está presente na consulta
    for (const nome of nomesRoletas) {
      const regex = new RegExp(nome.replace(/\s+/g, '\\s+'), 'i');
      if (regex.test(texto)) {
        return nome;
      }
    }
    
    // Verificar por nomes parciais ou abreviados
    const mapeamentoNomesParciais = {
      "lightning": "Lightning Roulette",
      "imersiva": "Immersive Roulette",
      "brasileira": "Brazilian Mega Roulette",
      "mega brasileira": "Brazilian Mega Roulette",
      "speed auto": "Speed Auto Roulette",
      "speed": "Speed Auto Roulette",
      "auto vip": "Auto-Roulette VIP",
      "auto": "Auto-Roulette",
      "xxxtreme": "XXXtreme Lightning Roulette",
      "gold vault": "Gold Vault Roulette",
      "mega": "Mega Roulette"
    };
    
    const textoLower = texto.toLowerCase();
    for (const [parcial, nomeCompleto] of Object.entries(mapeamentoNomesParciais)) {
      if (textoLower.includes(parcial)) {
        return nomeCompleto;
      }
    }
    
    return null;
  }
  
  // Lista todas as coleções numéricas (roletas)
  async listarColecoesNumericas() {
    const collections = await this.db.listCollections().toArray();
    return collections
      .map(col => col.name)
      .filter(name => /^\d+$/.test(name));
  }
  
  // Obtém metadados de todas as roletas
  async obterMetadados() {
    try {
      // Primeiro tenta buscar da coleção 'metadados_roletas'
      if (await this.colecaoExiste(this.metadataCollection)) {
        const metadados = await this.db.collection(this.metadataCollection)
          .find({})
          .project({ roleta_id: 1, roleta_nome: 1, _id: 0 })
          .toArray();
        
        if (metadados && metadados.length > 0) {
          return metadados;
        }
      }
      
      // Se não encontrar, tenta da coleção 'metadados'
      if (await this.colecaoExiste("metadados")) {
        return await this.db.collection("metadados")
          .find({})
          .project({ roleta_id: 1, roleta_nome: 1, _id: 0 })
          .toArray();
      }
      
      return [];
    } catch (erro) {
      console.error('Erro ao buscar metadados:', erro.message);
      return [];
    }
  }
  
  // Verifica se uma coleção existe
  async colecaoExiste(nomeColeção) {
    const colecoes = await this.db.listCollections().toArray();
    return colecoes.some(col => col.name === nomeColeção);
  }
  
  // Obtém metadados por ID
  async obterMetadadosPorId(id) {
    try {
      // Primeiro tenta na coleção configurada
      if (await this.colecaoExiste(this.metadataCollection)) {
        const metadado = await this.db.collection(this.metadataCollection)
          .findOne({ roleta_id: id });
        
        if (metadado) return metadado;
      }
      
      // Se não encontrar, tenta na coleção 'metadados'
      if (await this.colecaoExiste("metadados")) {
        return await this.db.collection("metadados")
          .findOne({ roleta_id: id });
      }
      
      return null;
    } catch (erro) {
      console.error(`Erro ao buscar metadados por ID ${id}:`, erro.message);
      return null;
    }
  }
  
  // Obtém metadados por nome
  async obterMetadadosPorNome(nome) {
    try {
      // Primeiro tenta na coleção configurada com correspondência exata
      if (await this.colecaoExiste(this.metadataCollection)) {
        const metadado = await this.db.collection(this.metadataCollection)
          .findOne({ roleta_nome: nome });
        
        if (metadado) return metadado;
        
        // Se não encontrou com correspondência exata, tenta com regex para correspondência parcial
        const metadadoRegex = await this.db.collection(this.metadataCollection)
          .findOne({ roleta_nome: { $regex: nome, $options: 'i' } });
        
        if (metadadoRegex) return metadadoRegex;
      }
      
      // Se não encontrar, tenta na coleção 'metadados'
      if (await this.colecaoExiste("metadados")) {
        const metadado = await this.db.collection("metadados")
          .findOne({ roleta_nome: nome });
        
        if (metadado) return metadado;
        
        // Tenta com regex para correspondência parcial
        return await this.db.collection("metadados")
          .findOne({ roleta_nome: { $regex: nome, $options: 'i' } });
      }
      
      return null;
    } catch (erro) {
      console.error(`Erro ao buscar metadados por nome "${nome}":`, erro.message);
      return null;
    }
  }
  
  // Obtém números de uma coleção
  async obterNumeros(colecaoId, limite = 1000) {
    try {
      const docs = await this.db.collection(colecaoId)
        .find({})
        .sort({ timestamp: -1 })
        .limit(limite)
        .toArray();
      
      if (!docs || docs.length === 0) return null;
      
      return docs
        .map(doc => {
          const num = doc.numero || doc.number;
          return typeof num === 'number' ? num : parseInt(num);
        })
        .filter(n => !isNaN(n));
    } catch (erro) {
      console.error(`Erro ao buscar números da coleção ${colecaoId}:`, erro.message);
      return null;
    }
  }
  
  // Calcula estatísticas dos números
  calcularEstatisticas(numeros) {
    if (!numeros || numeros.length === 0) return null;
    
    // Contagem de cada número
    const contagem = {};
    numeros.forEach(n => contagem[n] = (contagem[n] || 0) + 1);
    
    const zeroCount = numeros.filter(n => n === 0).length;
    let redCount = 0, blackCount = 0, evenCount = 0, oddCount = 0;
    
    numeros.forEach(n => {
      if (n === 0) return;
      if (CONFIG.roleta.cores.vermelhos.includes(n)) redCount++;
      else if (CONFIG.roleta.cores.pretos.includes(n)) blackCount++;
      if (n % 2 === 0) evenCount++;
      else oddCount++;
    });
    
    const totalSemZero = numeros.length - zeroCount;
    
    // Função para calcular percentagem
    const calcPct = (count, total) => {
      return total > 0 ? ((count / total) * 100).toFixed(2) : "0.00";
    };
    
    // Números mais frequentes
    const numerosQuentes = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([num, count]) => ({ number: parseInt(num), count }));
    
    // Números menos frequentes
    const numerosFrios = Object.entries(contagem)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5)
      .map(([num, count]) => ({ number: parseInt(num), count }));
    
    return {
      totalNumeros: numeros.length,
      numerosRecentes: numeros.slice(0, 50),
      estatisticas: {
        zeroCount,
        redCount,
        blackCount,
        evenCount,
        oddCount,
        zeroPercentage: calcPct(zeroCount, numeros.length),
        redPercentage: calcPct(redCount, totalSemZero),
        blackPercentage: calcPct(blackCount, totalSemZero),
        evenPercentage: calcPct(evenCount, totalSemZero),
        oddPercentage: calcPct(oddCount, totalSemZero)
      },
      numerosQuentes,
      numerosFrios,
      ultimoZero: numeros.indexOf(0)
    };
  }
  
  // Obtém detalhes completos de uma roleta
  async obterDetalhesRoleta(roletaId, roletaNome) {
    let colecaoId = null;
    let nomeRoleta = null;
    const isConsultaEspecifica = Boolean(roletaId || roletaNome);
    
    // 1. Determinar qual roleta buscar (priorizar busca por nome)
    if (roletaNome) {
      console.log(`Buscando roleta por nome: "${roletaNome}"`);
      const metadados = await this.obterMetadadosPorNome(roletaNome);
      
      if (!metadados) {
        return {
          identificador: roletaNome,
          erro: `Roleta com nome "${roletaNome}" não encontrada nos metadados`
        };
      }
      
      colecaoId = metadados.roleta_id || metadados.colecao;
      nomeRoleta = metadados.roleta_nome;
      console.log(`Roleta encontrada por nome: ${nomeRoleta} (ID: ${colecaoId})`);
    }
    else if (roletaId) {
      console.log(`Buscando roleta por ID: "${roletaId}"`);
      colecaoId = roletaId.toString().trim().replace(/^ID:/, '');
      const metadados = await this.obterMetadadosPorId(colecaoId);
      nomeRoleta = metadados?.roleta_nome;
      
      if (metadados) {
        console.log(`Roleta encontrada por ID: ${nomeRoleta || 'Sem nome'} (ID: ${colecaoId})`);
      }
    }
    else {
      // Sem ID ou nome, listar todas as coleções disponíveis
      console.log(`Sem ID ou nome específico, buscando coleções disponíveis`);
      
      // Primeiro verificar os metadados
      const metadados = await this.obterMetadados();
      if (metadados && metadados.length > 0) {
        // Usar a primeira roleta dos metadados
        const primeiraRoleta = metadados[0];
        colecaoId = primeiraRoleta.roleta_id || primeiraRoleta.colecao;
        nomeRoleta = primeiraRoleta.roleta_nome;
        console.log(`Usando primeira roleta dos metadados: ${nomeRoleta} (ID: ${colecaoId})`);
      } else {
        // Se não encontrou metadados, usar coleções numéricas
        const colecoes = await this.listarColecoesNumericas();
        
        if (colecoes.length === 0) {
          return {
            identificador: 'geral',
            erro: 'Nenhuma coleção de roleta encontrada'
          };
        }
        
        colecaoId = colecoes[0];
        console.log(`Usando primeira coleção disponível: ${colecaoId}`);
        
        // Tentar obter metadados para esta coleção
        const metadados = await this.obterMetadadosPorId(colecaoId);
        nomeRoleta = metadados?.roleta_nome;
      }
    }
    
    // 2. Identificador para a resposta
    const identificador = nomeRoleta 
      ? `${nomeRoleta} (ID: ${colecaoId})` 
      : `Roleta ${colecaoId}`;
    
    // 3. Verificar se a coleção existe
    const colecoes = await this.listarColecoesNumericas();
    
    if (!colecaoId || !colecoes.includes(colecaoId)) {
      return {
        identificador,
        erro: `Coleção de dados para ${identificador} não encontrada`
      };
    }
    
    // 4. Buscar números da coleção
    let numeros = await this.obterNumeros(colecaoId);
    
    // 5. Se não há números e é uma consulta específica, retornar erro
    if (!numeros && isConsultaEspecifica) {
      return {
        identificador,
        erro: `Não foram encontrados dados numéricos para ${identificador}`
      };
    }
    
    // 6. Se não há números e não é consulta específica, buscar outra coleção
    if (!numeros && !isConsultaEspecifica) {
      console.log(`Não foram encontrados dados para ${identificador}, tentando outras coleções`);
      
      // Tentar outras coleções
      for (const outroId of colecoes) {
        if (outroId === colecaoId) continue;
        
        numeros = await this.obterNumeros(outroId);
        
        if (numeros) {
          colecaoId = outroId;
          const metadados = await this.obterMetadadosPorId(colecaoId);
          nomeRoleta = metadados?.roleta_nome;
          
          // Atualizar identificador
          const novoIdentificador = nomeRoleta 
            ? `${nomeRoleta} (ID: ${colecaoId})` 
            : `Roleta ${colecaoId}`;
            
          console.log(`Usando roleta alternativa: ${novoIdentificador}`);
          break;
        }
      }
    }
    
    // 7. Se ainda não há números, retornar erro
    if (!numeros) {
      return {
        identificador,
        erro: 'Não foram encontrados dados numéricos para nenhuma roleta'
      };
    }
    
    // 8. Calcular estatísticas e retornar resultado completo
    const stats = this.calcularEstatisticas(numeros);
    const identificadorFinal = nomeRoleta 
      ? `${nomeRoleta} (ID: ${colecaoId})` 
      : `Roleta ${colecaoId}`;
    
    return {
      identificador: identificadorFinal,
      totalNumeros: stats.totalNumeros,
      numerosRecentes: stats.numerosRecentes,
      estatisticas: stats.estatisticas,
      numerosQuentes: stats.numerosQuentes,
      numerosFrios: stats.numerosFrios,
      ultimoZero: stats.ultimoZero
    };
  }
  
  // Lista todas as roletas disponíveis
  async listarRoletas() {
    // 1. Obter metadados
    const metadados = await this.obterMetadados();
    
    // 2. Obter coleções numéricas
    const colecoes = await this.listarColecoesNumericas();
    
    // 3. Se temos metadados, usá-los para informações completas
    if (metadados && metadados.length > 0) {
      // Verificar quais coleções realmente existem
      const roletasAtivas = metadados.filter(r => {
        const id = r.roleta_id || r.colecao;
        return id && colecoes.includes(id);
      });
      
      if (roletasAtivas.length > 0) {
        return {
          tipo: 'metadados',
          roletas: roletasAtivas.map(r => `${r.roleta_nome || 'Sem nome'} (ID: ${r.roleta_id || r.colecao})`)
        };
      }
    }
    
    // 4. Se não temos metadados ou nenhuma roleta ativa, usar coleções diretas
    if (colecoes && colecoes.length > 0) {
      // Para cada coleção, tentar encontrar seu nome nos metadados
      const roletasInfo = await Promise.all(colecoes.map(async (colecaoId) => {
        const metadado = await this.obterMetadadosPorId(colecaoId);
        return {
          id: colecaoId,
          nome: metadado?.roleta_nome || `Roleta ${colecaoId}`
        };
      }));
      
      return {
        tipo: 'colecoes',
        roletas: roletasInfo.map(r => `${r.nome} (ID: ${r.id})`)
      };
    }
    
    // 5. Nenhuma roleta encontrada
    return {
      tipo: 'vazio',
      roletas: []
    };
  }
}

// -------------------- SERVIÇO DE IA --------------------
class IAService {
  constructor() {
    this.provider = CONFIG.ai.provider;
    this.apiKey = CONFIG.ai.apiKey;
    this.model = CONFIG.ai.model;
    this.timeout = CONFIG.ai.timeout;
    this.apiUrl = `https://generativelanguage.googleapis.com/v1/models/${this.model}:generateContent`;
  }
  
  async processar(pergunta, dadosRoleta) {
    if (!this.apiKey) {
      throw new Error('Chave da API de IA não configurada');
    }
    
    // Se há erro nos dados da roleta, retornar o erro diretamente
    if (dadosRoleta.erro) {
      return dadosRoleta.erro;
    }
    
    const prompt = this.construirPrompt(pergunta, dadosRoleta);
    
    const payload = {
      contents: [{ 
        role: "user", 
        parts: [{ text: prompt }] 
      }],
      generationConfig: { 
        temperature: 0.2, 
        maxOutputTokens: 500, 
        topP: 0.8, 
        topK: 40 
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
      ]
    };
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Status ${response.status}: ${errorData.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Resposta em formato inesperado');
      }
      
      return data.candidates[0].content.parts[0].text;
    } catch (erro) {
      if (erro.name === 'AbortError') {
        return 'Tempo limite excedido ao chamar a API do Gemini.';
      }
      return `Erro ao processar consulta: ${erro.message}`;
    }
  }
  
  construirPrompt(pergunta, dadosRoleta) {
    return `Você é um assistente especializado em análise de roleta de cassino.

Instruções:
1. Responda em português, de forma DIRETA e OBJETIVA.
2. Não inclua explicações desnecessárias ou introduções.
3. Use apenas os dados fornecidos, sem inventar informações.
4. Seja conciso e direto ao responder.

Dados da roleta ${dadosRoleta.identificador}:
${dadosRoleta.erro ? `• Erro: ${dadosRoleta.erro}` : `• Total de resultados: ${dadosRoleta.totalNumeros || 0}
${dadosRoleta.estatisticas ? `• Zeros: ${dadosRoleta.estatisticas.zeroCount} (${dadosRoleta.estatisticas.zeroPercentage}%)
• Vermelhos: ${dadosRoleta.estatisticas.redCount} (${dadosRoleta.estatisticas.redPercentage}%)
• Pretos: ${dadosRoleta.estatisticas.blackCount} (${dadosRoleta.estatisticas.blackPercentage}%)
• Pares: ${dadosRoleta.estatisticas.evenCount} (${dadosRoleta.estatisticas.evenPercentage}%)
• Ímpares: ${dadosRoleta.estatisticas.oddCount} (${dadosRoleta.estatisticas.oddPercentage}%)` : ''}
${dadosRoleta.numerosQuentes ? `• Números quentes: ${dadosRoleta.numerosQuentes.map(n => `${n.number} (${n.count}x)`).join(', ')}` : ''}
${dadosRoleta.numerosFrios ? `• Números frios: ${dadosRoleta.numerosFrios.map(n => `${n.number} (${n.count}x)`).join(', ')}` : ''}
${dadosRoleta.numerosRecentes ? `• Últimos números: ${dadosRoleta.numerosRecentes.slice(0, 10).join(', ')}...` : ''}`}

A pergunta do usuário é: "${pergunta}"

Responda diretamente e objetivamente, sem introduções ou contextualizações. Sempre informe ao usuário qual roleta está sendo analisada pelo nome no início da resposta.`;
  }
}

// -------------------- HANDLER PRINCIPAL --------------------
export default async function handler(req, res) {
  try {
    // 1. Validar método HTTP
    if (req.method !== 'POST') {
      return res.status(405).json({ mensagem: 'Método não permitido' });
    }
    
    // 2. Extrair e validar parâmetros
    let { query, roletaId, roletaNome } = req.body;
    
    if (!query) {
      return res.status(400).json({ mensagem: 'Parâmetro "query" é obrigatório' });
    }
    
    // 3. Inicializar serviços
    const dbService = new Database();
    const db = await dbService.conectar();
    
    if (!db) {
      return res.status(503).json({ 
        mensagem: 'Serviço temporariamente indisponível (MongoDB)', 
        erro: 'connection_failed' 
      });
    }
    
    const roletaService = new RoletaService(db);
    const iaService = new IAService();
    
    // 4. Extrair ID e Nome da roleta do texto se não fornecido
    if (!roletaId && !roletaNome) {
      // Primeiro tenta extrair nome
      const nomeExtraido = roletaService.extrairNomeDaConsulta(query);
      if (nomeExtraido) {
        roletaNome = nomeExtraido;
        console.log(`Nome da roleta extraído do texto: ${roletaNome}`);
      } else {
        // Se não encontrou nome, tenta extrair ID
        const idExtraido = roletaService.extrairIdDaConsulta(query);
        if (idExtraido) {
          roletaId = idExtraido;
          console.log(`ID da roleta extraído do texto: ${roletaId}`);
        }
      }
    }
    
    // 5. Verificar se é uma consulta para listar todas as roletas
    const isListQuery = ["todas roletas", "roletas disponíveis", "listar roletas", "quais roletas"]
      .some(keyword => query.toLowerCase().includes(keyword));
      
    if (isListQuery) {
      const listaRoletas = await roletaService.listarRoletas();
      
      let resposta;
      if (listaRoletas.tipo === 'metadados') {
        resposta = `Roletas disponíveis: ${listaRoletas.roletas.join(', ')}.`;
      } else if (listaRoletas.tipo === 'colecoes') {
        resposta = `Roletas disponíveis (IDs): ${listaRoletas.roletas.join(', ')}. (Nomes não encontrados)`;
      } else {
        resposta = "Nenhuma roleta encontrada no banco de dados.";
      }
      
      return res.status(200).json({
        response: resposta,
        debug: { 
          query, 
          rouletteIdentifier: "Todas as Roletas", 
          listaRoletas: listaRoletas.roletas 
        }
      });
    }
    
    // 6. Obter detalhes da roleta
    const detalhesRoleta = await roletaService.obterDetalhesRoleta(roletaId, roletaNome);
    
    // 7. Se for consulta específica e houver erro, retornar sem processar com IA
    if (detalhesRoleta.erro && (roletaId || roletaNome)) {
      return res.status(200).json({
        response: detalhesRoleta.erro,
        debug: {
          query,
          rouletteIdentifier: detalhesRoleta.identificador,
          error: detalhesRoleta.erro,
          stats: { zeroCount: 0, totalNumbers: 0 },
          ai_config: { provider: CONFIG.ai.provider, model: CONFIG.ai.model }
        }
      });
    }
    
    // 8. Processar a consulta com a IA
    const respostaAI = await iaService.processar(query, detalhesRoleta);
    
    // 9. Retornar resposta
    return res.status(200).json({
      response: respostaAI,
      debug: {
        query,
        rouletteIdentifier: detalhesRoleta.identificador,
        stats: { 
          zeroCount: detalhesRoleta.estatisticas?.zeroCount || 0, 
          totalNumbers: detalhesRoleta.totalNumeros || 0 
        },
        ai_config: { provider: CONFIG.ai.provider, model: CONFIG.ai.model }
      }
    });
  } catch (erro) {
    console.error('Erro geral no handler:', erro);
    return res.status(500).json({ 
      mensagem: 'Erro interno no servidor', 
      erro: erro.message 
    });
  }
} 