const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../dist/engine.js');require('../dist/completeness.js');require('../dist/detail-checks.js');
const {suggestion}=require('../dist/watch-model.js');
const row=(entryValues)=>({symbol:'NVDA',close:105,status:'ok',entryValues,entrySources:[]});
test('SMA band alone never becomes a system buy suggestion',()=>assert.equal(suggestion({...row(),ma50:5}).available,false));
test('relative SOXX missing or lagging blocks trend; same evidence supports above benchmark',()=>{
 const values={...E.presets.trend,aligned:true,panicAligned:false};
 assert.equal(suggestion(row(values)).available,false);
 assert.equal(suggestion(row({...values,relative20:-1})).available,false);
 const r=suggestion(row({...values,relative20:0}));assert.equal(r.available,true);assert.equal(r.path,'trend');assert.equal(r.range.lower,100);assert.ok(Math.abs(r.range.upper-110)<1e-8);
});
test('trend suggestion caps zone at the valuation constraint',()=>{
 const r=suggestion(row({...E.presets.trend,stock:5,upside:5,relative20:1,aligned:true}));assert.equal(r.available,true);assert.equal(r.range.upper,105);
});
test('complete panic path survives missing breadth and relative SOXX',()=>{
 const r=suggestion(row({...E.presets.panic,panicAligned:true,aligned:false}));assert.equal(r.available,true);assert.equal(r.path,'panic');assert.ok(r.range.lower<105&&r.range.upper>=105);
});
test('cache, stale price, unresolved risks and ETF cannot emit a buy zone',()=>{
 const r=row({...E.presets.trend,relative20:1,aligned:true});
 assert.equal(suggestion(r,{cached:true}).available,false);
 for(const patch of [{status:'stale'},{status:'cached'},{quality:{blocking:true}},{researchRiskUnresolved:true},{symbol:'DRAM'}])assert.equal(suggestion({...r,...patch}).available,false);
});
test('missing breadth or business denies trend despite strong price',()=>{
 for(const patch of [{breadth:null},{broken:'unknown'},{broken:'yes'}])assert.equal(suggestion(row({...E.presets.trend,relative20:1,aligned:true,...patch})).available,false);
});
