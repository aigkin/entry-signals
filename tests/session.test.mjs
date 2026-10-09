import test from 'node:test';
import assert from 'node:assert/strict';
import {completedSession} from '../prices.mjs';
test('NY session cutoff handles summer and winter without waiting 24h',()=>{
 assert.equal(completedSession('2026-09-14',Date.parse('2026-09-14T20:30:00Z')),false);
 assert.equal(completedSession('2026-09-14',Date.parse('2026-09-14T21:01:00Z')),true);
 assert.equal(completedSession('2026-01-14',Date.parse('2026-01-14T21:30:00Z')),false);
 assert.equal(completedSession('2026-01-14',Date.parse('2026-01-14T22:01:00Z')),true);
 assert.equal(completedSession('2026-09-15',Date.parse('2026-09-14T23:00:00Z')),false);
});
test('reused session boundary changes exactly at close and NY midnight',()=>{
 const before=Date.parse('2026-10-08T20:59:59Z'),close=Date.parse('2026-10-08T21:00:00Z');
 for(let i=0;i<10;i++)assert.equal(completedSession('2026-10-08',before+i*10),false);
 assert.equal(completedSession('2026-10-08',close),true);
 assert.equal(completedSession('2026-10-09',Date.parse('2026-10-09T03:59:59Z')),false);
 assert.equal(completedSession('2026-10-09',Date.parse('2026-10-09T04:00:00Z')),false);
 assert.equal(completedSession('2026-10-08',Date.parse('2026-10-09T04:00:00Z')),true);
 assert.equal(completedSession('2026-10-08',before),false);
});
