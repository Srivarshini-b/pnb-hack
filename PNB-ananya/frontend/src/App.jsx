import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AssetInventory from './components/AssetInventory';
import AssetDiscovery from './components/AssetDiscovery';
import CbomPage from './components/CbomPage';
import CyberRating from './components/CyberRating';
import Reporting from './components/Reporting';
import Chatbot from './components/Chatbot';
import { LayoutDashboard, Database, Globe, FileText, Shield, BarChart, Sun, Moon } from 'lucide-react';

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [scanData, setScanData] = useState(null);
  
  // Theme state: default to dark (since the app started as dark)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check if user has a preference, otherwise default to true (dark)
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  };

  return (
    <div className="min-h-screen bg-background text-textMain flex flex-col font-sans">
      {/* Header Navbar */}
      <header className="glass-panel rounded-none border-t-0 border-l-0 border-r-0 border-b-primary/30 px-6 py-4 flex flex-col md:flex-row items-center justify-between sticky top-0 z-50 gap-4 md:gap-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/50">
            <span className="text-primary font-bold text-lg">Q</span>
          </div>
          <h1 className="text-xl font-bold tracking-wide cursor-pointer" onClick={() => setActiveView('dashboard')}>
            QScan<span className="text-primary">.</span> <span className="text-textMuted text-sm font-normal ml-2 hidden sm:inline-block">Quantum-Safe Communication Scanner</span>
          </h1>
        </div>

        <div className="flex bg-panel/80 rounded-lg p-1 border border-border overflow-x-auto shadow-sm">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${activeView === 'dashboard' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-textMuted hover:text-textMain'}`}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button
            onClick={() => setActiveView('inventory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${activeView === 'inventory' ? 'bg-secondary/20 text-secondary border border-secondary/30' : 'text-textMuted hover:text-textMain'}`}
          >
            <Database size={16} /> Asset Inventory
          </button>
          <button
            onClick={() => setActiveView('discovery')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${activeView === 'discovery' ? 'bg-[#06b6d4]/20 text-[#06b6d4] border border-[#06b6d4]/30' : 'text-textMuted hover:text-textMain'}`}
          >
            <Globe size={16} /> Asset Discovery
          </button>
          <button
            onClick={() => setActiveView('cbom')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${activeView === 'cbom' ? 'bg-[#8b5cf6]/20 text-[#8b5cf6] border border-[#8b5cf6]/30' : 'text-textMuted hover:text-textMain'}`}
          >
            <FileText size={16} /> CBOM
          </button>
          <button
            onClick={() => setActiveView('rating')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${activeView === 'rating' ? 'bg-warning/20 text-warning border border-warning/30' : 'text-textMuted hover:text-textMain'}`}
          >
            <Shield size={16} /> Cyber Rating
          </button>
          <button
            onClick={() => setActiveView('reporting')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium ${activeView === 'reporting' ? 'bg-[#d97706]/20 text-[#d97706] border border-[#d97706]/30' : 'text-textMuted hover:text-textMain'}`}
          >
            <BarChart size={16} /> Reporting
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium">
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-primary/20 text-textMuted hover:text-primary transition-colors border border-transparent hover:border-primary/30"
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <span className="flex items-center gap-2 text-secondary">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            System Online
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
        {activeView === 'dashboard' ? (
          <Dashboard setGlobalScanData={setScanData} />
        ) : activeView === 'inventory' ? (
          <AssetInventory assetData={scanData?.asset_inventory || null} target={scanData?.target || scanData?.asset_domain || ''} />
        ) : activeView === 'discovery' ? (
          <AssetDiscovery assetData={scanData?.asset_inventory || null} target={scanData?.target || scanData?.asset_domain || ''} />
        ) : activeView === 'cbom' ? (
          <CbomPage />
        ) : activeView === 'rating' ? (
          <CyberRating />
        ) : (
          <Reporting />
        )}
      </main>
      <Chatbot />
    </div>
  );
}

export default App;
