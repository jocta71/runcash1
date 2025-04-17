import { Link } from 'react-router-dom';
import NavbarAuth from './NavbarAuth';

const Navbar = () => {
  return (
    <nav className="bg-[#22c55e0d] border-b border-[#33333359] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center">
              <span className="font-bold text-xl bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] bg-clip-text text-transparent">RunCash</span>
            </Link>
          </div>
          <NavbarAuth />
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 