export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

export async function GET() {
  try {
    const doc = await db.collection('system').doc('engine_status').get();

    if (!doc.exists) {
      return NextResponse.json({
        status: 'unknown',
        signal: 'OFFLINE',
        lastRunAt: null,
        details: 'No heartbeat data found',
        backgroundActive: false,
      });
    }

    const data = doc.data()!;
    const lastRunAt = data.lastRunAt || null;
    const now = new Date();
    const lastRun = lastRunAt ? new Date(lastRunAt) : null;

    // Engine is ONLINE if it ran within the last 10 minutes
    const TEN_MINUTES = 10 * 60 * 1000;
    const isOnline = lastRun ? (now.getTime() - lastRun.getTime()) < TEN_MINUTES : false;

    // Calculate time since last run
    let timeSinceLastRun = '';
    if (lastRun) {
      const diffMs = now.getTime() - lastRun.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffSec = Math.floor((diffMs % 60000) / 1000);
      if (diffMin > 60) {
        const diffHr = Math.floor(diffMin / 60);
        timeSinceLastRun = `${diffHr}h ${diffMin % 60}m ago`;
      } else if (diffMin > 0) {
        timeSinceLastRun = `${diffMin}m ${diffSec}s ago`;
      } else {
        timeSinceLastRun = `${diffSec}s ago`;
      }
    }

    // Check pending queue count
    let pendingCount = 0;
    try {
      const mSnap = await db.collection('movies_queue').where('status', '==', 'pending').get();
      const wSnap = await db.collection('webseries_queue').where('status', '==', 'pending').get();
      pendingCount = mSnap.size + wSnap.size;
    } catch {}

    // Check processing count
    let processingCount = 0;
    try {
      const mProcSnap = await db.collection('movies_queue').where('status', '==', 'processing').get();
      const wProcSnap = await db.collection('webseries_queue').where('status', '==', 'processing').get();
      processingCount = mProcSnap.size + wProcSnap.size;
    } catch {}

    return NextResponse.json({
      status: data.status || 'unknown',
      signal: isOnline ? 'ONLINE' : 'OFFLINE',
      lastRunAt,
      timeSinceLastRun,
      details: data.details || '',
      source: data.source || 'unknown',
      backgroundActive: isOnline && (pendingCount > 0 || processingCount > 0),
      pendingCount,
      processingCount,
    });
  } catch (e: any) {
    return NextResponse.json({
      status: 'error',
      signal: 'OFFLINE',
      error: e.message,
      backgroundActive: false,
    }, { status: 500 });
  }
}
