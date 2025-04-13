import { Link } from 'react-router-dom';
import NavbarAuth from './NavbarAuth';

const Navbar = () => {
  return (
    <nav className="bg-[#0B0A0F] border-b border-[#33333359] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <span className="font-bold text-xl text-[#00ff00]">RunCash</span>
            </Link>
          </div>
          <NavbarAuth />
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 