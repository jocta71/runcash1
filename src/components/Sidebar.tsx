import { useState } from 'react';
import { CircleDollarSign, Rocket, Heart, Gift, Ticket, Trophy, Users, BarChart3, Scale, LifeBuoy, ChevronDown, Gamepad2, Flame, Globe, Send, X } from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

const Sidebar = ({ isOpen = false, onClose, isMobile = false }: SidebarProps) => {
  const [otherExpanded, setOtherExpanded] = useState(false);
  
  const sidebarClasses = isMobile
    ? "h-full w-full mobile-sidebar-inner animate-slide-right"
    : "h-screen fixed top-0 left-0 w-64 hidden md:flex flex-col animate-slide-right z-40 bg-[#0B0A0F] border-r border-[#33333359]";
  
  const content = (
    <div className="p-3 flex flex-col h-full justify-between">
      {isMobile && (
        <div className="flex justify-between items-center mb-4">
          <span className="text-white text-xl font-bold">RunCash</span>
          <button onClick={onClose} className="p-1 rounded-md text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
      )}
      
      <div className="space-y-6">
        <div>
          <h3 className="text-gray-500 text-xs font-medium px-4 mb-2">Jogos</h3>
          <div className="space-y-1">
            <div className="menu-item active">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Gamepad2 size={18} className="text-white" />
              </div>
              <span>Slots</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Flame size={18} className="text-white" />
              </div>
              <span>Cassino Ao Vivo</span>
            </div>
            
            <div className="menu-item">
              <div className="bg-[#1A191F] p-1.5 rounded-md">
                <Heart size={18} className="text-white" />
              </div>
              <span>Favoritos</span>
            </div>
          </div>
        </div>
        
        // ... keep existing code (rest of sidebar sections)
      </div>
      
      // ... keep existing code (footer sections)
    </div>
  );
  
  if (isMobile) {
    if (!isOpen) return null;
    
    return (
      <div className="mobile-sidebar" onClick={onClose}>
        <div className={sidebarClasses} onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }
  
  return (
    <div className={sidebarClasses}>
      {content}
    </div>
  );
};

export default Sidebar;