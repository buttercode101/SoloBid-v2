import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from './ui/button';
import { LayoutDashboard, FileText, FileSpreadsheet, Settings, LogOut, Menu, Users, RefreshCw, Download, AlertCircle, BarChart3, Plus } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from './ui/sheet';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const navGroups = [
  {
    title: 'Command',
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Reports', path: '/reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Workflows',
    items: [
      { name: 'Clients', path: '/clients', icon: Users },
      { name: 'Invoices', path: '/invoices', icon: FileSpreadsheet },
      { name: 'Recurring', path: '/recurring', icon: RefreshCw },
      { name: 'Templates', path: '/templates', icon: FileText },
    ],
  },
  {
    title: 'System',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ],
  },
];

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
    navigate('/');
  };

  const isActivePath = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const Logo = ({ onClick, compact = false }: { onClick?: () => void; compact?: boolean }) => (
    <Link to="/dashboard" className="flex items-center gap-2.5" onClick={onClick}>
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-teal-950/10">
        <FileText className="h-4.5 w-4.5 stroke-[2.5]" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <span className="block text-base font-black tracking-[-0.03em] text-zinc-950">SoloBid</span>
          <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Quote to paid</span>
        </div>
      )}
    </Link>
  );

  const NavLinks = ({ onItemClick }: { onItemClick?: () => void }) => (
    <div className="space-y-6">
      {navGroups.map((group) => (
        <div key={group.title} className="space-y-2">
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-400">
            {group.title}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onItemClick}
                  className={`group flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-white shadow-lg shadow-teal-950/10 active:scale-[0.985]'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${isActive ? 'bg-white/12' : 'bg-zinc-100 text-zinc-400 group-hover:bg-white group-hover:text-zinc-700'}`}>
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : ''}`} />
                    </span>
                    {item.name}
                  </span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white/60" />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const WorkspaceCard = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`${mobile ? 'bg-white' : 'bg-zinc-50/70'} rounded-3xl border border-zinc-200/70 p-3 shadow-sm`}>
      {profile ? (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-teal-100 bg-teal-50 text-sm font-black text-primary shadow-sm">
            {profile.businessName?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black tracking-tight text-zinc-950">{profile.businessName}</p>
            <p className="truncate text-[11px] font-medium text-zinc-400">{user?.email}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-black tracking-tight text-zinc-950">Workspace</p>
            <p className="text-[11px] font-medium text-zinc-400">SoloBid account</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50">
      {!isOnline && (
        <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800">
            You're offline. Changes will sync when you're back online.
          </span>
        </div>
      )}

      <div className={`md:hidden sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl ${!isOnline ? 'mt-10' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <Logo compact />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black tracking-tight text-zinc-950">SoloBid</p>
            <p className="truncate text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">Business workspace</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/quotes/new"
              className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-white shadow-sm shadow-teal-950/10 active:scale-95 transition-transform"
              title="New Quote"
            >
              <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
            </Link>
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl hover:bg-zinc-100">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex h-full w-80 flex-col border-r-0 bg-white p-0 shadow-2xl sm:max-w-sm">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="border-b border-zinc-100 p-5">
                  <Logo onClick={() => setIsMenuOpen(false)} />
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <NavLinks onItemClick={() => setIsMenuOpen(false)} />
                </div>
                <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 p-5">
                  <WorkspaceCard mobile />
                  {deferredPrompt && (
                    <Button variant="outline" className="h-10 w-full justify-start rounded-2xl border-zinc-200 text-xs font-bold text-zinc-900" onClick={() => { handleInstallClick(); setIsMenuOpen(false); }}>
                      <Download className="mr-2 h-4 w-4" />
                      Install App
                    </Button>
                  )}
                  <Button variant="ghost" className="h-10 w-full justify-start rounded-2xl text-xs font-black text-red-600 hover:bg-red-50 hover:text-red-700" onClick={async () => { await handleSignOut(); setIsMenuOpen(false); }}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <aside className={`fixed hidden h-full w-72 flex-col border-r border-zinc-200/80 bg-white/92 backdrop-blur-xl md:flex ${!isOnline ? 'mt-10' : ''}`}>
        <div className="p-6 pb-5">
          <Logo />
        </div>
        <div className="px-4 pb-4">
          <Link
            to="/quotes/new"
            className="flex items-center justify-between rounded-3xl bg-zinc-950 px-4 py-4 text-white shadow-xl shadow-zinc-950/10 transition-all hover:-translate-y-0.5 hover:bg-zinc-900"
          >
            <span>
              <span className="block text-sm font-black tracking-tight">New Quote</span>
              <span className="block text-xs font-medium text-white/55">Create, send, approve</span>
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zinc-950">
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </span>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 pb-5">
          <NavLinks />
        </nav>
        <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/40 p-5">
          <WorkspaceCard />
          {deferredPrompt && (
            <Button variant="outline" className="h-10 w-full justify-start rounded-2xl border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-white" onClick={handleInstallClick}>
              <Download className="mr-2 h-4 w-4 text-zinc-500" />
              Install App
            </Button>
          )}
          <Button variant="ghost" className="h-10 w-full justify-start rounded-2xl text-xs font-bold text-zinc-500 hover:bg-red-50 hover:text-red-700" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className={`min-h-screen md:ml-72 ${!isOnline ? 'mt-10' : ''}`}>
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 md:px-8 md:py-8 lg:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
