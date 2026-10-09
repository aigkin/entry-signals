const test=require('node:test'),assert=require('node:assert/strict');
const cache=require('../dist/watch-cache.js'),{pricePosition}=require('../dist/watch-model.js');
const row={symbol:'NVDA',status:'ok',close:110,ma50:10,date:'2026-10-08'};
test('stored lists expire by market date, ignore foreign symbols and survive blocked storage',()=>{
 const rows=cache.normalize({rows:[row,{...row,symbol:'OTHER'}]},Date.parse('2026-10-09T12:00:00Z'));
 assert.equal(rows.length,7);assert.equal(rows.find(r=>r.symbol==='NVDA').status,'ok');
 assert.equal(cache.normalize({rows:[row]},Date.parse('2026-10-15T12:00:00Z')).find(r=>r.symbol==='NVDA').status,'stale');
 const blocked={getItem(){throw Error()},setItem(){throw Error()}};
 assert.equal(cache.read(blocked),null);assert.equal(cache.saveHoldings(blocked,new Set(['NVDA'])),false);
});
test('holdings belong to browser storage and reject unknown symbols',()=>{
 const storage={value:null,setItem(k,v){this.value=v},getItem(){return this.value}};
 cache.saveHoldings(storage,new Set(['NVDA','OTHER']));assert.deepEqual([...cache.holdings(storage)],['NVDA']);
});
test('price-only labels respect excluded lower bound, included upper bound, proximity and risk',()=>{
 assert.equal(pricePosition(row).state,'到价');
 assert.equal(pricePosition({...row,close:100,ma50:0}).state,'接近');
 assert.equal(pricePosition({...row,close:112,ma50:12}).state,'接近');
 assert.equal(pricePosition({...row,close:120,ma50:20}).state,'观察');
 assert.equal(pricePosition({...row,researchRiskUnresolved:true}).state,'观察');
 assert.equal(pricePosition({...row,status:'stale'}).reference.available,false);
});
test('observe-only survives reopening and is isolated between browser stores',()=>{const map=new Map(),a={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},b={getItem:()=>null};cache.saveObserveOnly(a,new Set(['NVDA','OTHER']));assert.deepEqual([...cache.observeOnly(a)],['NVDA']);assert.deepEqual([...cache.observeOnly(b)],[]);assert.equal(cache.saveObserveOnly({setItem(){throw Error()}},new Set(['NVDA'])),false);});
