'use client';

import { useEffect, useRef, useState } from 'react';

// Approval comes from the in-page dialog, not window.confirm (which a host
// browser may suppress). Keep the normal close/reload guard at all other times.
export function usePageRefresh(hasPendingChanges: boolean) {
  const allowed = useRef(false);
  const timeout = useRef<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  useEffect(() => {
    if (!hasPendingChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (allowed.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasPendingChanges]);
  useEffect(() => () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    allowed.current = false;
  }, []);

  function requestReload(saveView: () => void) {
    if (allowed.current) return;
    const failed = () => {
      allowed.current = false;
      timeout.current = null;
      setRefreshing(false);
      setRefreshError('หน้าเดิมยังไม่โหลดใหม่ ข้อมูลในหน้านี้ยังไม่ได้ถูกล้าง กรุณาสำรองด้วย Export Current Data ก่อนใช้ปุ่ม Reload ของเบราว์เซอร์ หรือเปิดไฟล์ HTML เดิมในแท็บใหม่');
    };
    setRefreshError('');
    setRefreshing(true);
    allowed.current = true;
    try {
      saveView();
      timeout.current = window.setTimeout(failed, 4000);
      window.location.reload();
    } catch {
      if (timeout.current !== null) window.clearTimeout(timeout.current);
      failed();
    }
  }
  return { refreshing, refreshError, requestReload };
}
