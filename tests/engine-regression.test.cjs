const test=require('node:test'); const assert=require('node:assert/strict'); const E=require('../dist/engine.js');
const base={...E.presets.panic,broken:'no',panicAligned:true,aligned:false};
test('panic can complete when trend dates are unavailable',()=>{const r=E.evaluate(base);assert.equal(r.panicComplete,true);assert.equal(r.trendComplete,false);assert.equal(r.action.key,'review');});
test('trend is independently gated by aligned',()=>{const d={...E.presets.trend,broken:'no',aligned:false,panicAligned:false};const r=E.evaluate(d);assert.equal(r.trendComplete,false);assert.equal(r.panicComplete,false);});
test('dual path requires human review without position sizing',()=>{const d={...E.presets.panic,broken:'no',aligned:true,panicAligned:true,revision:5};d.market=6;d.sector=4;d.breadth=72;d.stock=5;const r=E.evaluate(d);assert.equal(r.panicComplete,true);assert.equal(r.trendComplete,true);assert.equal(r.action.key,'review');assert.equal(r.action.size,'不计算仓位');});
