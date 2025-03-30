import { useState } from 'react';
import RouletteCardRealtime from './components/RouletteCardRealtime';

// Mock data for roulettes
const mockRoulettes = [
  { id: 'roleta1', nome: 'Roleta Brasileira' },
  { id: 'roleta2', nome: 'Roleta Europeia' },
  { id: 'roleta3', nome: 'Roleta Americana' }
];

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter roulettes based on search term
  const filteredRoulettes = mockRoulettes.filter(roleta => 
    roleta.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="max-w-4xl mx-auto mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Roulette Tracker</h1>
        <div className="flex">
          <input
            type="text"
            placeholder="Buscar roletas..."
            className="flex-1 p-2 border rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoulettes.length > 0 ? (
            filteredRoulettes.map(roleta => (
              <RouletteCardRealtime
                key={roleta.id}
                roletaId={roleta.id}
                roletaNome={roleta.nome}
                onNumberChange={(newNumber) => 
                  console.log(`New number for ${roleta.nome}: ${newNumber}`)
                }
              />
            ))
          ) : (
            <div className="col-span-full text-center p-8 bg-white rounded-lg shadow">
              <p className="text-gray-500">Nenhuma roleta encontrada</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
