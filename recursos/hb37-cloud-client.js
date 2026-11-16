/* HistoriaBizia Cloud · extra layer; does not change the ten original game evaluators */
(()=>{'use strict';
 const C=window.HB37_CONFIG||{},base=String(C.url||'').replace(/\/$/,''),pub=C.publicKey||'';
 const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(pub);
 const GAMES=[['hasiera','Zergatik hasi zen?'],['industria_denbora_v1','Industria Iraultzen denbora-lerroa'],['sektoreak','Ehungintza eta siderurgia'],['garraioa','Garraioen iraultza'],['bigarrena','Bigarren Industria Iraultza'],['hedapena','Iraultzaren hedapena'],['gizartea','Gizarte industriala'],['denbora','Langileen denbora-lerroa'],['mugimendua','Langileen aldarrikapenak'],['azkena','Hiri elektrikoa']];
 const GAMESET=new Set(GAMES.map(x=>x[0])), $=id=>document.getElementById(id);
 let session=null,lastGame='',lastPoints=0,lastSent=0,requestBusy=false,joinedClass='',outbox=[],joining=false,activeAttempt=null;
 let top10Open=false,top10Busy=false,top10Cache='';
 const ps=()=>{try{return JSON.parse(localStorage.getItem('hb37-sessions')||'{}')}catch{return {}}};
 const snap=()=>{try{return JSON.parse(localStorage.getItem('hb37-pending-'+session.room_id+'-v'+session.generation)||'[]')}catch{return []}};
 const save=()=>{if(!session)return;try{localStorage.setItem('hb37-pending-'+session.room_id+'-v'+session.generation,JSON.stringify(outbox))}catch{}};
 function persist(){try{let a=ps();a[session.code]=session;localStorage.setItem('hb37-sessions',JSON.stringify(a))}catch{}}
 function status(message,bad=false){const x=$('hb37-message');if(x){x.textContent=message;x.classList.toggle('bad',!!bad)}}
 async function rpc(name,data){if(!configured)throw Error('Supabase ez dago konfiguratuta.');
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),12000);
  try{const res=await fetch(base+'/rest/v1/rpc/hb37_'+name,{method:'POST',headers:{'apikey':pub,'Content-Type':'application/json'},body:JSON.stringify(data),signal:ctrl.signal,cache:'no-store'});
  const val=await res.json().catch(()=>({}));if(!res.ok)throw Error(val.message||val.error||('Sareko errorea '+res.status));return val;
  }finally{clearTimeout(timeout)} }
 const safe=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function storageKey(k){if(!session)return k;if(['industria-demo-rankings','industria-nickname','historiabizia-v6-player-progress','historiabizia-v3-completions','historiabizia-v6-menu-selection'].includes(k))return 'hb37-'+session.room_id+'-g'+session.generation+'-'+k;return k}
 function veil(on){const x=$('hb37-veil');if(x)x.hidden=!on}
 function change(){veil(true);let f=$('hb37-form');if(!f)return;f.querySelector('[name=code]').value=session?.code||new URLSearchParams(location.search).get('klase')||'';f.querySelector('[name=nickname]').value=session?.nickname||'';}
 function paint(){const badge=$('hb37-badge');if(badge)badge.innerHTML=session?'🏆 '+safe(session.room)+' · '+safe(session.nickname):'🏆 Ikasgelara sartu';
   const note=$('hb37-inside');if(note)note.textContent=session?'✓ '+session.room+' · '+session.nickname:'Ikasgelaren kodea eta goitizena behar dira.';
   if(session){document.querySelectorAll('.hb37-cloud-only').forEach(x=>x.hidden=false);const c=$('connection');if(c){c.classList.remove('offline');c.classList.add('connected');c.innerHTML='<span class="signal-dot"></span> ONLINE · PARTEKATUA';}const t=$('rank-live');if(t)t.textContent='● ZUZENEAN';const l=document.querySelector('.v61-data-line');if(l)l.innerHTML=l.innerHTML.replace('V7 · TOKIKO AURREBISTA · DATUAK EZ DIRA PARTEKATZEN','V37 · IKASGELAKO SAILKAPEN PARTEKATUA');}
 }
 async function join(code,nick,restore=false){if(joining)return;code=String(code||'').trim().toUpperCase();nick=String(nick||'').trim().normalize('NFC');
  if(!/^[0-9A-F]{10}$/.test(code)||!/^[\p{L}0-9_-]{3,18}$/u.test(nick)){status('Kodea (10 karakter) eta 3-18 karaktereko goitizena behar dira.',true);return;}
  joining=true;status('Ikasgelara konektatzen…');
  const saved=ps()[code];try{const r=await rpc('student_join',{p_code:code,p_nickname:nick,p_resume_token:saved?.nickname===nick?saved.token:null});
    session={code,nickname:r.nickname,room:r.room,room_id:r.room_id,generation:r.generation||1,token:r.token};joinedClass=code;persist();outbox=snap();if(!Array.isArray(outbox))outbox=[];
    window.HB_CLOUD.joined=true;veil(false);paint();status('✓ Konektatuta');
    try{const input=$('nickname');if(input){input.value=nick;input.readOnly=true;}}catch{}
    try{localStorage.setItem(storageKey('industria-nickname'),JSON.stringify(nick))}catch{}
    window.dispatchEvent(new StorageEvent('storage',{key:'industria-nickname'}));void flush();void refreshBadge();
  }catch(e){if(restore){veil(true);status('Aukeratu goitizena gelan sartzeko.',true)}else status(e.message||'Ezin izan da gelara sartu.',true)}
  finally{joining=false;}}
 async function refreshBadge(){if(!session)return;try{const d=await rpc('student_board',{p_token:session.token});const list=d?.students||[];
   const me=list.find(x=>x.nickname.toLowerCase()===session.nickname.toLowerCase());const total=me?.total||0;
   const c=$('hb37-summary');if(c)c.textContent='☁ '+total+' puntu · '+(me?.completed||0)+'/10 jolas · '+session.room;
 }catch(e){status('Konexio edo ikasgela arazoa: '+e.message,true)}}
function top10Mount(){
 if(document.getElementById('hb37-game-top10'))return;
 const root=document.createElement('div');root.id='hb37-game-top10';
 root.innerHTML=`<button id="hb37-game-top10-toggle" type="button" aria-controls="hb37-game-top10-panel" aria-expanded="false" aria-label="Ikusi joko honetako TOP 10">🏆 TOP 10 <span aria-hidden="true">▸</span></button>
 <aside id="hb37-game-top10-panel" role="region" aria-label="Joko honetako ikasgelako TOP 10a" hidden>
 <header class="hb37-top10-head"><div><small>IKASGELAKO SAILKAPENA</small><strong id="hb37-game-top10-title">TOP 10</strong><span id="hb37-game-top10-room"></span></div><button id="hb37-game-top10-close" type="button" aria-label="Itxi TOP 10">✕</button></header>
 <div id="hb37-game-top10-rows" class="hb37-top10-rows" aria-live="polite"><p class="hb37-top10-note">Ireki sailkapena emaitzak ikusteko.</p></div>
 <footer class="hb37-top10-foot"><span id="hb37-game-top10-status">Amaitutako partiden markak</span><button type="button" id="hb37-game-top10-refresh">↻ Eguneratu</button></footer>
 </aside>`;
 document.body.appendChild(root);
 document.getElementById('hb37-game-top10-toggle').addEventListener('click',()=>top10SetOpen(!top10Open));
 document.getElementById('hb37-game-top10-close').addEventListener('click',()=>top10SetOpen(false));
 document.getElementById('hb37-game-top10-refresh').addEventListener('click',()=>void top10Refresh());
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&top10Open)top10SetOpen(false)});
 setInterval(()=>{if(top10Open&&!document.hidden&&document.body.classList.contains('hb-playing'))void top10Refresh()},12000);
}
function top10SetOpen(open){
 const root=document.getElementById('hb37-game-top10'),panel=document.getElementById('hb37-game-top10-panel'),btn=document.getElementById('hb37-game-top10-toggle');
 if(!root||!panel||!btn)return;
 top10Open=Boolean(open);root.classList.toggle('is-open',top10Open);panel.hidden=!top10Open;
 btn.setAttribute('aria-expanded',String(top10Open));
 if(top10Open){top10Cache='';void top10Refresh();}
 else btn.focus({preventScroll:true});
}
async function top10Refresh(){
 if(top10Busy||!top10Open||!session||!GAMESET.has(lastGame))return;
 const roomId=session.room_id,game=lastGame,token=session.token;
 const gameTitle=GAMES.find(g=>g[0]===game)?.[1]||'TOP 10';
 const name=document.getElementById('hb37-game-top10-title'),room=document.getElementById('hb37-game-top10-room'),statusEl=document.getElementById('hb37-game-top10-status'),refresh=document.getElementById('hb37-game-top10-refresh');
 if(name)name.textContent=gameTitle;
 if(room)room.textContent=session.room+' · TOP 10';
 if(refresh)refresh.disabled=true;
 top10Busy=true;
 try{
  const data=await rpc('student_board',{p_token:token});
  if(!top10Open||!session||session.room_id!==roomId||lastGame!==game)return;
  const entries=(Array.isArray(data?.students)?data.students:[])
   .filter(s=>s&&s.scores&&Object.prototype.hasOwnProperty.call(s.scores,game)&&s.scores[game]!==null&&s.scores[game]!==undefined&&Number.isFinite(Number(s.scores[game])))
   .map(s=>({name:String(s.nickname||''),score:Number(s.scores[game])}))
   .sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'eu'));
  const myPlace=entries.findIndex(s=>s.name.toLocaleLowerCase('eu')===session.nickname.toLocaleLowerCase('eu'));
  const rows=entries.slice(0,10).map((e,i)=>`<div class="hb37-top10-row${e.name.toLocaleLowerCase('eu')===session.nickname.toLocaleLowerCase('eu')?' mine':''}"><span class="hb37-top10-pos">${['🥇','🥈','🥉'][i]||(i+1)+'.'}</span><span class="hb37-top10-name">${safe(e.name)}</span><strong class="hb37-top10-score">${Math.round(e.score).toLocaleString('es-ES')}</strong></div>`).join('');
  const html=rows||'<p class="hb37-top10-note">Oraindik ez dago amaitutako partidarik joko honetan. Izan zaitez lehena!</p>';
  const box=document.getElementById('hb37-game-top10-rows');if(box&&top10Cache!==html){box.innerHTML=html;top10Cache=html;}
  if(statusEl)statusEl.textContent=myPlace>=10?'Zure postua: '+(myPlace+1)+'. · '+entries[myPlace].score+' puntu':'Ikasgelako markak · '+entries.length+' jokalari';
 }catch(err){
  if(!top10Cache){const box=document.getElementById('hb37-game-top10-rows');if(box)box.innerHTML='<p class="hb37-top10-note">Ezin izan da sailkapena kargatu. Saiatu berriro.</p>';}
  if(statusEl)statusEl.textContent='Konexio-arazoa · ↻ saiatu berriro';
 }finally{top10Busy=false;if(refresh)refresh.disabled=false;}
}
function top10Started(game,previous){
 if(!GAMESET.has(game))return;
 const root=document.getElementById('hb37-game-top10');if(root)root.classList.add('ready');
 if(previous!==game){top10Cache='';if(top10Open)top10SetOpen(false);}
}
 async function leaderboard(game){if(!session)return [];const d=await rpc('student_board',{p_token:session.token});
  const list=(d?.students||[]).map(s=>({name:s.nickname,score:Number(s.scores?.[game]||0),elapsedMs:0})).filter(s=>s.score>=0).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'eu'));
  return list.filter(s=>s.score>0).slice(0,10)}
 function attemptId(){
  return 'hb37-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
 }
 function queueStart(game,id){
  outbox.push({kind:'start',game,attempt:id,generation:session.generation});
  save();void flush();
 }
 function started(game){
  if(!session||!GAMESET.has(game))return;
  const previous=lastGame;
  lastGame=game;lastPoints=0;lastSent=0;
  activeAttempt={game,id:attemptId()};
  queueStart(game,activeAttempt.id);
  top10Started(game,previous);
  void progress('playing',true);
 }
 async function progress(st='playing',force=false){
  if(!session||!GAMESET.has(lastGame))return;
  if(!force&&Date.now()-lastSent<11000)return;lastSent=Date.now();
  try{await rpc('student_progress',{p_token:session.token,p_game:lastGame,p_partial:Math.min(800,Math.max(0,lastPoints|0)),p_status:st,p_generation:session.generation})}catch{}
 }
 function partial(n){if(!session)return;lastPoints=Math.min(800,Math.max(0,Number(n)||0));void progress('playing')}
 function aborted(){
  if(session&&lastGame){void progress('idle',true);lastGame='';activeAttempt=null;top10SetOpen(false)}
 }
 function finished(game,score,complete){
  if(!session||!GAMESET.has(game))return;
  lastGame=game;lastPoints=Math.min(800,Math.max(0,Math.round(Number(score)||0)));
  if(complete){
   let id;
   if(activeAttempt?.game===game)id=activeAttempt.id;
   else{id=attemptId();queueStart(game,id);}
   outbox.push({kind:'finish',game,score:lastPoints,attempt:id,generation:session.generation});
   save();void flush();
  }else void progress('idle',true);
  activeAttempt=null;
 }
 async function flush(){
  if(requestBusy||!session||!outbox.length)return;
  requestBusy=true;
  try{
   while(outbox.length&&session){
    const item=outbox[0];
    if(item.kind==='start'){
     try{
      await rpc('student_attempt_start',{p_token:session.token,p_game:item.game,p_attempt:item.attempt,p_generation:item.generation});
     }catch(err){
      // Before the teacher installs the non-destructive SQL update, the
      // start-only RPC is unavailable. Do not block the existing score uploads.
      if(!/(Could not find the function|PGRST202|student_attempt_start.*schema cache)/i.test(String(err?.message||'')))throw err;
     }
    }else{
     await rpc('student_finish',{p_token:session.token,p_game:item.game,p_score:item.score,p_attempt:item.attempt,p_generation:item.generation});
    }
    outbox.shift();save();
   }
   void refreshBadge();if(top10Open)void top10Refresh();
  }catch(err){
   status('Emaitzak bidaltzeke; konexioa berreskuratzean berriro saiatuko da.',true);
  }finally{requestBusy=false}
 }
 window.HB_CLOUD={joined:false,configured,storageKey,change,leaderboard,started,partial,aborted,finished,refresh:refreshBadge,get session(){return session}};
 function init(){const panel=document.createElement('div');panel.id='hb37-ui';panel.innerHTML=`<button type="button" id="hb37-badge">🏆 Ikasgelara sartu</button><div id="hb37-veil" hidden><div class="hb37-card" role="dialog" aria-modal="true" aria-labelledby="hb37-title"><h2 id="hb37-title">🏭 HistoriaBizia · Ikasgela</h2><p>Idatzi ikasgelako kodea eta zure goitizena. Emaitzak beste ikasleekin partekatuko dira.</p><form id="hb37-form"><label>Ikasgelaren kodea <input name="code" maxlength="10" autocomplete="off" required placeholder="10 karakter"/></label><label>Goitizena <input name="nickname" maxlength="18" autocomplete="nickname" required placeholder="Adib. Izar24"/></label><button type="submit">▶ Ikasgelan sartu</button></form><p id="hb37-message" role="status"></p><small>Ez erabili benetako izen-abizenik. Irakasleak emandako esteka erabil dezakezu.</small><button type="button" class="hb37-close" id="hb37-close" hidden>Itxi</button></div></div><span id="hb37-summary" aria-live="polite"></span>`;
  document.body.append(panel);top10Mount();
  $('hb37-badge').onclick=()=>change();$('hb37-form').onsubmit=e=>{e.preventDefault();const f=e.target;void join(f.elements.code.value,f.elements.nickname.value)};
  $('hb37-close').onclick=()=>{if(session)veil(false)};
  if(!configured){status('Supabase konfigurazioa falta da.',true);change();return}
  let code=new URLSearchParams(location.search).get('klase')||'',saved=ps();
  if(code&&saved[code.toUpperCase()]){void join(code,saved[code.toUpperCase()].nickname,true)}
  else if(!code&&Object.keys(saved).length===1){const x=Object.values(saved)[0];void join(x.code,x.nickname,true)}
  else{change();}
  const f=$('hb37-form');if(f)f.elements.code.value=code.toUpperCase();
  setInterval(()=>{if(session&&!document.hidden){void flush();void refreshBadge()}},15000);
  setInterval(()=>{if(session&&lastGame&&!document.hidden)void progress('playing',true)},22000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else setTimeout(init,0);
})();
