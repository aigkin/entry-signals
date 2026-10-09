const test=require('node:test'),assert=require('node:assert/strict'),{analyze}=require('../dist/watch-model.js');
const base={status:'ok',ma50:-8,volume:1.4,drawdown:-20,stabilize:1.3};
test('fresh drawdown recovery is worth inspecting but not called a buy',()=>{const r=analyze(base);assert.equal(r.kind,'watch');assert.match(r.next,/估值/);});
test('cached, stale and incomplete data never become price opportunities',()=>{for(const status of ['cached','stale','missing','review'])assert.equal(analyze({...base,status}).kind,'missing');for(const key of ['ma50','volume','drawdown','stabilize'])assert.equal(analyze({...base,[key]:null}).kind,'missing');});
test('a decline without stabilization stays waiting',()=>assert.equal(analyze({...base,stabilize:-1}).kind,'wait'));
test('fresh fundamental invalidation overrides a favorable price',()=>assert.equal(analyze({...base,researchStatus:'ok',broken:'yes'}).kind,'risk'));
test('expired fundamental record is not presented as current fact',()=>assert.equal(analyze({...base,researchStatus:'expired',broken:'yes'}).kind,'watch'));
test('trend observations need volume and respect extension cap',()=>{assert.equal(analyze({...base,drawdown:-5,ma50:4,volume:1.2}).kind,'watch');assert.equal(analyze({...base,drawdown:-5,ma50:4,volume:1.19}).kind,'wait');assert.equal(analyze({...base,drawdown:-5,ma50:11}).kind,'wait');});
