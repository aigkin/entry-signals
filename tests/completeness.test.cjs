const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/engine.js');
const complete=require('../dist/completeness.js');

test('完整低吸路径与趋势缺失彼此独立',()=>{
  const d={...E.presets.panic,broken:'no',panicAligned:true,aligned:false};
  const c=complete(d,[],'auto');
  assert.equal(c.paths.panic.complete,true);
  assert.equal(c.paths.trend.complete,false);
  assert.equal(c.currentPhase,'complete');
  assert.match(c.independence,/独立/);
});
test('未知输入标为缺失，不当作满足',()=>{
  const c=complete({broken:'unknown'},[],'auto');
  assert.equal(c.currentPhase,'missing');
  assert.ok(c.paths.panic.missing.includes('VIX 分位'));
  assert.equal(c.paths.panic.complete,false);
});
test('基本面否决优先于其他条件',()=>{
  const c=complete({...E.presets.panic,broken:'yes'},[],'auto');
  assert.equal(c.currentPhase,'blocked');
  assert.ok(c.paths.panic.blockers.length);
});
test('两条路径日期门控独立',()=>{
  const c=complete({...E.presets.panic,broken:'no',panicAligned:true,aligned:false},[],'auto');
  assert.equal(c.paths.panic.blockers.length,0);
  assert.ok(c.paths.trend.blockers.some(x=>x.includes('日期')));
});
test('手动模式只显示试算状态，不生成真实完整度',()=>{
  const c=complete({...E.presets.trend,broken:'no'},[],'manual');
  assert.equal(c.currentPhase,'manual');
  assert.equal(c.isScenario,true);
  assert.equal(c.actionAllowed,false);
});
test('MA200不足时显示实际根数',()=>{
  const c=complete({broken:'unknown'},[{symbol:'SPY',count:80,requiredHistory:200}],'auto');
  assert.match(c.paths.trend.missing.join(' '),/80 \/ 需要 200/);
});
test('越界数值不能通过完整路径',()=>{
 for(const fear of [101,Infinity,'90'])assert.equal(complete({...E.presets.panic,fear}).paths.panic.complete,false);
 assert.equal(complete({...E.presets.panic,volume:100}).paths.panic.complete,false);
});
test('基本面未知必须列为缺项，已失效不列为未知',()=>{
 assert.ok(complete({...E.presets.panic,broken:'unknown'}).paths.panic.missing.some(x=>x.includes('基本面')));
 assert.ok(!complete({...E.presets.panic,broken:'yes'}).paths.panic.missing.some(x=>x.includes('基本面')));
});
test('50日技术候选和200日完整规则分别展示',()=>{
 const d={...E.presets.trend,market50:6,market:undefined,broken:'unknown'};
 const c=complete(d);
 assert.equal(c.currentPhase,'technical_candidate_pending');
 assert.equal(c.paths.trend.complete,false);
 assert.ok(c.paths.trend.missing.includes('SPY MA200'));
});
test('完整度结论与引擎边界保持一致',()=>{
 for(const key of E.definitions.map(x=>x[0]))for(const value of [null,NaN,-1001,0,5,20,1001]){
 const d={...E.presets.panic,[key]:value};const c=complete(d);const r=E.evaluate(d);
 for(const path of ['panic','trend'])assert.equal(c.paths[path].complete,r[path].every(x=>x.status==='yes')&&d.broken==='no');
 }
});
