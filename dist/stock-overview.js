(function(root){
'use strict';
const $=id=>document.getElementById(id),finite=Number.isFinite,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,s='')=>finite(v)?v.toFixed(2)+s:'—',pct=v=>finite(v)?(v>0?'+':'')+v.toFixed(1)+'%':'—',tone=v=>finite(v)?v>=0?'positive':'negative':'muted';
const offset=(p,m)=>p>0&&m>0?(p/m-1)*100:null;
const line=(label,value,note='',cls='')=>`<div class="analysis-line"><div><span>${esc(label)}</span>${note?'<details class="metric-note"><summary aria-label="'+esc(label)+'指标说明">i</summary><p>'+esc(note)+'</p></details>':''}</div><strong class="${cls}">${esc(value)}</strong></div>`;
function reset(symbol,name,row,view,sample){
 $('detail-symbol').textContent=symbol;$('detail-company').textContent=name;$('detail-monogram').textContent=symbol.slice(0,2);$('detail-title').textContent=view.state;
 $('overview-price').textContent=finite(row.close)?'$'+row.close.toFixed(2):'—';$('overview-change').textContent='';$('overview-date').textContent=sample?'示例 · 假设价格':`${row.date||'日期待获取'} · 已完成日线 · ${row.status==='ok'?'收盘观察':'当前数据待核实'}`;
 $('overview-brief').textContent=view.reason;$('overview-tags').innerHTML='';$('company-meta').textContent=sample?'示例不展示真实公司资料':'行业、市值资料正在读取…';
 for(const id of ['structure-body','momentum-body','valuation-body','financial-body'])$(id).innerHTML='<p class="meta">'+(sample?'示例未提供可验证资料。':'正在核对数据…')+'</p>';
 $('earnings-banner').innerHTML='<span>下一次财报</span><strong>'+(sample?'示例不提供真实日期':'正在核对…')+'</strong>';
}
function render(t,values={},researchStatus='missing'){
 const ind=t?.indicators;
 if(!ind){$('overview-tags').innerHTML='<span class="analysis-tag neutral">技术数据待核实</span>';$('overview-brief').textContent='当前价格数据不足、过期或待核实，暂无法描述趋势与动能。';$('structure-body').innerHTML='<p>技术数据未通过当前有效性检查，趋势结构保持未知。</p>';$('momentum-body').innerHTML='<p>日线无法用于当前判断，量能与动能保持未知。</p>';renderValuation(values,researchStatus);return;}
 const p=ind.price,ma50=offset(p,ind.sma50),ma200=offset(p,ind.sma200),ema20=offset(p,ind.ema20);
 $('overview-price').textContent='$'+num(p);$('overview-change').textContent=finite(ind.change)?`${ind.change>=0?'+':''}${num(ind.change)} (${pct(ind.changePct)})`:'';$('overview-change').className=tone(ind.change);$('overview-date').textContent=`${t.date} · 已完成日线 · USD · 非盘中行情`;
 const tags=[],above=ind.sma200>0&&p>ind.sma200,strong=[ind.ema20,ind.sma50,ind.sma200].every(finite)&&p>ind.ema20&&ind.ema20>ind.sma50&&ind.sma50>ind.sma200;
 if(strong)tags.push(['多头排列','positive']);else if(above)tags.push(['站上200日线','positive']);
 if(finite(ind.slope50))tags.push([ind.slope50>0?'均线向上':'均线未上行',ind.slope50>0?'positive':'neutral']);
 if(ind.crossover)tags.push([`${ind.crossover.type==='golden'?'50/200 金叉':'50/200 死叉'} · ${ind.crossover.age}个交易日前`,ind.crossover.type==='golden'?'positive':'negative']);
 const rsiText=finite(ind.rsi14)?ind.rsi14>=70?'RSI 处于高位':ind.rsi14<=30?'RSI 处于低位':'RSI 30–70':'RSI 待数据';
 tags.push([rsiText,'neutral']);$('overview-tags').innerHTML=tags.map(([text,cls])=>`<span class="analysis-tag ${cls}">${esc(text)}</span>`).join('');
 const trend=finite(ind.slope50)&&finite(ma50)?ind.slope50>0&&ma50>0?'中期趋势向上':ind.slope50<=0&&ma50<0?'中期趋势偏弱':'价格与均线方向分化':'中期趋势待核实';
 const position=finite(ma50)?ma50>10?'距50日均线偏离较大':ma50>0?'位于50日均线上方':'位于50日均线下方':'价格位置待核实';
 const volume=finite(ind.volume)?ind.volume>=1.2?'量比达到趋势参考线':'量比未达到趋势参考线':'成交量待补';
 $('overview-brief').textContent=values.broken==='yes'?'研究记录提示经营假设可能失效，先复核公司风险，再评估价格条件。':`${volume}。${researchStatus==='ok'&&values.broken==='no'?'已有公司研究，待完整复核。':(['SPY','SOXX','DRAM'].includes($('detail-symbol').textContent)?'ETF持仓与穿透估值仍待核实。':'公司依据待补。')}`;
 const range=ind.range52;
 $('structure-body').innerHTML=line('现价 vs 20周均线',pct(ind.week20Pct),'取最近20个已完成交易周的最后收盘价；简单均线',tone(ind.week20Pct))+line('现价 vs EMA20',pct(ema20),'短期价格位置',tone(ema20))+line('现价 vs SMA50',pct(ma50),'趋势路径参考范围：高于均线且偏离不超过10%',tone(ma50))+line('现价 vs SMA200',pct(ma200),'长期价格位置；不足200根日线保持未知',tone(ma200))+line('SMA50 斜率',pct(ind.slope50),'与5个交易日前的均线相比',tone(ind.slope50))+line('RSI(14)',num(ind.rsi14),'Wilder平滑；70 / 30为常见参考线，不直接触发买卖')+(range?`<div class="range52"><div class="range-labels"><span>52周低 $${num(range.low)}</span><span>52周高 $${num(range.high)}</span></div><div class="range-track"><i style="left:${range.position.toFixed(2)}%"></i></div><p>距高点 ${pct(range.fromHigh)} · 距低点 ${pct(range.fromLow)}</p><small>${esc(range.start)} → ${esc(range.end)} · 日内高低价范围；价格位置不等于估值</small></div>`:'<p class="meta">52周历史不足或高低价缺失，不展示伪完整区间。</p>');
 $('momentum-body').innerHTML=line('量比',num(ind.volume,' 倍'),'趋势参考线1.20倍；回撤企稳参考线1.00倍')+line('20日相对 SOXX',pct(ind.relative20),'同日起止的复合收益比变化；正值表示跑赢行业',tone(ind.relative20))+line('VIX 历史分位',num(values.fear,'%'),'大盘波动情绪代理；不是这只股票的情绪评分')+line('ATR14 / 收盘价',num(ind.atrPct,'%'),'反映自身近期波动尺度，不预测未来风险')+line('距 EMA20',num(ind.extensionATR,' ATR'),'以自身波动衡量偏离；暂不设置新入场门槛');
 renderValuation(values,researchStatus);
}
function renderValuation(v,status){if(['SPY','SOXX','DRAM'].includes($('detail-symbol').textContent)){$('valuation-body').innerHTML='<p>ETF估值需要穿透持仓和成分股共识；单家公司估值门槛不直接套用。</p><p class="meta">基金穿透估值尚未接入，当前保持待核实。</p>';return;}$('valuation-body').innerHTML=line('人工基准价值空间',num(v.upside,'%'),'低吸参考线15%；趋势参考线5%')+line('收入共识修正 · 30日',num(v.revision,'%'),'低吸参考线≥−5%；趋势参考线≥0%')+'<p class="meta">'+esc(status==='expired'?'研究已过期，请重新核验。':status==='ok'?'使用有效期内的人工研究；依据见公司研究栏目。':'当前没有有效的估值与共识依据，不能给出回报高低的结论。')+' 分析师目标价没有被当作基准价值。</p>';}
function profile(d,symbol){
 if(d?.status==='not_applicable'){$('company-meta').textContent='ETF · 请核实基金穿透持仓';$('earnings-banner').innerHTML='<span>财报事件</span><strong>查看持仓成分股</strong><p>ETF没有单一公司的财报日。</p>';return;}
 const cap=d?.marketCap,capText=cap>0?(cap>=1e12?(cap/1e12).toFixed(2)+' 万亿美元':(cap/1e8).toFixed(1)+' 亿美元'):'待数据';
 $('company-meta').innerHTML=`<span>行业 ${esc(d?.industry||'待数据')}</span><span>市值 ${esc(capText)}</span>${d?.summaryUrl?'<a href="'+esc(d.summaryUrl)+'" target="_blank" rel="noopener noreferrer">公司资料来源 ↗</a>':''}`;
 const e=d?.earnings,link=d?.earningsUrl||`https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`;
 $('earnings-banner').innerHTML='<span>下一次财报</span><strong>'+esc(e?.date||'日期待确认')+(e?.date?' <small>来源预计</small>':'')+'</strong><p>'+esc(e?.note||'未取得有效日期；请核对公司官方公告。')+'</p><a href="'+esc(link)+'" target="_blank" rel="noopener noreferrer">日期来源 ↗</a><p class="meta">'+esc(d?.retrievedAt?'资料读取：'+new Date(d.retrievedAt).toLocaleString('zh-CN'):'本次未取得来源资料')+' · 公司资料与日线日期可能不同步。</p>';
}
function financial(d){const host=$('financial-body');if(d?.status==='not_applicable'){host.innerHTML='<p>ETF不套用单家公司财务指标，需另行核实成分股与基金资料。</p>';return;}
 const cards=(d?.cards||[]).filter(c=>c.status==='available');host.innerHTML=cards.length?cards.map(c=>line(c.label,c.display+(c.unit==='倍'?' 倍':c.unit==='USD'?' USD':''))).join(''):'<p>公司财务快照暂不可用，盈利和成长判断保持未知。</p>';
 host.innerHTML+='<details class="source-note"><summary>口径与来源</summary><p class="meta">'+esc(d?.note||'没有使用演示数字补齐。')+'</p>'+(d?.retrievedAt?'<p class="meta">读取时间 '+esc(new Date(d.retrievedAt).toLocaleString('zh-CN'))+'</p>':'')+(d?.url?'<a href="'+esc(d.url)+'" target="_blank" rel="noopener noreferrer">财务来源 ↗</a>':'')+'</details>';
}
root.StockOverview={reset,render,profile,financial};
})(globalThis);
