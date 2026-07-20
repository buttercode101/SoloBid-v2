import React from 'react';
import { CheckCheck } from 'lucide-react';

interface WhatsAppMessageProps {
  message: string;
  sent?: boolean;
  timestamp?: string;
}

export const WhatsAppMessage: React.FC<WhatsAppMessageProps> = ({
  message,
  sent = true,
  timestamp,
}) => {
  const defaultTimestamp = new Date().toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex ${sent ? 'justify-end' : 'justify-start'} mb-4`}
      role="listitem"
      aria-label={sent ? 'Sent message' : 'Received message'}
    >
      <div
        className="max-w-[95%] rounded-3xl px-5 py-4 shadow-sm bg-[#DCF8C6] dark:bg-emerald-900/40 text-slate-900 dark:text-slate-100 border border-emerald-100 dark:border-emerald-800"
        role="article"
      >
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap font-medium">
          {message}
        </p>
        <div className="flex items-center justify-end gap-1.5 mt-2 opacity-40">
          <span className="text-[10px] font-bold uppercase" aria-label={`Sent at ${timestamp || defaultTimestamp}`}>
            {timestamp || defaultTimestamp}
          </span>
          {sent && (
            <CheckCheck className="w-3.5 h-3.5" aria-label="Read" />
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMessage;
