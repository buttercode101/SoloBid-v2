import React from 'react';
import { Shield, Bell, Settings as SettingsIcon, Zap } from 'lucide-react';

interface HeaderProps {
  businessName?: string;
  hasUrgentPayments: boolean;
  onNotificationClick: () => void;
  onSettingsClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  businessName = 'Debt Chaser',
  hasUrgentPayments,
  onNotificationClick,
  onSettingsClick,
}) => {
  return (
    <header className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 sticky top-0 z-40 px-4 sm:px-6 py-4 sm:py-6 transition-colors">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="bg-slate-900 dark:bg-blue-600 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-white shadow-lg rotate-3"
            aria-hidden="true"
          >
            <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
              {businessName}
            </h1>
            <p className="text-[8px] sm:text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mt-1">
              Recovery Protocol Active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {hasUrgentPayments && (
            <button
              onClick={onNotificationClick}
              className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl sm:rounded-2xl text-blue-600 dark:text-blue-400 transition-all active:scale-90 relative"
              aria-label="View payment notifications"
              aria-pressed="false"
            >
              <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
              <span
                className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 animate-ping"
                aria-hidden="true"
              />
            </button>
          )}
          <button
            onClick={onSettingsClick}
            className="p-2 sm:p-3 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-xl sm:rounded-2xl text-slate-400 dark:text-slate-300 transition-all active:scale-90"
            aria-label="Open settings"
          >
            <SettingsIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
