'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield, RefreshCw, Trash2, RotateCcw, Film, Tv2, CheckCircle2,
  XCircle, Loader2, ChevronDown, ChevronUp, Activity,
  Database, Zap, LogOut, Eye, EyeOff, BarChart3,
  AlertTriangle, TrendingUp, Hash, Link2, Cpu,
  List, Search, Bell, Settings, Copy, Check,
  Clock, Plus, Upload,
} from 'lucide-react';

// ── SWR Hooks (Feature 4: Zero-Flicker Fast UI) ──
import {
  useStats, useTasks, useQueue, useActivity, useHealth, useAnalytics,
  adminDelete, adminPatch, adminPost,
} from '@/hooks/useAdminData';

// ── Components ──
import AnalyticsChart from './components/AnalyticsChart';
import SettingsTab from './components/SettingsTab';
import SystemHealth from './components/SystemHealth';
import ActivityFeed from './components/ActivityFeed';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskItem {
  id: string; url: string; status: string; createdAt: string;
  completedAt?: string; links?: any[];
  preview?: { title: string; posterUrl: string | null };
  metadata?: { quality: string; languages: string; audioLabel: string };
}
interface QueueItem {
  id: string; collection: string; type: string; url: string;
  title?: string; status: string; createdAt?: string;
}
type Tab = 'dashboard' | 'tasks' | 'queue' | 'settings';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const PulseDot = ({ color = 'bg-emerald-400' }: { color?: string }) => (
  <span className="relative flex h-2 w-2 flex-shrink-0">
    <span className={`animate-ping absolute h-full w-full rounded-full ${color} opacity-60`} />
    <span className={`relative rounded-full h-2 w-2 ${color}`} />
  </span>
);

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const map: Record<string, string> = {
    completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    done: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    failed: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
    error: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
    processing: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  };
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${map[s] || 'bg-slate-500/15 text-slate-400 border-slate-500/25'}`}>
      {status}
    </span>
  );
}

function StatCard({ label, value, color, bg, border, icon: Icon, pulse = false }: any) {
  return (
    <div className={`${bg} border ${border} rounded-2xl p-4 relative overflow-hidden`}>
      {pulse && value > 0 && <div className="absolute top-2 right-2"><PulseDot color={color.replace('text-', 'bg-')} /></div>}
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">{label}</p>
      <div className="flex items-end justify-between">
        <motion.p key={value} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className={`text-3xl font-black ${color} leading-none`}>{value}</motion.p>
        <Icon className={`w-5 h-5 ${color} opacity-25`} />
      </div>
    </div>
  );
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
import React from 'react';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#030303] flex items-center justify-center px-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/15 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-xl font-black text-white mb-2">Something went wrong</h2>
            <p className="text-xs text-slate-500 mb-4 font-mono">{this.state.error?.message}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (k: string) => void }) {
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('mflix_login_attempts');
    if (stored) {
      const data = JSON.parse(stored);
      if (data.lockUntil && Date.now() < data.lockUntil) {
        setLockUntil(data.lockUntil);
        setAttempts(data.count);
      }
    }
  }, []);

  const isLocked = lockUntil > Date.now();
  const lockRemaining = Math.ceil((lockUntil - Date.now()) / 1000);

  const submit = async () => {
    if (!key.trim() || isLocked) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch('/api/admin?action=stats', { headers: { 'x-admin-key': key } });
      if (res.ok) {
        if (rememberMe) {
          localStorage.setItem('mflix_admin_key', JSON.stringify({ key, expires: Date.now() + 86400000 }));
        } else {
          sessionStorage.setItem('mflix_admin_key', key);
        }
        localStorage.removeItem('mflix_login_attempts');
        onLogin(key);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setShake(true);
        setTimeout(() => setShake(false), 600);
        if (newAttempts >= 5) {
          const lock = Date.now() + 30000;
          setLockUntil(lock);
          localStorage.setItem('mflix_login_attempts', JSON.stringify({ count: newAttempts, lockUntil: lock }));
          setErr('Too many attempts. Try again in 30 seconds.');
        } else {
          localStorage.setItem('mflix_login_attempts', JSON.stringify({ count: newAttempts, lockUntil: 0 }));
          setErr(`Wrong password. (${5 - newAttempts} attempts remaining)`);
        }
      }
    } catch { setErr('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center px-5">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-48 h-48 bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm relative">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-indigo-500/30">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter">MFLIX</h1>
          <p className="text-sm font-bold text-slate-500 mt-0.5 tracking-widest uppercase">Admin Panel</p>
        </div>

        <motion.div animate={shake ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : {}} transition={{ duration: 0.5 }}
          className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-6 backdrop-blur-xl shadow-2xl">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-4">Enter Admin Password</p>
          <div className="relative mb-3">
            <input type={show ? 'text' : 'password'} value={key}
              onChange={e => setKey(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="••••••••••••" disabled={isLocked}
              className="w-full bg-black/60 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder-slate-700 outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/15 pr-12 text-sm transition-all font-mono disabled:opacity-40" />
            <button onClick={() => setShow(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Remember Me */}
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-600 bg-black/60 text-indigo-600 focus:ring-indigo-500/30" />
            <span className="text-[10px] text-slate-500 font-medium">Remember me for 24 hours</span>
          </label>

          <AnimatePresence>
            {err && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5 mb-4">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <p className="text-xs text-rose-400">{err}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={submit} disabled={loading || !key.trim() || isLocked}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 shadow-xl shadow-indigo-500/25">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {isLocked ? `Locked (${lockRemaining}s)` : loading ? 'Authenticating...' : 'Access Admin Panel'}
          </button>
        </motion.div>

        <p className="text-center text-[10px] text-slate-700 mt-5 font-mono">MFLIX PRO v2.0 • Secure Admin</p>
      </motion.div>
    </div>
  );
}

// ─── ADD TO QUEUE FORM ────────────────────────────────────────────────────────
function AddToQueueForm({ adminKey, onAdded }: { adminKey: string; onAdded: () => void }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'movie' | 'webseries'>('movie');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkUrls, setBulkUrls] = useState('');
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setAdding(true);
    try {
      await adminPost(adminKey, { action: 'add-queue', url: url.trim(), title: title.trim() || 'Untitled', type });
      setUrl(''); setTitle('');
      setResult('Added to queue!');
      setTimeout(() => setResult(null), 3000);
      onAdded();
    } catch { setResult('Failed to add'); }
    finally { setAdding(false); }
  };

  const handleBulkImport = async () => {
    const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u.length > 5);
    if (urls.length === 0) return;
    setAdding(true);
    try {
      const res = await adminPost(adminKey, { action: 'bulk-import', urls, type });
      setBulkUrls('');
      setResult(`Imported ${res.count} URLs!`);
      setTimeout(() => setResult(null), 3000);
      onAdded();
    } catch { setResult('Import failed'); }
    finally { setAdding(false); }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add to Queue</span>
        </div>
        <button onClick={() => setBulkMode(!bulkMode)} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300">
          {bulkMode ? 'Single Mode' : 'Bulk Import'}
        </button>
      </div>

      {!bulkMode ? (
        <div className="space-y-2.5">
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://site.com/movie-page..."
            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 outline-none focus:border-indigo-500/70 font-mono transition-all" />
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Movie/Series name (optional)"
            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 outline-none focus:border-indigo-500/70 transition-all" />
          <div className="flex gap-2">
            <div className="flex gap-1.5 flex-1">
              {(['movie', 'webseries'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 border transition-all ${type === t ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-white/[0.03] text-slate-500 border-white/[0.06]'}`}>
                  {t === 'movie' ? <Film className="w-3 h-3" /> : <Tv2 className="w-3 h-3" />}
                  {t === 'movie' ? 'Movie' : 'Series'}
                </button>
              ))}
            </div>
            <button onClick={handleAdd} disabled={adding || !url.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <textarea value={bulkUrls} onChange={e => setBulkUrls(e.target.value)} rows={5}
            placeholder={"Paste multiple URLs (one per line)\nhttps://site.com/movie1\nhttps://site.com/movie2"}
            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 outline-none focus:border-indigo-500/70 font-mono transition-all resize-none" />
          <div className="flex gap-2">
            <div className="flex gap-1.5 flex-1">
              {(['movie', 'webseries'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 border transition-all ${type === t ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-white/[0.03] text-slate-500 border-white/[0.06]'}`}>
                  {t === 'movie' ? <Film className="w-3 h-3" /> : <Tv2 className="w-3 h-3" />}
                  {t === 'movie' ? 'Movie' : 'Series'}
                </button>
              ))}
            </div>
            <button onClick={handleBulkImport} disabled={adding || !bulkUrls.trim()}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-bold flex items-center gap-1.5 disabled:opacity-40 transition-all active:scale-95 shadow-lg shadow-indigo-500/20">
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Import {bulkUrls.split('\n').filter(u => u.trim().length > 5).length || ''}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mt-2.5 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] text-emerald-400 font-bold">{result}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MAIN ADMIN PANEL ─────────────────────────────────────────────────────────
function AdminPanelInner() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [taskFilter, setTaskFilter] = useState('all');
  const [queueTypeFilter, setQueueTypeFilter] = useState('all');
  const [queueStatusFilter, setQueueStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // ── Restore session ──
  useEffect(() => {
    const stored = localStorage.getItem('mflix_admin_key');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        if (data.expires && Date.now() < data.expires) { setAdminKey(data.key); return; }
        else { localStorage.removeItem('mflix_admin_key'); }
      } catch {
        // Legacy format (plain string)
        setAdminKey(stored);
        return;
      }
    }
    const session = sessionStorage.getItem('mflix_admin_key');
    if (session) setAdminKey(session);
  }, []);

  // ── SWR Hooks (Feature 4: Zero-Flicker — no loading spinners on refresh!) ──
  const { stats, mutateStats } = useStats(adminKey);
  const { tasks, mutateTasks } = useTasks(adminKey, taskFilter);
  const { queueItems, mutateQueue } = useQueue(adminKey, queueTypeFilter, queueStatusFilter);
  const { activities, activityLoading } = useActivity(adminKey);
  const { health, healthLoading, mutateHealth } = useHealth(adminKey);
  const { analytics, analyticsLoading } = useAnalytics(adminKey);

  const refreshAll = useCallback(() => {
    mutateStats(); mutateTasks(); mutateQueue();
  }, [mutateStats, mutateTasks, mutateQueue]);

  const deleteItem = async (id: string, collection: string) => {
    setDeletingId(id);
    try {
      await adminDelete(adminKey!, { id, collection });
      mutateTasks(); mutateQueue(); mutateStats();
    } catch {} finally { setDeletingId(null); }
  };

  const patchStatus = async (id: string, collection: string, status: string) => {
    try {
      await adminPatch(adminKey!, { id, collection, status });
      mutateTasks(); mutateQueue(); mutateStats();
    } catch {}
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const logout = () => {
    localStorage.removeItem('mflix_admin_key');
    sessionStorage.removeItem('mflix_admin_key');
    setAdminKey(null);
  };

  if (!adminKey) return <LoginScreen onLogin={setAdminKey} />;

  // Filter tasks/queue by search
  const filteredTasks = tasks.filter((t: TaskItem) => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return (t.preview?.title || '').toLowerCase().includes(q) || t.url.toLowerCase().includes(q);
  });

  const filteredQueue = queueItems.filter((q: QueueItem) => {
    if (!searchQ) return true;
    const s = searchQ.toLowerCase();
    return (q.title || '').toLowerCase().includes(s) || q.url.toLowerCase().includes(s);
  });

  return (
    <div className="min-h-screen bg-[#030303] text-white pb-24 select-none">
      {/* BG Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-50 bg-[#030303]/95 backdrop-blur-2xl border-b border-white/[0.05]">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Shield className="w-[18px] h-[18px] text-white" />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-tighter text-white">MFLIX ADMIN</h1>
                <div className="flex items-center gap-1.5">
                  <PulseDot />
                  <span className="text-[9px] text-slate-600 font-mono">SWR Auto-Refresh</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {stats?.queue?.totalPending != null && stats.queue.totalPending > 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 border border-amber-500/25 rounded-full">
                  <PulseDot color="bg-amber-400" />
                  <span className="text-[9px] font-black text-amber-400">{stats.queue.totalPending} PENDING</span>
                </motion.div>
              )}
              <button onClick={refreshAll}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white transition-all active:scale-90">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button onClick={logout}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 transition-all active:scale-90">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search (tasks/queue) */}
          <AnimatePresence>
            {(tab === 'tasks' || tab === 'queue') && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="relative mt-3">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                  <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                    placeholder={`Search ${tab}...`}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-indigo-500/40 transition-all" />
                  {searchQ && (
                    <button onClick={() => setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── CONTENT ── */}
      {!stats ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center animate-pulse">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm text-slate-500 font-mono">Loading admin data...</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-5">
          <AnimatePresence mode="wait">

            {/* ═══ DASHBOARD ═══ */}
            {tab === 'dashboard' && (
              <motion.div key="dash" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                {/* Stats Grid */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scraping Tasks</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Completed" value={stats.tasks.completed} color="text-emerald-400" bg="bg-gradient-to-br from-emerald-950/50 to-slate-900/80" border="border-emerald-500/15" icon={CheckCircle2} />
                    <StatCard label="Failed" value={stats.tasks.failed} color="text-rose-400" bg="bg-gradient-to-br from-rose-950/50 to-slate-900/80" border="border-rose-500/15" icon={XCircle} />
                    <StatCard label="Processing" value={stats.tasks.processing} color="text-indigo-400" bg="bg-gradient-to-br from-indigo-950/50 to-slate-900/80" border="border-indigo-500/15" icon={Cpu} pulse />
                    <StatCard label="Total" value={stats.tasks.total} color="text-slate-300" bg="bg-white/[0.03]" border="border-white/[0.06]" icon={Hash} />
                  </div>
                </section>

                {/* Feature 1: 7-Day Analytics Chart */}
                <section>
                  <AnalyticsChart data={analytics} loading={analyticsLoading} />
                </section>

                {/* Live Activity Feed */}
                <section>
                  <ActivityFeed activities={activities} loading={activityLoading} />
                </section>

                {/* Queue Overview */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Queue Progress</span>
                  </div>

                  {/* Movies Queue */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/15 flex items-center justify-center">
                        <Film className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <span className="text-sm font-bold text-white">Movies</span>
                      <span className="ml-auto text-[9px] text-slate-600 font-mono bg-white/5 px-2 py-0.5 rounded-full">{stats.queue.movies.total}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { l: 'Pending', v: stats.queue.movies.pending, c: 'text-amber-400' },
                        { l: 'Done', v: stats.queue.movies.completed, c: 'text-emerald-400' },
                        { l: 'Failed', v: Math.max(0, stats.queue.movies.total - stats.queue.movies.pending - stats.queue.movies.completed), c: 'text-rose-400' },
                      ].map(({ l, v, c }) => (
                        <div key={l} className="text-center bg-black/30 rounded-xl py-2 px-1">
                          <p className="text-[8px] uppercase text-slate-600 font-bold">{l}</p>
                          <motion.p key={v} initial={{ scale: 1.15, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} className={`text-xl font-black mt-0.5 ${c}`}>{v}</motion.p>
                        </div>
                      ))}
                    </div>
                    {stats.queue.movies.total > 0 && (
                      <div>
                        <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full" initial={{ width: 0 }}
                            animate={{ width: `${Math.round((stats.queue.movies.completed / stats.queue.movies.total) * 100)}%` }}
                            transition={{ duration: 1.2, ease: 'easeOut' }} />
                        </div>
                        <p className="text-[8px] text-slate-700 mt-1 text-right font-mono">{Math.round((stats.queue.movies.completed / stats.queue.movies.total) * 100)}%</p>
                      </div>
                    )}
                  </div>

                  {/* Webseries Queue */}
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-xl bg-indigo-500/15 flex items-center justify-center">
                        <Tv2 className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <span className="text-sm font-bold text-white">Webseries</span>
                      <span className="ml-auto text-[9px] text-slate-600 font-mono bg-white/5 px-2 py-0.5 rounded-full">{stats.queue.webseries.total}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { l: 'Pending', v: stats.queue.webseries.pending, c: 'text-amber-400' },
                        { l: 'Done', v: stats.queue.webseries.completed, c: 'text-emerald-400' },
                        { l: 'Failed', v: Math.max(0, stats.queue.webseries.total - stats.queue.webseries.pending - stats.queue.webseries.completed), c: 'text-rose-400' },
                      ].map(({ l, v, c }) => (
                        <div key={l} className="text-center bg-black/30 rounded-xl py-2 px-1">
                          <p className="text-[8px] uppercase text-slate-600 font-bold">{l}</p>
                          <motion.p key={v} initial={{ scale: 1.15, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} className={`text-xl font-black mt-0.5 ${c}`}>{v}</motion.p>
                        </div>
                      ))}
                    </div>
                    {stats.queue.webseries.total > 0 && (
                      <div>
                        <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 rounded-full" initial={{ width: 0 }}
                            animate={{ width: `${Math.round((stats.queue.webseries.completed / stats.queue.webseries.total) * 100)}%` }}
                            transition={{ duration: 1.2, ease: 'easeOut' }} />
                        </div>
                        <p className="text-[8px] text-slate-700 mt-1 text-right font-mono">{Math.round((stats.queue.webseries.completed / stats.queue.webseries.total) * 100)}%</p>
                      </div>
                    )}
                  </div>

                  {/* Grand Total Progress */}
                  {(() => {
                    const total = stats.queue.movies.total + stats.queue.webseries.total;
                    const done = stats.queue.movies.completed + stats.queue.webseries.completed;
                    if (!total) return null;
                    const pct = Math.round((done / total) * 100);
                    return (
                      <div className="bg-gradient-to-br from-violet-950/40 to-slate-900/80 border border-violet-500/15 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-violet-300">Overall</span>
                          </div>
                          <span className="text-lg font-black text-violet-400">{pct}%</span>
                        </div>
                        <div className="h-3 bg-black/50 rounded-full overflow-hidden mb-2">
                          <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-violet-400 relative"
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.5, ease: 'easeOut' }}>
                            {pct < 100 && pct > 5 && <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/20 blur-sm animate-pulse" />}
                          </motion.div>
                        </div>
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-slate-500">{done} processed</span>
                          <span className="text-slate-500">{stats.queue.totalPending} remaining</span>
                        </div>
                      </div>
                    );
                  })()}
                </section>

                {/* VPS Health */}
                <section>
                  <SystemHealth health={health} loading={healthLoading} onRefresh={() => mutateHealth()} />
                </section>

                {/* Quick Actions */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Actions</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setTab('tasks')} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-left hover:bg-white/[0.06] transition-all active:scale-95">
                      <Activity className="w-5 h-5 text-indigo-400 mb-2" />
                      <p className="text-sm font-bold text-white">View Tasks</p>
                      <p className="text-[10px] text-slate-600">{stats.tasks.total} total</p>
                    </button>
                    <button onClick={() => setTab('queue')} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-left hover:bg-white/[0.06] transition-all active:scale-95">
                      <Database className="w-5 h-5 text-violet-400 mb-2" />
                      <p className="text-sm font-bold text-white">View Queue</p>
                      <p className="text-[10px] text-slate-600">{stats.queue.totalPending} pending</p>
                    </button>
                  </div>
                </section>
              </motion.div>
            )}

            {/* ═══ TASKS ═══ */}
            {tab === 'tasks' && (
              <motion.div key="tasks" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {[
                    { v: 'all', l: 'All', count: null },
                    { v: 'completed', l: 'Done', count: stats.tasks.completed },
                    { v: 'failed', l: 'Failed', count: stats.tasks.failed },
                    { v: 'processing', l: 'Live', count: stats.tasks.processing },
                  ].map(({ v, l, count }) => (
                    <button key={v} onClick={() => setTaskFilter(v)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[11px] font-bold whitespace-nowrap transition-all border flex-shrink-0 ${taskFilter === v
                        ? v === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : v === 'failed' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : v === 'processing' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                              : 'bg-white/10 text-white border-white/20'
                        : 'bg-white/[0.03] text-slate-500 border-white/[0.05] hover:bg-white/[0.06]'}`}>
                      {l}
                      {count != null && <span className="bg-white/10 rounded-full px-1.5 py-0.5 text-[8px] font-mono">{count}</span>}
                    </button>
                  ))}
                  <span className="ml-auto text-[9px] text-slate-700 font-mono self-center flex-shrink-0">{filteredTasks.length} shown</span>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="text-center py-20 text-slate-700">
                    <List className="w-14 h-14 mx-auto mb-3 opacity-15" />
                    <p className="font-bold">No tasks found</p>
                    <p className="text-xs mt-1 opacity-60">{searchQ ? 'Try a different search' : 'Queue is empty'}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredTasks.map((task: TaskItem) => {
                      const isExpanded = expandedId === task.id;
                      const linksDone = task.links?.filter((l: any) => ['done', 'success'].includes((l.status || '').toLowerCase())).length || 0;
                      const linksFailed = task.links?.filter((l: any) => ['error', 'failed'].includes((l.status || '').toLowerCase())).length || 0;
                      return (
                        <div key={task.id} className={`bg-white/[0.03] border rounded-2xl overflow-hidden transition-all ${task.status === 'completed' ? 'border-emerald-500/10' : task.status === 'failed' ? 'border-rose-500/10' : task.status === 'processing' ? 'border-indigo-500/15' : 'border-white/[0.06]'}`}>
                          <div className="p-3.5 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : task.id)}>
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-14 bg-slate-900 rounded-xl flex-shrink-0 overflow-hidden border border-white/5 relative">
                                {task.preview?.posterUrl ? (
                                  <img src={task.preview.posterUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Film className="w-4 h-4 text-slate-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-white truncate leading-tight">{task.preview?.title || 'Processing...'}</p>
                                <p className="text-[9px] text-slate-700 font-mono truncate mt-0.5">{task.url.replace(/^https?:\/\//, '')}</p>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  <StatusBadge status={task.status} />
                                  <span className="text-[9px] text-slate-700">{timeAgo(task.createdAt)}</span>
                                  {task.links && task.links.length > 0 && (
                                    <span className="text-[9px] text-slate-600 font-mono bg-white/5 px-1.5 py-0.5 rounded-full">
                                      {linksDone}✓ {linksFailed > 0 ? `${linksFailed}✗` : ''} / {task.links.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0 mt-0.5">
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                              </div>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-white/[0.05] bg-black/20">
                                <div className="p-4 space-y-3">
                                  <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2.5">
                                    <Link2 className="w-3 h-3 text-slate-600 flex-shrink-0" />
                                    <span className="text-[10px] text-slate-500 font-mono truncate flex-1">{task.url}</span>
                                    <button onClick={() => copyText(task.url, `url-${task.id}`)} className="flex-shrink-0 text-slate-600 hover:text-white transition-colors">
                                      {copied === `url-${task.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>

                                  {task.metadata && (
                                    <div className="grid grid-cols-3 gap-2">
                                      {[
                                        { l: 'Quality', v: task.metadata.quality, c: 'text-indigo-400' },
                                        { l: 'Language', v: task.metadata.languages, c: 'text-emerald-400' },
                                        { l: 'Audio', v: task.metadata.audioLabel, c: 'text-amber-400' },
                                      ].map(({ l, v, c }) => (
                                        <div key={l} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5 text-center">
                                          <p className="text-[8px] uppercase text-slate-600 font-bold mb-0.5">{l}</p>
                                          <p className={`text-[11px] font-bold ${c} truncate`}>{v || '—'}</p>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {task.links && task.links.length > 0 && (
                                    <div>
                                      <p className="text-[9px] text-slate-600 uppercase font-bold mb-2 tracking-wider">Download Links ({task.links.length})</p>
                                      <div className="space-y-1.5 max-h-44 overflow-y-auto">
                                        {task.links.map((link: any, i: number) => {
                                          const isDone = ['done', 'success'].includes((link.status || '').toLowerCase());
                                          const isFail = ['error', 'failed'].includes((link.status || '').toLowerCase());
                                          return (
                                            <div key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isDone ? 'bg-emerald-500/5' : isFail ? 'bg-rose-500/5' : 'bg-white/[0.02]'}`}>
                                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDone ? 'bg-emerald-400' : isFail ? 'bg-rose-400' : 'bg-amber-400'}`} />
                                              <span className="text-[10px] text-slate-300 truncate flex-1 font-medium">{link.name}</span>
                                              {link.finalLink && (
                                                <button onClick={() => copyText(link.finalLink, `link-${task.id}-${i}`)} className="flex-shrink-0 text-slate-600 hover:text-indigo-400 transition-colors">
                                                  {copied === `link-${task.id}-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                </button>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-2 text-[9px] font-mono text-slate-700">
                                    <div className="flex items-center gap-1.5 bg-white/[0.02] rounded-xl px-3 py-2">
                                      <Clock className="w-3 h-3" />
                                      <span>Created: {timeAgo(task.createdAt)}</span>
                                    </div>
                                    {task.completedAt && (
                                      <div className="flex items-center gap-1.5 bg-white/[0.02] rounded-xl px-3 py-2">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Done: {timeAgo(task.completedAt)}</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex gap-2">
                                    {task.status === 'failed' && (
                                      <button onClick={() => patchStatus(task.id, 'scraping_tasks', 'pending')}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-[11px] font-bold transition-all active:scale-95">
                                        <RotateCcw className="w-3.5 h-3.5" /> Retry
                                      </button>
                                    )}
                                    <button onClick={() => deleteItem(task.id, 'scraping_tasks')} disabled={deletingId === task.id}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50">
                                      {deletingId === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ QUEUE ═══ */}
            {tab === 'queue' && (
              <motion.div key="queue" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Add to Queue Form */}
                <AddToQueueForm adminKey={adminKey} onAdded={() => { mutateQueue(); mutateStats(); }} />

                {/* Type Filter */}
                <div className="flex gap-2">
                  {[
                    { v: 'all', l: 'All', icon: Database },
                    { v: 'movies', l: 'Movies', icon: Film },
                    { v: 'webseries', l: 'Series', icon: Tv2 },
                  ].map(({ v, l, icon: Icon }) => (
                    <button key={v} onClick={() => setQueueTypeFilter(v)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[11px] font-bold transition-all border flex-shrink-0 ${queueTypeFilter === v ? 'bg-violet-500/20 text-violet-400 border-violet-500/30' : 'bg-white/[0.03] text-slate-500 border-white/[0.05] hover:bg-white/[0.06]'}`}>
                      <Icon className="w-3 h-3" /> {l}
                    </button>
                  ))}
                  <span className="ml-auto text-[9px] text-slate-700 font-mono self-center">{filteredQueue.length}</span>
                </div>

                {/* Status Filter (FIXED: proper filtering) */}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {['all', 'pending', 'processing', 'completed', 'failed'].map(s => (
                    <button key={s}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap border flex-shrink-0 transition-all ${queueStatusFilter === s
                        ? s === 'pending' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : s === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : s === 'failed' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                              : s === 'processing' ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
                                : 'bg-white/10 text-white border-white/20'
                        : s === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                          : s === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                            : s === 'failed' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                              : s === 'processing' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 hover:bg-indigo-500/20'
                                : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:bg-white/[0.06]'}`}
                      onClick={() => setQueueStatusFilter(s)}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Queue Items */}
                {filteredQueue.length === 0 ? (
                  <div className="text-center py-20 text-slate-700">
                    <Database className="w-14 h-14 mx-auto mb-3 opacity-15" />
                    <p className="font-bold">Queue is empty</p>
                    <p className="text-xs mt-1 opacity-60">No items match your filter</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredQueue.map((item: QueueItem, idx: number) => {
                      const isPending = (item.status || '').toLowerCase() === 'pending';
                      const isDone = (item.status || '').toLowerCase() === 'completed';
                      const isFailed = ['failed', 'error'].includes((item.status || '').toLowerCase());
                      return (
                        <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                          className={`bg-white/[0.03] border rounded-2xl p-4 transition-all ${isPending ? 'border-amber-500/12' : isDone ? 'border-emerald-500/12' : isFailed ? 'border-rose-500/12' : 'border-white/[0.05]'}`}>
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
                              <span className="text-[9px] font-mono text-slate-700 w-5 text-center">{idx + 1}</span>
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${item.type === 'webseries' ? 'bg-indigo-500/12' : 'bg-amber-500/12'}`}>
                                {item.type === 'webseries' ? <Tv2 className="w-3.5 h-3.5 text-indigo-400" /> : <Film className="w-3.5 h-3.5 text-amber-400" />}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate leading-tight">{item.title || 'Untitled'}</p>
                              <p className="text-[9px] text-slate-700 font-mono truncate mt-0.5">{item.url.replace(/^https?:\/\//, '').slice(0, 50)}</p>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <StatusBadge status={item.status} />
                                <span className="text-[9px] text-slate-700 bg-white/[0.03] px-1.5 py-0.5 rounded-full font-mono">{item.collection.replace('_queue', '')}</span>
                                {item.createdAt && <span className="text-[9px] text-slate-700">{timeAgo(item.createdAt)}</span>}
                              </div>
                            </div>
                            <button onClick={() => deleteItem(item.id, item.collection)} disabled={deletingId === item.id}
                              className="w-8 h-8 flex items-center justify-center rounded-xl bg-rose-500/8 border border-rose-500/15 text-rose-500 hover:bg-rose-500/20 transition-all active:scale-90 disabled:opacity-50 flex-shrink-0">
                              {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          {isFailed && (
                            <button onClick={() => patchStatus(item.id, item.collection, 'pending')}
                              className="mt-2.5 w-full py-2 rounded-xl bg-amber-500/8 border border-amber-500/12 text-amber-400 text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-amber-500/15 transition-all active:scale-95">
                              <RotateCcw className="w-3 h-3" /> Reset to Pending
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══ SETTINGS ═══ */}
            {tab === 'settings' && (
              <SettingsTab
                adminKey={adminKey}
                stats={stats}
                onLogout={logout}
                onRefresh={refreshAll}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── BOTTOM NAVIGATION ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#030303]/95 backdrop-blur-2xl border-t border-white/[0.05]">
        <div className="max-w-2xl mx-auto flex items-stretch">
          {([
            { key: 'dashboard' as Tab, icon: BarChart3, label: 'Dashboard', badge: null },
            { key: 'tasks' as Tab, icon: Activity, label: 'Tasks', badge: stats?.tasks?.processing || null },
            { key: 'queue' as Tab, icon: Database, label: 'Queue', badge: stats?.queue?.totalPending || null },
            { key: 'settings' as Tab, icon: Settings, label: 'Settings', badge: null },
          ]).map(({ key, icon: Icon, label, badge }) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)}
                className={`flex-1 flex flex-col items-center gap-1 py-3.5 px-2 transition-all relative ${active ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}>
                {active && (
                  <motion.span layoutId="tab-indicator" className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
                )}
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {badge != null && badge > 0 && (
                    <span className={`absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center text-[8px] font-black rounded-full px-1 shadow-lg ${key === 'tasks' ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-black'}`}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

// ─── EXPORT WITH ERROR BOUNDARY ───────────────────────────────────────────────
export default function AdminPanel() {
  return (
    <ErrorBoundary>
      <AdminPanelInner />
    </ErrorBoundary>
  );
}
