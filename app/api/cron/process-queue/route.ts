export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

// ============================================================================
// TELEGRAM HELPER
// ============================================================================
async function sendTelegram(msg: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: msg, parse_mode: 'HTML' }),
    });
  } catch {}
}

// ============================================================================
// HEARTBEAT: Update engine status in Firebase every cron run
// ============================================================================
async function updateHeartbeat(status: 'running' | 'idle' | 'error', details?: string) {
  try {
    await db.collection('system').doc('engine_status').set({
      lastRunAt: new Date().toISOString(),
      status,
      details: details || '',
      source: 'github-cron',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e: any) {
    console.error('[Heartbeat] Failed to update:', e.message);
  }
}

// ============================================================================
// STUCK TASK RECOVERY: Reset tasks stuck in "processing" for 10+ minutes
// ============================================================================
async function recoverStuckTasks(): Promise<number> {
  const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  let recovered = 0;

  for (const col of ['movies_queue', 'webseries_queue']) {
    try {
      const stuckSnap = await db.collection(col)
        .where('status', '==', 'processing')
        .get();

      for (const doc of stuckSnap.docs) {
        const data = doc.data();
        const lockedAt = data.lockedAt || data.updatedAt || data.createdAt || '';

        if (lockedAt && lockedAt < TEN_MINUTES_AGO) {
          const retryCount = (data.retryCount || 0) + 1;

          if (retryCount > 3) {
            await db.collection(col).doc(doc.id).update({
              status: 'failed',
              error: 'Max retries exceeded (3/3) — task timed out repeatedly',
              failedAt: new Date().toISOString(),
              retryCount,
            });
            recovered++;
            console.log(`[Recovery] FAILED (max retries): ${doc.id} in ${col}`);
          } else {
            await db.collection(col).doc(doc.id).update({
              status: 'pending',
              lockedAt: null,
              retryCount,
              lastRecoveredAt: new Date().toISOString(),
              recoveryNote: `Auto-recovered from stuck processing (attempt ${retryCount}/3)`,
            });
            recovered++;
            console.log(`[Recovery] Reset to pending: ${doc.id} in ${col} (retry ${retryCount}/3)`);
          }
        }
      }
    } catch (e: any) {
      console.error(`[Recovery] Error scanning ${col}:`, e.message);
    }
  }

  // Also recover stuck scraping_tasks
  try {
    const stuckTasksSnap = await db.collection('scraping_tasks')
      .where('status', '==', 'processing')
      .get();

    for (const doc of stuckTasksSnap.docs) {
      const data = doc.data();
      const createdAt = data.createdAt || data.updatedAt || '';
      if (createdAt && createdAt < TEN_MINUTES_AGO) {
        const links = data.links || [];
        const hasPending = links.some((l: any) => {
          const s = (l.status || '').toLowerCase();
          return s === 'pending' || s === 'processing' || s === '';
        });

        if (hasPending) {
          const updatedLinks = links.map((l: any) => {
            const s = (l.status || '').toLowerCase();
            if (s === 'processing') {
              return { ...l, status: 'pending', logs: [{ msg: '🔄 Auto-recovered from timeout', type: 'info' }] };
            }
            return l;
          });

          await db.collection('scraping_tasks').doc(doc.id).update({
            status: 'processing',
            links: updatedLinks,
            recoveredAt: new Date().toISOString(),
          });
          recovered++;
        }
      }
    }
  } catch (e: any) {
    console.error('[Recovery] Error scanning scraping_tasks:', e.message);
  }

  return recovered;
}

// ============================================================================
// MAIN CRON HANDLER
// ============================================================================
export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();

  try {
    // ── Step 1: Update Heartbeat ──
    await updateHeartbeat('running', 'Cron job started');

    // ── Step 2: Recover Stuck Tasks ──
    const recovered = await recoverStuckTasks();
    if (recovered > 0) {
      await sendTelegram(`🔧 <b>Auto-Recovery</b>\n♻️ ${recovered} stuck task(s) recovered`);
    }

    // ── Step 3: Pick 1 pending item ──
    let doc: any = null;
    let col = '';

    const mSnap = await db.collection('movies_queue')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();

    if (!mSnap.empty) {
      doc = mSnap.docs[0];
      col = 'movies_queue';
    } else {
      const wSnap = await db.collection('webseries_queue')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();
      if (!wSnap.empty) {
        doc = wSnap.docs[0];
        col = 'webseries_queue';
      }
    }

    if (!doc) {
      await updateHeartbeat('idle', 'Queue empty — nothing to process');
      return NextResponse.json({ status: 'idle', message: 'Queue empty', recovered, heartbeat: 'updated' });
    }

    const item = { id: doc.id, ...doc.data() } as any;
    const retryCount = item.retryCount || 0;

    // ── Step 4: Lock the task ──
    await db.collection(col).doc(item.id).update({
      status: 'processing',
      lockedAt: new Date().toISOString(),
      retryCount,
    });

    // ── Step 5: Create task via /api/tasks ──
    const base = process.env.NEXT_PUBLIC_BASE_URL!;
    const taskRes = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: item.url }),
    });

    if (!taskRes.ok) throw new Error(`/api/tasks HTTP ${taskRes.status}`);
    const taskData = await taskRes.json();
    if (taskData.error) throw new Error(taskData.error);

    const taskId = taskData.taskId;

    // ── Step 6: Fetch and solve links ──
    const listRes = await fetch(`${base}/api/tasks`);
    const taskList = await listRes.json();
    const newTask = Array.isArray(taskList) ? taskList.find((t: any) => t.id === taskId) : null;

    let success = false;
    if (newTask?.links?.length > 0) {
      const pending = newTask.links
        .map((l: any, i: number) => ({ ...l, _idx: i }))
        .filter((l: any) => {
          const s = (l.status || '').toLowerCase();
          return s === 'pending' || s === '' || s === 'processing';
        });

      if (pending.length > 0) {
        const solveRes = await fetch(`${base}/api/stream_solve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            links: pending.map((l: any) => ({ id: l._idx, name: l.name, link: l.link })),
            taskId,
            extractedBy: 'Server/Auto-Pilot',
          }),
        });

        if (solveRes.ok && solveRes.body) {
          const reader = solveRes.body.getReader();
          const dec = new TextDecoder();
          let buf = '', ok = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const l of lines) {
              try {
                const d = JSON.parse(l);
                if (d.status === 'done') ok++;
              } catch {}
            }
          }
          success = ok > 0;
        }
      } else {
        success = true;
      }
    }

    // ── Step 7: Update queue status ──
    const finalStatus = success ? 'completed' : 'failed';
    await db.collection(col).doc(item.id).update({
      status: finalStatus,
      processedAt: new Date().toISOString(),
      taskId,
      extractedBy: 'Server/Auto-Pilot',
      retryCount,
    });

    // ── Step 8: Mark extraction source on scraping_tasks ──
    try {
      await db.collection('scraping_tasks').doc(taskId).update({
        extractedBy: 'Server/Auto-Pilot',
      });
    } catch {}

    // ── Step 9: Update Heartbeat ──
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const title = taskData.preview?.title || item.title || item.url;

    await updateHeartbeat('idle', `Last: ${title} (${finalStatus})`);

    await sendTelegram(success
      ? `✅ <b>Auto-Pilot</b> 🤖\n🎬 ${title}\n⏱ ${elapsed}s\n🔄 Retry: ${retryCount}/3`
      : `❌ <b>Auto-Pilot Failed</b>\n🎬 ${title}\n🔄 Retry: ${retryCount}/3`
    );

    return NextResponse.json({
      status: finalStatus, title, elapsed, recovered, retryCount,
      extractedBy: 'Server/Auto-Pilot', heartbeat: 'updated',
    });

  } catch (e: any) {
    await updateHeartbeat('error', e.message);
    await sendTelegram(`🚨 <b>CRON ERROR</b>\n${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
