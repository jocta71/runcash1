import { 
  mapToCanonicalId, 
  getNumberColor, 
  transformRouletteNumber, 
  transformRouletteData,
  CANONICAL_IDS
} from '../rouletteTransformer';

describe('rouletteTransformer', () => {
  describe('mapToCanonicalId', () => {
    it('deve mapear um ID conhecido para o ID canônico', () => {
      expect(mapToCanonicalId('evolution-lightning-roulette')).toBe('evolution-lightning');
      expect(mapToCanonicalId('EVOLUTION-LIGHTNING-ROULETTE')).toBe('evolution-lightning');
      expect(mapToCanonicalId('pragmatic-roulette')).toBe('pragmatic');
    });
    
    it('deve mapear um UUID para o ID canônico quando disponível', () => {
      expect(mapToCanonicalId('550e8400-e29b-41d4-a716-446655440000')).toBe('evolution-lightning');
      expect(mapToCanonicalId('38a52be4-535e-4505-a38d-9c38469cc4dd')).toBe('pragmatic');
    });
    
    it('deve retornar o ID original quando não encontrar mapeamento', () => {
      expect(mapToCanonicalId('roleta-desconhecida')).toBe('roleta-desconhecida');
    });
    
    it('deve lidar com entradas nulas ou vazias', () => {
      expect(mapToCanonicalId('')).toBe('unknown-roulette');
      expect(mapToCanonicalId(null as any)).toBe('unknown-roulette');
      expect(mapToCanonicalId(undefined as any)).toBe('unknown-roulette');
    });
  });
  
  describe('getNumberColor', () => {
    it('deve retornar "red" para números vermelhos', () => {
      const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
      redNumbers.forEach(num => {
        expect(getNumberColor(num)).toBe('red');
      });
    });
    
    it('deve retornar "black" para números pretos', () => {
      const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
      blackNumbers.forEach(num => {
        expect(getNumberColor(num)).toBe('black');
      });
    });
    
    it('deve retornar "green" para zero', () => {
      expect(getNumberColor(0)).toBe('green');
    });
    
    it('deve lidar com números inválidos', () => {
      expect(getNumberColor(-1)).toBe('unknown');
      expect(getNumberColor(37)).toBe('unknown');
      expect(getNumberColor(NaN)).toBe('unknown');
    });
  });
  
  describe('transformRouletteNumber', () => {
    it('deve transformar um número de roleta válido', () => {
      const now = Date.now();
      const result = transformRouletteNumber({
        number: 5,
        timestamp: now
      });
      
      expect(result).toEqual({
        value: 5,
        color: 'red',
        timestamp: now
      });
    });
    
    it('deve usar a cor fornecida se disponível', () => {
      const result = transformRouletteNumber({
        number: 5,
        color: 'custom-color',
        timestamp: 123456789
      });
      
      expect(result).toEqual({
        value: 5,
        color: 'custom-color',
        timestamp: 123456789
      });
    });
    
    it('deve gerar um timestamp se não fornecido', () => {
      const result = transformRouletteNumber({
        number: 5
      });
      
      expect(result.value).toBe(5);
      expect(result.color).toBe('red');
      expect(typeof result.timestamp).toBe('number');
    });
    
    it('deve lidar com entradas inválidas', () => {
      // @ts-ignore
      expect(() => transformRouletteNumber(null)).toThrow();
      // @ts-ignore
      expect(() => transformRouletteNumber(undefined)).toThrow();
      expect(() => transformRouletteNumber({ invalid: 'data' } as any)).toThrow();
    });
  });
  
  describe('transformRouletteData', () => {
    it('deve transformar dados de roleta válidos', () => {
      const data = {
        id: 'evolution-lightning-roulette',
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        active: true,
        numbers: [
          { number: 5, timestamp: '2023-05-01T12:00:00Z' },
          { number: 0, timestamp: '2023-05-01T11:55:00Z' }
        ]
      };
      
      const result = transformRouletteData(data);
      
      expect(result).toMatchObject({
        id: 'evolution-lightning',
        uuid: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Evolution Lightning',
        active: true,
        strategyState: 'WAITING',
        wins: 0,
        losses: 0
      });
      
      expect(result.numbers).toHaveLength(2);
      expect(result.numbers[0]).toMatchObject({
        value: 5,
        color: 'red'
      });
      expect(result.numbers[1]).toMatchObject({
        value: 0,
        color: 'green'
      });
    });
    
    it('deve manter os valores de estratégia se fornecidos', () => {
      const data = {
        id: 'pragmatic-roulette',
        active: true,
        numbers: [],
        strategyState: 'BETTING',
        wins: 10,
        losses: 5
      };
      
      const result = transformRouletteData(data);
      
      expect(result).toMatchObject({
        id: 'pragmatic',
        name: 'Pragmatic',
        strategyState: 'BETTING',
        wins: 10,
        losses: 5
      });
    });
    
    it('deve lidar com dados de roleta inválidos', () => {
      // @ts-ignore
      expect(() => transformRouletteData(null)).toThrow();
      // @ts-ignore
      expect(() => transformRouletteData(undefined)).toThrow();
      expect(() => transformRouletteData({ invalid: 'data' } as any)).toThrow();
    });
  });
  
  describe('CANONICAL_IDS', () => {
    it('deve conter os IDs canônicos esperados', () => {
      expect(CANONICAL_IDS).toHaveProperty('EVOLUTION_LIGHTNING');
      expect(CANONICAL_IDS).toHaveProperty('PRAGMATIC');
      expect(CANONICAL_IDS).toHaveProperty('EVOLUTION_AUTO');
      expect(CANONICAL_IDS).toHaveProperty('PLAYTECH');
    });
  });
}); 