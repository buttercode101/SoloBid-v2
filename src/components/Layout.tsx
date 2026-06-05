import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from './ui/button';
import { LayoutDashboard, FileText, FileSpreadsheet, Settings, LogOut, Menu, Users, RefreshCw, Download, AlertCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from './ui/sheet';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function Layout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const isOnline = useOnlineStatus();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  // Auto-hide menu when navigating or changing routes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, public: true },
    { name: 'Clients', path: '/clients', icon: Users, public: false },
    { name: 'Invoices', path: '/invoices', icon: FileSpreadsheet, public: false },
    { name: 'Recurring', path: '/recurring', icon: RefreshCw, public: false },
    { name: 'Templates', path: '/templates', icon: FileText, public: false },
    { name: 'Settings', path: '/settings', icon: Settings, public: false },
  ];

  const Logo = ({ onClick }: { onClick?: () => void }) => (
    <Link to="/" className="flex items-center gap-2" onClick={onClick}>
      <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-teal-100">
        <FileText className="w-4.5 h-4.5 text-white stroke-[2.5]" />
      </div>
      <span className="font-bold text-lg text-zinc-900 tracking-tight">SoloBid</span>
    </Link>
  );

  const NavLinks = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              isActive 
                ? 'bg-primary text-white shadow-sm font-bold active:scale-[0.985]' 
                : 'text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-950'
            }`}
          >
            <div className="relative">
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
              {!user && !item.public && (
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-400 rounded-full border border-white" />
              )}
            </div>
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 p-3 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-800">
            You're offline. Changes will sync when you're back online.
          </span>
        </div>
      )}
      
      {/* Mobile Header */}
      <div className={`md:hidden flex items-center justify-between p-4 bg-white border-b sticky top-0 z-40 ${!isOnline ? 'mt-10' : ''}`}>
        <Logo />
        <div className="flex items-center gap-2">
          {!user && (
            <Button variant="outline" size="sm" onClick={() => navigate('/login')} className="text-xs h-8.5 rounded-lg border-zinc-200 text-zinc-700">
              Sign In
            </Button>
          )}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-zinc-100 h-9.5 w-9.5 rounded-xl">
                <Menu className="w-5.5 h-5.5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 border-r-0 rounded-r-3xl bg-white flex flex-col h-full shadow-2xl">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="p-6 border-b">
                <Logo onClick={() => setIsMenuOpen(false)} />
              </div>
              <div className="p-4 flex flex-col gap-1.5 mt-2 flex-grow overflow-y-auto">
                <NavLinks onItemClick={() => setIsMenuOpen(false)} />
              </div>
              <div className="p-6 border-t bg-zinc-50/50 space-y-3 shrink-0">
                {profile && (
                  <div className="flex items-center gap-3 mb-2 p-2 bg-white border border-zinc-100 rounded-2xl shadow-sm">
                    <div className="w-10 h-10 bg-teal-50 text-primary border border-teal-100 rounded-full flex items-center justify-center font-bold">
                      {profile.businessName?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-900 truncate">{profile.businessName}</p>
                      <p className="text-[10px] text-zinc-400 font-medium truncate">{user?.email}</p>
                    </div>
                  </div>
                )}
                {deferredPrompt && (
                  <Button variant="outline" className="w-full justify-start text-zinc-900 border-zinc-200 h-9.5 rounded-xl text-xs font-semibold" onClick={() => { handleInstallClick(); setIsMenuOpen(false); }}>
                    <Download className="w-4 h-4 mr-2" />
                    Install App
                  </Button>
                )}
                {user ? (
                  <Button variant="ghost" className="w-full justify-start text-red-650 hover:text-red-700 hover:bg-red-50 h-9.5 rounded-xl text-xs font-bold" onClick={async () => { await handleSignOut(); setIsMenuOpen(false); }}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                ) : (
                  <Button className="w-full justify-start bg-primary hover:bg-[#03362f] text-white h-9.5 rounded-xl text-xs font-semibold" onClick={() => { navigate('/login'); setIsMenuOpen(false); }}>
                    <LogOut className="w-4 h-4 mr-2 rotate-180" />
                    Get Started
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className={`hidden md:flex w-72 bg-white border-r flex-col fixed h-full ${!isOnline ? 'mt-10' : ''}`}>
        <div className="p-8 pb-6">
          <Logo />
          {!user && (
            <div className="mt-4 p-3 bg-teal-50/20 rounded-2xl border border-teal-100/50">
              <p className="text-xs text-primary font-semibold leading-relaxed">
                You are viewing SoloBid in <strong>Demo Mode</strong>. 
              </p>
              <Button size="sm" className="w-full mt-2.5 h-8.5 rounded-xl text-xs bg-primary hover:bg-[#03362f] active:scale-[0.985] text-white" onClick={() => navigate('/login')}>
                Sign Up Now
              </Button>
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col gap-1.5 flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="p-6 border-t bg-zinc-50/15 space-y-3">
          {profile && (
            <div className="flex items-center gap-3 mb-2 p-2 rounded-2xl bg-zinc-50 border border-zinc-200/40">
              <div className="w-10 h-10 bg-teal-50 text-primary border border-teal-100 rounded-full flex items-center justify-center font-bold shadow-sm">
                {profile.businessName?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-zinc-900 truncate">{profile.businessName}</p>
                <p className="text-[10px] text-zinc-400 font-medium truncate">{user?.email}</p>
              </div>
            </div>
          )}
          {deferredPrompt && (
            <Button variant="outline" className="w-full h-9.5 rounded-xl justify-start text-zinc-700 border-zinc-200 hover:bg-zinc-50 text-xs font-semibold" onClick={handleInstallClick}>
              <Download className="w-4 h-4 mr-2 text-zinc-550" />
              Install App
            </Button>
          )}
          {user ? (
            <Button variant="ghost" className="w-full h-9.5 rounded-xl justify-start text-zinc-500 hover:text-red-650 hover:bg-red-50 text-xs font-semibold" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          ) : (
            <Button variant="ghost" className="w-full h-9.5 rounded-xl justify-start text-zinc-500 hover:text-zinc-900 text-xs font-semibold" onClick={() => navigate('/login')}>
              <LogOut className="w-4 h-4 mr-2 rotate-180" />
              Sign In
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 md:ml-72 p-4 md:p-10 ${!isOnline ? 'mt-10' : ''}`}>
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
