const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../dist/engine.js');
const layers=require('../dist/layers.js');
test('low-buy and trend retain distinct confirmation boundaries',()=>{
 for(const [upside,revision,panic,trend] of [[14.99,0,'unmet','supported'],[15,-5,'supported','unmet'],[15,-5.01,'unmet','unmet'],[5,0,'unmet','supported'],[4.99,0,'unmet','unmet']]){
  const d={broken:'no',upside,revision};
  assert.equal(engine.confirmation(d,'panic').status,panic);
  assert.equal(engine.confirmation(d,'trend').status,trend);
  assert.deepEqual(layers(d).confirmations,{panic:engine.confirmation(d,'panic'),trend:engine.confirmation(d,'trend')});
 }
});
test('missing invalid and unverified data cannot confirm entry',()=>{
 for(const value of [null,undefined,NaN,Infinity,'20',1001])assert.equal(engine.confirmation({broken:'no',upside:value,revision:0},'panic').status,'unknown');
 assert.equal(engine.confirmation({upside:20,revision:0,broken:'unknown'},'panic').status,'unknown');
});
test('business failure overrides favorable technical and valuation inputs',()=>{
 const d={...engine.presets.panic,broken:'yes'};
 assert.equal(engine.evaluate(d).action.key,'blocked');
 assert.equal(layers(d).confirmation,'基本面已失效');
 for(const path of ['panic','trend'])assert.equal(engine.confirmation(d,path).status,'blocked');
});
test('full path and layered confirmation agree across boundary combinations',()=>{
 for(const upside of [null,4.99,5,14.99,15,20])for(const revision of [null,-5.01,-5,0,5]){
  const p={...engine.presets.panic,upside,revision};
  assert.equal(engine.evaluate(p).panicComplete,engine.confirmation(p,'panic').status==='supported');
  const t={...engine.presets.trend,upside,revision};
  assert.equal(engine.evaluate(t).trendComplete,engine.confirmation(t,'trend').status==='supported');
 }
});
test('a drawdown is not described as a valuation reset',()=>{
 assert.equal(engine.evaluate(engine.presets.panic).panic[1].label,'价格回撤达到阈值');
});
