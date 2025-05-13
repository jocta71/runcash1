/**
 * Utilitários centralizados para processamento de dados de roletas
 */

import { RouletteNumber } from '../types/roulette';

/**
 * Mapeia IDs específicos de roletas para seus nomes corretos
 * @param id ID da roleta 
 * @returns Nome correto da roleta ou null se não for encontrado
 */
export function mapRouletteIdToName(id: string): string | null {
  // Mapeamento de IDs conhecidos para nomes corretos
  const idNameMap: Record<string, string> = {
    "2010045": "Ruleta en Vivo",
    // Adicione outros mapeamentos de ID conforme necessário
  };
  
  return idNameMap[id] || null;
}

/**
 * Mapeia os nomes das roletas para URLs de imagens correspondentes
 * @param rouletteName Nome da roleta
 * @param provider Nome do provedor (Evolution ou Pragmatic Play)
 * @returns URL da imagem para a roleta
 */
export function getRouletteImage(rouletteName: string, provider: string): string {
  // Normaliza o nome da roleta para comparação
  const normalizedName = rouletteName.toLowerCase().trim();
  
  console.log(`Buscando imagem para roleta: "${normalizedName}", provedor: "${provider}"`);
  
  // URLs baseadas no provedor
  if (provider.toLowerCase().includes('pragmatic')) {
    // Mapeamento específico para roletas Pragmatic Play
    const pragmaticImageMap: Record<string, string> = {
      "fortune roulette": "https://client.pragmaticplaylive.net/desktop/assets/snaps/megaroulettbba91/poster.jpg?v=0.9804522165134438",
      "immersive roulette deluxe": "https://client.pragmaticplaylive.net/desktop/assets/snaps/25irclas25imrcrw/poster.jpg?v=0.9804522165134438",
      "vip auto roulette": "https://client.pragmaticplaylive.net/desktop/assets/snaps/ar25vipautorw251/poster.jpg?v=0.9804522165134438",
      "mega roulette": "https://client.pragmaticplaylive.net/desktop/assets/snaps/mrbras531mrbr532/poster.jpg?v=0.9804522165134438",
      "roulette 1": "https://client.pragmaticplaylive.net/desktop/assets/snaps/fl9knouu0yjez2wi/poster.jpg?v=0.9804522165134438",
      "romanian roulette": "https://client.pragmaticplaylive.net/desktop/assets/snaps/romania233rwl291/poster.jpg?v=0.9804522165134438",
      "brazilian mega roulette": "https://client.pragmaticplaylive.net/desktop/assets/snaps/mrbras531mrbr532/poster.jpg?v=0.9804522165134438",
      "speed roulette 1": "https://client.pragmaticplaylive.net/desktop/assets/snaps/fl9knouu0yjez2wi/poster.jpg?v=0.9804522165134438",
      "roulette macao": "https://client.pragmaticplaylive.net/desktop/assets/snaps/yqpz3ichst2xg439/poster.jpg?v=0.9804522165134438",
      "german roulette": "https://client.pragmaticplaylive.net/desktop/assets/snaps/s2x6b4jdeqza2ge2/poster.jpg?v=0.9804522165134438",
      "russian roulette": "https://client.pragmaticplaylive.net/desktop/assets/snaps/t4jzencinod6iqwi/poster.jpg?v=0.9804522165134438",
      "roulette italia tricolore": "https://client.pragmaticplaylive.net/desktop/assets/snaps/v1c52fgw7yy02upz/poster.jpg?v=0.9804522165134438",
      "turkish roulette": "https://bshots.egcvi.com/thumbnail/ezugi_221000_med_L.jpg"
    };

    // Ordena as chaves do mais específico (mais longo) para o mais genérico (mais curto)
    const orderedKeys = Object.keys(pragmaticImageMap).sort((a, b) => b.length - a.length);
    
    // Busca pelo nome mais específico primeiro
    for (const key of orderedKeys) {
      if (normalizedName.includes(key.toLowerCase())) {
        console.log(`Imagem encontrada para ${normalizedName}: ${pragmaticImageMap[key]}`);
        return pragmaticImageMap[key];
      }
    }
    
    // Fallback para Pragmatic Play
    console.log(`Usando imagem padrão da Pragmatic para ${normalizedName}`);
    return "https://client.pragmaticplaylive.net/desktop/assets/snaps/megaroulettbba91/poster.jpg?v=0.9804522165134438";
  } 
  else if (provider.toLowerCase().includes('evolution')) {
    // Imagens da Evolution com URLs reais
    const evolutionImageMap: Record<string, string> = {
      "lightning roulette": "https://bshots.egcvi.com/thumbnail/xfrt1_imr_med_L.jpg",
      "immersive roulette": "https://bshots.egcvi.com/thumbnail/immersive_med_L.jpg",
      "xxxtreme lightning roulette": "https://bshots.egcvi.com/thumbnail/xfrt1_imr_med_L.jpg",
      "gold vault roulette": "https://bshots.egcvi.com/thumbnail/goldvk1_imr_med_L.jpg",
      "dansk roulette": "https://bshots.egcvi.com/thumbnail/dgenm1_imr_med_L.jpg",
      "vip roulette": "https://bshots.egcvi.com/thumbnail/vipk1_imr_med_L.jpg",
      "ruleta relámpago en vivo": "https://bshots.egcvi.com/thumbnail/lightrs1_imrs_med_L.jpg",
      "ruleta en vivo": "https://bshots.egcvi.com/thumbnail/revmu1_imrs_med_L.jpg",
      "speed auto roulette": "https://bshots.egcvi.com/thumbnail/ezugi_221002_med_L.jpg",
      "bucharest auto-roulette": "https://bshots.egcvi.com/thumbnail/buc1_ss_thumb_med_L.jpg",
      "bucharest roulette": "https://bshots.egcvi.com/thumbnail/buc1_ss_thumb_med_L.jpg",
      "dragonara roulette": "https://bshots.egcvi.com/thumbnail/dgnm1_imr_med_L.jpg",
      "lightning roulette italia": "https://bshots.egcvi.com/thumbnail/lightm1_imrs_med_L.jpg",
      "venezia roulette": "https://bshots.egcvi.com/thumbnail/itm1_imrs_med_L.jpg",
      "auto-roulette vip": "https://bshots.egcvi.com/thumbnail/vip1_ss_thumb_med_L.jpg",
      "american roulette": "https://bshots.egcvi.com/thumbnail/dzerot1_imrs_med_L.jpg",
      "hippodrome grand casino": "https://bshots.egcvi.com/thumbnail/hippo2_imr_med_L.jpg",
      "jawhara roulette": "https://bshots.egcvi.com/thumbnail/arabicm1_imrs_med_L.jpg",
      "türkçe rulet": "https://bshots.egcvi.com/thumbnail/tkm1_imr_med_L.jpg",
      "deutsches roulette": "https://bshots.egcvi.com/thumbnail/deu_vir_med_L.jpg",
      "ruletka live": "https://bshots.egcvi.com/thumbnail/rugent1_imr_med_L.jpg",
      "türkçe lightning rulet": "https://bshots.egcvi.com/thumbnail/lightt1_imr_med_L.jpg",
      "football studio roulette": "https://bshots.egcvi.com/thumbnail/lrm1_imr_med_L.jpg",
      "roulette": "https://bshots.egcvi.com/thumbnail/green_imr_med_L.jpg"
    };

    // Ordena as chaves do mais específico (mais longo) para o mais genérico (mais curto)
    const orderedKeys = Object.keys(evolutionImageMap).sort((a, b) => b.length - a.length);
    
    // Busca pelo nome mais específico primeiro
    for (const key of orderedKeys) {
      if (normalizedName.includes(key.toLowerCase())) {
        console.log(`Imagem encontrada para ${normalizedName}: ${evolutionImageMap[key]}`);
        return evolutionImageMap[key];
      }
    }
    
   
  }
  
  // Imagem padrão se o provedor não for reconhecido

}

/**
 * Mapeia os nomes das roletas para seus respectivos provedores
 * @param rouletteName Nome da roleta
 * @returns Nome do provedor (Evolution ou Pragmatic Play)
 */
export function mapRouletteProvider(rouletteName: string): string {
  // Normaliza o nome da roleta para comparação (minúsculas, sem espaços extras)
  const normalizedName = rouletteName.toLowerCase().trim();
  
  console.log(`Mapeando provedor para: "${normalizedName}"`);
  
  // Verificações específicas por nome exato para casos mais comuns
  if (normalizedName.includes('romanian') || 
      normalizedName.includes('mega') || 
      normalizedName.includes('russian') || 
      normalizedName.includes('fortune') ||
      normalizedName.includes('speed roulette 1') ||
      normalizedName.includes('roulette macao') ||
      normalizedName.includes('roulette 1') ||
      normalizedName.includes('german') && !normalizedName.includes('deutsches')) {
    console.log(`Roleta identificada como Pragmatic Play por padrão específico: ${normalizedName}`);
    return 'Pragmatic Play';
  }
  
  // Mapeamento de roletas da Evolution
  const evolutionRoulettes = [
    'roulette',
    'lightning roulette',
    'immersive roulette',
    'xxxtreme lightning roulette',
    'gold vault roulette',
    'dansk roulette',
    'vip roulette',
    'ruleta relámpago en vivo',
    'ruleta en vivo',
    'speed auto roulette',
    'bucharest auto-roulette',
    'bucharest roulette',
    'dragonara roulette',
    'lightning roulette italia',
    'venezia roulette',
    'auto-roulette vip',
    'american roulette',
    'hippodrome grand casino',
    'jawhara roulette',
    'türkçe rulet',
    'deutsches roulette',
    'ruletka live',
    'türkçe lightning rulet',
    'football studio roulette'
  ];
  
  // Mapeamento de roletas da Pragmatic Play
  const pragmaticRoulettes = [
    'fortune roulette',
    'immersive roulette deluxe',
    'vip auto roulette',
    'mega roulette',
    'roulette 1',
    'romanian roulette',
    'brazilian mega roulette',
    'speed roulette 1',
    'roulette macao',
    'german roulette',
    'russian roulette',
    'roulette italia tricolore',
    'turkish roulette'
  ];
  
  // Verifica se o nome está nas listas
  for (const name of evolutionRoulettes) {
    if (normalizedName.includes(name.toLowerCase())) {
      console.log(`Roleta identificada como Evolution: ${normalizedName} (via ${name})`);
      return 'Evolution';
    }
  }
  
  for (const name of pragmaticRoulettes) {
    if (normalizedName.includes(name.toLowerCase())) {
      console.log(`Roleta identificada como Pragmatic Play: ${normalizedName} (via ${name})`);
      return 'Pragmatic Play';
    }
  }
  
  // Verificação adicional para roletas genéricas
  if (normalizedName.includes('roulette') && !normalizedName.includes('auto') && !normalizedName.includes('speed')) {
    // Se for apenas "Roulette" sem qualificadores específicos, é mais provável ser Evolution
    console.log(`Roleta genérica identificada como Evolution: ${normalizedName}`);
    return 'Evolution';
  }
  
  // Se não encontrar correspondência, retorna o valor padrão
  console.log(`Nenhum provedor identificado para: ${normalizedName}`);
  return 'Desconhecido';
}

/**
 * Determina a cor do número da roleta
 * @param num Número da roleta
 * @returns Cor correspondente (verde, vermelho, preto)
 */
export function getNumberColor(num: number): string {
  // Número zero é verde
  if (num === 0) return 'verde';
  
  // Números vermelhos na roleta europeia
  const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  return numerosVermelhos.includes(num) ? 'vermelho' : 'preto';
}

/**
 * Processa dados brutos da roleta para um formato padronizado
 * @param roulette Dados brutos da roleta
 * @returns Dados processados ou null se inválidos
 */
export function processRouletteData(roulette: any): any {
  if (!roulette) return null;
  
  const rouletteIdForLog = roulette?.id || roulette?.roleta_id || 'ID Desconhecido';
  const rouletteNameForLog = roulette?.nome || roulette?.name || roulette?.roleta_nome || 'Nome Desconhecido';
  
  if (!roulette || !(roulette.id || roulette.roleta_id)) {
    console.warn(`[processRouletteData] Dados inválidos ou sem ID para ${rouletteNameForLog}`);
    return null;
  }

  const currentId = roulette.id || roulette.roleta_id;
  
  // Tenta obter o nome mapeado pelo ID, caso exista
  const mappedName = mapRouletteIdToName(currentId);
  const currentName = mappedName || roulette.roleta_nome || roulette.nome || roulette.name || `Roleta ${currentId}`;

  // 1. Identificar a fonte primária dos números
  let potentialSources = [
    { key: 'numbers', data: roulette.numbers },
    { key: 'numero', data: roulette.numero },
    { key: 'numeros', data: roulette.numeros },
    { key: 'lastNumbers', data: roulette.lastNumbers },
  ];

  let sourceArray: any[] = [];
  let sourceKey: string = 'none';
  let itemFormat: 'object_number' | 'object_numero' | 'number' | 'unknown' = 'unknown';

  for (const source of potentialSources) {
    if (Array.isArray(source.data) && source.data.length > 0) {
      sourceArray = source.data;
      sourceKey = source.key;
      
      // Determinar formato do item dentro do array encontrado
      const firstItem = sourceArray[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        if (typeof firstItem.number !== 'undefined') {
          itemFormat = 'object_number';
        } else if (typeof firstItem.numero !== 'undefined') {
          itemFormat = 'object_numero';
        } else {
          itemFormat = 'unknown';
        }
      } else if (typeof firstItem === 'number') {
        itemFormat = 'number';
      } else {
        itemFormat = 'unknown';
      }
      break; // Encontrou uma fonte válida, para a busca
    }
  }

  if (sourceKey === 'none') {
    return null; 
  }

  // 2. Mapear o array fonte para o formato { numero: number, timestamp: string }
  const numerosComTimestamp: RouletteNumber[] = sourceArray.map((item: any) => {
    let numero: number | null = null;
    let timestamp: string | null | undefined = null;

    // Extrair número baseado no formato detectado
    if (itemFormat === 'object_number' && typeof item === 'object') {
      numero = Number(item.number);
      timestamp = item.timestamp;
    } else if (itemFormat === 'object_numero' && typeof item === 'object') {
      numero = Number(item.numero);
      timestamp = item.timestamp;
    } else if (itemFormat === 'number') {
      numero = Number(item);
      timestamp = roulette.timestamp;
    }

    // Fallback/Default para timestamp
    let timeString = "--:--";
    if (timestamp) {
      try {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {
        // Erro ao processar timestamp
      }
    }

    const finalNumero = (numero === null || isNaN(numero)) ? -1 : numero;

    return {
      numero: finalNumero,
      timestamp: timeString,
      cor: getNumberColor(finalNumero)
    };
  })
  .filter(n => n.numero !== -1 && n.numero >= 0 && n.numero <= 36);

  // 3. Obter outros dados
  const ultimoNumero = numerosComTimestamp.length > 0 ? numerosComTimestamp[0].numero : null;
  const winRate = roulette.winRate !== undefined ? roulette.winRate : Math.random() * 100;
  const streak = roulette.streak !== undefined ? roulette.streak : Math.floor(Math.random() * 5);
  const finalUpdateTime = roulette.lastUpdateTime || roulette.timestamp ? new Date(roulette.lastUpdateTime || roulette.timestamp).getTime() : Date.now();
  
  // Identificar o provedor com base no nome da roleta se não estiver explícito
  let currentProvider = roulette.provider || 'Desconhecido';
  if (currentProvider === 'Desconhecido') {
    currentProvider = mapRouletteProvider(currentName);
  }
  
  // Obter a URL da imagem da roleta (usar a fornecida ou gerar com base no nome)
  const imageUrl = roulette.imageUrl || getRouletteImage(currentName, currentProvider);
  
  const currentStatus = roulette.status || (numerosComTimestamp.length > 0 ? 'online' : 'offline');
  const isHistorical = roulette.isHistorical || false;

  return {
    id: currentId,
    nome: currentName,
    provider: currentProvider,
    status: currentStatus,
    ultimoNumero: ultimoNumero,
    numeros: numerosComTimestamp,
    winRate: winRate,
    streak: streak,
    lastUpdateTime: finalUpdateTime,
    isHistorical: isHistorical,
    imageUrl: imageUrl
  };
}

/**
 * Utilitários para trabalhar com números de roleta
 */

/**
 * Determina a classe CSS de cor para um número de roleta
 * @param num Número da roleta (0-36)
 * @returns String com classes CSS para aplicar a cor correta
 */
export const getRouletteNumberColor = (num: number): string => {
  num = Number(num); // Garantir que o número está no formato correto
  if (num === 0) {
    return 'bg-green-600 text-white'; // Verde para o zero
  } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
    return 'bg-red-600 text-white'; // Vermelho para números específicos
  } else {
    return 'bg-transparent text-white'; // Transparente para os demais números
  }
};

/**
 * Verifica se um número é vermelho na roleta
 * @param num Número da roleta
 * @returns true se o número for vermelho
 */
export const isRedNumber = (num: number): boolean => {
  return [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(Number(num));
};

/**
 * Verifica se um número é preto na roleta
 * @param num Número da roleta
 * @returns true se o número for preto
 */
export const isBlackNumber = (num: number): boolean => {
  return !isRedNumber(num) && num !== 0;
};

/**
 * Verifica se um número é par
 * @param num Número da roleta
 * @returns true se o número for par
 */
export const isEvenNumber = (num: number): boolean => {
  return num !== 0 && num % 2 === 0;
};

/**
 * Verifica se um número é ímpar
 * @param num Número da roleta
 * @returns true se o número for ímpar
 */
export const isOddNumber = (num: number): boolean => {
  return num !== 0 && num % 2 !== 0;
}; 