export const maxDuration = 60;

import { db } from '@/lib/firebaseAdmin';
// FIX: Imports are correctly handled
import { solveHBLinks, solveHubCDN, solveHubDrive, solveHubCloudNative, solveGadgetsWebNative } from '@/lib/solvers';

const TIMER_API = 'http://85.121.5.246:10000/solve?url=';

// FIX: Timeout increased to 120s (was 40s) to allow VPS enough time
const fetchJSON = async (url: string, timeoutMs = 120000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'MflixPro/2.0' },
    });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

export async function POST(req: Request) {
  let links: any[];
  let taskId: string | undefined;
  let extractedBy: string = 'Browser/Live'; // Default: browser extraction

  try {
    const body = await req.json();
    links = body.links;
    taskId = body.taskId;
    if (body.extractedBy) extractedBy = body.extractedBy;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  if (!Array.isArray(links) || links.length === 0) {
    return new Response(JSON.stringify({ error: 'No links provided' }), { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: any) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(data) + '\n')); } catch {}
      };

      const finalResults: Map<number, any> = new Map();

      const processLink = async (linkData: any, idx: number) => {
        const lid = linkData.id ?? idx;
        let currentLink = linkData.link;
        const logs: { msg: string; type: string }[] = [];

        const sendLog = (msg: string, type = 'info') => {
          logs.push({ msg, type });
          send({ id: lid, msg, type });
        };

        try {
          if (!currentLink || typeof currentLink !== 'string') {
            sendLog('❌ No link URL', 'error');
            finalResults.set(lid, { ...linkData, status: 'error', error: 'No link URL', logs });
            return;
          }

          // ── HUBCDN.FANS ──
          if (currentLink.includes('hubcdn.fans')) {
            sendLog('⚡ HubCDN processing...', 'info');
            const r = await solveHubCDN(currentLink);
            if (r.status === 'success') {
              send({ id: lid, final: r.final_link, status: 'done' });
              finalResults.set(lid, { ...linkData, finalLink: r.final_link, status: 'done', logs });
            } else {
              sendLog(`❌ HubCDN: ${r.message}`, 'error');
              finalResults.set(lid, { ...linkData, status: 'error', error: r.message, logs });
            }
            return;
          }

          // ── TIMER BYPASS (RECOGNIZED GADGETSWEB) ──
          const targetDomains = ['hblinks', 'hubdrive', 'hubcdn', 'hubcloud'];
          let loopCount = 0;
          while (loopCount < 3 && !targetDomains.some(d => currentLink.includes(d))) {
            const isTimer = ['gadgetsweb', 'review-tech', 'ngwin', 'cryptoinsights'].some(x => currentLink.includes(x));
            if (!isTimer && loopCount === 0) break;
            
            sendLog('⏳ Timer bypass...', 'warn');
            try {
              if (currentLink.includes('gadgetsweb')) {
                // Port 10000 calling
                const r = await solveGadgetsWebNative(currentLink);
                if (r.status === 'success') {
                  currentLink = r.link!;
                  sendLog('✅ Timer bypassed', 'success');
                } else throw new Error(r.message || 'Bypass failed');
              } else {
                const r = await fetchJSON(TIMER_API + encodeURIComponent(currentLink));
                if (r.status === 'success') {
                  currentLink = r.extracted_link;
                  sendLog('✅ Timer bypassed', 'success');
                } else throw new Error(r.message || 'Timer failed');
              }
            } catch (e: any) {
              sendLog(`❌ Timer: ${e.message}`, 'error');
              break;
            }
            loopCount++;
          }

          // ── HBLINKS ──
          if (currentLink.includes('hblinks')) {
            sendLog('🔗 Solving HBLinks...', 'info');
            const r = await solveHBLinks(currentLink);
            if (r.status === 'success') {
              currentLink = r.link!;
              sendLog('✅ HBLinks solved', 'success');
            } else {
              sendLog(`❌ HBLinks: ${r.message}`, 'error');
              finalResults.set(lid, { ...linkData, status: 'error', error: r.message, logs });
              return;
            }
          }

          // ── HUBDRIVE ──
          if (currentLink.includes('hubdrive')) {
            sendLog('☁️ Solving HubDrive...', 'info');
            const r = await solveHubDrive(currentLink);
            if (r.status === 'success') {
              currentLink = r.link!;
              sendLog('✅ HubDrive solved', 'success');
            } else {
              sendLog(`❌ HubDrive: ${r.message}`, 'error');
              finalResults.set(lid, { ...linkData, status: 'error', error: r.message, logs });
              return;
            }
          }

          // ── HUBCLOUD (port 5001 FIXED) ──
          if (currentLink.includes('hubcloud') || currentLink.includes('hubcdn')) {
            sendLog('⚡ HubCloud direct link...', 'info');
            const r = await solveHubCloudNative(currentLink);
            if (r.status === 'success' && r.best_download_link) {
              sendLog(`🎉 Done via ${r.best_button_name || 'Best'}`, 'success');
              send({ id: lid, final: r.best_download_link, status: 'done' });
              finalResults.set(lid, {
                ...linkData,
                finalLink: r.best_download_link,
                status: 'done',
                logs,
                best_button_name: r.best_button_name || null,
                all_available_buttons: r.all_available_buttons || [],
              });
              return;
            } else {
              sendLog(`❌ HubCloud: ${r.message}`, 'error');
            }
          }

          sendLog('❌ Unrecognized link format', 'error');
          send({ id: lid, status: 'error' });
          finalResults.set(lid, { ...linkData, status: 'error', error: 'Could not solve', logs });

        } catch (e: any) {
          sendLog(`⚠️ Error: ${e.message}`, 'error');
          finalResults.set(lid, { ...linkData, status: 'error', error: e.message, logs });
        } finally {
          // Firestore save logic logic remains same
          const saved = finalResults.get(lid) || { ...linkData, status: 'error', logs };
          if (taskId) {
            try {
              const taskRef = db.collection('scraping_tasks').doc(taskId);
              await db.runTransaction(async (tx) => {
                const doc = await tx.get(taskRef);
                if (!doc.exists) return;
                const existing = doc.data()?.links || [];
                const updated = existing.map((l: any) => {
                  if (l.id === lid || l.link === linkData.link) {
                    return {
                      ...l,
                      finalLink: saved.finalLink || l.finalLink || null,
                      status: saved.status || 'error',
                      error: saved.error || null,
                      logs: saved.logs || [],
                      best_button_name: saved.best_button_name || null,
                    };
                  }
                  return l;
                });
                const allDone = updated.every((l: any) => ['done','success','error','failed'].includes((l.status||'').toLowerCase()));
                const anySuccess = updated.some((l: any) => ['done','success'].includes((l.status||'').toLowerCase()));
                tx.update(taskRef, {
                  links: updated,
                  status: allDone ? (anySuccess ? 'completed' : 'failed') : 'processing',
                  extractedBy,
                  ...(allDone ? { completedAt: new Date().toISOString() } : {}),
                });
              });
            } catch (e: any) {
              console.error('[Stream] DB save error:', e.message);
            }
          }
          send({ id: lid, status: 'finished' });
        }
      };

      // ── FIXED: SEQUENTIAL processing to prevent VPS Overload ──
      // Parallel (Promise.all) was causing "Operation Aborted" due to server stress.
      for (let i = 0; i < links.length; i++) {
        await processLink(links[i], i);
      }
      
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
