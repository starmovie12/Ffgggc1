import useSWR from 'swr';

// ── SWR Fetcher with admin key ──
const createFetcher = (adminKey: string) => async (url: string) => {
  const res = await fetch(url, {
    headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

// ── Stats Hook ──
export function useStats(adminKey: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    adminKey ? '/api/admin?action=stats' : null,
    adminKey ? createFetcher(adminKey) : null,
    {
      refreshInterval: 15000,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );
  return { stats: data, statsError: error, statsLoading: isLoading, mutateStats: mutate };
}

// ── Tasks Hook ──
export function useTasks(adminKey: string | null, filter: string = 'all') {
  const qs = filter !== 'all' ? `&status=${filter}` : '';
  const { data, error, isLoading, mutate } = useSWR(
    adminKey ? `/api/admin?action=tasks&limit=40${qs}` : null,
    adminKey ? createFetcher(adminKey) : null,
    {
      refreshInterval: 15000,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );
  return { tasks: Array.isArray(data) ? data : [], tasksError: error, tasksLoading: isLoading, mutateTasks: mutate };
}

// ── Queue Hook ──
export function useQueue(adminKey: string | null, type: string = 'all', status?: string) {
  const qs = (type !== 'all' ? `&type=${type}` : '') + (status && status !== 'all' ? `&status=${status}` : '');
  const { data, error, isLoading, mutate } = useSWR(
    adminKey ? `/api/admin?action=queue${qs}` : null,
    adminKey ? createFetcher(adminKey) : null,
    {
      refreshInterval: 15000,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );
  return { queueItems: data?.items || [], queueError: error, queueLoading: isLoading, mutateQueue: mutate };
}

// ── Activity Feed Hook ──
export function useActivity(adminKey: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    adminKey ? '/api/admin?action=activity' : null,
    adminKey ? createFetcher(adminKey) : null,
    {
      refreshInterval: 15000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );
  return { activities: Array.isArray(data) ? data : [], activityError: error, activityLoading: isLoading, mutateActivity: mutate };
}

// ── Health Hook ──
export function useHealth(adminKey: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    adminKey ? '/api/admin?action=health' : null,
    adminKey ? createFetcher(adminKey) : null,
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );
  return { health: data, healthError: error, healthLoading: isLoading, mutateHealth: mutate };
}

// ── Analytics Hook (7-day chart data) ──
export function useAnalytics(adminKey: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    adminKey ? '/api/admin?action=analytics' : null,
    adminKey ? createFetcher(adminKey) : null,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );
  return { analytics: Array.isArray(data) ? data : [], analyticsError: error, analyticsLoading: isLoading, mutateAnalytics: mutate };
}

// ── Telegram Settings Hook ──
export function useTelegramSettings(adminKey: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    adminKey ? '/api/admin?action=telegram-settings' : null,
    adminKey ? createFetcher(adminKey) : null,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );
  return { telegramSettings: data, telegramError: error, telegramLoading: isLoading, mutateTelegram: mutate };
}

// ── Mutate helper for POST actions ──
export async function adminPost(adminKey: string, body: Record<string, any>) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function adminDelete(adminKey: string, body: Record<string, any>) {
  const res = await fetch('/api/admin', {
    method: 'DELETE',
    headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function adminPatch(adminKey: string, body: Record<string, any>) {
  const res = await fetch('/api/admin', {
    method: 'PATCH',
    headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
