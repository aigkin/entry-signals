// Sites supplies trusted identity headers; anonymous public visitors are read-only.
export function canWriteResearch(request,env={}){
 const owner=typeof env?.RESEARCH_OWNER_EMAIL==='string'?env.RESEARCH_OWNER_EMAIL.trim().toLowerCase():'';
 if(!owner)return false;
 return !!request.headers.get('oai-authenticated-user-id')?.trim()&&request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase()===owner;
}
