import { Link } from 'react-router-dom';
import NavbarAuth from './NavbarAuth';

const Navbar = () => {
  return (
    <nav className="bg-background border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <div className="flex space-x-4">
              <Link to="/live-roulettes" className="text-white hover:text-primary transition-colors">
                Roletas ao Vivo
              </Link>
              <Link to="/strategies" className="text-white hover:text-primary transition-colors">
                Estratégias
              </Link>
              <Link to="/analise" className="text-white hover:text-primary transition-colors">
                Análise
              </Link>
            </div>
          </div>
          <NavbarAuth />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
