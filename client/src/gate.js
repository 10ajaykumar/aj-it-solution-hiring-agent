(function(){
  var $=function(q){return document.querySelector(q)},gate=$('#gate'),KEY='tara-access',reduce=false;
  try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
  var viewer=null;try{viewer=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){}
  async function cap(n){try{return window.claude&&window.claude.use?await window.claude.use(n):null}catch(e){return null}}
  function note(t){var el=$('#toast');if(!el)return;el.textContent='✓ '+t;el.classList.add('show');clearTimeout(note.t);note.t=setTimeout(function(){el.classList.remove('show')},3000)}
  function showWho(){var p=$('#whoPill');if(!p||!viewer)return;p.hidden=false;$('#whoTxt').textContent=viewer.label||viewer.email||'Signed in'}
  function open(){gate.classList.remove('out');gate.hidden=false;document.body.classList.add('gated');if(viewer&&viewer.email)$('#gEmail').value=viewer.email;setTimeout(function(){try{$('#gEmail').focus({preventScroll:true})}catch(e){}},60)}
  function close(){gate.classList.add('out');document.body.classList.remove('gated');setTimeout(function(){gate.hidden=true},reduce?0:450)}
  function remember(v){viewer=v;try{localStorage.setItem(KEY,JSON.stringify(v))}catch(e){}}
  async function save(rec){var db=await cap('db'),user=await cap('user');if(!db||!user)return;try{var id=await user.id();if(!id)return;await db.doc('visitors/'+id).set(rec)}catch(e){}}
  function enter(v,rec,msg){remember(v);save(rec);close();showWho();note(msg)}
  if(viewer&&(viewer.email||viewer.label)){gate.hidden=true;showWho()}else{gate.hidden=false;document.body.classList.add('gated');setTimeout(function(){try{$('#gEmail').focus({preventScroll:true})}catch(e){}},80)}
  $('#gateForm').addEventListener('submit',function(e){e.preventDefault();var email=$('#gEmail').value.trim(),err=$('#gErr');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){err.textContent='That email looks incomplete. Try name@company.com.';err.hidden=false;$('#gEmail').focus();return}
    err.hidden=true;var at=new Date().toISOString();enter({email:email,label:email,at:at},{email:email,via:'email',at:at},'Welcome to AJ')});
  (async function(){var user=await cap('user');if(!user)return;var owner=false;try{owner=await user.isOwner()}catch(e){}
    if(owner){if(!viewer)remember({label:'Owner',at:new Date().toISOString()});if(!gate.hidden)close();showWho();return}
    var me=null;try{me=await user.me()}catch(e){}if(!me)return;var label=me.name||me.email;if(!label||gate.hidden)return;
    $('#gQuickName').textContent=label;$('#gQuick').hidden=false;$('#gOr').hidden=false;
    $('#gQuick').onclick=function(){var at=new Date().toISOString();enter({label:label,email:me.email||'',at:at},{via:'account',at:at},'Welcome'+(me.name?', '+me.name.split(' ')[0]:'')+'. You are in.')}})();
  var wp=$('#whoPill');if(wp)wp.addEventListener('click',open);
  window.shubhGate={open:open};
  setInterval(function(){var g=document.getElementById('gLive');if(g&&!gate.hidden)g.textContent=36+Math.round(Math.random()*22)},1600);
})();
