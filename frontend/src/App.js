import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import PollingTestPage from './components/PollingTestPage';

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="bg-blue-600 p-4 text-white">
          <div className="container mx-auto flex justify-between items-center">
            <div className="text-xl font-bold">RunCash - Teste de Polling</div>
            <ul className="flex space-x-4">
              <li>
                <Link to="/" className="hover:underline">Home</Link>
              </li>
              <li>
                <Link to="/polling-test" className="hover:underline">Polling Test</Link>
              </li>
            </ul>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={
            <div className="container mx-auto p-8">
              <h1 className="text-3xl font-bold mb-4">Bem-vindo ao Teste de Polling</h1>
              <p className="mb-4">Este aplicativo demonstra um sistema de polling para roletas.</p>
              <Link to="/polling-test" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Ver Demonstração de Polling
              </Link>
            </div>
          } />
          <Route path="/polling-test" element={<PollingTestPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 