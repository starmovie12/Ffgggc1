'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Play,
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Film,
  Tv,
  RotateCcw,
  Database,
  ArrowLeft,
  AlertTriangle,
  Coffee,
  Rocket,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

// =============================================
// Types
// =============================================
interface QueueItem {
  id: string;
  collection: string;
  type: string;
  url: string;
  title: string;
  status: string;
}

interface LogEntry {
  time: string;
  msg: string;
  type: 'info' | 'success' | 'error' | 'warn';
  step?: string;
}

interface ProcessedItem {
  queueItem: QueueItem;
  status: 'completed' | 'failed' | 'processing' | 'skipped';
  savedId?: string;
  savedCollection?: string;
  successfulLinks?: number;
  failedLinks?: number;
  error?: string;
  title?: string;
}

// =============================================
// Component
// =============================================
export default function AutoProcessorPage() {
  // Queue state
  const [queueType, setQueueType] = useState<'all' | 'movies' | 'webseries'>('all');
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [currentItem, setCurrentItem] = useState<QueueItem | null>(null);
  const [currentStep, setCurrentStep] = useState('');
  const [linkProgress, setLinkProgress] = useState<{ current: number; total: number } | null>(null);

  // Logs & results
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [processedItems, setProcessedItems] = useState<ProcessedItem[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const [showResults, setShowResults] = useState(false);

  // Refs for abort control
  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // =============================================
  // Fetch Queue
  // =============================================
  const fetchQueue = useCallback(async () => {
    setIsLoadingQueue(true);
    setQueueError(null);
    try {
      const res = await fetch(`/api/auto-process/queue?type=${queueType}&include_active=true`);
      const data = await res.json();
      if (data.status === 'success') {
        setQueueItems(data.items);
      } else {
        setQueueError(data.message || 'Failed to fetch queue');
      }
    } catch (e: any) {
      setQueueError(e.message);
    } finally {
      setIsLoadingQueue(false);
    }
  }, [queueType]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // =============================================
  // Add Log
  // =============================================
  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info', step?: string) => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    setLogs((prev) => [...prev, { time, msg, type, step }]);
  }, []);

  // =============================================
  // Process single item via streaming API
  // =============================================
  const processSingleItem = useCallback(
    async (item: QueueItem): Promise<ProcessedItem> => {
      return new Promise(async (resolve) => {
        try {
          const res = await fetch('/api/auto-process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              queueId: item.id,
              collection: item.collection,
              url: item.url,
              title: item.title,
              type: item.type,
            }),
          });

          if (!res.ok || !res.body) {
            const err = await res.text();
            addLog(`❌ API Error: ${err}`, 'error');
            resolve({ queueItem: item, status: 'failed', error: err });
            return;
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let result: ProcessedItem = { queueItem: item, status: 'failed' };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                if (data.msg) addLog(data.msg, data.type || 'info', data.step);
                if (data.step) setCurrentStep(data.step);
                if (data.progress) setLinkProgress(data.progress);

                if (data.step === 'done') {
                  result = {
                    queueItem: item,
                    status: data.status,
                    savedId: data.savedId,
                    savedCollection: data.savedCollection,
                    title: data.title || item.title,
                    successfulLinks: data.successfulLinks,
                    failedLinks: data.failedLinks,
                    error: data.error,
                  };
                }
              } catch {
                // ignore parse errors
              }
            }
          }
          resolve(result);
        } catch (e: any) {
          addLog(`❌ Network Error: ${e.message}`, 'error');
          resolve({ queueItem: item, status: 'failed', error: e.message });
        }
      });
    },
    [addLog]
  );

  // =============================================
  // Start Auto-Processing (SYNCHRONOUS LOOP WITH RETRY)
  // =============================================
  const startProcessing = useCallback(async () => {
    if (queueItems.length === 0) {
      addLog('⚠️ No pending items in queue!', 'warn');
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);
    abortRef.current = false;
    pauseRef.current = false;
    setCurrentIndex(0);
    setTotalItems(queueItems.length);
    setProcessedItems([]);
    setLogs([]);
    setShowResults(false);

    addLog(`🚀 Starting Auto-Processor (AUTO-RETRY MODE)`, 'success');
    addLog(`⚙️ Each URL will have 3 retry attempts on failure.`, 'info');
    addLog('─'.repeat(50), 'info');

    const itemsToProcess = [...queueItems];

    for (let i = 0; i < itemsToProcess.length; i++) {
      if (abortRef.current) {
        addLog('🛑 Processing stopped by user.', 'warn');
        break;
      }

      const item = itemsToProcess[i];
      setCurrentIndex(i + 1);
      setCurrentItem(item);
      setLinkProgress(null);
      setCurrentStep('extract');

      addLog('═'.repeat(50), 'info');
      addLog(`📦 [${i + 1}/${itemsToProcess.length}] Target: "${item.title}"`, 'info');

      // NEW LOGIC: Inner Loop for Checkpointing + Auto-Retry
      let itemDone = false;
      let finalResult: ProcessedItem | null = null;
      let consecutiveFails = 0; // Tracks consecutive failures for the SAME item
      const MAX_RETRIES = 3;

      while (!itemDone && !abortRef.current) {
        // Handle pause
        while (pauseRef.current && !abortRef.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (abortRef.current) break;

        const result = await processSingleItem(item);

        if (result.status === 'processing') {
          // Progress is being made (Vercel timed out, but we resume)
          addLog(`⏳ Checkpoint: Resuming "${item.title}"...`, 'warn');
          consecutiveFails = 0; // Reset fails because we are technically moving forward
        } 
        else if (result.status === 'completed') {
          // Success!
          itemDone = true;
          finalResult = result;
        } 
        else if (result.status === 'failed') {
          // Genuine failure or error
          consecutiveFails++;
          
          if (consecutiveFails < MAX_RETRIES) {
            addLog(`⚠️ Attempt ${consecutiveFails} failed. Retrying in 2s...`, 'error');
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            addLog(`❌ Final Strike: Skipping "${item.title}" after ${MAX_RETRIES} attempts.`, 'error');
            itemDone = true;
            finalResult = result;
          }
        }
      }

      if (abortRef.current) break;
      if (!finalResult) continue;

      setProcessedItems((prev) => [...prev, finalResult]);

      if (finalResult.status === 'completed') {
        addLog(`✅ [${i + 1}/${itemsToProcess.length}] "${finalResult.title}" — COMPLETED`, 'success');
      } else {
        addLog(`❌ [${i + 1}/${itemsToProcess.length}] "${item.title}" — FAILED`, 'error');
      }

      // --- ADDED SAFE DELAY BEFORE NEXT ITEM ---
      if (i < itemsToProcess.length - 1 && !abortRef.current) {
        addLog(`⏳ Taking a 3-second breather before the next URL...`, 'info');
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    addLog('─'.repeat(50), 'info');
    addLog('🏁 Auto-Processing Complete!', 'success');

    setIsProcessing(false);
    setCurrentItem(null);
    setCurrentStep('');
    setLinkProgress(null);
    setShowResults(true);
    fetchQueue();
  }, [queueItems, addLog, processSingleItem, fetchQueue]);

  // =============================================
  // Stop / Pause
  // =============================================
  const stopProcessing = () => {
    abortRef.current = true;
    pauseRef.current = false;
    setIsPaused(false);
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(!isPaused);
    addLog(pauseRef.current ? '⏸️ Paused' : '▶️ Resumed', 'warn');
  };

  // =============================================
  // Stats
  // =============================================
  const completedCount = processedItems.filter((i) => i.status === 'completed').length;
  const failedCount = processedItems.filter((i) => i.status === 'failed').length;
  const progressPercent = totalItems > 0 ? Math.round((currentIndex / totalItems) * 100) : 0;

  const stepLabel: Record<string, string> = {
    extract: '🔍 Extracting Links',
    solve: '⚡ Resolving Downloads',
    save: '💾 Saving to Database',
    complete: '✅ Finalizing',
  };

  // =============================================
  // Render
  // =============================================
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold">Auto-Processor</h1>
              <p className="text-[10px] text-slate-500">Batch Queue Processing Engine</p>
            </div>
          </div>
          {isProcessing && (
            <span className="ml-auto px-2 py-1 bg-violet-500/20 text-violet-400 text-[10px] font-bold rounded-full animate-pulse">
              PROCESSING
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ==================== CONTROLS ==================== */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500 font-bold uppercase">Queue:</span>
            {(['all', 'movies', 'webseries'] as const).map((type) => (
              <button
                key={type}
                onClick={() => !isProcessing && setQueueType(type)}
                disabled={isProcessing}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                  queueType === type
                    ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'
                } disabled:opacity-50`}
              >
                {type === 'movies' && <Film className="w-3 h-3" />}
                {type === 'webseries' && <Tv className="w-3 h-3" />}
                {type === 'all' && <Database className="w-3 h-3" />}
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}

            <button
              onClick={fetchQueue}
              disabled={isProcessing || isLoadingQueue}
              className="ml-auto p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoadingQueue ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                <span className="text-[10px] uppercase text-amber-500 font-bold block">Pending</span>
                <span className="text-2xl font-bold text-amber-400">
                  {isLoadingQueue ? '...' : queueItems.length}
                </span>
              </div>
              {processedItems.length > 0 && (
                <>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                    <span className="text-[10px] uppercase text-emerald-500 font-bold block">Done</span>
                    <span className="text-2xl font-bold text-emerald-400">{completedCount}</span>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                    <span className="text-[10px] uppercase text-rose-500 font-bold block">Failed</span>
                    <span className="text-2xl font-bold text-rose-400">{failedCount}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {queueError && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span className="text-xs text-rose-400">{queueError}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {!isProcessing ? (
              <button
                onClick={startProcessing}
                disabled={queueItems.length === 0 || isLoadingQueue}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Rocket className="w-5 h-5" />
                Start Auto-Processing ({queueItems.length} items)
              </button>
            ) : (
              <>
                <button
                  onClick={togglePause}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-xl transition-all ${
                    isPaused
                      ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
                      : 'bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30'
                  }`}
                >
                  {isPaused ? <><Play className="w-5 h-5" /> Resume</> : <><Coffee className="w-5 h-5" /> Pause</>}
                </button>
                <button
                  onClick={stopProcessing}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30 font-bold rounded-xl transition-all"
                >
                  <Square className="w-5 h-5" /> Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* ==================== PROGRESS BAR ==================== */}
        {(isProcessing || processedItems.length > 0) && (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400">
                {isProcessing
                  ? `Processing ${currentIndex} of ${totalItems}...`
                  : `Completed: ${completedCount + failedCount} of ${totalItems}`}
              </span>
              <span className="text-sm font-bold text-white">{progressPercent}%</span>
            </div>

            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mb-3">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%`, background: `linear-gradient(90deg, #8b5cf6, #d946ef)` }}
              />
            </div>

            {currentItem && isProcessing && (
              <div className="bg-violet-500/5 border border-violet-500/10 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  <span className="text-sm font-bold text-white truncate">{currentItem.title}</span>
                  <span className="text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full font-bold ml-auto flex-shrink-0">
                    {currentItem.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{stepLabel[currentStep] || currentStep}</span>
                  {linkProgress && (
                    <span className="text-violet-400 font-mono">Link {linkProgress.current}/{linkProgress.total}</span>
                  )}
                </div>

                {linkProgress && (
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-violet-500/60 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((linkProgress.current / linkProgress.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== LIVE LOGS ==================== */}
        {logs.length > 0 && (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-all"
            >
              <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Live Logs ({logs.length})
              </span>
              {showLogs ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>

            {showLogs && (
              <div className="border-t border-white/5 max-h-80 overflow-y-auto px-4 py-2 font-mono text-[11px] leading-relaxed bg-black/30">
                {logs.map((log, i) => (
                  <div key={i} className={`flex gap-2 py-0.5 ${
                    log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-rose-400' : log.type === 'warn' ? 'text-amber-400' : 'text-slate-400'
                  }`}>
                    <span className="text-slate-600 flex-shrink-0">{log.time}</span>
                    <span>{log.msg}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        )}

        {/* ==================== RESULTS SUMMARY ==================== */}
        {processedItems.length > 0 && (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowResults(!showResults)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-all"
            >
              <span className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                <Database className="w-3.5 h-3.5" />
                Results ({processedItems.length})
              </span>
              {showResults ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>

            {showResults && (
              <div className="border-t border-white/5 divide-y divide-white/5">
                {processedItems.map((item, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.01]">
                    {item.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{item.title || item.queueItem.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.status === 'completed' ? `Saved to ${item.savedCollection} • ${item.successfulLinks} links` : item.error || 'Failed'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== PENDING QUEUE PREVIEW ==================== */}
        {!isProcessing && queueItems.length > 0 && (
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/5">
              <span className="text-xs font-bold text-slate-400 uppercase">Pending Queue ({queueItems.length} items)</span>
            </div>
            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
              {queueItems.map((item, i) => (
                <div key={item.id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-white/[0.01]">
                  <span className="text-[10px] text-slate-600 font-mono w-6 text-right">{i + 1}</span>
                  {item.type === 'webseries' ? <Tv className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" /> : <Film className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-300 truncate">{item.title}</p>
                    <p className="text-[10px] text-slate-600 truncate">{item.url}</p>
                  </div>
                  <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold">{item.collection}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isProcessing && !isLoadingQueue && queueItems.length === 0 && processedItems.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Zap className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="text-lg font-bold mb-1">No Pending Items</p>
            <p className="text-sm opacity-60">Add URLs to <code className="bg-white/5 px-1.5 py-0.5 rounded text-xs">movies_queue</code> or <code className="bg-white/5 px-1.5 py-0.5 rounded text-xs">webseries_queue</code> in Firebase</p>
          </div>
        )}
      </div>
    </div>
  );
}
