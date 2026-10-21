'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export function RefreshDialog({ importedDays, queueCount, masterDirty, masterPreview, onClose, onConfirm, onBackup, onMaster }: {
  importedDays: number; queueCount: number; masterDirty: boolean; masterPreview: boolean;
  onClose: () => void; onConfirm: () => void; onBackup: () => void; onMaster: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const hasPending = importedDays > 0 || queueCount > 0 || masterDirty || masterPreview;
  return <AlertDialog open onOpenChange={open => { if (!open) onClose(); }}>
    <AlertDialogContent className="sm:max-w-lg">
      <AlertDialogHeader>
        <AlertDialogTitle>Refresh Dashboard</AlertDialogTitle>
        <AlertDialogDescription>โหลดไฟล์ HTML ใหม่ โดยคงร้าน วันที่ หน้า และประเภท Report ที่เลือกไว้ ไม่ดึงข้อมูลใหม่จาก POS</AlertDialogDescription>
      </AlertDialogHeader>
      {hasPending ? <div className="space-y-3 text-xs leading-relaxed text-stone-600">
        <p className="rounded-lg bg-amber-50 p-3 text-amber-900">หลัง Refresh ข้อมูล Import {importedDays} ชุดจะกลับเป็นข้อมูลต้นแบบ และคิว {queueCount} รายการจะถูกล้าง ต้องใช้ Open Backup → Restore Backup เพื่อคืนข้อมูลที่นำเข้า</p>
        {masterPreview && <p>Master Data ที่ทดลองใช้อยู่จะกลับต้นแบบ ต้องสำรอง Master ล่าสุดพร้อมข้อมูล Import ก่อน</p>}
        {masterDirty && <p className="text-red-700">มีแบบร่าง Master Data ที่ยังไม่ใช้กับ Dashboard: Export Current Data ยังไม่รวมแบบร่างนี้ กรุณาไป Master Data เพื่อส่งออกแบบร่างหรือทดลองใช้ก่อนสำรอง</p>}
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onBackup}>Go to Backup</Button>{masterDirty && <Button variant="outline" onClick={onMaster}>Go to Master Data</Button>}</div>
        <label className="flex items-start gap-2"><input aria-label="Confirm Refresh Backup" type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>ฉันเก็บไฟล์สำรองและแบบร่างที่ต้องการแล้ว และยอมให้โหลดใหม่โดยล้างข้อมูลชั่วคราว/คิวในหน้านี้</span></label>
      </div> : <p className="text-xs text-stone-500">ไม่มีข้อมูล Import หรือแบบร่างที่ต้องสำรอง สามารถโหลดหน้าใหม่ได้</p>}
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
        <AlertDialogAction disabled={hasPending && !confirmed} onClick={() => { if (!hasPending || confirmed) onConfirm(); }}>Reload Page</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
