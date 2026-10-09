import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { researchApi, researchValues, readResearch } from '../research.mjs';

function env(){const sqlite=new DatabaseSync(':memory:');for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sqlite.exec(readFileSync('drizzle/'+f,'utf8'));return{sqlite,RESEARCH_OWNER_EMAIL:'owner@example.com',DB:{prepare(sql){return{bind(...a){const s=sqlite.prepare(sql);return{async first(){return s.get(...a)},async run(){return{meta:s.run(...a)}},async all(){return{results:s.all(...a)}}}}}}}}}
const base={fairValue:200,revision:4,fiscalYear:'2027',broken:'no',rationale:'财报与管理层指引支持该假设。',sourceUrl:'https://example.com/evidence',asOf:'2026-09-14',expiresOn:'2026-10-14'};
test('public research writes are denied for anonymous and other signed-in users before touching DB',async()=>{
 for(const headers of [{'content-type':'application/json'},{'content-type':'application/json','oai-authenticated-user-id':'visitor','oai-authenticated-user-email':'friend@example.com'},{'content-type':'application/json','oai-authenticated-user-email':'owner@example.com'}]){
  const r=await researchApi(new Request('https://app.test/api/research?symbol=NVDA',{method:'POST',headers,body:JSON.stringify(base)}),{RESEARCH_OWNER_EMAIL:'owner@example.com',DB:{prepare(){throw Error('must not reach DB')}}});assert.equal(r.status,403);
 }
});
const request=(method='POST',body=base,headers={'content-type':'application/json','oai-authenticated-user-id':'owner-site-id','oai-authenticated-user-email':'owner@example.com'})=>new Request('https://app.test/api/research?symbol=NVDA',{method,headers,body:method==='POST'?JSON.stringify(body):undefined});
test('research record GET/POST is durable and upserted',async()=>{const e=env();let r=await researchApi(request(),e);assert.equal(r.status,200);assert.equal((await r.json()).status,'saved');r=await researchApi(request('GET',null,{}),e);const d=await r.json();assert.equal(d.record.fairValue,200);assert.equal(await readResearch(e,'NVDA').then(x=>x.broken),'no');});
test('validates origin, dates, and required evidence',async()=>{const e=env();let r=await researchApi(request('POST',{...base,sourceUrl:'http://bad'}),e);assert.equal(r.status,400);r=await researchApi(request('POST',base,{'content-type':'application/json',origin:'https://evil.test'}),e);assert.equal(r.status,403);});
test('expired record contributes unknown fundamentals',()=>{const v=researchValues({...base,expiresOn:'2026-09-15'},100,Date.parse('2026-09-16T00:00:00Z'));assert.deepEqual(v,{upside:null,revision:null,broken:'unknown'});const fresh=researchValues(base,100,Date.parse('2026-09-15T00:00:00Z'));assert.equal(fresh.upside,100);assert.equal(fresh.revision,4);});
