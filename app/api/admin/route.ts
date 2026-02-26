export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

function checkAuth(req: Request) {
  const key = req.headers.get('x-admin-key') || new URL(req.url).searchParams.get('key');
  return key === process.env.ADMIN_SECRET;
}

// GET /api/admin?action=stats|tasks|queue|activity|health|analytics|backup|telegram-settings
export async function GET(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = new URL(req.url).searchParams.get('action') || 'stats';

  try {
    // ── STATS (FIXED: includes pending count) ──
    if (action === 'stats') {
      const [mqSnap, wqSnap] = await Promise.all([
        db.collection('movies_queue').get(),
        db.collection('webseries_queue').get(),
      ]);

      const [completedSnap, failedSnap, processingSnap, pendingSnap] = await Promise.all([
        db.collection('scraping_tasks').where('status', '==', 'completed').get(),
        db.collection('scraping_tasks').where('status', '==', 'failed').get(),
        db.collection('scraping_tasks').where('status', '==', 'processing').get(),
        db.collection('scraping_tasks').where('status', '==', 'pending').get(),
      ]);

      const mqPending = mqSnap.docs.filter(d => d.data().status === 'pending').length;
      const wqPending = wqSnap.docs.filter(d => d.data().status === 'pending').length;
      const mqDone = mqSnap.docs.filter(d => d.data().status === 'completed').length;
      const wqDone = wqSnap.docs.filter(d => d.data().status === 'completed').length;

      return NextResponse.json({
        tasks: {
          completed: completedSnap.size,
          failed: failedSnap.size,
          processing: processingSnap.size,
          pending: pendingSnap.size,
          total: completedSnap.size + failedSnap.size + processingSnap.size + pendingSnap.size,
        },
        queue: {
          movies: { pending: mqPending, completed: mqDone, total: mqSnap.size },
          webseries: { pending: wqPending, completed: wqDone, total: wqSnap.size },
          totalPending: mqPending + wqPending,
        },
      });
    }

    // ── TASKS ──
    if (action === 'tasks') {
      const limit = parseInt(new URL(req.url).searchParams.get('limit') || '40');
      const status = new URL(req.url).searchParams.get('status');
      let query: any = db.collection('scraping_tasks').orderBy('createdAt', 'desc').limit(limit);
      if (status && status !== 'all') {
        query = db.collection('scraping_tasks').where('status', '==', status).orderBy('createdAt', 'desc').limit(limit);
      }
      const snap = await query.get();
      return NextResponse.json(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    }

    // ── QUEUE (FIXED: proper status filtering) ──
    if (action === 'queue') {
      const type = new URL(req.url).searchParams.get('type') || 'all';
      const status = new URL(req.url).searchParams.get('status');
      const items: any[] = [];
      if (type === 'all' || type === 'movies') {
        const s = await db.collection('movies_queue').orderBy('createdAt', 'desc').limit(50).get();
        s.docs.forEach(d => {
          const data = d.data();
          if (!status || status === 'all' || data.status === status) {
            items.push({ id: d.id, collection: 'movies_queue', ...data });
          }
        });
      }
      if (type === 'all' || type === 'webseries') {
        const s = await db.collection('webseries_queue').orderBy('createdAt', 'desc').limit(50).get();
        s.docs.forEach(d => {
          const data = d.data();
          if (!status || status === 'all' || data.status === status) {
            items.push({ id: d.id, collection: 'webseries_queue', ...data });
          }
        });
      }
      return NextResponse.json({ items, total: items.length });
    }

    // ── ACTIVITY FEED ──
    if (action === 'activity') {
      const snap = await db.collection('scraping_tasks').orderBy('updatedAt', 'desc').limit(20).get();
      const activities = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.preview?.title || 'Unknown',
          status: data.status,
          updatedAt: data.updatedAt || data.createdAt,
          linksCount: data.links?.length || 0,
          linksDone: data.links?.filter((l: any) => ['done', 'success'].includes((l.status || '').toLowerCase())).length || 0,
        };
      });
      return NextResponse.json(activities);
    }

    // ── VPS HEALTH CHECK ──
    if (action === 'health') {
      const pingService = async (url: string) => {
        const start = Date.now();
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 8000);
          const res = await fetch(url, { signal: ctrl.signal });
          clearTimeout(t);
          return { online: res.ok || res.status < 500, latency: Date.now() - start };
        } catch {
          return { online: false, latency: Date.now() - start };
        }
      };
      const [hubcloud, timer] = await Promise.all([
        pingService('http://85.121.5.246:5001/'),
        pingService('http://85.121.5.246:10000/'),
      ]);
      return NextResponse.json({
        hubcloud: { ...hubcloud, port: 5001 },
        timer: { ...timer, port: 10000 },
        checkedAt: new Date().toISOString(),
      });
    }

    // ── 7-DAY ANALYTICS ──
    if (action === 'analytics') {
      const days: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        try {
          const doc = await db.collection('processing_history').doc(dateStr).get();
          if (doc.exists) {
            const data = doc.data()!;
            days.push({ date: dateStr, label: dayLabel, success: data.success || 0, failed: data.failed || 0, total: data.total || 0 });
          } else {
            days.push({ date: dateStr, label: dayLabel, success: 0, failed: 0, total: 0 });
          }
        } catch {
          days.push({ date: dateStr, label: dayLabel, success: 0, failed: 0, total: 0 });
        }
      }
      return NextResponse.json(days);
    }

    // ── FULL DATABASE BACKUP ──
    if (action === 'backup') {
      const backup: Record<string, any[]> = {};
      const collections = ['scraping_tasks', 'movies_queue', 'webseries_queue', 'movies', 'webseries', 'processing_history', 'admin_settings'];
      for (const col of collections) {
        try {
          const snap = await db.collection(col).get();
          backup[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {
          backup[col] = [];
        }
      }
      return new Response(JSON.stringify(backup, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="mflix-backup-${new Date().toISOString().split('T')[0]}.json"`,
        },
      });
    }

    // ── TELEGRAM SETTINGS (GET) ──
    if (action === 'telegram-settings') {
      try {
        const doc = await db.collection('admin_settings').doc('telegram').get();
        if (doc.exists) {
          return NextResponse.json(doc.data());
        }
        return NextResponse.json({ botToken: '', chatId: '', enabled: false });
      } catch {
        return NextResponse.json({ botToken: '', chatId: '', enabled: false });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/admin
export async function DELETE(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, collection } = await req.json();
    if (!id || !collection) return NextResponse.json({ error: 'id and collection required' }, { status: 400 });
    await db.collection(collection).doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/admin
export async function PATCH(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { id, collection, status } = await req.json();
    if (!id || !collection || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    await db.collection(collection).doc(id).update({ status, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin — multiple actions
export async function POST(req: Request) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const action = body.action;

    // ── ADD TO QUEUE ──
    if (action === 'add-queue') {
      const { url, title, type } = body;
      if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });
      const collection = type === 'webseries' ? 'webseries_queue' : 'movies_queue';
      const ref = await db.collection(collection).add({
        url, title: title || 'Untitled', type: type || 'movie',
        status: 'pending', createdAt: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, id: ref.id });
    }

    // ── BULK IMPORT ──
    if (action === 'bulk-import') {
      const { urls, type } = body;
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return NextResponse.json({ error: 'urls array required' }, { status: 400 });
      }
      const collection = type === 'webseries' ? 'webseries_queue' : 'movies_queue';
      const batch = db.batch();
      const ids: string[] = [];
      for (const url of urls.slice(0, 50)) {
        if (!url.trim()) continue;
        const ref = db.collection(collection).doc();
        batch.set(ref, {
          url: url.trim(), title: 'Imported', type: type || 'movie',
          status: 'pending', createdAt: new Date().toISOString(),
        });
        ids.push(ref.id);
      }
      await batch.commit();
      return NextResponse.json({ success: true, count: ids.length, ids });
    }

    // ── CLEAR COMPLETED ──
    if (action === 'clear-completed') {
      const snap = await db.collection('scraping_tasks').where('status', '==', 'completed').get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return NextResponse.json({ success: true, deleted: snap.size });
    }

    // ── CLEAR FAILED ──
    if (action === 'clear-failed') {
      const snap = await db.collection('scraping_tasks').where('status', '==', 'failed').get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      return NextResponse.json({ success: true, deleted: snap.size });
    }

    // ── SAVE TELEGRAM SETTINGS ──
    if (action === 'save-telegram') {
      const { botToken, chatId, enabled } = body;
      await db.collection('admin_settings').doc('telegram').set({
        botToken: botToken || '', chatId: chatId || '', enabled: !!enabled,
        updatedAt: new Date().toISOString(),
      });

      // Test the connection if enabled
      if (enabled && botToken && chatId) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: '✅ MFLIX PRO Admin Panel connected! Notifications are now active.',
              parse_mode: 'HTML',
            }),
          });
        } catch { /* test message failed, but settings saved */ }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
