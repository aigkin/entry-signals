import test from 'node:test';
import assert from 'node:assert/strict';
import {canWriteResearch} from '../access.mjs';
const request=(email='owner@example.com',id='owner-site-id')=>new Request('https://app.test',{headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':email}});
test('unconfigured owner always denies writes, including signed-in visitors',()=>{
 for(const env of [undefined,{}, {RESEARCH_OWNER_EMAIL:''},{RESEARCH_OWNER_EMAIL:'   '},{RESEARCH_OWNER_EMAIL:123}])assert.equal(canWriteResearch(request(),env),false);
});
test('configured owner requires trusted visitor identity and matching email',()=>{
 const env={RESEARCH_OWNER_EMAIL:' Owner@Example.com '};
 assert.equal(canWriteResearch(request(),env),true);
 assert.equal(canWriteResearch(request('friend@example.com'),env),false);
 assert.equal(canWriteResearch(request('owner@example.com',''),env),false);
 assert.equal(canWriteResearch(request('owner@example.com','  '),env),false);
});
