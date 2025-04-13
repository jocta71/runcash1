import { Link } from 'react-router-dom';
import NavbarAuth from './NavbarAuth';

const Navbar = () => {
  return (
    <nav className="bg-black border-b border-[#111] sticky top-0 z-50 py-2">
      <div className="max-w-full mx-auto px-6">
        <div className="flex items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-[#00ff00] font-bold text-xl">
              RunCash
            </Link>
          </div>
          
          {/* Menu de navegação (lado esquerdo) */}
          <div className="ml-4 text-xs text-gray-400">
            <span>Jogos</span>
          </div>
          
          {/* Espaço flexível */}
          <div className="flex-grow"></div>
          
          {/* Autenticação e saldo */}
          <NavbarAuth />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
