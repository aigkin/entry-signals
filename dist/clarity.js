let activeView='observe';
function showView(name){
 if(!['observe','research','simulation'].includes(name))return;
 const leaving=activeView==='simulation'&&name!=='simulation';activeView=name;
 window.scrollTo({top:0});
 document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-'+name);
 document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===name)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 $('lab').open=true;
 if(leaving&&mode!=='auto')refresh();
 updateClarity();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
function updateClarity(){
 document.body.dataset.simulation=String(mode!=='auto');
 document.querySelectorAll('.context-symbol').forEach(n=>n.textContent=$('symbol').value);
 $('next-visible').innerHTML=$('next').innerHTML;
 $('brief-macro').textContent=$('macro-status').textContent;
 $('simulation-title').textContent=mode==='auto'?'选择情景开始试算':evaluate(current).decision;
 $('simulation-description').textContent=mode==='auto'?'当前尚未应用假设输入。':evaluate(current).explanation;
 $('simulation-checks').innerHTML=mode==='auto'?'':['panic','trend'].map(k=>'<div><h3>'+({panic:'恐慌低吸',trend:'趋势买入'}[k])+'</h3>'+$(`${k}-checks`).innerHTML+'</div>').join('');
 document.querySelectorAll('#watch-rows tr[data-symbol]').forEach(tr=>tr.dataset.selected=String(tr.dataset.symbol===$('symbol').value));
}
const clarityRender=render;render=function(){clarityRender();updateClarity();};
const clarityPreset=preset;preset=function(name){showView('simulation');clarityPreset(name);};
$('open-macro').onclick=()=>{$('macro-detail').open=true;$('macro-detail').scrollIntoView({behavior:'smooth',block:'start'});};
$('refresh-all').onclick=()=>{refresh();loadFundamentals();loadMacro(true);refreshWatchlist(true);};
new MutationObserver(updateClarity).observe($('macro-status'),{childList:true,characterData:true,subtree:true});
new MutationObserver(()=>{$('refresh-all').disabled=$('refresh').disabled;$('refresh-all').textContent=$('refresh').disabled?'正在刷新…':'刷新全部数据';}).observe($('refresh'),{attributes:true,attributeFilter:['disabled']});
$('symbol').addEventListener('change',updateClarity);
updateClarity();
