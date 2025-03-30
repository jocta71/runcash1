import { useState, useMemo } from 'react';
import { Search, Wallet, Menu, MessageSquare } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import RouletteCard from '@/components/RouletteCard';
import { Input } from '@/components/ui/input';
import ChatUI from '@/components/ChatUI';
import { Button } from '@/components/ui/button';
import AnimatedInsights from '@/components/AnimatedInsights';
import ProfileDropdown from '@/components/ProfileDropdown';

// ... keep existing code (interfaces and mock data)

const Index = () => {
  // ... keep existing code (state definitions)
  
  return (
    <div className="min-h-screen flex bg-vegas-black">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Mobile Sidebar (drawer) */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isMobile={true} />
      
      <div className="flex-1 relative">
        {/* Mobile Header */}
        <div className="mobile-header">
          <button 
            className="p-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} className="text-[#00ff00]" />
          </button>
          
          <div className="flex-1"></div>
          
          <div className="flex items-center gap-2">
            {showMobileSearch ? (
              <div className="absolute top-0 left-0 right-0 z-50 p-2 bg-[#100f13] border-b border-[#33333359]">
                <div className="relative flex items-center w-full">
                  <Search size={16} className="absolute left-3 text-gray-400" />
                  <Input 
                    type="text" 
                    placeholder="Pesquisar roleta..." 
                    className="w-full pl-9 py-2 pr-3 text-sm bg-[#1A191F] border-none rounded-full text-white focus-visible:ring-0 focus-visible:ring-offset-0" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                    onBlur={() => setShowMobileSearch(false)}
                  />
                </div>
              </div>
            ) : (
              <>
                <button 
                  className="p-2 bg-[#1A191F] rounded-full"
                  onClick={() => setShowMobileSearch(true)}
                >
                  <Search size={16} className="text-gray-400" />
                </button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="h-8 text-black font-medium bg-gradient-to-b from-[#00ff00] to-[#00ff00] hover:from-[#00ff00]/90 hover:to-[#00ff00]/90"
                >
                  <Wallet size={14} className="mr-1" /> Saldo
                </Button>
                <ProfileDropdown />
              </>
            )}
            <button 
              className="p-2"
              onClick={() => setChatOpen(true)}
            >
              <MessageSquare size={24} className="text-[#00ff00]" />
            </button>
          </div>
        </div>
        
        {/* Desktop Header */}
        // ... keep existing code (desktop header)
        
        {/* Mobile Insights */}
        // ... keep existing code (mobile insights)
        
        <main className="pt-4 md:pt-[70px] pb-8 px-4 md:px-6 md:pl-[280px] md:pr-[340px] w-full min-h-screen bg-[#100f13]">
          // ... keep existing code (main content)
        </main>
      </div>
      
      {/* Desktop Chat */}
      <ChatUI />
      
      {/* Mobile Chat (drawer) */}
      <ChatUI isOpen={chatOpen} onClose={() => setChatOpen(false)} isMobile={true} />
    </div>
  );
};

export default Index;
