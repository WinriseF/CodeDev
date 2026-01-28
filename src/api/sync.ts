export async function syncOfflineMemos() {
  const offlineData = localStorage.getItem('offline_memos');
  if (!offlineData) return;

  const memos = JSON.parse(offlineData);
  if (memos.length === 0) return;

  try {
    const res = await fetch('/api/memos/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memos),
    });

    if (res.ok) {
      localStorage.removeItem('offline_memos');
      console.log('离线数据同步完成');
    }
  } catch (error) {
    console.error('同步失败，可能仍处于离线状态');
  }
}

export function saveOfflineMemo(memo: { content: string; tags: string[]; created_at: number }) {
  const offlineData = localStorage.getItem('offline_memos');
  const memos = offlineData ? JSON.parse(offlineData) : [];
  memos.push(memo);
  localStorage.setItem('offline_memos', JSON.stringify(memos));
}
