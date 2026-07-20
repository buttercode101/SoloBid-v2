import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Settings2, Building, Globe, BellRing, Shield, Download, Trash2, Moon, Sun, ChevronRight } from 'lucide-react';
import { Settings } from '../../types';
import { CURRENCY_OPTIONS } from '../../constants';

interface SettingsModalProps {
  settings: Settings;
  onSave: (settings: Partial<Settings>) => void;
  onClose: () => void;
  onExport: () => void;
  onReset: () => void;
  isResetting: boolean;
  onRequestNotifications: () => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onSave,
  onClose,
  onExport,
  onReset,
  isResetting,
  onRequestNotifications,
  darkMode,
  onToggleDarkMode,
}) => {
  const [localBusinessName, setLocalBusinessName] = useState(settings.businessName);
  const [localBusinessEmail, setLocalBusinessEmail] = useState(settings.businessEmail);

  // Debounced save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localBusinessName !== settings.businessName || localBusinessEmail !== settings.businessEmail) {
        onSave({
          businessName: localBusinessName,
          businessEmail: localBusinessEmail,
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [localBusinessName, localBusinessEmail, onSave, settings.businessName, settings.businessEmail]);

  const inputClass = "w-full px-5 py-4 border border-gray-200 dark:border-slate-600 rounded-[22px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 transition-all duration-300 outline-none shadow-sm hover:border-gray-300 dark:hover:border-slate-500 font-medium";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[60] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-gray-50 dark:bg-slate-800 rounded-[32px] sm:rounded-[36px] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/20 dark:border-slate-700 transition-colors"
      >
        <div className="px-6 sm:px-8 py-6 sm:py-8 bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex items-center justify-between transition-colors">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-blue-600 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl text-white shadow-lg">
              <Settings2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 id="settings-title" className="font-black text-xl sm:text-2xl text-slate-900 dark:text-white">Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            aria-label="Close settings"
          >
            <X className="w-6 h-6 sm:w-7 sm:h-7 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 sm:space-y-10">
          {/* Profile Section */}
          <section className="space-y-5">
            <h4 className="flex items-center gap-2 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] px-1">
              <Building className="w-4 h-4" />
              Profile
            </h4>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-200 dark:border-slate-700 space-y-6 shadow-sm transition-colors">
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                  Business Name
                </label>
                <input
                  type="text"
                  value={localBusinessName}
                  onChange={(e) => setLocalBusinessName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className={inputClass}
                  aria-label="Business name"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                  Business Email
                </label>
                <input
                  type="email"
                  value={localBusinessEmail}
                  onChange={(e) => setLocalBusinessEmail(e.target.value)}
                  placeholder="hello@yourbusiness.com"
                  className={inputClass}
                  aria-label="Business email"
                />
              </div>
            </div>
          </section>

          {/* Localization */}
          <section className="space-y-5">
            <h4 className="flex items-center gap-2 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] px-1">
              <Globe className="w-4 h-4" />
              Localization
            </h4>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm transition-colors">
              <label className="block text-xs font-black text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                Currency
              </label>
              <select
                value={settings.currency}
                onChange={(e) => onSave({ currency: e.target.value })}
                className={inputClass}
                aria-label="Select currency"
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Appearance */}
          <section className="space-y-5">
            <h4 className="flex items-center gap-2 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] px-1">
              {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              Appearance
            </h4>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm transition-colors">
              <button
                onClick={onToggleDarkMode}
                className="w-full flex items-center justify-between group"
                aria-pressed={darkMode}
                aria-label={darkMode ? 'Disable dark mode' : 'Enable dark mode'}
              >
                <div className="text-left">
                  <p className="font-black text-slate-900 dark:text-white text-sm">Dark Mode</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    {darkMode ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'} relative`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${darkMode ? 'left-7' : 'left-1'}`} />
                </div>
              </button>
            </div>
          </section>

          {/* Notifications */}
          <section className="space-y-5">
            <h4 className="flex items-center gap-2 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] px-1">
              <BellRing className="w-4 h-4" />
              Notifications
            </h4>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-200 dark:border-slate-700 shadow-sm transition-colors">
              <button
                onClick={onRequestNotifications}
                className="w-full flex items-center justify-between group"
                aria-label="Enable browser notifications"
              >
                <div className="text-left">
                  <p className="font-black text-slate-900 dark:text-white text-sm">Browser Alerts</p>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">
                    {Notification.permission === 'granted' ? 'Enabled' : 'Enable system notifications'}
                  </p>
                </div>
                {Notification.permission !== 'granted' && (
                  <ChevronRight className="w-4 h-4 text-blue-300" />
                )}
              </button>
            </div>
          </section>

          {/* Security & Data */}
          <section className="space-y-5">
            <h4 className="flex items-center gap-2 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] px-1">
              <Shield className="w-4 h-4" />
              Security & Data
            </h4>
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm transition-colors">
              <button
                onClick={onExport}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-700 border-b dark:border-slate-700 transition-colors group"
                aria-label="Export records as CSV"
              >
                <span className="flex items-center gap-3 font-bold text-slate-700 dark:text-slate-300">
                  <Download className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                  Export Records (CSV)
                </span>
              </button>
              <button
                onClick={onReset}
                disabled={isResetting}
                className={`w-full flex items-center gap-3 p-5 transition-colors font-black ${
                  isResetting
                    ? 'bg-gray-100 dark:bg-slate-700 text-gray-400'
                    : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400'
                }`}
                aria-label="Reset all data"
              >
                <Trash2 className={`w-5 h-5 ${isResetting ? 'animate-pulse' : ''}`} />
                {isResetting ? 'Purging System...' : 'Reset Everything'}
              </button>
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SettingsModal;
