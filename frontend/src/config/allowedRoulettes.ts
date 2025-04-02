import { getEnvVar } from '@/config/env';

/**
 * Lista de IDs de roletas permitidas para exibição no frontend
 * Estes IDs devem corresponder aos configurados no scraper
 */
export const ROLETAS_PERMITIDAS = getRouletasFromEnv() || [
  "2010016",  // Immersive Roulette
  "2380335",  // Brazilian Mega Roulette
  "2010065",  // Bucharest Auto-Roulette
  "2010096",  // Speed Auto Roulette
  "2010017",  // Auto-Roulette
  "2010098"   // Auto-Roulette VIP
];

/**
 * Mapeamento de IDs alternativos para IDs padrão
 * Alguns sistemas podem usar diferentes prefixos ou formatos
 */
const ID_MAPPING: Record<string, string> = {
  // Prefixo 2b comum em algumas APIs
  "2b00051": "2010016", // Immersive Roulette
  "2b00081": "2010016", // Immersive Roulette (alternativo)
  "2b00091": "2380335", // Brazilian Mega Roulette
  "2b00035": "2380335", // Brazilian Mega Roulette (alternativo)
  "2b00085": "2010096", // Speed Auto Roulette
  "2b00098": "2010098", // Auto-Roulette VIP
  "2b00093": "2010017", // Auto-Roulette
  "2b00095": "2010065", // Bucharest Auto-Roulette
  
  // Versões sem prefixo se necessário
  "00051": "2010016",
  "00081": "2010016",
  "00091": "2380335",
  "00035": "2380335"
  // Adicione mais mapeamentos conforme necessário
};

/**
 * Lê as roletas permitidas das variáveis de ambiente
 * Formato da variável: VITE_ALLOWED_ROULETTES="2010016,2380335,2010065,2010096,2010017,2010098"
 */
function getRouletasFromEnv(): string[] | null {
  try {
    // Tentar ler da variável de ambiente
    const envRoulettes = getEnvVar('VITE_ALLOWED_ROULETTES', '');
    
    if (envRoulettes) {
      console.log('[Config] Lendo roletas permitidas das variáveis de ambiente');
      const roulettes = envRoulettes.split(',').map(id => id.trim());
      console.log(`[Config] Roletas permitidas por env (${roulettes.length}):`, roulettes);
      return roulettes.length > 0 ? roulettes : null;
    }
    
    return null;
  } catch (error) {
    console.warn('[Config] Erro ao ler roletas de variáveis de ambiente:', error);
    return null;
  }
}

/**
 * Normaliza um ID de roleta para comparação
 * Limpa prefixos, sufixos, etc. para obter apenas parte numérica significativa
 */
export const normalizeRouletteId = (id: string | number | null | undefined): string => {
  if (!id) return '';
  
  // Converter para string e remover espaços
  const stringId = String(id).trim();
  
  // Verificar se existe no mapeamento de IDs alternativos
  if (ID_MAPPING[stringId]) {
    return ID_MAPPING[stringId];
  }
  
  // Remover prefixos não numéricos (como "ID_" ou "RouletteID_")
  const numericId = stringId.replace(/^[^0-9]+/, '');
  
  // Remover qualquer texto após números (como sufixos ou delimitadores)
  const cleanId = numericId.replace(/[^0-9].*/g, '');
  
  // Se o ID original era diferente do limpo, registrar para diagnóstico
  if (stringId !== cleanId) {
    console.log(`[Config] ID normalizado: ${stringId} -> ${cleanId}`);
  }
  
  return cleanId;
};

/**
 * Verifica se uma roleta está na lista de roletas permitidas
 * @param rouletteId ID da roleta a ser verificada
 * @returns boolean indicando se a roleta está permitida
 */
export const isRouletteAllowed = (rouletteId: string | number | null | undefined): boolean => {
  // Normalizar o ID fornecido
  const normalizedId = normalizeRouletteId(rouletteId);
  
  // Se o ID não for válido após normalização, rejeitar
  if (!normalizedId) {
    return false;
  }
  
  // Verificar se está na lista permitida diretamente
  if (ROLETAS_PERMITIDAS.includes(normalizedId)) {
    return true;
  }
  
  // Verificar se algum ID permitido está contido no ID normalizado
  // Isso ajuda com casos onde o ID vem com prefixos/sufixos adicionais
  for (const allowedId of ROLETAS_PERMITIDAS) {
    if (normalizedId.includes(allowedId)) {
      console.log(`[Config] ID permitido por inclusão parcial: ${rouletteId} contém ${allowedId}`);
      return true;
    }
  }
  
  // Verificar se é um ID parcial de algum ID permitido (últimos 5-6 dígitos)
  if (normalizedId.length >= 5) {
    const partialId = normalizedId.slice(-6); // últimos 6 dígitos
    for (const allowedId of ROLETAS_PERMITIDAS) {
      if (allowedId.endsWith(partialId)) {
        console.log(`[Config] ID permitido por correspondência parcial final: ${rouletteId} ~ ${allowedId}`);
        return true;
      }
    }
  }
  
  // Se chegou aqui, não está permitido
  return false;
};

/**
 * Filtra um array de roletas para incluir apenas as permitidas
 * @param roulettes Array de roletas
 * @returns Array filtrado contendo apenas roletas permitidas
 */
export const filterAllowedRoulettes = <T extends { id: string | number }>(roulettes: T[]): T[] => {
  const filtered = roulettes.filter(roulette => isRouletteAllowed(roulette.id));
  console.log(`[Config] Roletas filtradas: ${roulettes.length} -> ${filtered.length}`);
  return filtered;
}; 