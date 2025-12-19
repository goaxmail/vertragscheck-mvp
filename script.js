
document.querySelectorAll('.tabbar button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const p = btn.dataset.page;
    document.querySelectorAll('.page').forEach(pg=>pg.classList.remove('active'));
    document.getElementById(p).classList.add('active');
    window.scrollTo(0,0);
  });
});

document.getElementById('analyzeBtn').addEventListener('click', async ()=>{
  const txt=document.getElementById('contractText').value.trim();
  if(!txt)return alert("Bitte Text eingeben.");
  const resBox=document.getElementById('results');
  const content=document.getElementById('resultContent');
  resBox.classList.remove('hidden');
  content.innerHTML="Analyse läuft...";
  const r=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:txt})});
  const data=await r.json();
  content.innerHTML="<pre>"+JSON.stringify(data,null,2)+"</pre>";
});
