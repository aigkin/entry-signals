import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {readFileSync,readdirSync} from 'node:fs';
import {saveWatchlistCache,savedWatchlist} from '../watch-cache.mjs';
function environment(){
 const sqlite=new DatabaseSync(':memory:');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));
 const DB={prepare(sql){return{bind(...args){return{
  async first(){return sqlite.prepare(sql).get(...args)},
  async run(){return sqlite.prepare(sql).run(...args)}
 };}};}};
 return {sqlite,DB};
}
test('shared snapshot serves a fresh visitor without upstream prices and does not replace valid cache with failure',async()=>{
 const env=environment(),data={rows:[{symbol:'NVDA',status:'ok',close:100,date:'2026-10-08'}],changes:{status:'ok'}};
 await saveWatchlistCache(env,data);await saveWatchlistCache(env,{rows:[{symbol:'NVDA',status:'missing'}]});
 const d=await (await savedWatchlist(env)).json();assert.equal(d.rows[0].close,100);assert.equal(d.cached,true);assert.equal(d.changes,null);
});
test('existing observation records seed the first server cache and missing DB returns a usable empty response',async()=>{
 const env=environment();env.sqlite.prepare('INSERT INTO watch_observations(symbol,rule_version,market_date,observed_at,data_json) VALUES(?,?,?,?,?)').run('NVDA','watch-1','2026-10-08','2026-10-09',JSON.stringify({symbol:'NVDA',close:100,status:'ok',date:'2026-10-08'}));
 const d=await(await savedWatchlist(env)).json();assert.equal(d.rows.find(r=>r.symbol==='NVDA').close,100);
 assert.deepEqual((await(await savedWatchlist({})).json()).rows,[]);
});
