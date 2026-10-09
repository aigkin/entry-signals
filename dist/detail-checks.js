(function(root){
const finite=Number.isFinite;
function inspect(values={},sources=[],symbol='NBIS'){
 if(symbol==='DRAM')return{etf:true,next:'这是ETF，先核实穿透持仓、行业环境与加权估值；单家公司完整买点规则不适用。'};
 const complete=root.EntryCompleteness||(typeof require==='function'?require('./completeness.js'):null);
 const c=complete(values,sources,'auto');
 const paths=Object.values(c.paths).map(p=>({...p,checks:p.checks.concat([{key:'business',label:'经营假设未失效',target:'有有效研究依据',status:values.broken==='no'?'met':values.broken==='yes'?'unmet':'missing',value:null}])}));
 const trend=paths.find(p=>p.name==='trend');
 trend.checks.push({key:'relative20',label:'20日相对 SOXX',target:'≥ 0%',status:finite(values.relative20)?(values.relative20>=0?'met':'unmet'):'missing',value:finite(values.relative20)?values.relative20:null});
 trend.complete=trend.complete&&trend.checks.every(x=>x.status==='met');
 const selected=paths.find(p=>p.complete)?.name||paths.slice().sort((a,b)=>b.checks.filter(x=>x.status==='met').length/b.checks.length-a.checks.filter(x=>x.status==='met').length/a.checks.length)[0].name;
 return{paths,selected,blocked:values.broken==='yes',complete:paths.some(p=>p.complete)};
}
function render(host,values,sources,symbol,onChange){
 const result=inspect(values,sources,symbol),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(result.etf){host.innerHTML='<p>'+esc(result.next)+'</p>';return result.next;}
 let active=result.selected;
 function draw(){const p=result.paths.find(x=>x.name===active),unknown=p.checks.filter(x=>x.status==='missing'),unmet=p.checks.filter(x=>x.status==='unmet');const next=result.blocked?'经营假设已失效，先复核研究依据；价格条件不能解除该拦截。':p.complete?'这条路径的必要条件已满足。继续复核来源日期与近期事件。':unknown.length?'尚缺：'+unknown.map(x=>x.label).join('、')+'。'+(unmet.length?'另有 '+unmet.length+' 项条件未达到。':''):'等待：'+unmet.map(x=>x.label).join('、')+'。';
 host.innerHTML='<div class="review-blockers"><b>'+esc(p.complete?'规则满足 · 待人工复核':'暂无建议买点')+'</b><p>'+esc([...unknown.map(x=>'缺 '+x.label),...unmet.map(x=>x.label+'未达到')].join(' · ')||'核对近期公告与个人风险计划')+'</p></div><div class="path-switch" role="group" aria-label="查看完整路径">'+result.paths.map(x=>`<button data-path="${x.name}" aria-pressed="${x.name===active}">${x.name==='panic'?'回撤企稳路径':'趋势路径'}</button>`).join('')+'</div><p class="path-summary">'+esc(next)+'</p>'+p.checks.map(x=>{const targets={volume:active==='panic'?'≥ 1.00 倍':'≥ 1.20 倍',upside:active==='panic'?'≥ 15%':'≥ 5%',revision:active==='panic'?'≥ −5%':'≥ 0%'};const field={upside:'research-fair-value',revision:'research-revision',business:'research-broken'}[x.key];return `<div class="detail-check"><span class="check-state ${x.status}">${{met:'已满足',unmet:'未达到',missing:'待核实'}[x.status]}</span><div><b>${esc(x.label)}</b><small>${finite(x.value)?'当前 '+x.value.toFixed(2)+(x.key==='volume'?' 倍':x.key==='fear'?' 分位':'%')+' · ':''}需要 ${esc(targets[x.key]||x.target)}</small>${field?`<a href="/workspace.html?symbol=${encodeURIComponent(symbol)}&view=research#${field}">${x.status==='missing'?'补充依据':'复核依据'} ↗</a>`:''}</div></div>`}).join('')+'<p class="meta">逐项核对的是当前试用条件，阈值尚未验证为有效买点。缺少数据表示待核实，不等于条件未达到。</p>';
 host.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>{active=b.dataset.path;const next=draw();if(onChange)onChange(next);});
 return next;}
 return draw();
}
root.DetailChecks={inspect,render};if(typeof module!=='undefined')module.exports={inspect};
})(globalThis);
