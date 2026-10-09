const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../dist/engine.js');
require('../dist/completeness.js');
const {inspect}=require('../dist/detail-checks.js');
test('selects complete low entry independently of missing trend evidence',()=>{const r=inspect({...E.presets.panic,broken:'no',aligned:false,panicAligned:true});assert.equal(r.selected,'panic');assert.equal(r.paths[0].complete,true);assert.equal(r.paths[1].complete,false);});
test('distinguishes unknown evidence from failed conditions',()=>{const r=inspect({volume:0.5});const c=r.paths[0].checks;assert.equal(c.find(x=>x.key==='volume').status,'unmet');assert.equal(c.find(x=>x.key==='upside').status,'missing');assert.equal(c.find(x=>x.key==='business').status,'missing');});
test('broken business blocks otherwise complete conditions',()=>{const r=inspect({...E.presets.panic,broken:'yes'});assert.equal(r.blocked,true);assert.ok(r.paths.every(x=>!x.complete));});
test('ETF bypasses company confirmation checklist',()=>{assert.equal(inspect({},[],'DRAM').etf,true);});
