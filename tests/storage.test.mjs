import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import {getStoredPrices,recordSnapshot,savedHistory} from '../storage.mjs';
function database(){
 const sqlite=new DatabaseSync(':memory:');
 for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')))sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
 const DB={
  prepare(sql){return {bind(...args){const s=sqlite.prepare(sql);return {async all(){return {results:s.all(...args)}},async first(){return s.get(...args)},async run(){return {meta:s.run(...args)}}};}}},
  async batch(statements){assert.ok(statements.length<=40);return Promise.all(statements.map(s=>s.run()));}
 };
 return {sqlite,DB};
}
const now=Date.parse('2026-09-15T08:00:00Z');
const bars=Array.from({length:65},(_,i)=>({date:new Date(now-(65-i)*86400000).toISOString().slice(0,10),o:100,h:102,l:99,c:101,v:1000}));
const live=async()=>({status:'ok',bars,source:'Stock Analysis 历史行情',retrievedAt:'2026-09-15T07:00:00Z'});
test('real SQLite upsert is idempotent, applies corrections and preserves source retrieval time',async()=>{const env=database();await getStoredPrices('NVDA',env,now,live);await getStoredPrices('NVDA',env,now,live);assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM daily_bars').get().n,65);assert.equal(env.sqlite.prepare('SELECT retrieved_at FROM daily_bars LIMIT 1').get().retrieved_at,'2026-09-15T07:00:00Z');const changed=async()=>({...await live(),bars:bars.map((x,i)=>i===64?{...x,c:102}:x)});const p=await getStoredPrices('NVDA',env,now,changed);assert.equal(p.close,102);assert.equal(p.storageStatus,'ok');});
test('source outage returns durable history without calling it live; stale data remains excluded',async()=>{const env=database();await getStoredPrices('NVDA',env,now,live);const missing=async()=>({status:'missing'});const p=await getStoredPrices('NVDA',env,now,missing);assert.equal(p.status,'cached');assert.equal(p.dataStatus,'cached');assert.equal(p.bars.length,65);assert.equal(p.fetched_at,'2026-09-15T07:00:00Z');const stale=await getStoredPrices('NVDA',env,now+10*86400000,missing);assert.equal(stale.status,'stale');});
test('storage failure preserves live display and reports failure',async()=>{const p=await getStoredPrices('NVDA',{DB:{prepare(){throw Error('unavailable')}}},now,live);assert.equal(p.storageStatus,'error');assert.equal(p.bars.length,65);});
test('invalid OHLC excluded from persistence and metrics are marked review',async()=>{const env=database();const p=await getStoredPrices('NVDA',env,now,async()=>({...await live(),bars:[...bars,{...bars[0],h:50}]}));assert.equal(p.status,'review');assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM daily_bars').get().n,65);});
test('snapshot insert is unique per observed day and preserves original observation',async()=>{const env=database();const p={symbol:'NVDA',ruleVersion:'entry-0.2',observedAt:'2026-09-15T07:00:00Z',inputs:{broken:'unknown'},sources:[{date:'2026-09-14'}],result:{action:'observe'}};await Promise.all([recordSnapshot(env,p),recordSnapshot(env,{...p,observedAt:'2026-09-15T08:00:00Z'})]);assert.equal(env.sqlite.prepare('SELECT COUNT(*) n FROM signal_snapshots').get().n,1);assert.equal(env.sqlite.prepare('SELECT observed_at FROM signal_snapshots').get().observed_at,p.observedAt);});
test('missing historical volume preserves close for moving averages and stays unknown',async()=>{
 const env=database();const data=bars.map((r,i)=>({...r,v:i===64?null:r.v}));
 const p=await getStoredPrices('SPY',env,now,async()=>({status:'ok',bars:data,source:'Nasdaq 历史行情',retrievedAt:new Date(now).toISOString()}));
 assert.equal(p.count,65);assert.equal(p.volume,null);assert.ok(Number.isFinite(p.ma50));
 assert.equal(env.sqlite.prepare('SELECT volume FROM daily_bars ORDER BY date DESC LIMIT 1').get().volume,null);
});
test('sources remain separate and an outage uses the longer durable series',async()=>{
 const env=database();await getStoredPrices('SPY',env,now,live);
 await getStoredPrices('SPY',env,now,async()=>({...await live(),source:'Nasdaq 历史行情'}));
 const p=await getStoredPrices('SPY',env,now,async()=>({status:'missing',source:'Nasdaq 历史行情'}));
 assert.equal(p.count,65);assert.equal(p.source,'Nasdaq 历史行情');assert.equal(p.dataStatus,'cached');
 assert.equal(env.sqlite.prepare('SELECT COUNT(DISTINCT source) n FROM daily_bars').get().n,2);
});

test('concurrent reads share one load and unchanged history sends zero writes',async()=>{
 const env=database();let calls=0,writes=0;const batch=env.DB.batch;env.DB.batch=async items=>{writes+=items.length;return batch(items)};
 const loader=async()=>{calls++;return live()};
 await Promise.all([getStoredPrices('NVDA',env,now,loader),getStoredPrices('NVDA',env,now,loader)]);
 assert.equal(calls,1);assert.equal(writes,65);
 writes=0;await getStoredPrices('NVDA',env,now+61000,loader);assert.equal(calls,2);assert.equal(writes,0);
 const corrected=async()=>({...await live(),bars:bars.map((r,i)=>i===64?{...r,c:102}:r)});
 await getStoredPrices('NVDA',env,now+62000,corrected);assert.equal(writes,1);
});
test('saved history returns while upstream update is blocked and never calls it live',async()=>{
 const env=database();await getStoredPrices('NVDA',env,now,live);
 let release;const blocked=new Promise(r=>release=r);
 const pending=getStoredPrices('NVDA',env,now+61000,async()=>{await blocked;return live()});
 const saved=await savedHistory('NVDA',env,now);assert.equal(saved.bars.length,65);assert.equal(saved.status,'cached');assert.equal(saved.dataStatus,'cached');release();await pending;
 const stale=await savedHistory('NVDA',env,now+10*86400000);assert.equal(stale.status,'stale');
});
test('invalid calendar and unfinished sessions are rejected before persistence',async()=>{
 const env=database();const result=await getStoredPrices('NVDA',env,now,async()=>({...await live(),bars:[...bars,{...bars[0],date:'2026-02-30'},{...bars[0],date:'2026-09-16'}]}));
 assert.equal(result.status,'review');assert.equal(result.quality.rejected,2);assert.equal(env.sqlite.prepare('SELECT count(*) n FROM daily_bars').get().n,65);
});
