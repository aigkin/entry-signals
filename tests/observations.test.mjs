import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';import {compareAndStore,summarizeObservations,observationHistory} from '../observations.mjs';
function env(){const db=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync('drizzle/'+f,'utf8'));return{sqlite:db,DB:{prepare(sql){return{bind(...args){return{sql,args}}}},async batch(statements){db.exec('BEGIN');try{const out=statements.map(({sql,args})=>{const s=db.prepare(sql);return sql.startsWith('SELECT')?{results:s.all(...args)}:{meta:s.run(...args)}});db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}}}}
const row={symbol:'NBIS',status:'ok',date:'2026-09-18',close:80,drawdown:-20,stabilize:-1,volume:1.2,ma50:-8};
test('first, newly interesting, no change, then exit persist across calls',async()=>{const e=env();assert.equal((await compareAndStore([row],e,'2026-09-19T01:00:00Z')).items[0].type,'first');const active={...row,stabilize:1};assert.equal((await compareAndStore([active],e,'2026-09-19T02:00:00Z')).items[0].type,'entered');assert.equal((await compareAndStore([active],e,'2026-09-19T03:00:00Z')).items[0].type,'unchanged');assert.equal((await compareAndStore([row],e,'2026-09-19T04:00:00Z')).items[0].type,'exited');});
test('outage and older data do not overwrite valid baseline',async()=>{const e=env();await compareAndStore([row],e,'2026-09-19T01:00:00Z');assert.equal((await compareAndStore([{...row,status:'missing'}],e,'2026-09-19T02:00:00Z')).items[0].type,'unavailable');assert.equal((await compareAndStore([{...row,date:'2026-09-17'}],e,'2026-09-19T03:00:00Z')).items[0].type,'older');assert.equal(e.sqlite.prepare('SELECT count(*) n FROM watch_observations').get().n,1);const next=await compareAndStore([row],e,'2026-09-19T04:00:00Z');assert.equal(next.items[0].previousAt,'2026-09-19T01:00:00Z');});
test('late response cannot overwrite newer observation',async()=>{const e=env();await compareAndStore([row],e,'2026-09-19T02:00:00Z');assert.equal((await compareAndStore([row],e,'2026-09-19T01:00:00Z')).items[0].type,'older');assert.equal(e.sqlite.prepare('SELECT count(*) n FROM watch_observations').get().n,1);});
test('storage error never claims baseline saved',async()=>{assert.equal((await compareAndStore([row],{})).status,'disabled');assert.equal((await compareAndStore([row],{DB:{prepare(){throw Error('offline')}}})).status,'error');});

test('history groups consecutive same-day states without hiding transitions',()=>{
 const r=(stabilize,observedAt,date='2026-09-18')=>({data_json:JSON.stringify({...row,stabilize,observedAt,date})});
 const d=summarizeObservations([r(1,'2026-09-19T04:00:00Z'),r(1,'2026-09-19T03:00:00Z'),r(-1,'2026-09-19T02:00:00Z'),r(1,'2026-09-18T01:00:00Z','2026-09-17')]);
 assert.equal(d.recordCount,4);assert.equal(d.marketDays,2);assert.equal(d.items.length,3);assert.equal(d.items[0].count,2);assert.equal(d.items[0].change.type,'entered');assert.equal(d.items[1].change.type,'exited');assert.equal(d.items[2].change,null);
});
test('history bounds output, ignores corrupt records and reports truncation',()=>{
 const r=Array.from({length:60},(_,i)=>({data_json:JSON.stringify({...row,stabilize:i%2?1:-1,observedAt:new Date(Date.UTC(2026,8,19,0,60-i)).toISOString()})}));
 const d=summarizeObservations(r);assert.equal(d.items.length,12);assert.equal(d.truncated,true);assert.equal(summarizeObservations([{data_json:'broken'}]).recordCount,0);
});
test('history reports unsupported symbol and unavailable storage explicitly',async()=>{
 assert.equal((await observationHistory('UNKNOWN',{})).status,400);
 assert.equal((await (await observationHistory('NBIS',{})).json()).status,'disabled');
});

test('expired or unavailable research cannot erase prior risk baseline',async()=>{
 const e=env(),risk={...row,researchStatus:'ok',broken:'yes'};
 await compareAndStore([risk],e,'2026-09-19T01:00:00Z');
 for(const [i,researchStatus] of ['expired','error','missing','ok'].entries()){
 const result=await compareAndStore([{...row,stabilize:1,researchStatus,broken:'unknown'}],e,`2026-09-19T0${i+2}:00:00Z`);
 assert.equal(result.items[0].type,'unavailable');
 }
 assert.equal(e.sqlite.prepare('SELECT count(*) n FROM watch_observations').get().n,1);
 const confirmed=await compareAndStore([{...row,stabilize:1,researchStatus:'ok',broken:'no'}],e,'2026-09-19T08:00:00Z');
 assert.equal(confirmed.items[0].type,'entered');
 assert.equal(e.sqlite.prepare('SELECT count(*) n FROM watch_observations').get().n,2);
});
test('expired risk remains visible without claiming the old evidence is current',async()=>{
 const r={...row,stabilize:1,researchStatus:'expired',broken:'unknown',researchRiskUnresolved:true};
 const view=globalThis.WatchModel.analyze(r);assert.equal(view.kind,'risk');assert.match(view.state,/待复核/);
 const e=env();await compareAndStore([r],e,'2026-09-19T01:00:00Z');
 const result=await compareAndStore([{...r,researchRiskUnresolved:false,researchStatus:'error'}],e,'2026-09-19T02:00:00Z');assert.equal(result.items[0].type,'unavailable');
 assert.equal(e.sqlite.prepare('SELECT count(*) n FROM watch_observations').get().n,1);
});
