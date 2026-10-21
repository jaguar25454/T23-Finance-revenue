import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Component event unit tests; no browser/DOM, network, storage or report writes.
const reportExports={};
const compile=(path)=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
vm.runInNewContext(compile('lib/report-data.ts'),{exports:reportExports,URLSearchParams,require:name=>JSON.parse(readFileSync(name.replace('@/',''),'utf8'))});

function harness(path, exportName, props) {
  const slots=[];let index=0,dirty=false,effects=[];
  const hooks={
    useState(initial){const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{const next=typeof value==='function'?value(slots[i]):value;if(!Object.is(next,slots[i])){slots[i]=next;dirty=true;}}];},
    useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useEffect(callback,deps){const i=index++;if(!slots[i]||deps.some((d,n)=>!Object.is(d,slots[i][n]))){slots[i]=deps;effects.push(callback);}},
  };
  const output={};
  vm.runInNewContext(compile(path),{exports:output,require:name=>{
    if(name==='react')return hooks;
    if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
    if(name==='@/lib/report-data')return reportExports;
    if(name==='date-fns/locale')return {th:{code:'th'}};
    return new Proxy({},{get:(_,key)=>key});
  }});
  let tree;
  function render(){let turns=0;do{dirty=false;index=0;effects=[];tree=output[exportName](props);effects.forEach(effect=>effect());assert.ok(++turns<10,'stable state');}while(dirty);return tree;}
  function all(predicate){const found=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!node||typeof node!=='object')return;if(predicate(node))found.push(node);visit(node.props?.children);}visit(tree);return found;}
  render();
  return{render,all,one:predicate=>{const found=all(predicate);assert.equal(found.length,1);return found[0];}};
}
const civil=iso=>new Date(`${iso}T12:00:00`);
const period={start:'2026-09-01',end:'2026-09-02',mode:'custom'};

test('Import Business Date calendar selects any business day, cancels drafts and keeps text entry',()=>{
  const applied=[],props={value:'2026-09-01',onChange:value=>{applied.push(value);props.value=value;}};
  const h=harness('components/business-date-picker.tsx','BusinessDatePicker',props);
  const open=()=>{h.one(n=>n.type==='Popover').props.onOpenChange(true);h.render();};
  const select=iso=>{h.one(n=>n.type==='Calendar').props.onSelect(civil(iso));h.render();};
  const button=text=>h.one(n=>n.type==='Button'&&n.props.children===text);
  open();select('2027-01-15');assert.equal(applied.length,0);button('Cancel').props.onClick();h.render();assert.equal(props.value,'2026-09-01');
  open();assert.equal(h.one(n=>n.type==='Calendar').props.selected.getDate(),1);
  select('2024-02-29');button('Apply').props.onClick();h.render();assert.equal(props.value,'2024-02-29');
  assert.equal(h.one(n=>n.type==='Calendar').props.mode,'single');
  assert.equal(h.one(n=>n.type==='DateInput').props.label,'Import Business Date');
  h.one(n=>n.type==='DateInput').props.onChange('');h.render();open();assert.equal(button('Apply').props.disabled,true);
  select('2028-12-31');assert.equal(button('Apply').props.disabled,false);button('Apply').props.onClick();assert.equal(props.value,'2028-12-31');
});

test('Range clicks create a draft, order reversed clicks and cancel without applying',()=>{
  const applied=[],props={period,latest:{start:'2026-09-01',end:'2026-09-01',mode:'day'},daysWithData:1,onChange:value=>applied.push(value)};
  const h=harness('components/period-controls.tsx','HeaderDatePicker',props);
  const open=()=>{h.one(n=>n.type==='Popover').props.onOpenChange(true);h.render();};
  const click=iso=>{h.one(n=>n.type==='Calendar').props.onSelect(undefined,civil(iso),{},{});h.render();};
  const input=label=>h.one(n=>n.type==='DateInput'&&n.props.label===label).props.value;
  open();click('2026-09-08');assert.equal(input('วันที่เริ่มต้น'),'2026-09-08');assert.equal(input('วันที่สิ้นสุด'),'2026-09-08');
  click('2026-09-05');assert.equal(input('วันที่เริ่มต้น'),'2026-09-05');assert.equal(input('วันที่สิ้นสุด'),'2026-09-08');
  assert.equal(applied.length,0);
  h.one(n=>n.type==='Button'&&n.props.children==='ยกเลิก').props.onClick();h.render();
  assert.equal(applied.length,0);open();assert.equal(input('วันที่เริ่มต้น'),period.start);assert.equal(input('วันที่สิ้นสุด'),period.end);
});

test('One calendar click on NO DATA applies a one-day period; presets wait for Apply',()=>{
  const applied=[];
  const h=harness('components/period-controls.tsx','HeaderDatePicker',{period,latest:period,daysWithData:1,onChange:value=>applied.push(value)});
  h.one(n=>n.type==='Popover').props.onOpenChange(true);h.render();
  h.one(n=>n.type==='Calendar').props.onSelect(undefined,civil('2026-09-03'),{},{});h.render();
  const apply=()=>h.one(n=>n.type==='Button'&&n.props.children==='เลือก');
  assert.equal(apply().props.disabled,false);apply().props.onClick();h.render();
  assert.equal(applied[0].start,'2026-09-03');assert.equal(applied[0].end,'2026-09-03');
  h.one(n=>n.type==='Popover').props.onOpenChange(true);h.render();
  h.one(n=>n.type==='button'&&n.props.children==='7 วันล่าสุด').props.onClick();h.render();
  assert.equal(applied.length,1);apply().props.onClick();h.render();
  assert.equal(reportExports.periodDays(applied[1]),7);
  assert.equal(applied[1].end,reportExports.bangkokBusinessDate());
});

test('Text dates invalidate Apply immediately, and external period navigation remains available',()=>{
  const applied=[],h=harness('components/period-controls.tsx','HeaderDatePicker',{period,latest:period,daysWithData:1,onChange:value=>applied.push(value)});
  h.one(n=>n.type==='DateInput'&&n.props.label==='วันที่เริ่มต้น').props.onChange('');h.render();
  assert.equal(h.one(n=>n.type==='Button'&&n.props.children==='เลือก').props.disabled,true);
  h.one(n=>n.type==='Button'&&n.props['aria-label']==='ช่วงถัดไป').props.onClick();
  assert.equal(applied[0].start,'2026-09-03');assert.equal(applied[0].end,'2026-09-04');
});

test('Shared date field retains incomplete typing, rejects impossible days and syncs calendar dates',()=>{
  const received=[];const props={value:'2026-09-01',label:'Business Date',onChange:iso=>{props.value=iso;received.push(iso);}};
  const h=harness('components/date-input.tsx','DateInput',props),input=()=>h.one(n=>n.type==='Input');
  assert.equal(input().props.value,'01/09/26');
  for(const text of ['0','03/','03/09/2','31/02/26']){input().props.onChange({target:{value:text}});h.render();assert.equal(input().props.value,text);assert.equal(props.value,'');assert.equal(input().props['aria-invalid'],true);}
  input().props.onChange({target:{value:'03/09/26'}});h.render();assert.equal(props.value,'2026-09-03');assert.equal(input().props['aria-invalid'],false);
  props.value='2027-01-05';h.render();assert.equal(input().props.value,'05/01/27');
  input().props.onChange({target:{value:'01/01/1900'}});h.render();input().props.onBlur();h.render();assert.equal(props.value,'1900-01-01');assert.equal(input().props.value,'01/01/00');
  input().props.onChange({target:{value:'02/01/00'}});h.render();assert.equal(props.value,'1900-01-02');
});
