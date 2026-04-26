import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import IntelligenceHub from './components/IntelligenceHub';
import SubsidyTracker from './components/SubsidyTracker';
import SupplierBoard from './components/SupplierBoard';
import MarketBoard from './components/MarketBoard';
import { TbPlant2 } from 'react-icons/tb';
import { FiSun, FiAward, FiPackage, FiTrendingUp, FiMenu, FiX, FiLogOut, FiUser } from 'react-icons/fi';

const NAV_ITEMS = [
  { id: 'intelligence', label: 'Intelligence Hub', icon: FiSun, section: 'intelligence-hub' },
  { id: 'subsidies', label: 'Subsidies', icon: FiAward, section: 'subsidy-tracker' },
  { id: 'suppliers', label: 'Sourcing Board', icon: FiPackage, section: 'supplier-board' },
  { id: 'market', label: 'Market & Mandi', icon: FiTrendingUp, section: 'market-board' },
];

function Navbar({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollTo = (tab) => {
    setActiveTab(tab.id);
    setMobileOpen(false);
    document.getElementById(tab.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="sticky top-0 z-50 glass-card border-b border-white/10 backdrop-blur-xl rounded-none px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-500/20 rounded-xl">
            <TbPlant2 className="text-brand-400 text-2xl" />
          </div>
          <div>
            <h1 className="text-lg font-black gradient-text leading-none">Flora-Yield</h1>
            <p className="text-xs text-slate-500 leading-none">Mandi · Himachal Pradesh</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => scrollTo(item)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${active ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <Icon className="text-base" />{item.label}
              </button>
            );
          })}
        </div>

        {/* User menu */}
        <div className="hidden md:flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 glass-card rounded-xl border border-white/10">
            <FiUser className="text-brand-400 text-sm" />
            <span className="text-slate-300 text-sm font-medium">{user?.name || 'Farmer'}</span>
          </div>
          <button onClick={logout} title="Sign out"
            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <FiLogOut />
          </button>
        </div>

        <button className="md:hidden p-2 rounded-xl glass-card text-slate-400 hover:text-white"
          onClick={() => setMobileOpen((o) => !o)}>
          {mobileOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden mt-3 space-y-1 border-t border-white/10 pt-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => scrollTo(item)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-all">
                <Icon />{item.label}
              </button>
            );
          })}
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all">
            <FiLogOut />Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <div className="relative overflow-hidden py-16 px-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-brand-600/10 blur-3xl pointer-events-none" />
      <div className="max-w-3xl mx-auto text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 glass-card border-brand-500/30 text-brand-400 text-xs font-semibold mb-6 animate-fade-in">
          <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse-slow" />
          AI-Powered Agritech Platform · Mandi, HP
        </div>
        <h1 className="text-4xl md:text-6xl font-black mb-4 animate-slide-up">
          <span className="gradient-text">Grow Smarter.</span><br />
          <span className="text-white">Profit More.</span>
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed animate-fade-in">
          Soil-aware crop recommendations, government subsidies, verified local suppliers, and direct B2B buyer connections — all in one dashboard.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {[{ label: 'Microservices Architecture', emoji: '⚙️' }, { label: 'Redis Caching', emoji: '⚡' }, { label: 'Live Mandi Prices', emoji: '📊' }, { label: 'B2B Buyer Network', emoji: '🤝' }].map((tag) => (
            <span key={tag.label} className="glass-card px-4 py-2 text-sm text-slate-300 flex items-center gap-2">
              <span>{tag.emoji}</span>{tag.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState('intelligence');
  return (
    <div className="min-h-screen">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <Hero />
      <main className="max-w-7xl mx-auto px-4 pb-20 space-y-16">
        <IntelligenceHub />
        <div className="border-t border-white/5" />
        <SubsidyTracker />
        <div className="border-t border-white/5" />
        <SupplierBoard />
        <div className="border-t border-white/5" />
        <MarketBoard />
      </main>
      <footer className="border-t border-white/5 py-8 text-center text-slate-600 text-xs">
        <p>Flora-Yield v2.0 · Microservices · Redis · API Gateway · Service Registry</p>
        <p className="mt-1">© {new Date().getFullYear()} Flora-Yield · Mandi, Himachal Pradesh</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
