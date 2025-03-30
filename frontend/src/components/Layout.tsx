import React from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#100f13] text-white">
      <div className="flex">
        <div className="hidden md:block w-64 min-h-screen">
          <Sidebar />
        </div>
        
        <main className="flex-1 p-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout; 