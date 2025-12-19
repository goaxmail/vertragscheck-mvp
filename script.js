
document.getElementById('analyzeBtn').addEventListener('click', async () => {
  const txt = document.getElementById('contractText').value.trim();
  if(!txt) return alert("Bitte Vertragstext eingeben.");
  const resBox = document.getElementById('results');
  const content = document.getElementById('resultContent');
  content.innerHTML = "<p>Analyse läuft...</p>";
  resBox.classList.remove('hidden');
  const r = await fetch('/api/analyze', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({text: txt})
  });
  const data = await r.json();
  content.innerHTML = "<pre>"+JSON.stringify(data, null, 2)+"</pre>";
});
