import type { CapricciMaster } from '@/lib/capricci-master';

// Future GitHub-hosted UI -> authenticated API -> Google Drive.
// This contract is unconfigured until finalization, not a working Drive adapter.
export type MasterRecord = { master: CapricciMaster; revision: number; updatedAt: string | null; updatedBy: string | null };
export type MasterHistory = { revision: number; updatedAt: string; updatedBy: string };
export type MasterApi = {
  load: () => Promise<MasterRecord & { canEdit: boolean; history: MasterHistory[] }>;
  save: (master: CapricciMaster, expectedRevision: number) => Promise<MasterRecord>;
};
