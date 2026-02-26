'use client';

import { motion } from 'motion/react';
import { BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface AnalyticsDay {
  date: string;
  label: string;
  success: number;
  failed: number;
  total: number;
}

interface Props {
  data: AnalyticsDay[];
  loading?: boolean;
}

// Custom tooltip with dark theme
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[11px] text-slate-300">
            {entry.name}: <span className="font-bold text-white">{entry.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">7-Day History</span>
        </div>
        <div className="h-48 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const hasData = data.some(d => d.total > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            7-Day Processing History
          </span>
        </div>
        {hasData && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-[9px] text-slate-500 font-medium">Success</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="text-[9px] text-slate-500 font-medium">Failed</span>
            </div>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="h-48 flex flex-col items-center justify-center text-slate-700">
          <BarChart3 className="w-10 h-10 mb-2 opacity-20" />
          <p className="text-xs font-medium">No processing data yet</p>
          <p className="text-[10px] opacity-60 mt-0.5">Chart will populate as movies are processed</p>
        </div>
      ) : (
        <div className="h-52 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 9, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                interval={0}
                tickFormatter={(v) => v.split(' ')[0]}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="success"
                name="Success"
                stroke="#34d399"
                strokeWidth={2.5}
                dot={{ fill: '#34d399', strokeWidth: 0, r: 4 }}
                activeDot={{ fill: '#34d399', strokeWidth: 2, stroke: '#030303', r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="failed"
                name="Failed"
                stroke="#fb7185"
                strokeWidth={2.5}
                dot={{ fill: '#fb7185', strokeWidth: 0, r: 4 }}
                activeDot={{ fill: '#fb7185', strokeWidth: 2, stroke: '#030303', r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary row */}
      {hasData && (
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/[0.04]">
          <div className="text-center">
            <p className="text-[8px] text-slate-600 uppercase font-bold">Total</p>
            <p className="text-lg font-black text-white">{data.reduce((s, d) => s + d.total, 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] text-slate-600 uppercase font-bold">Success</p>
            <p className="text-lg font-black text-emerald-400">{data.reduce((s, d) => s + d.success, 0)}</p>
          </div>
          <div className="text-center">
            <p className="text-[8px] text-slate-600 uppercase font-bold">Failed</p>
            <p className="text-lg font-black text-rose-400">{data.reduce((s, d) => s + d.failed, 0)}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
