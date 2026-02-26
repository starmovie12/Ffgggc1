'use client';

import { motion } from 'motion/react';
import {
  Activity, CheckCircle2, XCircle, Loader2, Clock,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  linksCount: number;
  linksDone: number;
}

function timeAgo(iso?: string) {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return '—'; }
}

interface Props {
  activities: ActivityItem[];
  loading: boolean;
}

export default function ActivityFeed({ activities, loading }: Props) {
  if (loading && activities.length === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Feed</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-white/[0.02] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute h-full w-full rounded-full bg-rose-400 opacity-60" />
            <span className="relative rounded-full h-2 w-2 bg-rose-400" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Feed</span>
        </div>
        {activities.length > 0 && (
          <span className="text-[9px] text-slate-700 font-mono bg-white/5 px-2 py-0.5 rounded-full">
            {activities.length} entries
          </span>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8 text-slate-700">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-[10px] font-medium">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {activities.map((item, idx) => {
            const s = (item.status || '').toLowerCase();
            const isSuccess = s === 'completed';
            const isFail = s === 'failed';
            const isProcessing = s === 'processing';

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${
                  isSuccess ? 'bg-emerald-500/5' :
                  isFail ? 'bg-rose-500/5' :
                  isProcessing ? 'bg-indigo-500/5' :
                  'bg-white/[0.02]'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isSuccess ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isFail ? (
                    <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  ) : isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-300 font-medium truncate leading-tight">
                    {isProcessing && '⚡ Processing '}
                    {isSuccess && '✅ '}
                    {isFail && '❌ '}
                    &quot;{item.title}&quot;
                    {isSuccess && ` — ${item.linksDone}/${item.linksCount}`}
                    {isFail && ' — failed'}
                    {isProcessing && ` — ${item.linksDone}/${item.linksCount} links`}
                  </p>
                </div>

                <span className="text-[8px] text-slate-700 font-mono flex-shrink-0 mt-0.5">
                  {timeAgo(item.updatedAt)}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
