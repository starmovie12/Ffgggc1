'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings, Bell, Download, Trash2, Loader2,
  CheckCircle2, AlertTriangle, Send, Shield, Wifi,
  Database, LogOut, Info, MessageCircle, Server,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { useTelegramSettings, adminPost } from '@/hooks/useAdminData';

interface Props {
  adminKey: string;
  stats: any;
  onLogout: () => void;
  onRefresh: () => void;
}

export default function SettingsTab({ adminKey, stats, onLogout, onRefresh }: Props) {
  const { telegramSettings, mutateTelegram } = useTelegramSettings(adminKey);

  // ── Telegram State ──
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgSaved, setTgSaved] = useState(false);
  const [tgExpanded, setTgExpanded] = useState(false);

  // ── Data Management State ──
  const [clearing, setClearing] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<{ type: string; count: number } | null>(null);
  const [downloading, setDownloading] = useState(false);

  // ── Confirm Modal ──
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  useEffect(() => {
    if (telegramSettings) {
      setBotToken(telegramSettings.botToken || '');
      setChatId(telegramSettings.chatId || '');
      setTgEnabled(telegramSettings.enabled || false);
    }
  }, [telegramSettings]);

  // ── Save Telegram Settings ──
  const saveTelegram = async () => {
    setTgSaving(true);
    try {
      await adminPost(adminKey, {
        action: 'save-telegram',
        botToken, chatId, enabled: tgEnabled,
      });
      mutateTelegram();
      setTgSaved(true);
      setTimeout(() => setTgSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save telegram settings:', e);
    } finally {
      setTgSaving(false);
    }
  };

  // ── Clear Actions ──
  const handleClear = async (action: string) => {
    setClearing(action);
    setConfirmAction(null);
    try {
      const res = await adminPost(adminKey, { action });
      setClearResult({ type: action, count: res.deleted || 0 });
      setTimeout(() => setClearResult(null), 4000);
      onRefresh();
    } catch (e) {
      console.error('Clear failed:', e);
    } finally {
      setClearing(null);
    }
  };

  // ── Download Backup ──
  const downloadBackup = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/admin?action=backup', {
        headers: { 'x-admin-key': adminKey },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mflix-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Backup download failed:', e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-5"
    >
      {/* ── TELEGRAM NOTIFICATIONS ── */}
      <section>
        <button
          onClick={() => setTgExpanded(!tgExpanded)}
          className="w-full flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Telegram Notifications
            </span>
          </div>
          {tgExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-600" />
          )}
        </button>

        <AnimatePresence>
          {tgExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-4">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Enable Alerts</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      Get notified when tasks complete, fail, or VPS crashes
                    </p>
                  </div>
                  <button
                    onClick={() => setTgEnabled(!tgEnabled)}
                    className="transition-colors"
                  >
                    {tgEnabled ? (
                      <ToggleRight className="w-8 h-8 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-8 h-8 text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Bot Token Input */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                    Bot Token
                  </label>
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:ABCDefgh..."
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-3 text-xs text-white placeholder-slate-700 outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/15 font-mono transition-all"
                  />
                  <p className="text-[9px] text-slate-700 mt-1">
                    Get from @BotFather on Telegram
                  </p>
                </div>

                {/* Chat ID Input */}
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                    Chat ID
                  </label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="-1001234567890"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-3 text-xs text-white placeholder-slate-700 outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/15 font-mono transition-all"
                  />
                  <p className="text-[9px] text-slate-700 mt-1">
                    Get from @userinfobot or @RawDataBot
                  </p>
                </div>

                {/* Save Button */}
                <button
                  onClick={saveTelegram}
                  disabled={tgSaving}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-blue-500/20"
                >
                  {tgSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : tgSaved ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  {tgSaving ? 'Saving...' : tgSaved ? 'Saved & Test Sent!' : 'Save & Test Connection'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── VPS CONFIGURATION ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Server className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">VPS Configuration</span>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-300">HubCloud Solver</p>
              <p className="text-[10px] text-slate-600 font-mono">85.121.5.246:5001</p>
            </div>
            <Wifi className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="h-px bg-white/[0.04]" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-300">Timer Bypass API</p>
              <p className="text-[10px] text-slate-600 font-mono">85.121.5.246:10000</p>
            </div>
            <Wifi className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </section>

      {/* ── DATABASE BACKUP ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Disaster Recovery</span>
        </div>
        <div className="bg-gradient-to-br from-amber-950/30 to-slate-900/80 border border-amber-500/15 rounded-2xl p-4">
          <p className="text-sm font-bold text-white mb-1">One-Click Full Backup</p>
          <p className="text-[10px] text-slate-500 mb-4">
            Download entire Firebase database (Movies, Webseries, Tasks, Queue) as a single JSON file
          </p>
          <button
            onClick={downloadBackup}
            disabled={downloading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-amber-500/20"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {downloading ? 'Downloading...' : 'Download Full Backup (.json)'}
          </button>
        </div>
      </section>

      {/* ── DATA MANAGEMENT ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Data Management</span>
        </div>
        <div className="space-y-2.5">
          {/* Clear Completed */}
          <button
            onClick={() => setConfirmAction('clear-completed')}
            disabled={!!clearing}
            className="w-full flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-left hover:bg-white/[0.06] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              {clearing === 'clear-completed' ? (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Clear Completed Tasks</p>
              <p className="text-[10px] text-slate-600">
                Remove {stats?.tasks?.completed || 0} completed tasks
              </p>
            </div>
          </button>

          {/* Clear Failed */}
          <button
            onClick={() => setConfirmAction('clear-failed')}
            disabled={!!clearing}
            className="w-full flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-left hover:bg-white/[0.06] transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
              {clearing === 'clear-failed' ? (
                <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">Clear Failed Tasks</p>
              <p className="text-[10px] text-slate-600">
                Remove {stats?.tasks?.failed || 0} failed tasks
              </p>
            </div>
          </button>
        </div>

        {/* Clear Result Toast */}
        <AnimatePresence>
          {clearResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-400">
                Deleted {clearResult.count} {clearResult.type.replace('clear-', '')} tasks
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── ABOUT ── */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">About</span>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-2">
          {[
            { l: 'Version', v: 'MFLIX PRO v2.0' },
            { l: 'Stack', v: 'Next.js 15 + Firebase + SWR' },
            { l: 'VPS', v: '85.121.5.246' },
            { l: 'Features', v: 'Analytics • Auto-Retry • Telegram' },
          ].map(({ l, v }) => (
            <div key={l} className="flex items-center justify-between">
              <span className="text-[10px] text-slate-600 font-medium">{l}</span>
              <span className="text-[10px] text-slate-400 font-mono">{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── LOGOUT ── */}
      <button
        onClick={onLogout}
        className="w-full py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-500/20 transition-all active:scale-[0.98]"
      >
        <LogOut className="w-4 h-4" /> Logout
      </button>

      {/* ── CONFIRM MODAL ── */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-6"
            onClick={() => setConfirmAction(null)}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-rose-400" />
              </div>
              <h3 className="text-lg font-black text-white text-center mb-2">Are you sure?</h3>
              <p className="text-xs text-slate-500 text-center mb-6">
                This will permanently delete all{' '}
                {confirmAction === 'clear-completed' ? 'completed' : 'failed'} tasks.
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.08] text-slate-400 text-xs font-bold transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleClear(confirmAction)}
                  className="flex-1 py-3 rounded-xl bg-rose-600 text-white text-xs font-bold transition-all active:scale-95 shadow-lg shadow-rose-500/20"
                >
                  Delete All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
