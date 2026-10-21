import { calculateFinanceCategories, capricciFinance } from '@/lib/report-data';

export type MasterItem = { itemCode: string; name: string; subgroup: string };
export type MasterGroup = { subgroup: string; category: string };
export type CapricciMaster = {
  version: 1; brandId: 'capricci'; sourceSha256: string;
  items: MasterItem[]; groups: MasterGroup[];
};
export const masterKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const clean = (value: string) => value.trim().replace(/\s+/g, ' ');
// This earlier workbook hash was independently checked against the re-saved
// reference: every existing mapping, group, transaction and cached check agrees.
const compatibleSourceHashes = new Set([capricciFinance.source.sha256, 'bbd6f27742b69f2c90b84bbddcab2f5bccd87b6d12c1b93a91358adb48cb750a']);
export function createCapricciMaster(): CapricciMaster {
  const items = new Map<string, MasterItem>();
  for (const row of capricciFinance.mapping) {
    const key = masterKey(row.itemCode);
    if (!items.has(key)) items.set(key, { itemCode: row.itemCode.trim(), name: clean(row.menu || row.itemCode), subgroup: clean(row.subgroup ?? '') });
  }
  return {
    version: 1, brandId: 'capricci', sourceSha256: capricciFinance.source.sha256,
    items: [...items.values()],
    groups: capricciFinance.groups.map(group => ({ subgroup: clean(group.subgroup), category: clean(group.category) })),
  };
}
export const originalCapricciMaster = createCapricciMaster();
export const masterCategoryNames = [...capricciFinance.categoryNames];

export const masterMissingValue = 'ไม่ระบุ';
export type MasterTableRow = MasterItem & {
  type: string; subType: string; sourceCategory: string; output: string;
  hasSales: boolean; hasConflict: boolean;
};
export type MasterTableFilters = {
  type?: string; subType?: string; sourceCategory?: string;
  search?: string; status?: 'ทั้งหมด' | 'มีรายการขาย' | 'หมวดขัดกัน';
};

// Display metadata is separate from the v1 editable/exported Master contract.
// P (Main.) is NOT Q (Output); D (Category) is NOT the sales Output either.
export function masterTableRows(master: CapricciMaster): MasterTableRow[] {
  const sourceItems = new Map<string, { sourceCategory?: string | null }>();
  for (const row of capricciFinance.mapping) {
    const key = masterKey(row.itemCode);
    if (!sourceItems.has(key)) sourceItems.set(key, row);
  }
  const sourceGroups = new Map(capricciFinance.groups.map(group => [masterKey(group.subgroup), group]));
  const outputs = new Map(master.groups.map(group => [masterKey(group.subgroup), group.category]));
  const sold = new Set(capricciFinance.rows.map(row => masterKey(row.itemCode)));
  const conflicts = new Set(capricciFinance.duplicateConflicts.map(row => masterKey(row.itemCode)));
  return master.items.map(item => {
    const key = masterKey(item.itemCode), groupKey = masterKey(item.subgroup);
    const sourceGroup = sourceGroups.get(groupKey);
    return {
      ...item,
      type: clean(sourceGroup?.mainGroup || '') || masterMissingValue,
      subType: clean(sourceGroup?.subgroup || item.subgroup) || masterMissingValue,
      sourceCategory: clean(sourceItems.get(key)?.sourceCategory || '') || masterMissingValue,
      output: key === 'servicecharge' ? 'ยกเว้นจากยอดขาย' : outputs.get(groupKey) ?? 'Unmapped',
      hasSales: sold.has(key), hasConflict: conflicts.has(key),
    };
  });
}

export function filterMasterTable(rows: MasterTableRow[], filters: MasterTableFilters) {
  const search = masterKey(filters.search ?? '');
  return rows.filter(row =>
    (!filters.type || row.type === filters.type) &&
    (!filters.subType || row.subType === filters.subType) &&
    (!filters.sourceCategory || row.sourceCategory === filters.sourceCategory) &&
    (!search || masterKey(`${row.itemCode} ${row.name} ${row.type} ${row.subType} ${row.sourceCategory} ${row.output}`).includes(search)) &&
    (filters.status !== 'มีรายการขาย' || row.hasSales) &&
    (filters.status !== 'หมวดขัดกัน' || row.hasConflict)
  );
}

export function masterFilterOptions(rows: MasterTableRow[], field: 'type' | 'subType' | 'sourceCategory') {
  return [...new Set(rows.map(row => row[field]))].sort((a, b) => a === masterMissingValue ? 1 : b === masterMissingValue ? -1 : a.localeCompare(b, 'en'));
}

// Sub Type depends only on Type, not on search / Category / sales filters.
// Resolve both options and value so a stale child selection never hides rows.
export function masterSubTypeFilter(rows: MasterTableRow[], type: string, selected = 'ทั้งหมด') {
  const typeRows = type === 'ทั้งหมด' ? rows : rows.filter(row => row.type === type);
  const options = ['ทั้งหมด', ...masterFilterOptions(typeRows, 'subType')];
  return { options, value: options.includes(selected) ? selected : 'ทั้งหมด' };
}

// Category is the child of the effective Sub Type and Type. Resolving the
// parent first also handles switching Type while its old Sub Type is stale.
export function masterCategoryFilter(rows: MasterTableRow[], type: string, subType: string, selected = 'ทั้งหมด') {
  const parent = masterSubTypeFilter(rows, type, subType).value;
  const parentRows = rows.filter(row => (type === 'ทั้งหมด' || row.type === type) && (parent === 'ทั้งหมด' || row.subType === parent));
  const options = ['ทั้งหมด', ...masterFilterOptions(parentRows, 'sourceCategory')];
  return { options, value: options.includes(selected) ? selected : 'ทั้งหมด' };
}

// The JSON boundary accepts only this brand / source version and valid unique
// codes. No money, transaction, filter, or original-report edits are accepted.
export function validateCapricciMaster(value: unknown): CapricciMaster {
  if (!value || typeof value !== 'object') throw new Error('รูปแบบ Master Data ไม่ถูกต้อง');
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || input.brandId !== 'capricci' || typeof input.sourceSha256 !== 'string' || !compatibleSourceHashes.has(input.sourceSha256)) throw new Error('ไฟล์ต้องเป็น Master Data ของ Capricci และชุดต้นแบบเดียวกัน');
  if (!Array.isArray(input.items) || input.items.length > 10000 || !Array.isArray(input.groups)) throw new Error('ไม่พบตารางสินค้า/หมวดย่อย หรือจำนวนรายการเกินกำหนด');
  const field = (row: unknown, key: string, max: number) => {
    const value = row && typeof row === 'object' ? (row as Record<string, unknown>)[key] : undefined;
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`ข้อมูล ${key} ไม่ครบหรือยาวเกินกำหนด`);
    return clean(value);
  };
  const groupKeys = new Set(originalCapricciMaster.groups.map(group => masterKey(group.subgroup)));
  const seenGroups = new Set<string>();
  const groups = input.groups.map(row => {
    const subgroup = field(row, 'subgroup', 80), category = field(row, 'category', 80);
    const key = masterKey(subgroup);
    if (!groupKeys.has(key) || seenGroups.has(key) || !masterCategoryNames.includes(category)) throw new Error('หมวดย่อยต้องครบ ไม่ซ้ำ และ Output ต้องเป็นหนึ่งใน 4 หมวด');
    seenGroups.add(key);
    return { subgroup, category };
  });
  if (seenGroups.size !== groupKeys.size) throw new Error('หมวดย่อยไม่ครบตามต้นแบบ');
  const seen = new Set<string>();
  const items = input.items.map(row => {
    const itemCode = field(row, 'itemCode', 80), name = field(row, 'name', 300), subgroup = field(row, 'subgroup', 80);
    const key = masterKey(itemCode);
    if (seen.has(key)) throw new Error(`ItemCode ซ้ำ: ${itemCode}`);
    if (key === 'servicecharge' ? subgroup !== 'Service Charge' : subgroup !== 'ยังไม่จัดหมวด' && !groupKeys.has(masterKey(subgroup))) throw new Error(`หมวดของ ${itemCode} ไม่ถูกต้อง; Service Charge ไม่ใช่ยอดขายสินค้า`);
    seen.add(key);
    return { itemCode, name, subgroup };
  });
  if (originalCapricciMaster.items.some(item => !seen.has(masterKey(item.itemCode)))) throw new Error('ห้ามลบรหัสสินค้าเดิมออกจาก Master Data');
  return { version: 1, brandId: 'capricci', sourceSha256: capricciFinance.source.sha256, items, groups };
}

export function calculateMasterCategories(master: CapricciMaster, finance = capricciFinance) {
  const sourceRows = new Map<string, (typeof capricciFinance.mapping)[number]>();
  for (const row of capricciFinance.mapping) if (!sourceRows.has(masterKey(row.itemCode))) sourceRows.set(masterKey(row.itemCode), row);
  return calculateFinanceCategories({
    ...finance,
    mapping: master.items.map(item => {
      const source = sourceRows.get(masterKey(item.itemCode));
      return { ...(source ?? { sourceRow: 0, sourceCategory: null, categorySourceCell: null }), itemCode: item.itemCode, menu: item.name, subgroup: item.subgroup };
    }),
    groups: master.groups.map((group, index) => ({ ...group, mainGroup: group.category, sourceRow: capricciFinance.groups[index]?.sourceRow ?? 0 })),
  });
}

export function masterChangeCount(master: CapricciMaster, baseline = originalCapricciMaster) {
  const items = new Map(baseline.items.map(item => [masterKey(item.itemCode), item]));
  const groups = new Map(baseline.groups.map(group => [masterKey(group.subgroup), group.category]));
  return master.items.filter(item => {
    const original = items.get(masterKey(item.itemCode));
    return !original || item.name !== original.name || item.subgroup !== original.subgroup;
  }).length + master.groups.filter(group => group.category !== groups.get(masterKey(group.subgroup))).length;
}

export function parseMasterJson(text: string) {
  if (text.length > 3_000_000) throw new Error('ไฟล์ Master Data ใหญ่เกิน 3 MB');
  let input: unknown;
  try { input = JSON.parse(text.replace(/^\uFEFF/, '')); }
  catch { throw new Error('ไม่สามารถอ่าน JSON ของ Master Data ได้'); }
  return validateCapricciMaster(input);
}
