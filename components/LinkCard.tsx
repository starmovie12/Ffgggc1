'use client';

import { Video, CircleCheck, CircleDashed, Copy, Check, AlertCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface LogEntry {
  msg: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

interface LinkCardProps {
  id: number;
  name: string;
  logs: LogEntry[];
  finalLink: string | null;
  status: 'processing' | 'done' | 'error';
}

export default function LinkCard({ id, name, logs, finalLink, status }: LinkCardProps) {
  const [copied, setCopied] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = async () => {
    if (!finalLink) return;
    try {
      await navigator.clipboard.writeText(finalLink);
      setCopied(true);
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'done': return 'border-emerald-500 bg-emerald-500/5';
      case 'error': return 'border-rose-500 bg-rose-500/5';
      default: return 'border-indigo-500 bg-white/5';
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-emerald-400 font-bold';
      case 'error': return 'text-rose-400';
      case 'warn': return 'text-amber-400';
      case 'info': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 mb-4 rounded-2xl border-l-4 backdrop-blur-md border transition-all duration-300 ${getStatusColor()}`}
    >
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-bold flex items-center gap-2 truncate max-w-[80%]">
          <Video className="w-4 h-4 text-indigo-400" />
          {name}
        </span>
        {status === 'processing' ? (
          <CircleDashed className="w-5 h-5 text-indigo-500 animate-spin" />
        ) : status === 'done' ? (
          <CircleCheck className="w-5 h-5 text-emerald-500" />
        ) : (
          <AlertCircle className="w-5 h-5 text-rose-500" />
        )}
      </div>

      {/* Live Logs Terminal */}
      {logs.length > 0 && (
        <div 
          ref={logEndRef}
          className="bg-black/80 p-3 rounded-lg font-mono text-[11px] max-h-[150px] overflow-y-auto border border-white/5 scrollbar-hide mb-3"
        >
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${getLogColor(log.type)}`}>
              {`> ${log.msg}`}
            </div>
          ))}
          {status === 'processing' && (
            <div className="text-slate-500 animate-pulse mt-1">{'> Processing...'}</div>
          )}
        </div>
      )}

      {/* No logs but processing */}
      {logs.length === 0 && status === 'processing' && (
        <div className="bg-black/80 p-3 rounded-lg font-mono text-[11px] border border-white/5 mb-3">
          <div className="text-slate-500 animate-pulse">{'> Queued for processing...'}</div>
        </div>
      )}

      <AnimatePresence>
        {finalLink && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden"
          >
            <div 
              onClick={handleCopy}
              className="w-full bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 py-3 px-4 rounded-xl font-mono text-xs font-bold text-center cursor-pointer hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
            >
              <span className="truncate">{copied ? 'COPIED TO CLIPBOARD! ✅' : finalLink}</span>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
