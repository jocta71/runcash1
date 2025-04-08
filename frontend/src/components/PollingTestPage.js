import React from 'react';
import PollingRouletteList from './PollingRouletteList';

/**
 * Página de teste para demonstrar o sistema de polling
 */
const PollingTestPage = () => {
  return (
    <div className="container mx-auto p-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Sistema de Polling - Teste</h1>
        <p className="text-gray-600">
          Esta página demonstra o sistema de polling que busca atualizações das roletas a cada 3 segundos.
        </p>
      </header>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Como usar:</strong> Inicie o script <code className="bg-gray-100 px-1 py-0.5 rounded">test_polling.js</code> para inserir números aleatórios em uma roleta de teste.
            </p>
            <p className="text-sm text-blue-700 mt-2">
              <code className="bg-gray-100 px-1 py-0.5 rounded">node backend/test_polling.js</code>
            </p>
          </div>
        </div>
      </div>

      {/* Listar as roletas usando o sistema de polling */}
      <PollingRouletteList />

      <div className="mt-8 border-t pt-6">
        <h2 className="text-xl font-semibold mb-4">Documentação do Sistema</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium">Arquitetura de Polling</h3>
            <p className="text-gray-600 mt-1">
              O sistema utiliza polling HTTP regular para obter atualizações das roletas, o que é mais confiável do que SSE ou WebSockets em certos ambientes.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium">Vantagens</h3>
            <ul className="list-disc pl-5 mt-1 text-gray-600">
              <li>Funciona em qualquer ambiente, mesmo com proxies e firewalls restritos</li>
              <li>Evita problemas de conexões perdidas comuns em WebSockets</li>
              <li>Baixo consumo de recursos no servidor</li>
              <li>Suporte para timestamp incremental para minimizar tráfego</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-medium">Limitações</h3>
            <ul className="list-disc pl-5 mt-1 text-gray-600">
              <li>Pode ter maior latência comparado com WebSockets</li>
              <li>Mais requisições HTTP ao servidor</li>
              <li>Não é push verdadeiro, depende do intervalo de polling</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PollingTestPage; 