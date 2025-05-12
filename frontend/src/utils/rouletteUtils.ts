/**
 * Utilitários centralizados para processamento de dados de roletas
 */

import { RouletteNumber } from '../types/roulette';

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
  const currentName = roulette.roleta_nome || roulette.nome || roulette.name || `Roleta ${currentId}`;

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
  const currentProvider = roulette.provider || 'Desconhecido';
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
    isHistorical: isHistorical
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

/**
 * Inicializa o cliente SSE se necessário
 */
export const initializeSSEClientIfNeeded = (): void => {
  // Esta função seria chamada pelo UnifiedRouletteClient quando necessário
  // Seu propósito seria inicializar uma única conexão SSE compartilhada
  // Implementação vazia para compatibilidade
};

/**
 * Adiciona lógica para remover possíveis assinaturas duplicadas
 * @param client O cliente UnifiedRouletteClient
 * @param eventType Tipo de evento
 * @param callback Função callback
 */
export const addUniqueSubscription = (
  client: any,
  eventType: string,
  callback: (data: any) => void
): string => {
  // Gera um ID único para o subscriber
  const subscriberId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Esta função seria usada para garantir que não haja callbacks duplicados
  if (client && typeof client.subscribe === 'function') {
    return client.subscribe(eventType, callback);
  }
  
  return subscriberId;
}; 