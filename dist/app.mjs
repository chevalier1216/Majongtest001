import {createGame,completeOpening,declareReady,discard,respond,selfKong,winSelf,aiStep,legalActions,waits,TILE_NAMES,NAMES,canDiscard,seatWind,roundLabel} from './engine.mjs';
import {flowerItems,WINDS,FLOWERS,TAI_TABLE,BASE,PER_TAI} from './scoring.mjs';
const $=s=>document.querySelector(s);
let game=createGame(Date.now(),null,{opening:true}),selected=null,timer=null,sound=false,audio=null,resultShown=false,animating=false,eventTimer=null,openingTimer=null;
function tileFace(t){
  let row,col;if(t<27){row=Math.floor(t/9)+1;col=t%9; if(col>=4)col++;}else{row=0;col=t-27;}
  return `background-position:${(31+57*col)/575*100}% ${(31+77*row)/291*100}%`;
}
function tile(t,{button=false,selected:sel=false,drawn=false,recent=false,hidden=false,operable=false}={}){
  const tag=button?'button':'span',type=t.type;
  const face=hidden?'<span class="face" style="background-position:84.695652% 10.652921%"></span>':type>=34?`<span class="face flower-face ${type>=38?'flower-plant':'flower-season'}" style="background-position:${['春','夏','秋','冬','梅','蘭','菊','竹'].indexOf(TILE_NAMES[type])%4*100/3}% ${type>=38?100:0}%"><span class="flower-name">${TILE_NAMES[type]}</span><small>${(type-34)%4+1}</small></span>`:`<span class="face" style="${tileFace(type)}"></span>`;
  return `<${tag} class="tile${type>=34&&!hidden?' flower-tile':''}${button&&!operable?' is-muted':''}${sel?' selected':''}${drawn?' drawn':''}${recent?' recent':''}" ${button?`data-tile="${t.id}" aria-pressed="${sel}" ${operable?'':'disabled aria-disabled="true"'}`:''} aria-label="${hidden?'暗牌':TILE_NAMES[type]}" title="${hidden?'暗牌':TILE_NAMES[type]}">${face}</${tag}>`;
}
function badge(seat){const p=game.players[seat],wind=WINDS[seatWind(game,seat)];return `<div class="player-badge ${game.turn===seat&&game.phase!=='over'?'active':''}"><span class="avatar">${seat===0?'我':NAMES[seat].slice(-1)}</span><div><div class="player-name">${NAMES[seat]}<span class="seat-label">${wind}家</span>${seat===game.dealer?'<span class="dealer">莊</span>':''}${p.ready?'<span class="ready-badge">聽</span>':''}</div><div class="score">${p.score.toLocaleString()} 分</div></div></div>`;}
function melds(seat){return game.players[seat].melds.map(m=>`<div class="meld" title="${m.kind==='concealed'?'暗槓':m.kind==='chi'?'吃':m.kind==='pong'?'碰':'槓'}">${m.tiles.map((t,i)=>tile(t,{hidden:m.kind==='concealed'&&seat!==0&&game.phase!=='over'||m.kind==='concealed'&&(i===0||i===3)&&game.phase!=='over'})).join('')}</div>`).join('');}
function publicTiles(seat){const p=game.players[seat],items=flowerItems(game,seat),tai=items.reduce((n,x)=>n+x.tai,0);return (p.melds.length?`<div class="meld-run" style="--meld-tiles:${p.melds.reduce((n,m)=>n+m.tiles.length,0)};--meld-groups:${p.melds.length}" aria-label="吃碰槓明牌">${melds(seat)}</div>`:'')+(p.flowers.length?`<div class="meld flower-meld" style="--flower-count:${p.flowers.length}" title="補花：${p.flowers.map(t=>TILE_NAMES[t.type]).join('、')}">${p.flowers.map(t=>tile(t)).join('')}<span class="flower-tai" title="${items.map(x=>`${x.name} ${x.tai}台`).join('、')||'目前無花台'}">花 ${tai} 台</span></div>`:'');}
function flowerLabel(seat){const wind=seatWind(game,seat);return `<div class="flower-target">正花：${FLOWERS[wind]}・${FLOWERS[wind+4]}</div>`;}

function render(){
  $('#restart').disabled=animating||game.phase==='opening';
  $('#round-label').textContent=roundLabel(game);$('#dealer-run').textContent=`${WINDS[seatWind(game,0)]}家是你 · ${game.streak?`連莊 ${game.streak}（莊台 ${1+2*game.streak}）`:'莊台 1'}`;$('#wall-count').textContent=game.wall.length;
  for(let s=1;s<4;s++){const hand=game.phase==='over'?`<div class="revealed-hand">${game.players[s].hand.map(t=>tile(t)).join('')}</div>`:`<div class="backs" aria-label="${game.players[s].hand.length} 張暗牌">${'<span class="back"></span>'.repeat(game.players[s].hand.length)}</div>`;$('#seat'+s).innerHTML=badge(s)+`<div class="opponent-zones">${hand}<div class="opponent-melds">${publicTiles(s)}</div></div>`+flowerLabel(s);}
  for(let s=0;s<4;s++){$('#river'+s).innerHTML=game.players[s].discards.map(t=>tile(t,{recent:game.lastDiscard?.tile.id===t.id})).join('');const wind=document.querySelector(`[data-seat="${s}"]`);wind.textContent=['東','南','西','北'][(s-game.dealer+4)%4];wind.classList.toggle('active',s===game.turn&&game.phase!=='over');}
  $('#self-info').innerHTML=badge(0)+flowerLabel(0);$('#self-melds').innerHTML=publicTiles(0);
  const hand=game.players[0].hand,drawn=game.players[0].drawn;const ordered=[...hand.filter(t=>t.id!==drawn),...hand.filter(t=>t.id===drawn)];
  $('#hand').innerHTML=ordered.map(t=>tile(t,{button:true,operable:!animating&&canDiscard(game,0,t.id),selected:selected===t.id,drawn:t.id===drawn})).join('');
  const pending=game.pending;$('#last-play').textContent=game.phase==='response'?`${NAMES[pending.from]}${pending.rob?'加槓':'打出'} ${TILE_NAMES[pending.tile.type]}`:game.message;
  $('#status').textContent=game.phase==='opening'?'擲骰定抓位，兩秒後發牌':game.phase==='over'?game.result.text:game.phase==='response'?`${NAMES[pending.from]}${pending.rob?'加槓':'打出'} ${TILE_NAMES[pending.tile.type]}，要接牌嗎？`:game.turn===0?(game.players[0].ready?'已宣告聽牌：可胡牌或打出新摸的牌':'輪到你出牌'):`${NAMES[game.turn]}正在想牌…`;
  $('#hand-tip').textContent=game.phase==='opening'?'東家先抓牌，再依序南、西、北家':game.phase==='response'?(game.players[0].ready?'已聽牌，選擇胡牌或「過」':'選擇吃碰槓胡，或按「過」繼續'):game.phase==='over'?'本局結束，可查看四家手牌':game.players[0].ready?'已鎖定手牌 · 胡牌加 1 台 · 僅新摸的牌可打出':game.turn===0?(game.players[0].banned.length?`吃後本巡禁打：${game.players[0].banned.map(t=>TILE_NAMES[t]).join('、')}（較淡的牌）`:'點一下選牌，再按「打出」 · 可聽牌時，選牌後按「宣告聽牌」'):'等候對手出牌';
  renderWaits();
  $('#history').innerHTML=game.log.map(s=>`<li>${s}</li>`).join('');renderActions();
  if(game.phase==='over'&&!resultShown&&!animating){resultShown=true;showResult();}
}
function renderWaits(){const p=game.players[0],choice=legalActions(game).find(a=>a.kind==='ready')?.discards.find(o=>o.id===selected),list=p.ready?p.readyWaits:choice?.waits||waits(p);$('#waits').textContent=list.length?`${p.ready?'已宣告聽牌（＋1 台）':choice?'打出後可聽':'聽牌'}：${list.map(t=>TILE_NAMES[t]).join('、')}`:'';}
function renderActions(){renderWaits();const response=game.phase==='response'&&!animating,panel=$('#reaction-panel');panel.hidden=!response;$('#reaction-actions').innerHTML='';$('#reaction-message').textContent=response?`${NAMES[game.pending.from]}${game.pending.rob?'加槓':'打出'} ${TILE_NAMES[game.pending.tile.type]}，要接牌嗎？`:'';if(game.phase==='opening'){$('#actions').innerHTML='<span class="action-pause">擲骰中…</span>';return;}if(animating){$('#actions').innerHTML='<span class="action-pause">動作提示中…</span>';return;}const actions=legalActions(game);let html='';
  if(game.phase==='over'){html='<button class="primary" data-action="result">本局結算</button>';}
  else {
    for(const [index,a] of actions.entries()){
      if(a.kind==='ready'){const valid=a.discards.some(o=>o.id===selected);html+=`<button class="action-button ready-action" data-action-index="${index}" ${valid?'':'disabled'} title="先選一張打出後能聽牌的牌；宣告後不能更換手牌">宣告聽牌 ＋1台</button>`;continue;}
      let label=a.kind==='win'?(game.phase==='response'?'胡':'自摸'):a.kind==='kong'?`槓 ${TILE_NAMES[a.type]}`:a.kind==='pong'?'碰':a.kind==='pass'?'過':'吃';
      if(a.kind==='chi')label+=' '+a.sequence.map(type=>tile({type},{operable:true})).join('');
      html+=`<button class="action-button ${a.kind==='pass'?'secondary':''} ${a.kind==='chi'?'chi':''}" data-action-index="${index}">${label}</button>`;
    }
    if(game.phase==='discard'&&game.turn===0)html+=`<button class="primary" data-action="discard" ${selected===null||!canDiscard(game,0,selected)?'disabled':''}>${selected===null?'請選一張牌':`打出 ${TILE_NAMES[game.players[0].hand.find(t=>t.id===selected)?.type]}`}</button>`;
  }if(response){$('#actions').innerHTML='';$('#reaction-actions').innerHTML=html;}else $('#actions').innerHTML=html;
}
function tickSound(){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);osc.type='triangle';osc.frequency.setValueAtTime(650,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(180,audio.currentTime+.055);gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.09);osc.start();osc.stop(audio.currentTime+.1);}catch{sound=false;}}
function schedule(){clearTimeout(timer);if(!animating&&game.phase==='discard'&&game.turn!==0&&!document.querySelector('dialog[open]'))timer=setTimeout(()=>act(()=>aiStep(game)),850);}
function startOpening(){
 clearTimeout(timer);clearTimeout(eventTimer);clearTimeout(openingTimer);animating=false;selected=null;$('#call-notice').hidden=true;
 const openingGame=game,{dice,total,wallSeat,firstDeal}=game.opening,notice=$('#opening-notice');
 notice.hidden=false;notice.innerHTML=`<span class="eyebrow">開局擲骰</span><div class="dice-row" aria-label="三顆骰子：${dice.join('、')}，合計 ${total} 點">${dice.map(n=>`<span class="die die-${n}" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="${({1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]})[n].includes(i)?'pip':''}"></i>`).join('')}</span>`).join('')}</div><strong>${total} 點 · ${NAMES[game.dealer]}先抓牌</strong><p>${NAMES[game.dealer]}為東家（莊家）<br>取牌牌牆：${NAMES[wallSeat]}・${WINDS[seatWind(game,wallSeat)]}家</p><small>${firstDeal?'首局由你起算，逆時針數點定東家':'由本局莊家起算，逆時針數點定取牌牌牆'}</small>`;
 render();openingTimer=setTimeout(()=>{openingTimer=null;if(game!==openingGame||game.phase!=='opening')return;notice.hidden=true;completeOpening(game);render();schedule();},2000);
}
function playEvents(events){
 clearTimeout(timer);animating=true;render();
 const next=()=>{
  const event=events.shift();if(!event){animating=false;$('#call-notice').hidden=true;render();schedule();return;}
  const labels={chi:'吃',pong:'碰',kong:'明槓','concealed-kong':'暗槓','added-kong':'加槓',flower:'補花',ready:'聽牌',win:'胡牌','self-win':'自摸'};
  const notice=$('#call-notice');notice.hidden=false;
  notice.innerHTML=`<div class="call-card"><span class="call-player">${NAMES[event.seat]}</span><strong>${labels[event.kind]}</strong><div class="call-tiles">${event.tile===null||event.tile===undefined?'':(event.sequence||[event.tile]).map(type=>tile({type})).join('')}</div><p>${event.from!==null&&event.from!==event.seat?`接走${NAMES[event.from]}的 ${TILE_NAMES[event.tile]}`:event.kind==='ready'?'已鎖手 · 胡牌加 1 台':event.kind==='flower'?'亮花後從牌尾補牌':event.kind.includes('kong')?'槓牌後從牌尾補牌':''}</p></div>`;
  eventTimer=setTimeout(next,1400);
 };next();
}
function act(fn){if(animating||game.phase==='opening')return;try{fn();selected=null;tickSound();if(game.phase==='opening'){startOpening();return;}const events=game.events.splice(0);if(events.length)playEvents(events);else{render();schedule();}}catch(err){$('#status').textContent=err.message;}}
function playSelected(){if(!animating&&selected!==null&&canDiscard(game,0,selected))act(()=>discard(game,0,selected));}
$('#hand').addEventListener('click',e=>{const t=e.target.closest('[data-tile]');if(!t||t.disabled||animating)return;selected=Number(t.dataset.tile);for(const b of $('#hand').querySelectorAll('[data-tile]')){const active=Number(b.dataset.tile)===selected;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}renderActions();});
// Keep the DOM stable between clicks so native dblclick dispatch is reliable.
$('#hand').addEventListener('dblclick',e=>{const t=e.target.closest('[data-tile]');if(t&&!t.disabled&&!animating){selected=Number(t.dataset.tile);playSelected();}});
function handleAction(e){const b=e.target.closest('button');if(!b||b.disabled||animating)return;if(b.dataset.action==='discard')return playSelected();if(b.dataset.action==='result')return showResult();const a=legalActions(game)[Number(b.dataset.actionIndex)];if(!a)return;act(()=>{if(game.phase==='response')respond(game,a.kind,a.sequence);else if(a.kind==='win')winSelf(game,0);else if(a.kind==='kong')selfKong(game,0,a.type);else if(a.kind==='ready')declareReady(game,0,selected);});}
$('#actions').addEventListener('click',handleAction);$('#reaction-actions').addEventListener('click',handleAction);
$('#hand').addEventListener('keydown',e=>{if(animating||game.phase!=='discard'||game.turn!==0)return;const buttons=[...$('#hand').querySelectorAll('[data-tile]:not(:disabled)')];if(!buttons.length)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const idx=buttons.findIndex(b=>Number(b.dataset.tile)===selected),next=buttons[(Math.max(idx,0)+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];selected=Number(next.dataset.tile);render();document.querySelector(`[data-tile="${selected}"]`)?.focus({preventScroll:true});}else if(e.key==='Enter'&&selected!==null){e.preventDefault();playSelected();}});
function openDialog(id){clearTimeout(timer);$(id).showModal();}
$('#rules-button').onclick=()=>openDialog('#rules');$('#restart').onclick=()=>openDialog('#restart-dialog');
for(const b of document.querySelectorAll('.close-dialog'))b.onclick=()=>b.closest('dialog').close();
for(const d of document.querySelectorAll('dialog'))d.addEventListener('close',schedule);
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=`音效 ${sound?'開':'關'}`;$('#sound').setAttribute('aria-label',sound?'關閉音效':'開啟音效');tickSound();};
function showResult(){const r=game.result;
 $('#result-title').textContent=game.matchEndReason==='bankruptcy'?'籌碼低於零 · 牌局結束':r.text+(game.matchOver?' · 本將結束':'');
 $('#result-note').textContent=`${roundLabel(game)} · 底 ${BASE.toLocaleString()}／台 ${PER_TAI.toLocaleString()}。`+(r.kind==='draw'?'流局，積分不變，莊家續莊。':r.self?'自摸三家分別付款，莊家加台依付款對象計算。':`${NAMES[r.from]}${r.rob?'被搶槓':'放銃'}，依各胡牌者台數付款。`);
 $('#winning-hands').innerHTML=r.winners.map(s=>`<div class="winning-label">${NAMES[s]}（${WINDS[seatWind(game,s)]}家）・牌型 ${r.scores[s].tai} 台</div><div class="result-hand">${game.players[s].melds.flatMap(m=>m.tiles).map(t=>tile(t)).join('')}${game.players[s].hand.map(t=>tile(t)).join('')}${!r.self&&r.tile?tile(r.tile,{recent:true}):''}</div><div class="tai-items">${r.scores[s].items.map(x=>`<span>${x.name}<b>${x.tai} 台</b></span>`).join('')||'<span>無加台牌型<b>0 台</b></span>'}</div>`).join('');
 $('#payment-breakdown').innerHTML=(r.payments||[]).map(p=>`<div class="payment-row"><strong>${NAMES[p.payer]} → ${NAMES[p.winner]}</strong><span>${p.items.filter(x=>x.name.startsWith('莊家')).map(x=>`${x.name} ＋${x.tai} 台`).join('')||'不含莊家加台'}</span><b>${p.base.toLocaleString()} ＋ ${p.tai} 台 × ${p.perTai} ＝ ${p.amount.toLocaleString()} 分</b></div>`).join('');
 $('#ranking-heading').textContent=game.matchOver?'最終點數排名':'本局積分';
 $('#match-end-note').hidden=!game.matchOver;$('#match-end-note').textContent=game.matchEndReason==='bankruptcy'?`${game.players.filter(p=>p.score<0).map(p=>p.name).join('、')}的籌碼已低於零。所有付款結算完成，本桌停止續局。`:'北風北局莊家下莊，本將結束。';
 const rows=game.matchOver?r.rankings:game.players.map((p,seat)=>({...p,seat}));
 $('#scoreboard').innerHTML=rows.map(p=>`<div class="score-row${p.score<0?' bankrupt':''}"><span>${game.matchOver?`<b class="rank">${p.rank}</b> `:''}${p.name}</span><span class="${r.deltas[p.seat]>=0?'positive':'negative'}">本局 ${r.deltas[p.seat]>0?'+':''}${r.deltas[p.seat].toLocaleString()}</span><span>持有 ${p.score.toLocaleString()}</span></div>`).join('');
 $('#next-round').textContent=game.matchOver?'開始新的一將（積分重置）':'下一局';
 if(!$('#result').open)openDialog('#result');}

$('#review-table').onclick=()=>$('#result').close();
$('#next-round').onclick=()=>{$('#result').close();act(()=>{game=createGame(Date.now(),game.matchOver?null:game,{opening:true});resultShown=false;});};
$('#confirm-restart').onclick=()=>{$('#restart-dialog').close();act(()=>{game=createGame(Date.now(),null,{opening:true});resultShown=false;});};
$('#tai-table').innerHTML=TAI_TABLE.map(([name,tai])=>`<tr><td>${name}</td><td>${tai}</td></tr>`).join('');
startOpening();
// Optional browser agent tools: expose only public table state and legal human actions.
const toolContext=document.modelContext;
if(toolContext?.registerTool){
  try{Promise.resolve(toolContext.registerTool({name:'read_mahjong_table',description:'Read your mahjong hand, public discards and available actions. Opponent hands remain hidden.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:async()=>({content:[{type:'text',text:JSON.stringify({phase:game.phase,turn:game.turn,hand:game.players[0].hand.map(t=>({...t,name:TILE_NAMES[t.type]})),players:game.players.map(p=>({name:p.name,score:p.score,discards:p.discards,melds:p.melds.filter(m=>m.kind!=='concealed'),flowers:p.flowers})),actions:legalActions(game)})}]})})).catch(()=>{});}catch{}
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('#offline-status').textContent='已備妥離線快取 · 本機運算';}).catch(()=>{});
