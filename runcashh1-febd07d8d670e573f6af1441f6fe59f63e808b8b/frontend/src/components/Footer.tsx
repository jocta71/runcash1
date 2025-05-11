import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Twitter, Facebook, Youtube, Mail, Phone, MapPin, ArrowUp } from 'lucide-react';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#0F0F0F] border-t border-[#333333] text-gray-300">
      <div className="container mx-auto px-4 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Coluna 1 - Logo e Descrição */}
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-green-500 mb-4">American Roulette</h2>
            <p className="text-sm text-gray-400 mb-4">
              A melhor plataforma para gerenciar suas apostas em roletas americanas
              com estratégias avançadas e análises em tempo real.
            </p>
            <div className="flex space-x-4 mt-2">
              <a href="#" className="text-gray-400 hover:text-green-500 transition-colors">
                <Instagram size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-green-500 transition-colors">
                <Twitter size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-green-500 transition-colors">
                <Facebook size={20} />
              </a>
              <a href="#" className="text-gray-400 hover:text-green-500 transition-colors">
                <Youtube size={20} />
              </a>
            </div>
          </div>

          {/* Coluna 2 - Links Rápidos */}
          <div>
            <h3 className="text-white font-bold mb-4">Links Rápidos</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-green-500 transition-colors text-sm">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/planos" className="text-gray-400 hover:text-green-500 transition-colors text-sm">
                  Planos
                </Link>
              </li>
              <li>
                <Link to="/estrategias" className="text-gray-400 hover:text-green-500 transition-colors text-sm">
                  Estratégias
                </Link>
              </li>
              <li>
                <Link to="/historico" className="text-gray-400 hover:text-green-500 transition-colors text-sm">
                  Histórico
                </Link>
              </li>
              <li>
                <Link to="/perfil" className="text-gray-400 hover:text-green-500 transition-colors text-sm">
                  Meu Perfil
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 3 - Suporte */}
          <div>
            <h3 className="text-white font-bold mb-4">Suporte</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/faq" className="text-gray-400 hover:text-green-500 transition-colors text-sm">
                  FAQ
                </Link>
              </li>
              <li>
                <Link to="/termos" className="text-gray-400 hover:text-green-500 transition-colors text-sm">
                  Termos de Uso
                </Link>
              </li>
              <li>
                <Link to="/privacidade" className="text-gray-400 hover:text-green-500 transition-colors text-sm">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/contato" className="text-gray-400 hover:text-green-500 transition-colors text-sm">
                  Contato
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 4 - Contato */}
          <div>
            <h3 className="text-white font-bold mb-4">Contato</h3>
            <ul className="space-y-3">
              <li className="flex items-center text-sm text-gray-400">
                <Mail size={16} className="mr-2 text-green-500" />
                <span>suporte@americanroulette.com</span>
              </li>
              <li className="flex items-center text-sm text-gray-400">
                <Phone size={16} className="mr-2 text-green-500" />
                <span>+55 (11) 99999-9999</span>
              </li>
              <li className="flex items-start text-sm text-gray-400">
                <MapPin size={16} className="mr-2 mt-1 text-green-500" />
                <span>São Paulo, SP - Brasil</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Botão para voltar ao topo */}
        <div className="flex justify-end mt-8">
          <button
            onClick={scrollToTop}
            className="bg-green-600 hover:bg-green-700 rounded-full p-3 text-white transition-colors"
            aria-label="Voltar ao topo"
          >
            <ArrowUp size={16} />
          </button>
        </div>

        {/* Copyright */}
        <div className="border-t border-[#333333] mt-8 pt-8 text-center text-sm text-gray-500">
          <p>© {currentYear} American Roulette. Todos os direitos reservados.</p>
          <p className="mt-2">
            Desenvolvido com ♠️ ♥️ ♣️ ♦️ para sua experiência de apostas
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 