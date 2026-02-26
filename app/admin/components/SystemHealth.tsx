'use client';

import { motion } from 'motion/react';
import { Wifi, WifiOff, RefreshCw, Server } from 'lucide-react';

interface HealthData {
  hubcloud: { online: boolean; latency: number; port: number };
  timer: { online: boolean; latency: number; port: number };
  checkedAt: string;
}

interface Props {
  health: HealthData | null;
  loading: boolean;
  onRefresh: () => void;
}

export default function SystemHealth({ health, loading, onRefresh }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">VPS Health</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="text-[9px] font-bold text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Check Now
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          {
            name: 'HubCloud Solver',
            data: health?.hubcloud,
            port: 5001,
            gradient: 'from-emerald-950/40 to-slate-900/80',
            border: 'border-emerald-500/15',
          },
          {
            name: 'Timer Bypass',
            data: health?.timer,
            port: 10000,
            gradient: 'from-cyan-950/40 to-slate-900/80',
            border: 'border-cyan-500/15',
          },
        ].map(({ name, data, port, gradient, border }) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-gradient-to-br ${gradient} border ${border} rounded-2xl p-3.5 relative overflow-hidden`}
          >
            {/* Status indicator */}
            <div className="flex items-center gap-2 mb-2">
              {data ? (
                data.online ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative rounded-full h-2.5 w-2.5 bg-emerald-400" />
                  </span>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                )
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600 animate-pulse" />
              )}
              <span className={`text-[9px] font-bold uppercase tracking-wider ${data?.online ? 'text-emerald-400' : data ? 'text-rose-400' : 'text-slate-600'}`}>
                {data ? (data.online ? 'ONLINE' : 'OFFLINE') : 'CHECKING...'}
              </span>
            </div>

            <p className="text-xs font-bold text-white leading-tight">{name}</p>
            <p className="text-[9px] text-slate-600 font-mono mt-0.5">Port {port}</p>

            {data && (
              <p className={`text-lg font-black mt-1.5 ${data.online ? 'text-emerald-400' : 'text-rose-400'}`}>
                {data.latency}ms
              </p>
            )}

            {/* Background icon */}
            {data?.online ? (
              <Wifi className="absolute bottom-2 right-2 w-6 h-6 text-emerald-400 opacity-10" />
            ) : (
              <WifiOff className="absolute bottom-2 right-2 w-6 h-6 text-rose-400 opacity-10" />
            )}
          </motion.div>
        ))}
      </div>

      {health?.checkedAt && (
        <p className="text-[8px] text-slate-700 font-mono mt-2 text-right">
          Last check: {new Date(health.checkedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
