let decisionFinancials=null;
function ensureActionCard(){if($('action-card'))return;const title=$('buy-title');const box=document.createElement('section');box.id='action-card';box.className='action-card';box.innerHTML='<div><span>当前结论</span><strong id="action-label">继续观察</strong></div><div><span>仓位</span><strong id="action-size">不计算</strong></div><p id="action-reason"></p><p id="action-next"></p><div class="completeness" id="completeness-panel"><strong id="completeness-phase">完整度整理中</strong><p id="completeness-independence"></p><div id="completeness-paths" class="completeness-paths"></div></div>';title.before(box);}
function renderDecisionCard(){
 ensureActionCard();
 const symbol=$('symbol').value,d=current,l=EntryLayers(d),etf=['SPY','SOXX','DRAM'].includes(symbol),e=explainSignals(d),r=evaluate(d);
 const f=decisionFinancials?.symbol===symbol?decisionFinancials:null;
 const financial=id=>f?.cards?.find(c=>c.id===id&&c.status==='available');
 let title,summary;
 if(mode!=='auto'){title='情景试算，不是当前买入判断';summary='恢复自动数据后，再查看真实价格与财务证据。';}
 else if(d.broken==='yes'){title='先复核公司风险';summary='研究记录提示原来的经营假设可能失效。先核实公司情况，价格线索不能消除这项风险。';}
 else if(!l.dipKnown&&!l.trendKnown){title='数据不足 · 暂不能判断入场时机';summary='价格证据还未齐备；没有数据不等于没有机会，也不等于可以买。';}
 else if(l.dip||l.trend){title='出现价格线索 · 公司依据待核实';summary='当前价格满足部分试用条件。再检查公司和行业依据、数据日期与风险；这不是买入或加仓结论。';}
 else{title='继续观察 · 暂无明显价格线索';summary='当前未达到试用规则的条件。下方会说明差什么；这不等于公司没有长期投资价值。';}
 $('buy-title').textContent=symbol+'：'+title;$('buy-summary').textContent=summary;const action=r.action||{label:'观察',size:'不计算',reason:'关键数据尚未齐备。',next:'补齐数据后复核。'};$('action-label').textContent=action.label;$('action-size').textContent=action.size;$('action-reason').textContent=action.reason;$('action-next').textContent='下一步：'+action.next;
 const support=[],risk=[];
 if(l.envKnown)(d.market50>0&&d.sector>0?support:risk).push(l.environment+'：SPY '+numberText(d.market50)+'，SOXX '+numberText(d.sector)+'（相对50日均线）。');
 if(l.dip)support.push('回撤企稳技术条件已成立。');if(l.trend)support.push('趋势技术条件已成立。');
 if(typeof d.stock==='number'&&d.stock>10)risk.push('高于50日均线 '+numberText(d.stock)+'，超过本版趋势路径的10%追高上限。');
 const cashflow=financial('Free Cash Flow'),income=financial('Net Income');
 if(cashflow)(cashflow.value<0?risk:support).push('来源TTM自由现金流 '+cashflow.display+' USD'+(cashflow.value<0?'：需要进一步核实投资支出与资金来源。':'：该口径为正，不代表未来现金流已得到保证。'));
 if(income?.value<0)risk.push('来源TTM净利润为负：'+income.display+' USD。');
 const ps=financial('PS Ratio');if(ps)risk.push('当前市销率 '+ps.display+' 倍；缺少增长与利润率情景，尚不能判断贵或便宜。');
 $('buy-support').innerHTML=(support.length?support:['暂未形成可确认的支持证据。']).map(x=>'<li>'+esc(x)+'</li>').join('');
 $('buy-risk').innerHTML=(risk.length?risk:['未发现已获取指标中的明确提示，不代表风险已排除。']).map(x=>'<li>'+esc(x)+'</li>').join('');
 $('buy-triggers').innerHTML=[['dip','回撤企稳路径'],['trend','趋势路径']].map(([key,label])=>'<article><h3>'+label+'</h3>'+e[key].map(x=>'<p><span class="'+x.status+'">'+({yes:'已满足',no:'未满足',unknown:'待数据'}[x.status])+'</span> · '+esc(x.label)+'：'+esc(x.value)+'；需 '+esc(x.target)+'</p>').join('')+'</article>').join('');
 $('buy-triggers').insertAdjacentHTML('beforeend','<p class="muted">'+esc(l.confirmation)+'。当前试用门槛：回撤路径看价值空间 ≥15%、收入预期修正 ≥−5%；趋势路径看价值空间 ≥5%、收入预期修正 ≥0%。这些数字尚未验证为有效买点。两条路径还要求有依据支持经营假设未失效。</p>');
 $('buy-alignment').textContent=d.aligned===false?'跨资产日期未对齐，趋势路径暂停判断。':'任一路径的必要条件不再满足时，撤销该技术候选。使用已完成日线，不是盘中买入价或止损价。';
 $('buy-business').textContent=etf?'ETF需另行核实穿透持仓及加权估值，不能套用单家公司财务结论。':symbol==='NBIS'?'NBIS仍需核实：最新收入增长与指引、资本开支及付款计划、现金消耗、债务到期与融资稀释、订单转为收入的进度。当前快照未覆盖这些项目，不能用账面利润替代经营核查。':'仍需核实：收入增长与指引、盈利预期修正、现金流可持续性，以及估值情景。当前财务快照不是基本面通过证明。';
 $('buy-portfolio').textContent='按你此前提供的组合，MRVL为最大仓位，整体集中于AI/半导体。新增'+symbol+'应同时检查相关风险，而非只看单股机会。当前仓位、现金和可承受回撤未更新，因此本版不生成买入股数或加仓比例。';
 $('buy-provenance').textContent=mode!=='auto'?'上方使用实验室参数；财务快照仍是真实来源，二者不能视为同一时点的投资判断。':'价格来源与观察日期见下方“市场证据”。'+(f?.retrievedAt?'财务抓取于 '+new Date(f.retrievedAt).toLocaleString()+'；统计截止日未核验。':'财务数据尚未获取或此标的不适用。')+' 决策规则未经完整回测；不提供上涨概率。';
}
function renderCompletenessCard(){if(!window.EntryCompleteness)return;const c=EntryCompleteness(current,records,mode);const phase={blocked:'基本面拦截',manual:'手动试算（不代表真实判断）',complete:'至少一条完整路径',unmet:'条件尚未满足',missing:'数据待补齐',technical_candidate_pending:'技术候选待确认'}[c.currentPhase]||c.currentPhase;if(c.isScenario){$('action-label').textContent='仅供试算';$('action-size').textContent='不生成';$('action-reason').textContent='手动或情景参数不代表当前市场判断。';}else if(c.currentPhase==='complete'){$('buy-title').textContent=$('symbol').value+'：试用条件符合 · 继续人工核对';$('buy-summary').textContent='至少一条试用路径满足条件；仍需核实来源、日期、公司依据和近期事件。';}$('completeness-phase').textContent='条件核对：'+phase;$('completeness-independence').textContent=c.independence;$('completeness-paths').innerHTML=Object.values(c.paths).map(p=>'<article><b>'+(p.name==='panic'?'回撤企稳路径':'趋势路径')+'：'+(p.complete?'完整':'未完整')+'</b><p>已满足 '+p.checks.filter(x=>x.status==='met').length+' / '+p.checks.length+' 项</p><p>'+esc(p.checks.filter(x=>x.status==='met').map(x=>x.label+' '+(typeof x.value==='number'?x.value.toFixed(2):'')).join(' · ')||'当前尚无满足项')+'</p>'+p.blockers.concat(p.missing.map(x=>'缺失：'+x),p.unmet.map(x=>'未满足：'+x)).map(x=>'<p>'+esc(x)+'</p>').join('')+(p.complete?'':'<p>下一步：'+esc(p.next[0]||'复核数据。')+'</p>')+'</article>').join('');}
const beforeDecisionRender=render;render=function(){beforeDecisionRender();renderDecisionCard();renderCompletenessCard();};
window.addEventListener('fundamentals-updated',event=>{decisionFinancials=event.detail;renderDecisionCard();renderCompletenessCard();});
 $('symbol').addEventListener('change',()=>{decisionFinancials=null;renderDecisionCard();renderCompletenessCard();});
$('focus-nbis').onclick=()=>{$('symbol').value='NBIS';$('symbol').dispatchEvent(new Event('change'));};
renderDecisionCard();renderCompletenessCard();
