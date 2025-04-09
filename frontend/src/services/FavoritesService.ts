/**
 * Serviço para gerenciar as roletas favoritas do usuário
 */

import { getLogger } from './utils/logger';

const logger = getLogger('FavoritesService');
const FAVORITES_KEY = 'runcash_favorite_roulettes';

/**
 * Obtém a lista de IDs de roletas favoritas do usuário
 * @returns Array de IDs das roletas favoritas
 */
export const getFavoriteRoulettes = (): string[] => {
  try {
    const favoritesStr = localStorage.getItem(FAVORITES_KEY);
    if (!favoritesStr) {
      return [];
    }
    return JSON.parse(favoritesStr);
  } catch (error) {
    logger.error('❌ Erro ao obter lista de roletas favoritas:', error);
    return [];
  }
};

/**
 * Verifica se uma roleta está nos favoritos
 * @param roletaId ID da roleta a verificar
 * @returns true se a roleta estiver nos favoritos
 */
export const isRouletteFavorite = (roletaId: string): boolean => {
  if (!roletaId) return false;
  
  const favorites = getFavoriteRoulettes();
  return favorites.includes(roletaId);
};

/**
 * Adiciona uma roleta aos favoritos
 * @param roletaId ID da roleta a adicionar aos favoritos
 */
export const addRouletteToFavorites = (roletaId: string): void => {
  if (!roletaId) {
    logger.warn('⚠️ Tentativa de adicionar roleta sem ID aos favoritos');
    return;
  }
  
  try {
    const favorites = getFavoriteRoulettes();
    if (favorites.includes(roletaId)) {
      return; // Já está nos favoritos
    }
    
    favorites.push(roletaId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    logger.info(`✅ Roleta ${roletaId} adicionada aos favoritos`);
  } catch (error) {
    logger.error(`❌ Erro ao adicionar roleta ${roletaId} aos favoritos:`, error);
  }
};

/**
 * Remove uma roleta dos favoritos
 * @param roletaId ID da roleta a remover dos favoritos
 */
export const removeRouletteFromFavorites = (roletaId: string): void => {
  if (!roletaId) {
    logger.warn('⚠️ Tentativa de remover roleta sem ID dos favoritos');
    return;
  }
  
  try {
    const favorites = getFavoriteRoulettes();
    const newFavorites = favorites.filter(id => id !== roletaId);
    
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    logger.info(`✅ Roleta ${roletaId} removida dos favoritos`);
  } catch (error) {
    logger.error(`❌ Erro ao remover roleta ${roletaId} dos favoritos:`, error);
  }
};

/**
 * Toggle de favorito - adiciona ou remove dependendo do estado atual
 * @param roletaId ID da roleta para alternar estado de favorito
 * @returns novo estado (true = favorito, false = não favorito)
 */
export const toggleFavorite = (roletaId: string): boolean => {
  if (!roletaId) {
    logger.warn('⚠️ Tentativa de alternar favorito para roleta sem ID');
    return false;
  }
  
  const isFavorite = isRouletteFavorite(roletaId);
  
  if (isFavorite) {
    removeRouletteFromFavorites(roletaId);
    return false;
  } else {
    addRouletteToFavorites(roletaId);
    return true;
  }
}; 