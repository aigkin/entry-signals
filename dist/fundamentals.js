let fundamentalSequence=0,fundamentalController;
async function loadFundamentals(){
 window.dispatchEvent(new CustomEvent('fundamentals-updated',{detail:null}));
 const sequence=++fundamentalSequence;fundamentalController?.abort();fundamentalController=new AbortController();
 const timer=setTimeout(()=>fundamentalController?.abort(),20000);
 $('fundamental-status').textContent='正在读取公开财务与估值…';$('fundamental-cards').innerHTML='';$('fundamental-source').textContent='';
 try{
  const response=await fetch('/api/fundamentals?symbol='+encodeURIComponent($('symbol').value),{signal:fundamentalController.signal});if(!response.ok)throw Error();const d=await response.json();if(sequence!==fundamentalSequence)return;window.dispatchEvent(new CustomEvent('fundamentals-updated',{detail:d}));
  $('fundamental-status').textContent=d.symbol+' · '+(d.status==='snapshot'?'可用 '+d.coverage+' / 8 项':d.status==='not_applicable'?'ETF视图':'来源暂不可用');
  $('fundamental-cards').innerHTML=d.cards.map(c=>`<article class="macro-card"><h3>${esc(c.label)}</h3><strong>${c.status==='available'?esc(c.display)+' '+esc(c.unit):'暂无数据'}</strong></article>`).join('');
  $('fundamental-source').innerHTML=esc(d.note)+(d.url?` <a href="${esc(d.url)}" target="_blank" rel="noopener">查看公开来源</a>`:'')+(d.retrievedAt?'<br>抓取时间：'+esc(new Date(d.retrievedAt).toLocaleString())+'；不是财报截止日。':'');
 }catch{if(sequence===fundamentalSequence)$('fundamental-status').textContent='获取失败，可稍后重试；未代填。';}finally{clearTimeout(timer);}
}
$('symbol').addEventListener('change',loadFundamentals);$('refresh-fundamental').onclick=loadFundamentals;$('refresh').addEventListener('click',loadFundamentals);loadFundamentals();
