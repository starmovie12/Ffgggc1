export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for Vercel Pro (default is 10s)

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { extractMovieLinks } from '@/lib/solvers';

// =============================================
// HELPER: Telegram Alert
// =============================================
async function sendTelegramAlert(failedUrl: string, errorMessage: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const message = `🚨 MFLIX ERROR 🚨\nURL: ${failedUrl}\nError: ${errorMessage}`;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (e: any) {
    console.error('[Telegram] Failed to send alert:', e.message);
  }
}

// =============================================
// GET /api/tasks — List recent tasks
// =============================================
export async function GET() {
  try {
    const snapshot = await db
      .collection('scraping_tasks')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(tasks);
  } catch (e: any) {
    console.error('[GET /api/tasks] Error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// =============================================
// POST /api/tasks — Create or merge/retry a scraping task
// =============================================
export async function POST(req: Request) {
  let url: string;
  try {
    const body = await req.json();
    url = body?.url;
  } catch (parseError: any) {
    console.error('[POST /api/tasks] JSON parse error:', parseError.message);
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  if (!url || typeof url !== 'string' || !url.trim()) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const trimmedUrl = url.trim();

  try {
    let existingTaskId: string | null = null;
    let existingTaskData: any = null;

    try {
      const existingSnapshot = await db
        .collection('scraping_tasks')
        .where('url', '==', trimmedUrl)
        .limit(5) 
        .get();

      if (!existingSnapshot.empty) {
        const sorted = existingSnapshot.docs
          .map((doc) => ({ id: doc.id, data: doc.data() }))
          .sort((a, b) => {
            const timeA = a.data.createdAt || '';
            const timeB = b.data.createdAt || '';
            return timeB > timeA ? 1 : timeB < timeA ? -1 : 0;
          });

        existingTaskId = sorted[0].id;
        existingTaskData = sorted[0].data;
      }
    } catch (dupCheckErr: any) {
      console.warn('[POST /api/tasks] Duplicate check failed, creating new task:', dupCheckErr.message);
    }

    const listResult = await extractMovieLinks(trimmedUrl);

    // ---- Step 4: If duplicate exists, Merge or Retry ----
    if (existingTaskId && existingTaskData) {
      if (listResult.status === 'success' && listResult.links) {
        const existingLinks: any[] = existingTaskData.links || [];
        const existingLinkUrls = new Set(existingLinks.map((l: any) => l.link));

        const newLinksToAdd = listResult.links
          .filter((l: any) => !existingLinkUrls.has(l.link))
          .map((l: any) => ({ ...l, status: 'pending', logs: [] }));

        // FIX FOR RETRY BUG: Reset any failed/error links back to pending automatically
        const updatedExistingLinks = existingLinks.map((l: any) => {
          if (l.status === 'error' || l.status === 'failed') {
            return { 
              ...l, 
              status: 'pending', 
              logs: [{ msg: '🔄 Retrying...', type: 'info' }] 
            };
          }
          return l;
        });

        const mergedLinks = [...updatedExistingLinks, ...newLinksToAdd];

        await db.collection('scraping_tasks').doc(existingTaskId).update({
          status: 'processing', // Ensure task is active again for stream_solve
          error: null, // Clear past errors
          links: mergedLinks,
          metadata: listResult.metadata || existingTaskData.metadata,
          preview: listResult.preview || existingTaskData.preview,
          updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
          taskId: existingTaskId,
          metadata: listResult.metadata,
          preview: listResult.preview,
          merged: true,
          newLinksAdded: newLinksToAdd.length,
          note: 'Task reset for retry successfully'
        });
      }

      return NextResponse.json({
        taskId: existingTaskId,
        metadata: existingTaskData.metadata,
        preview: existingTaskData.preview,
        merged: true,
        newLinksAdded: 0,
      });
    }

    // ---- Step 5: Create new task ----
    const taskData: Record<string, any> = {
      url: trimmedUrl,
      status: 'processing',
      createdAt: new Date().toISOString(),
      extractedBy: 'Browser/Live',
      metadata: listResult.status === 'success' ? listResult.metadata : null,
      preview: listResult.status === 'success' ? (listResult as any).preview : null,
      links:
        listResult.status === 'success' && listResult.links
          ? listResult.links.map((l: any) => ({
              ...l,
              status: 'pending', // Set to pending so stream_solve can pick it up
              logs: [{ msg: '🔍 Queued for processing...', type: 'info' }],
            }))
          : [],
    };

    const taskRef = await db.collection('scraping_tasks').add(taskData);
    const taskId = taskRef.id;

    if (listResult.status !== 'success' || !listResult.links) {
      await taskRef.update({
        status: 'failed',
        error: listResult.message || 'Extraction failed',
      });
      sendTelegramAlert(trimmedUrl, listResult.message || 'Extraction failed').catch(() => {});
    }

    return NextResponse.json({
      taskId,
      metadata: taskData.metadata,
      preview: taskData.preview,
    });
  } catch (e: any) {
    console.error('[POST /api/tasks] Unhandled error:', e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// =============================================
// DELETE /api/tasks — Delete a task from Firestore
// =============================================
export async function DELETE(req: Request) {
  try {
    let taskId: string | null = null;
    
    // Support URL search params fallback (e.g., /api/tasks?taskId=123)
    const url = new URL(req.url);
    taskId = url.searchParams.get('taskId');

    // If not in URL, check JSON body safely
    if (!taskId) {
      const body = await req.json().catch(() => ({}));
      taskId = body?.taskId;
    }

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const docRef = db.collection('scraping_tasks').doc(taskId);
    const doc = await docRef.get();

    if (!doc.exists) {
      // If already deleted, return success so UI updates smoothly
      return NextResponse.json({ success: true, deletedId: taskId, note: 'Task not found or already deleted' });
    }

    await docRef.delete();
    return NextResponse.json({ success: true, deletedId: taskId });
  } catch (e: any) {
    console.error('[DELETE /api/tasks] Error:', e.message);
    // Return 200 with error flag to prevent UI crashing
    return NextResponse.json({ success: false, error: e.message }, { status: 200 });
  }
}
