import { Link } from 'react-router-dom';
import NavbarAuth from './NavbarAuth';

const Navbar = () => {
  return (
    <nav className="bg-black border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-full mx-auto px-4">
        <div className="flex justify-between h-14 items-center">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-green-500 font-bold text-xl">
              RunCash
            </Link>
          </div>
          
          {/* Autenticação e saldo */}
          <NavbarAuth />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
