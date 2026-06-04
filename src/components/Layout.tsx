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
      <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center shadow-lg shadow-zinc-200">
        <FileText className="w-5 h-5 text-white" />
      </div>
      <span className="font-bold text-xl text-zinc-900 tracking-tight">SoloBid</span>
    </Link>
  );

  const NavLinks = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        
        // Show all but maybe visually distinguish protected ones for guests?
        // Or just let them click and be prompted to login.
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              isActive 
                ? 'bg-zinc-900 text-white shadow-md shadow-zinc-200 font-medium' 
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
              {!user && !item.public && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full border border-white" />
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
            <Button variant="outline" size="sm" onClick={() => navigate('/login')} className="text-xs">
              Sign In
            </Button>
          )}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:bg-zinc-100">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 border-r-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <div className="p-6 border-b">
                <Logo onClick={() => setIsMenuOpen(false)} />
              </div>
              <div className="p-4 flex flex-col gap-2 mt-2">
                <NavLinks onItemClick={() => setIsMenuOpen(false)} />
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 border-t bg-white space-y-3">
                {profile && (
                  <div className="flex items-center gap-3 mb-4 p-2 bg-zinc-50 rounded-lg">
                    <div className="w-10 h-10 bg-zinc-200 rounded-full flex items-center justify-center font-bold text-zinc-600">
                      {profile.businessName?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{profile.businessName}</p>
                      <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                )}
                {deferredPrompt && (
                  <Button variant="outline" className="w-full justify-start text-zinc-900 border-zinc-200" onClick={() => { handleInstallClick(); setIsMenuOpen(false); }}>
                    <Download className="w-5 h-5 mr-3" />
                    Install App
                  </Button>
                )}
                {user ? (
                  <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100" onClick={async () => { await handleSignOut(); setIsMenuOpen(false); }}>
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                  </Button>
                ) : (
                  <Button className="w-full justify-start bg-zinc-900 text-white" onClick={() => { navigate('/login'); setIsMenuOpen(false); }}>
                    <LogOut className="w-5 h-5 mr-3 rotate-180" />
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
            <div className="mt-4 p-3 bg-zinc-50 rounded-lg border border-zinc-100">
              <p className="text-xs text-zinc-500 leading-relaxed">
                You are viewing SoloBid in <strong>Demo Mode</strong>. 
              </p>
              <Button size="sm" className="w-full mt-2 h-8 text-xs bg-zinc-900" onClick={() => navigate('/login')}>
                Sign Up Now
              </Button>
            </div>
          )}
        </div>
        <div className="p-4 flex flex-col gap-1 flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="p-6 border-t bg-zinc-50/50 space-y-3">
          {profile && (
            <div className="flex items-center gap-3 mb-2 p-2">
              <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center font-bold text-white shadow-md">
                {profile.businessName?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{profile.businessName}</p>
                <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
              </div>
            </div>
          )}
          {deferredPrompt && (
            <Button variant="outline" className="w-full justify-start text-zinc-900 border-zinc-200 hover:bg-white" onClick={handleInstallClick}>
              <Download className="w-5 h-5 mr-3" />
              Install App
            </Button>
          )}
          {user ? (
            <Button variant="ghost" className="w-full justify-start text-zinc-500 hover:text-red-600 hover:bg-red-50" onClick={handleSignOut}>
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </Button>
          ) : (
            <Button variant="ghost" className="w-full justify-start text-zinc-500 hover:text-zinc-900" onClick={() => navigate('/login')}>
              <LogOut className="w-5 h-5 mr-3 rotate-180" />
              Sign In
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 md:ml-72 p-4 md:p-10 ${!isOnline ? 'mt-10' : ''}`}>
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
