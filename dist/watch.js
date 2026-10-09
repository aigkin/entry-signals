(() => {
'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={MRVL:'Marvell',DRAM:'DRAM ETF',NBIS:'Nebius Group',NVDA:'NVIDIA',ASX:'ASE Technology',INTC:'Intel',AAOI:'Applied Optoelectronics'},symbols=Object.keys(names),finite=Number.isFinite;
let activeFilter='all',cachedDisplay=false;
let browserStorage;try{browserStorage=window.localStorage;}catch{}
const holdings=WatchCache.holdings(browserStorage);
const initialCache=WatchCache.read(browserStorage);
let refreshError=false,retaining=false,changes=null,mode='live',rows=[],listSequence=0,detailSequence=0,loading=false,selected=null,listController,detailController;
const samples=[{symbol:'NBIS',close:80,ma50:-8,volume:1.4,drawdown:-20,stabilize:1.3},{symbol:'MRVL',close:72,ma50:4,volume:1.5,drawdown:-6,stabilize:.3},{symbol:'NVDA',close:150,ma50:14,volume:1.3,drawdown:-3,stabilize:.8},{symbol:'INTC',close:24,ma50:-12,volume:.8,drawdown:-23,stabilize:-2},{symbol:'ASX',close:10,ma50:3,volume:.7,drawdown:-5,stabilize:.1},{symbol:'AAOI',close:20,ma50:-3,volume:.9,drawdown:-12,stabilize:-1},{symbol:'DRAM',status:'missing'}].map(r=>({status:'ok',researchStatus:'missing',...r}));
function hideDetail(){detailSequence++;detailController?.abort();selected=null;$('detail').close();$('detail').hidden=true;document.body.classList.remove('report-open');}
function drawChart(bars,label,status='sample'){ClueChart.render(bars,label,status);}
function renderChanges(){
$('changes-time').textContent='';$('changes-items').innerHTML='';
if(loading){$('changes-summary').textContent='正在比较上次有效观察…';return;}
if(mode==='sample'){$('changes-summary').textContent='示例不保存观察记录，也不与真实行情比较。';return;}
if(changes?.status!=='ok'){$('changes-summary').textContent='观察记录暂时无法保存或读取，本次不报告状态变化。当前行情仍可查看。';return;}
const items=changes.items||[],changed=items.filter(x=>['entered','exited','risk','changed'].includes(x.type)),first=items.filter(x=>x.type==='first'),same=items.filter(x=>x.type==='unchanged'),unknown=items.filter(x=>['unavailable','older'].includes(x.type));
$('changes-summary').textContent=changed.length?`${changed.length} 个标的的观察状态有变化。`:same.length?'可比较标的的观察状态未变。':first.length?'首次有效观察，已建立比较基线。':'本次没有可比较的有效记录。';
$('changes-time').textContent=changes.observedAt?'本次记录 '+new Date(changes.observedAt).toLocaleString('zh-CN'):'';
const rowHTML=x=>`<div class="change-item"><button data-change-symbol="${esc(x.symbol)}">${esc(x.symbol)}</button><div><strong>${esc(x.label)}</strong><p>${esc(x.message)}${x.previousAt?' 上次观察：'+esc(new Date(x.previousAt).toLocaleString('zh-CN'))+'，行情日 '+esc(x.previousDate)+'。':''}${Number.isFinite(x.priceChange)?' 收盘价较上次记录 '+(x.priceChange>=0?'+':'')+x.priceChange.toFixed(2)+'%。':''}</p></div></div>`;
$('changes-items').innerHTML=changed.map(rowHTML).join('')+(first.length||unknown.length||same.length?'<details><summary>查看其余记录（'+first.length+' 个首次记录 · '+same.length+' 个未变 · '+unknown.length+' 个暂不可比）</summary>'+first.concat(unknown,same).map(rowHTML).join('')+'</details>':'');
$('changes-items').querySelectorAll('[data-change-symbol]').forEach(b=>b.onclick=()=>openDetail(b.dataset.changeSymbol));
}
function referencePrice(r){
 const p=WatchModel.priceReference(r);
 if(!p.available)return '<div class="entry-reference"><span>加仓观察区间 · 规则参考</span><strong>—</strong><p>依据待更新</p></div>';
 const distance=p.position==='inside'?'距目标 0% · 区间内':p.position==='above'?'距上沿需回落 '+Math.abs(p.distancePercent).toFixed(1)+'%':'距下沿需上涨 '+Math.abs(p.distancePercent).toFixed(1)+'%';
 return `<div class="entry-reference"><span>加仓观察区间 · 规则参考</span><strong>$${p.lower.toFixed(2)} – $${p.upper.toFixed(2)}</strong><p>${esc(distance)}</p></div>`;
}
function recentSignal(r){const t=r.technicalReview;if(!t)return '';const e=t.latest;return `<div class="recent-signal"><span>最近一次技术候选 · 历史回算</span><strong>${e?esc(e.date)+' · '+esc(e.name):'已取得历史中暂无候选'}</strong><p>${e?esc(e.age+' 个交易日前 · '+({met:'这类条件当前仍满足',unmet:'这类条件当前不再满足',unknown:'当前数据不足，无法确认'}[e.current])):'历史范围 '+esc(t.start||'未知')+' 至 '+esc(t.date||'未知')}</p>${e?.blockers?.length?'<p>当前缺项：'+e.blockers.map(c=>esc(c.label+' '+(c.status==='unknown'?'待核实':finite(c.value)?c.value.toFixed(2)+(c.label==='当日量比'?' 倍':'%'):'未知')+'（需 '+c.target+'）')).join('；')+'</p>':''}</div>`;}
function renderTechnical(t){const host=$('technical-review');if(!t){host.innerHTML='<p class="meta">技术复核暂不可用；没有用旧结果补齐。</p>';return;}
const n=(v,suffix='')=>finite(v)?v.toFixed(2)+suffix:'待数据';
host.innerHTML='<div class="list-heading"><h3>技术候选复核</h3><span class="meta">'+esc(t.date||'日期未知')+'</span></div><p class="meta">原规则采用 SMA50（简单均线），不是 EMA50。下面指标提供补充证据，不自动改变候选条件。</p>'+'<h3>当前技术条件：逐项核对</h3>'+[['趋势路径',t.checks],['回撤企稳路径',t.dipChecks]].map(([label,checks])=>'<details '+(label==='趋势路径'?'open':'')+'><summary>'+label+'</summary><div class="technical-checks">'+(checks||[]).map(c=>'<div><span>'+esc(c.label)+'</span><b>'+esc(n(c.value,c.label==='当日量比'?' 倍':'%'))+'</b><span>'+esc(c.target)+'</span><strong class="check-'+c.status+'">'+({yes:'满足',no:'未满足',unknown:'待数据'}[c.status])+'</strong></div>').join('')+'</div></details>').join('')+'<h3>最近的技术候选</h3><p class="meta">'+esc(t.scope)+' 候选条件不再满足并不等于卖出信号。</p>'+(t.events?.length?'<div class="signal-history">'+t.events.slice().reverse().map(e=>'<div><time>'+esc(e.date)+'</time><span>'+esc(e.name)+'</span><span>当日收盘 $'+n(e.close)+'</span></div>').join('')+'</div>':'<p>本次可验证历史中暂无技术候选。</p>')+'<p class="meta">指标方法：<a href="https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/ema" target="_blank" rel="noopener">Fidelity · EMA</a> · <a href="https://www.schwab.com/learn/story/average-true-range-indicator-and-volatility" target="_blank" rel="noopener">Schwab · ATR</a>。价格与指标使用同一份未复权日线，异常跳变时暂停；仅辅助观察，不替代公司研究。</p>';
}
function renderList(){
 renderChanges();
 const analyzed=rows.map(r=>({...r,view:WatchModel.analyze(r),position:WatchModel.pricePosition(r)})).sort((a,b)=>({at:0,near:1,observe:2}[a.position.kind]-{at:0,near:1,observe:2}[b.position.kind]));
 const at=analyzed.filter(r=>r.position.kind==='at'),near=analyzed.filter(r=>r.position.kind==='near'),observe=analyzed.filter(r=>r.position.kind==='observe');
 $('brief-label').textContent=cachedDisplay?'上次保存 · '+(loading?'后台更新中':refreshError?'更新失败':'待更新'):loading?'关注列表 · 后台更新中':'本次观察';
 $('count-watch').textContent=at.length;$('count-wait').textContent=near.length;$('count-missing').textContent=observe.length;
 $('brief-title').textContent=at.length?'到价 '+at.map(r=>r.symbol).join('、'):near.length?'接近 '+near.map(r=>r.symbol).join('、'):'继续观察';
 $('brief-copy').textContent=cachedDisplay?'上次价格位置，刷新完成后再复核。':'到价仅表示价格位置，量能与风险见详情。';
 const groups={all:analyzed,held:analyzed.filter(r=>holdings.has(r.symbol)),at,near,observe};
 const labels={all:'全部',held:'持仓',at:'到价',near:'接近',observe:'观察'};
 $('watch-filters').innerHTML=Object.keys(groups).map(k=>`<button data-filter="${k}" aria-pressed="${activeFilter===k}">${labels[k]} <span>${groups[k].length}</span></button>`).join('');
 const visible=groups[activeFilter]||analyzed;
 $('filter-status').textContent=activeFilter==='held'&&!visible.length?'点卡片「标为持仓」添加 · 仅存本浏览器':`显示 ${visible.length} / ${analyzed.length} 个标的`;
 $('cards').classList.toggle('filtered',activeFilter!=='all');
 $('cards').innerHTML=visible.map(r=>`<article class="stock-card ${r.view.kind}"><div class="stock-head"><div><h3>${esc(r.symbol)}</h3><span class="company">${esc(names[r.symbol])}</span></div><div class="quote">${finite(r.close)?'$'+r.close.toFixed(2):'—'}<small>${r.date?esc(r.date):'待更新'}${cachedDisplay&&finite(r.close)?' · 缓存':''}${r.status==='stale'?' · 已过期':''}</small></div></div>${referencePrice(r)}<div class="card-state"><span class="price-state ${r.position.kind}">${esc(r.position.state)}</span><span>${esc(r.position.note)}</span></div><div class="card-actions"><button data-symbol="${esc(r.symbol)}">查看详情</button><button data-held="${esc(r.symbol)}" aria-pressed="${holdings.has(r.symbol)}">${holdings.has(r.symbol)?'已持仓 ✓':'标为持仓'}</button></div></article>`).join('');
 $('cards').querySelectorAll('[data-symbol]').forEach(b=>b.onclick=()=>openDetail(b.dataset.symbol));
 $('cards').querySelectorAll('[data-held]').forEach(b=>b.onclick=()=>{const symbol=b.dataset.held;if(holdings.has(symbol))holdings.delete(symbol);else holdings.add(symbol);const saved=WatchCache.saveHoldings(browserStorage,holdings);renderList();if(!saved)$('filter-status').textContent='浏览器无法保存，持仓标记仅在本页有效';$('cards').querySelector(`[data-held="${symbol}"]`)?.focus();});
 $('refresh').disabled=loading;$('refresh').textContent=loading?'更新中…':'刷新观察';
}
async function fetchJSON(path,signal){const r=await fetch(path,{cache:'no-store',signal});if(!r.ok)throw Error('请求失败');return r.json();}
async function load(){
 detailMarketCache.clear();const seq=++listSequence;listController?.abort();listController=new AbortController();
 const previousSymbol=selected;retaining=rows.some(r=>finite(r.close));cachedDisplay=retaining;refreshError=false;changes=null;mode='live';loading=true;
 if(!rows.length)rows=symbols.map(symbol=>({symbol,status:'loading'}));
 if(previousSymbol){detailSequence++;detailController?.abort();$('detail-next').textContent='后台更新中，暂保留上次依据。';}
 $('updated').textContent=retaining?'上次保存 · 后台更新中':'已显示关注列表 · 后台更新中';renderList();
 // A fresh visitor can also use the shared server snapshot, independently of live providers.
 const savedTask=fetchJSON('/api/watchlist?saved=1',AbortSignal.any([listController.signal,AbortSignal.timeout(5000)])).then(d=>{
  if(seq!==listSequence||!loading||rows.some(r=>finite(r.close)))return;
  const saved=WatchCache.normalize(d);if(!saved.some(r=>finite(r.close)))return;
  rows=saved;cachedDisplay=true;retaining=true;renderList();$('updated').textContent='上次保存 · 后台更新中';
 }).catch(()=>{});
 try{
  const d=await fetchJSON('/api/watchlist',AbortSignal.any([listController.signal,AbortSignal.timeout(20000)]));if(seq!==listSequence)return;
  const fresh=symbols.map(symbol=>(d.rows||[]).find(r=>r.symbol===symbol)||{symbol,status:'missing'});
  if(!fresh.some(r=>r.status==='ok')&&rows.some(r=>finite(r.close)))throw Error('更新未取得有效行情');
  changes=d.changes;rows=fresh;cachedDisplay=false;WatchCache.save(browserStorage,d);
  $('updated').textContent='更新于 '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})+' · 已完成日线';
 }catch{
  await savedTask;if(seq!==listSequence)return;refreshError=true;cachedDisplay=rows.some(r=>finite(r.close));
  $('updated').textContent=cachedDisplay?'更新失败 · 保留上次价格':'更新失败 · 点击刷新重试';
  if(previousSymbol)$('detail-next').textContent='更新失败，保留上次依据。';
 }finally{if(seq===listSequence){loading=false;retaining=false;renderList();if(previousSymbol&&!refreshError)openDetail(previousSymbol,false);}}
}
function sample(){activeFilter='all';retaining=false;refreshError=false;listSequence++;listController?.abort();hideDetail();mode='sample';loading=false;rows=samples.map(r=>({...r}));$('updated').textContent='示例数据 · 不代表最新行情';renderList();}
const officialSources={MRVL:['Marvell 财报与业绩','https://investor.marvell.com/financial-information/financial-results'],NBIS:['Nebius 财务报告','https://nebius.com/financials'],NVDA:['NVIDIA 投资者关系','https://investor.nvidia.com/home/'],INTC:['Intel 财务业绩','https://www.intc.com/financial-info/financial-results'],ASX:['ASE 财务与投资者关系','https://ase.aseglobal.com/about-ase/financials/'],AAOI:['AAOI 业绩与投资者活动','https://investors.ao-inc.com/news-events/events-and-presentations'],DRAM:['DRAM 基金公告与持仓','https://www.roundhillinvestments.com/etf/dram/']};
function renderQuality(q,source){
const host=$('data-quality');if(!q){host.innerHTML='<h3>行情质量核查</h3><p>质量检查结果尚未取得，不能视作已通过。</p>';return;}
host.innerHTML='<h3>行情质量核查</h3><p>'+esc(source||'来源待核实')+' · '+esc(q.latestDate||'无行情日期')+' · '+q.count+' 根日线</p>'+(q.reasons.length?'<ul>'+q.reasons.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul>':'<p>本次基础检查未发现跳价、长间隔或近期成交量缺失；不代表已核实全部公司行动。</p>')+'<p class="meta">'+esc(q.adjustment)+'。'+esc(q.scope)+'</p>';
}
function renderEvents(symbol){const source=officialSources[symbol];$('official-events').innerHTML='<h3>财报与公告核查</h3><p>事件状态：尚未自动读取。请核对近期业绩、指引变化及拆股公告，不能据此认定没有重大事件。</p>'+(source?'<a target="_blank" rel="noopener noreferrer" href="'+source[1]+'">'+esc(source[0])+' ↗</a>':'')+'<p class="meta">官方入口核对于 2026-10-07；公告内容与下次财报日期需以来源最新披露为准。</p>';}
function renderSources(sources){$('sources').innerHTML=sources.map(s=>`<div class="source-row"><b>${esc(s.label)}</b> · ${esc(s.date||'日期未知')}<p>${esc(s.message)}</p>${/^https:\/\//.test(s.url||'')?`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.source||'查看来源')} ↗</a>`:''}</div>`).join('')+'<p class="meta">首页仅筛选单个标的的价格线索，未把它当作完整买入结论。完整趋势路径的行业广度尚未接入；ETF不套用单家公司估值。价格为未复权日线，大幅跳变需另行核实。</p>';}
function evidence(values={},researchStatus='missing'){const r=EntryEngine.evaluate(values),isETF=selected==='DRAM';const env=values.aligned===true&&finite(values.market50)&&finite(values.sector)?values.market50>0&&values.sector>0?'市场和行业同时站上近50日均价':'市场和行业尚未同时转强':'市场与行业日期或数据待补';const business=values.broken==='yes'?'经营假设已失效':values.broken==='no'?'已保存研究：未发现失效证据':researchStatus==='expired'?'研究已过期，需重新核实':'尚无有效经营核查，保持未知';const full=values.broken==='yes'?'基本面拦截':isETF?'ETF需另行核实穿透持仓与估值':values.broken==='no'&&(r.panicComplete||r.trendComplete)?'至少一条完整路径满足，仍需复核来源与事件':'完整路径尚未确认；不影响先观察价格线索';$('evidence').innerHTML=[['市场环境',env],['经营核查',business],['完整判断',full]].map(([k,v])=>`<div class="evidence-row"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('');}
function renderSavedResearch(record,status){
const host=$('saved-research');
if(!record){host.textContent=status==='error'?'研究记录暂时无法读取。':'尚无已保存依据，可通过上方缺项入口补充。';return;}
const url=/^https:\/\//.test(record.sourceUrl||'')?record.sourceUrl:null;
host.innerHTML='<h3>已保存的研究依据</h3><p class="research-validity">'+(status==='expired'?'已过期 · 不用于当前确认':'有效期内 · 人工研究记录')+'</p><p class="meta">依据日期 '+esc(record.asOf)+' · 有效至 '+esc(record.expiresOn)+'</p><p class="research-rationale">'+esc(record.rationale)+'</p>'+(url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">打开证据来源 ↗</a>':'');
}
function renderObservationHistory(data){
const items=data.items||[];
$('observation-summary').textContent=data.status!=='ok'?'观察记录暂时无法读取，稍后重新打开详情重试。':!items.length?'还没有有效观察记录；取得有效行情后会开始积累。':`最近 ${data.recordCount} 次有效记录，覆盖 ${data.marketDays} 个行情日。相邻的同日同状态记录已合并${data.truncated?'；仅展示最近一部分':''}。`;
$('observation-items').innerHTML=items.map(x=>`<article class="observation-item ${esc(x.kind)}"><div class="observation-time"><time>${esc(x.marketDate)}</time><span>行情日</span></div><div><strong>${esc(x.state)}</strong><p>${esc(x.change?.message||'本段最早记录，无更早状态可比较。')}</p><p>${esc(x.reason)}</p><small>观察于 ${esc(new Date(x.observedAt).toLocaleString('zh-CN'))}${x.count>1?' · 合并 '+x.count+' 次同状态观察':''}${finite(x.close)?' · 收盘 $'+x.close.toFixed(2):''}</small></div></article>`).join('')+(items.length?'<p class="meta">这是打开页面或刷新时实际保存的记录，不是连续监控，也不是历史回测。读取失败、过期或异常行情不计作退出观察，不会写入有效记录。</p>':'');
}
const detailMarketCache=new Map();
async function fetchDetailMarket(symbol,date,signal){
 const hit=detailMarketCache.get(symbol);
 if(hit&&hit.date===date&&Date.now()-hit.time<60000)return hit.value;
 const value=await fetchJSON('/api/market?symbol='+symbol,signal);
 if(!signal.aborted)detailMarketCache.set(symbol,{date,time:Date.now(),value});
 return value;
}
async function openDetail(symbol,focus=true){const row=rows.find(r=>r.symbol===symbol);if(!row)return;const seq=++detailSequence;detailController?.abort();detailController=new AbortController();selected=symbol;const view=WatchModel.analyze(row);StockOverview.reset(symbol,names[symbol],row,view,mode==='sample');renderQuality(mode==='sample'?null:row.quality,row.source);renderEvents(symbol);$('official-events').hidden=mode==='sample';$('data-quality').hidden=mode==='sample';$('detail').hidden=false;if(!$('detail').open)$('detail').showModal();document.body.classList.add('report-open');if(focus){selectReportTab(0);document.querySelector('.overview-extra').open=!matchMedia('(max-width:780px)').matches;}$('detail-title').textContent=(cachedDisplay?'上次保存 · ':'')+view.state;$('detail-summary').textContent=view.reason;$('detail-next').textContent=view.next;$('detail-price').textContent=finite(row.close)?'$'+row.close.toFixed(2):'—';$('research-link').href='/workspace.html?symbol='+encodeURIComponent(symbol)+'&view=research#research-form';$('research-link').hidden=mode==='sample';$('chart-caption').textContent=mode==='sample'?'示例走势 · 全部为假设，不代表历史行情':'正在读取日线…';$('sources').textContent='正在核对来源…';$('evidence').textContent='正在读取市场环境与已有研究…';$('confirmation-checks').innerHTML='';$('technical-review').innerHTML='<p class="meta">正在核对趋势、相对强弱和波动…</p>';$('saved-research').textContent='';$('observation-summary').textContent=mode==='sample'?'示例不生成实际观察记录。':'正在读取已保存的观察记录…';$('observation-items').innerHTML='';drawChart([],'正在读取日线…');if(focus)$('close-detail').focus({preventScroll:true});
if(mode==='live'&&row.technicalReview){StockOverview.render(row.technicalReview,{broken:row.broken},row.researchStatus);renderTechnical(row.technicalReview);}
if(mode==='sample'){$('technical-review').innerHTML='<p class="meta">示例未提供完整日线，多维复核不生成假指标。</p>';const history=finite(row.close)?Array.from({length:80},(_,i)=>({date:'示例第'+(i+1)+'日',c:row.close*(1+((79-i)/79)*.18+(Math.sin(i/8)-Math.sin(79/8))*.025)})):[];drawChart(history,symbol+' 假设价格');$('evidence').innerHTML='<p>此卡只演示“状态、原因、下一条件”的阅读方式，未核实该公司的真实行情或经营情况。</p>';$('sources').textContent='所有示例价格与判断均为假设。点击「返回真实观察」获取当前可用数据。';return;}
const signal=AbortSignal.any([detailController.signal,AbortSignal.timeout(35000)]);
let historyFinished=false,savedShown=false;
fetchJSON('/api/history?symbol='+symbol+'&saved=1',signal).then(h=>{if(seq!==detailSequence||historyFinished)return;const bars=(h.bars||[]).filter(b=>finite(b.c)&&b.c>0);if(!bars.length)return;savedShown=true;drawChart(bars,symbol+' 已保存走势',h.status);$('chart-caption').textContent=`已保存走势 · 最新 ${bars.at(-1).date} · 正在检查更新，暂不作为本次确认依据。`;}).catch(()=>{});
await Promise.allSettled([
(async()=>{try{const d=await fetchJSON('/api/profile?symbol='+symbol,signal);if(seq===detailSequence)StockOverview.profile(d,symbol);}catch{if(seq===detailSequence)StockOverview.profile(null,symbol);}})(),
(async()=>{try{const d=await fetchJSON('/api/fundamentals?symbol='+symbol,signal);if(seq===detailSequence)StockOverview.financial(d);}catch{if(seq===detailSequence)StockOverview.financial(null);}})(),
(async()=>{try{const d=await fetchJSON('/api/observations?symbol='+symbol,signal);if(seq===detailSequence)renderObservationHistory(d);}catch{if(seq===detailSequence)renderObservationHistory({status:'error'});}})(),
(async()=>{try{const h=await fetchJSON('/api/history?symbol='+symbol,signal);if(seq!==detailSequence)return;historyFinished=true;renderQuality(h.quality,h.source);const bars=(h.bars||[]).filter(b=>finite(b.c)&&b.c>0);drawChart(bars,symbol+' 历史收盘与50日均价',h.status);$('detail-price').textContent=bars.length?'$'+bars.at(-1).c.toFixed(2):'—';$('chart-caption').textContent=`${h.source||'来源未知'} · ${h.status==='ok'?'已获取':({stale:'已过期，不参与判断',cached:'缓存日线，不参与判断',review:'价格跳变待核实'})[h.status]||'数据不足'} · ${bars.length} 根 · 最新 ${bars.at(-1)?.date||'未知'}。图表独立读取，日期可能与卡片不同。`;}catch{if(seq===detailSequence){historyFinished=true;if(savedShown){$('chart-caption').textContent+=' 更新失败，保留已保存走势，请稍后重试。';}else{drawChart([],'暂时无法获取历史走势');$('chart-caption').textContent='历史数据读取失败，可重新点击卡片重试。';}}}})(),
(async()=>{try{const m=await fetchDetailMarket(symbol,row.date,signal);if(seq!==detailSequence)return;StockOverview.render(m.technicalReview,m.values||{},m.researchStatus);renderTechnical(m.technicalReview);evidence(m.values||{},m.researchStatus);renderSavedResearch(m.research,m.researchStatus);renderSources(m.sources||[]);$('detail-next').textContent=DetailChecks.render($('confirmation-checks'),m.values||{},m.sources||[],symbol,next=>{$('detail-next').textContent=next;});if(m.values?.broken==='yes'){$('detail-title').textContent=symbol+' · 先核实风险';$('detail-next').textContent='研究记录提示经营假设可能失效，先复核公司情况。';}}catch{if(seq===detailSequence){StockOverview.render(row.technicalReview||null,{broken:row.broken},row.researchStatus);renderTechnical(row.technicalReview||null);$('evidence').textContent='市场环境与研究读取失败，尚不能确认完整路径。';$('sources').textContent='暂时无法获取详细来源。首页仅展示先前取得的价格线索。';}}})()
]);}
$('watch-filters').onclick=e=>{const button=e.target.closest('[data-filter]');if(!button||button.disabled)return;activeFilter=button.dataset.filter;renderList();$('watch-filters').querySelector(`[data-filter="${activeFilter}"]`)?.focus();};
const reportTabs=[...document.querySelectorAll('.report-nav [role="tab"]')];
function selectReportTab(index,focus=false){reportTabs.forEach((tab,i)=>{const active=i===index;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(tab.getAttribute('aria-controls')).hidden=!active;});document.querySelector('.report-panels').scrollTop=0;if(focus){reportTabs[index].focus();reportTabs[index].scrollIntoView({block:'nearest',inline:'nearest'});}}
reportTabs.forEach((tab,i)=>{tab.onclick=()=>selectReportTab(i);tab.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%reportTabs.length;else if(e.key==='ArrowLeft')next=(i+reportTabs.length-1)%reportTabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=reportTabs.length-1;if(next!==undefined){e.preventDefault();selectReportTab(next,true);}};});
$('detail').addEventListener('cancel',e=>{e.preventDefault();$('close-detail').click();});
if(initialCache){rows=WatchCache.normalize(initialCache);cachedDisplay=true;}
$('refresh').onclick=load;$('close-detail').onclick=()=>{const symbol=selected;hideDetail();$('cards').querySelector(`[data-symbol="${symbol}"]`)?.focus();};load();
})();
