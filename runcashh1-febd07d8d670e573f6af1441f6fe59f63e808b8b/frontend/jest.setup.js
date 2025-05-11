/**
 * Configurações do Jest para testes no frontend
 */

// Mock global.fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({}),
    ok: true,
    status: 200,
    text: () => Promise.resolve(''),
  })
);

// Mock EventSource
class MockEventSource {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
  }
  
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

global.EventSource = MockEventSource;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

global.localStorage = localStorageMock;

// Mock console methods para melhorar a saída dos testes
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}; 