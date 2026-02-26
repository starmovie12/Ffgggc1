export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const queueType = searchParams.get('type') || 'all';
  const includeActive = searchParams.get('include_active') === 'true';

  try {
    const results: any[] = [];

    const fetchQueue = async (col: string, label: string) => {
      let snap;
      if (includeActive) {
        snap = await db.collection(col).orderBy('createdAt', 'desc').limit(100).get();
      } else {
        snap = await db.collection(col).where('status', '==', 'pending').orderBy('__name__').get();
      }
      snap.docs.forEach(doc => results.push({ id: doc.id, collection: col, type: label, ...doc.data() }));
    };

    if (queueType === 'movies' || queueType === 'all') await fetchQueue('movies_queue', 'movie');
    if (queueType === 'webseries' || queueType === 'all') await fetchQueue('webseries_queue', 'webseries');

    // If not include_active, only return pending
    const filtered = includeActive ? results : results.filter(r => r.status === 'pending');

    return NextResponse.json({ status: 'success', total: filtered.length, items: filtered });
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, collection, status, error: errorMsg } = await req.json();
    if (!id || !collection || !status) {
      return NextResponse.json({ status: 'error', message: 'id, collection, status required' }, { status: 400 });
    }
    const update: any = { status, updatedAt: new Date().toISOString() };
    if (errorMsg) update.error = errorMsg;
    await db.collection(collection).doc(id).update(update);
    return NextResponse.json({ status: 'success', id, newStatus: status });
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
  }
}
