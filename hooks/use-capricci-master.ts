'use client';

import { useState } from 'react';
import { masterChangeCount, originalCapricciMaster, validateCapricciMaster, type CapricciMaster } from '@/lib/capricci-master';
import type { MasterHistory, MasterRecord } from '@/lib/master-api-contract';

// GitHub deployment and Google Drive persistence are deferred by the user.
// Today's edits apply only to a clearly labeled, in-memory preview.
export function useCapricciMaster() {
  const [record, setRecord] = useState<MasterRecord>({ master: originalCapricciMaster, revision: 0, updatedAt: null, updatedBy: null });
  const [previewActive, setPreviewActive] = useState(false);
  const preview = (master: CapricciMaster) => {
    const validated = validateCapricciMaster(master);
    setRecord({ master: validated, revision: 0, updatedAt: null, updatedBy: null });
    setPreviewActive(masterChangeCount(validated) > 0);
  };
  return {
    record, previewActive, preview,
    status: 'offline' as 'loading' | 'connected' | 'offline' | 'error',
    canEdit: false, history: [] as MasterHistory[], busy: false, error: '',
    reload: async () => false, save: async (_master: CapricciMaster) => false,
  };
}
