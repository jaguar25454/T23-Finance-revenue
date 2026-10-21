import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url), exports = {};
const source = readFileSync('components/sales-category-rows.tsx', 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
vm.runInNewContext(outputText, { exports, require });
const formatValue = value => value === null ? 'NO DATA' : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
const render = (items, guest = { guests: 41, totalPerPerson: 2629.45 }) => renderToStaticMarkup(createElement(exports.SalesCategoryRows, { items, guest, colors: ['red', 'blue', 'gray', 'gold'], formatValue }));

test('Guests and Total / Person render immediately after Alcohol without altering categories', () => {
  const items = ['Food', 'Beverage - Non-Alcohol', 'Beverage - Alcohol', 'Other', 'ยังไม่จัดหมวด'].map((name, index) => ({ name, value: index * 100 }));
  const before = JSON.stringify(items), html = render(items);
  const ordered = ['>Food<', '>Beverage - Non-Alcohol<', '>Beverage - Alcohol<', '>Guests<', '>Total / Person<', '>Other<', '>ยังไม่จัดหมวด<'];
  for (let i = 1; i < ordered.length; i++) assert.ok(html.indexOf(ordered[i]) > html.indexOf(ordered[i - 1]), ordered[i]);
  assert.match(html, />41</); assert.match(html, />2,629\.45</);
  assert.equal(html.match(/aria-label="S117 guest metrics"/g).length, 1);
  assert.equal(JSON.stringify(items), before);
});

test('Other restaurant grouping remains intact and NO DATA is distinct from zero', () => {
  const html = render(['Food', 'Beverage', 'Other'].map(name => ({ name, value: 1 })));
  assert.ok(html.indexOf('>Guests<') > html.indexOf('>Other<'));
  assert.doesNotMatch(html, />Beverage - Alcohol</);
  for (const items of [null, []]) {
    const empty = render(items, { guests: null, totalPerPerson: null });
    assert.equal(empty.match(/>NO DATA</g).length, 3);
    assert.equal(empty.match(/>Guests</g).length, 1);
    assert.equal(empty.match(/>Total \/ Person</g).length, 1);
  }
  const zero = render([], { guests: 0, totalPerPerson: null });
  assert.match(zero, />0</); assert.equal(zero.match(/>NO DATA</g).length, 2);
});

test('Guest rows reuse the small color-marker format without a shaded or bordered box', () => {
  const html = render([]);
  assert.match(html, /aria-label="S117 guest metrics" class="space-y-3"/);
  assert.match(html, /aria-hidden="true" class="size-2\.5 shrink-0 rounded-sm bg-\[#2a9d8f\]"[^>]*><\/span><span>Guests<\/span>/);
  assert.match(html, /aria-hidden="true" class="size-2\.5 shrink-0 rounded-sm bg-\[#517ca4\]"[^>]*><\/span><span>Total \/ Person<\/span>/);
  assert.doesNotMatch(html, /border-y|bg-stone-50/);
});

test('Unmapped amount and marker remain purple even when its category position changes', () => {
  const unmapped = { name: 'ยังไม่จัดหมวด', value: 4480 };
  for (const items of [[unmapped], [{ name: 'Food', value: 100 }, unmapped], [unmapped, { name: 'Beverage - Alcohol', value: 20 }]]) {
    const before = JSON.stringify(items), html = render(items);
    assert.match(html, /background-color:#b75b93/);
    assert.match(html, /<strong class="tabular-nums text-\[#934371\]">4,480<\/strong>/);
    assert.equal(html.match(/>ยังไม่จัดหมวด</g).length, 1);
    assert.equal(JSON.stringify(items), before);
  }
  assert.doesNotMatch(render([{ name: 'Food', value: 100 }]), />ยังไม่จัดหมวด</);
  const page = readFileSync('app/page.tsx', 'utf8');
  assert.match(page, /fill=\{item.name === 'ยังไม่จัดหมวด' \? unmappedColor : categoryColors\[items.indexOf\(item\)\]\}/);
});

test('Sales cards wire guest scopes separately from revenue and pie data', () => {
  const page = readFileSync('app/page.tsx', 'utf8');
  const tree = ts.createSourceFile('page.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const funcs = tree.statements.filter(ts.isFunctionDeclaration);
  const category = funcs.find(f => f.name?.text === 'CategoryPanel').getText(tree);
  assert.match(category, /const total = items\?\.reduce\(\(sum, item\) => sum \+ item.value, 0\)/);
  assert.match(category, /data=\{items.filter\(\(item\) => item.value > 0\)\}/);
  assert.match(category, /<SalesCategoryRows items=\{items\} guest=\{guest\}/);
  assert.match(page, /<CategoryPanel date=\{date\} items=\{categories\} guest=\{guest\}/);
  assert.match(page, /salesGuestsForPeriod\(brandKey, monthlyPeriod, dataset\), \[brandKey, monthlyPeriod, dataset\]/);
  assert.match(page, /salesGuestsForPeriod\(brandKey, period, dataset\), \[brandKey, period, dataset\]/);
  const cards = [];
  function visit(n) { if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(tree) === 'SalesCard') cards.push(n.getText(tree)); ts.forEachChild(n, visit); }
  visit(tree);
  assert.equal(cards.length, 2);
  assert.match(cards.find(n => n.includes('tone="monthly"')), /guest=\{activeMonthlySalesGuests\}/);
  assert.match(cards.find(n => n.includes('tone="daily"')), /guest=\{activeSelectedSalesGuests\}/);
  assert.match(page, /<GuestMonthly/); assert.match(page, /money\(data.guest.totalPerPerson\)/);
});
