import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function harness(path, browser = {}) {
  const slots = []; let cursor = 0;
  const react = {
    useRef: value => { const i = cursor++; return slots[i] ??= { current: value }; },
    useState: value => { const i = cursor++; slots[i] ??= { value }; return [slots[i].value, next => { slots[i].value = next; }]; },
    useEffect: (fn, deps) => { const i = cursor++, old = slots[i]; if (!old || deps.some((v, j) => v !== old.deps[j])) { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; } },
  };
  const output = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: output, window: browser, require: name => name === 'react' ? react : name === 'react/jsx-runtime'
      ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
      : new Proxy({}, { get: (_, key) => key }),
  });
  return { render: (...args) => { cursor = 0; return Object.values(output)[0](...args); }, cleanup: () => slots.forEach(slot => slot?.cleanup?.()) };
}
function find(node, type) {
  if (Array.isArray(node)) return node.flatMap(n => find(n, type));
  if (!node || typeof node !== 'object') return [];
  return [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
}

test('Refresh dialog explicitly protects imports, drafts and queues; cancel/backup never reload', () => {
  for (const risk of [{}, { importedDays: 2 }, { queueCount: 5 }, { masterDirty: true }, { masterPreview: true }]) {
    const calls = [], h = harness('components/refresh-dialog.tsx');
    const props = { importedDays: 0, queueCount: 0, masterDirty: false, masterPreview: false, ...risk,
      onClose: () => calls.push('close'), onConfirm: () => calls.push('reload'), onBackup: () => calls.push('backup'), onMaster: () => calls.push('master') };
    let tree = h.render(props), action = find(tree, 'AlertDialogAction')[0];
    if (Object.keys(risk).length) {
      assert.equal(action.props.disabled, true); action.props.onClick(); assert.deepEqual(calls, []);
      find(tree, 'input')[0].props.onChange({ target: { checked: true } }); tree = h.render(props); action = find(tree, 'AlertDialogAction')[0];
      assert.equal(action.props.disabled, false); action.props.onClick(); assert.deepEqual(calls, ['reload']);
      calls.length = 0; find(tree, 'Button')[0].props.onClick(); assert.deepEqual(calls, ['backup']);
      if (risk.masterDirty) { assert.match(JSON.stringify(tree), /Export Current Data ยังไม่รวมแบบร่างนี้/); find(tree, 'Button')[1].props.onClick(); assert.equal(calls.at(-1), 'master'); }
    } else { assert.equal(action.props.disabled, false); action.props.onClick(); assert.deepEqual(calls, ['reload']); }
    calls.length = 0; find(tree, 'AlertDialogCancel')[0].props.onClick(); assert.deepEqual(calls, ['close']);
    calls.length = 0; find(tree, 'AlertDialog')[0].props.onOpenChange(false); assert.deepEqual(calls, ['close']);
  }
});

function browserHarness({ throws = false } = {}) {
  const listeners = new Map(), timers = new Map(), calls = [];
  const browser = { confirm: () => { throw Error('Native confirm must not be called'); },
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    setTimeout: (fn, delay) => { assert.equal(delay, 4000); timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id),
    location: { reload: () => { calls.push('reload'); if (throws) throw Error('Blocked'); } } };
  const hook = harness('hooks/use-page-refresh.ts', browser);
  const prevented = () => { let value = false; listeners.get('beforeunload')?.({ preventDefault: () => { value = true; }, returnValue: null }); return value; };
  return { ...hook, timers, calls, prevented, listeners };
}
test('Approved reload saves view first, avoids repeated prompts, prevents double submission and recovers a blocked reload', () => {
  const h = browserHarness(); let state = h.render(true);
  assert.equal(h.prevented(), true);
  state.requestReload(() => h.calls.push('save brand/date/report/page'));
  assert.deepEqual(h.calls, ['save brand/date/report/page', 'reload']); assert.equal(h.prevented(), false);
  state.requestReload(() => h.calls.push('duplicate')); assert.equal(h.calls.length, 2);
  state = h.render(true); assert.equal(state.refreshing, true);
  h.timers.get(1)(); state = h.render(true);
  assert.equal(state.refreshing, false); assert.match(state.refreshError, /Export Current Data/); assert.equal(h.prevented(), true);
  state.requestReload(() => h.calls.push('retry')); assert.equal(h.calls.at(-1), 'reload');
  h.cleanup(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
});
test('Reload or view-save errors clear busy state and restore unsaved data protection', () => {
  for (const saveFails of [false, true]) {
    const h = browserHarness({ throws: !saveFails }); const state = h.render(true);
    state.requestReload(() => { if (saveFails) throw Error('Cannot save'); });
    const result = h.render(true); assert.equal(result.refreshing, false); assert.ok(result.refreshError); assert.equal(h.prevented(), true); assert.equal(h.timers.size, 0);
    assert.equal(h.calls.length, saveFails ? 0 : 1);
  }
});
test('Clean refresh has no unload guard; Home renders failure notices outside Dashboard and no native confirm', () => {
  const h = browserHarness(); h.render(false); assert.equal(h.prevented(), false);
  h.render(true); assert.equal(h.prevented(), true); h.render(false); assert.equal(h.prevented(), false);
  const page = readFileSync('app/page.tsx', 'utf8');
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(page, /refreshOpen && <RefreshDialog/);
  assert.ok(page.indexOf('{refreshError &&') < page.indexOf('hidden={page !== \'dashboard\'}'));
  assert.match(page, /requestReload\(\(\) => saveFragment\(viewFragment\(\{ brand: brandKey, period, report: reportCode \}\) \+ pageFragment\(page\)\)\)/);
});
