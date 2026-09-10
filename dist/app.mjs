import {createGame,discard,respond,selfKong,winSelf,aiStep,legalActions,waits,TILE_NAMES,NAMES} from './engine.mjs';
const $=s=>document.querySelector(s);
let game=createGame(),selected=null,timer=null,sound=false,audio=null,resultShown=false;
function tileFace(t){
  let row,col;if(t<27){row=Math.floor(t/9)+1;col=t%9; if(col>=4)col++;}else{row=0;col=t-27;}
  return `background-position:${(31+57*col)/575*100}% ${(31+77*row)/291*100}%`;
}
function tile(t,{button=false,selected:sel=false,drawn=false,recent=false,hidden=false}={}){
  const tag=button?'button':'span',type=t.type;
  return `<${tag} class="tile${sel?' selected':''}${drawn?' drawn':''}${recent?' recent':''}" ${button?`data-tile="${t.id}" aria-pressed="${sel}"`:''} aria-label="${hidden?'暗牌':TILE_NAMES[type]}" title="${hidden?'暗牌':TILE_NAMES[type]}"><span class="face" style="${hidden?'background-position:84.695652% 10.652921%':tileFace(type)}"></span></${tag}>`;
}
function badge(seat){const p=game.players[seat],wind=['東','南','西','北'][(seat-game.dealer+4)%4];return `<div class="player-badge ${game.turn===seat&&game.phase!=='over'?'active':''}"><span class="avatar">${seat===0?'我':NAMES[seat].slice(-1)}</span><div><div class="player-name">${NAMES[seat]}<span class="seat-label">${wind}家</span>${seat===game.dealer?'<span class="dealer">莊</span>':''}</div><div class="score">${p.score>=0?'+':''}${p.score} 分</div></div></div>`;}
function melds(seat){return game.players[seat].melds.map(m=>`<div class="meld" title="${m.kind==='concealed'?'暗槓':m.kind==='chi'?'吃':m.kind==='pong'?'碰':'槓'}">${m.tiles.map((t,i)=>tile(t,{hidden:m.kind==='concealed'&&seat!==0&&game.phase!=='over'||m.kind==='concealed'&&(i===0||i===3)&&game.phase!=='over'})).join('')}</div>`).join('');}
function flowerLabel(p){return `<div class="flowers">${p.flowers.length?p.flowers.map(t=>TILE_NAMES[t.type]).join(' '):'無花'}</div>`;}
function render(){
  $('#round-label').textContent=`第 ${game.round} 局`;$('#wall-count').textContent=game.wall.length;
  for(let s=1;s<4;s++)$('#seat'+s).innerHTML=badge(s)+(game.phase==='over'?`<div class="opponent-melds">${game.players[s].hand.map(t=>tile(t)).join('')}</div>`:`<div class="backs" aria-label="${game.players[s].hand.length} 張暗牌">${'<span class="back"></span>'.repeat(game.players[s].hand.length)}</div>`)+`<div class="opponent-melds">${melds(s)}</div>`+flowerLabel(game.players[s]);
  for(let s=0;s<4;s++){$('#river'+s).innerHTML=game.players[s].discards.map(t=>tile(t,{recent:game.lastDiscard?.tile.id===t.id})).join('');const wind=document.querySelector(`[data-seat="${s}"]`);wind.textContent=['東','南','西','北'][(s-game.dealer+4)%4];wind.classList.toggle('active',s===game.turn&&game.phase!=='over');}
  $('#self-info').innerHTML=badge(0)+flowerLabel(game.players[0]);$('#self-melds').innerHTML=melds(0);
  const hand=game.players[0].hand,drawn=game.players[0].drawn;const ordered=[...hand.filter(t=>t.id!==drawn),...hand.filter(t=>t.id===drawn)];
  $('#hand').innerHTML=ordered.map(t=>tile(t,{button:game.phase==='discard'&&game.turn===0,selected:selected===t.id,drawn:t.id===drawn})).join('');
  const pending=game.pending;$('#last-play').textContent=game.phase==='response'?`${NAMES[pending.from]}${pending.rob?'加槓':'打出'} ${TILE_NAMES[pending.tile.type]}`:game.message;
  $('#status').textContent=game.phase==='over'?game.result.text:game.phase==='response'?`${NAMES[pending.from]}${pending.rob?'加槓':'打出'} ${TILE_NAMES[pending.tile.type]}，要接牌嗎？`:game.turn===0?'輪到你出牌':`${NAMES[game.turn]}正在想牌…`;
  $('#hand-tip').textContent=game.phase==='response'?'選擇吃碰槓胡，或按「過」繼續':game.phase==='over'?'本局結束，可查看四家手牌':game.turn===0?'點一下選牌，再按「打出」 · 雙擊直接出牌':'等候對手出牌';
  $('#waits').textContent=waits(game.players[0]).length?`聽牌：${waits(game.players[0]).map(t=>TILE_NAMES[t]).join('、')}`:'';
  $('#history').innerHTML=game.log.map(s=>`<li>${s}</li>`).join('');renderActions();
  if(game.phase==='over'&&!resultShown){resultShown=true;showResult();}
}
function renderActions(){const actions=legalActions(game);let html='';
  if(game.phase==='over'){html='<button class="primary" data-action="result">本局結算</button>';}
  else {
    for(const [index,a] of actions.entries()){
      let label=a.kind==='win'?(game.phase==='response'?'胡':'自摸'):a.kind==='kong'?`槓 ${TILE_NAMES[a.type]}`:a.kind==='pong'?'碰':a.kind==='pass'?'過':'吃';
      if(a.kind==='chi')label+=' '+a.sequence.map(type=>tile({type})).join('');
      html+=`<button class="action-button ${a.kind==='pass'?'secondary':''} ${a.kind==='chi'?'chi':''}" data-action-index="${index}">${label}</button>`;
    }
    if(game.phase==='discard'&&game.turn===0)html+=`<button class="primary" data-action="discard" ${selected===null?'disabled':''}>${selected===null?'請選一張牌':`打出 ${TILE_NAMES[game.players[0].hand.find(t=>t.id===selected)?.type]}`}</button>`;
  }$('#actions').innerHTML=html;
}
function tickSound(){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);osc.type='triangle';osc.frequency.setValueAtTime(650,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(180,audio.currentTime+.055);gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.09);osc.start();osc.stop(audio.currentTime+.1);}catch{sound=false;}}
function schedule(){clearTimeout(timer);if(game.phase==='discard'&&game.turn!==0&&!document.querySelector('dialog[open]'))timer=setTimeout(()=>act(()=>aiStep(game)),850);}
function act(fn){try{fn();selected=null;tickSound();render();schedule();}catch(err){$('#status').textContent=err.message;}}
function playSelected(){if(selected!==null)act(()=>discard(game,0,selected));}
$('#hand').addEventListener('click',e=>{const t=e.target.closest('[data-tile]');if(!t)return;selected=Number(t.dataset.tile);for(const b of $('#hand').querySelectorAll('[data-tile]')){const active=Number(b.dataset.tile)===selected;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}renderActions();});
// Keep the DOM stable between clicks so native dblclick dispatch is reliable.
$('#hand').addEventListener('dblclick',e=>{const t=e.target.closest('[data-tile]');if(t){selected=Number(t.dataset.tile);playSelected();}});
$('#actions').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.action==='discard')return playSelected();if(b.dataset.action==='result')return showResult();const a=legalActions(game)[Number(b.dataset.actionIndex)];if(!a)return;act(()=>{if(game.phase==='response')respond(game,a.kind,a.sequence);else if(a.kind==='win')winSelf(game,0);else if(a.kind==='kong')selfKong(game,0,a.type);});});
$('#hand').addEventListener('keydown',e=>{if(game.phase!=='discard'||game.turn!==0)return;const buttons=[...$('#hand').querySelectorAll('[data-tile]')];if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const idx=buttons.findIndex(b=>Number(b.dataset.tile)===selected),next=buttons[(Math.max(idx,0)+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];selected=Number(next.dataset.tile);render();document.querySelector(`[data-tile="${selected}"]`)?.focus({preventScroll:true});}else if(e.key==='Enter'&&selected!==null){e.preventDefault();playSelected();}});
function openDialog(id){clearTimeout(timer);$(id).showModal();}
$('#rules-button').onclick=()=>openDialog('#rules');$('#restart').onclick=()=>openDialog('#restart-dialog');
for(const b of document.querySelectorAll('.close-dialog'))b.onclick=()=>b.closest('dialog').close();
for(const d of document.querySelectorAll('dialog'))d.addEventListener('close',schedule);
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent=`音效 ${sound?'開':'關'}`;$('#sound').setAttribute('aria-label',sound?'關閉音效':'開啟音效');tickSound();};
function showResult(){const r=game.result;$('#result-title').textContent=r.text;$('#result-note').textContent=r.kind==='draw'?'牌牆保留 16 張，四家積分不變。':r.self?'三家各付 100 分。本版採固定練習積分，不計台數。':`${NAMES[r.from]}${r.rob?'被搶槓':'放銃'}，付每位胡牌者 100 分。`;
  $('#winning-hands').innerHTML=r.winners.map(s=>`<div class="winning-label">${NAMES[s]}的胡牌</div><div class="result-hand">${game.players[s].melds.flatMap(m=>m.tiles).map(t=>tile(t)).join('')}${game.players[s].hand.map(t=>tile(t)).join('')}${!r.self&&r.tile?tile(r.tile,{recent:true}):''}</div>`).join('');
  $('#scoreboard').innerHTML=game.players.map((p,i)=>`<div class="score-row"><span>${p.name}</span><span class="${r.deltas[i]>=0?'positive':'negative'}">本局 ${r.deltas[i]>0?'+':''}${r.deltas[i]}</span><span>累計 ${p.score>0?'+':''}${p.score}</span></div>`).join('');if(!$('#result').open)openDialog('#result');}
$('#review-table').onclick=()=>$('#result').close();
$('#next-round').onclick=()=>{$('#result').close();act(()=>{game=createGame(Date.now(),game);resultShown=false;});};
$('#confirm-restart').onclick=()=>{$('#restart-dialog').close();act(()=>{game=createGame();resultShown=false;});};
render();schedule();
// Optional browser agent tools: expose only public table state and legal human actions.
const toolContext=document.modelContext;
if(toolContext?.registerTool){
  try{Promise.resolve(toolContext.registerTool({name:'read_mahjong_table',description:'Read your mahjong hand, public discards and available actions. Opponent hands remain hidden.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:async()=>({content:[{type:'text',text:JSON.stringify({phase:game.phase,turn:game.turn,hand:game.players[0].hand.map(t=>({...t,name:TILE_NAMES[t.type]})),players:game.players.map(p=>({name:p.name,score:p.score,discards:p.discards,melds:p.melds.filter(m=>m.kind!=='concealed'),flowers:p.flowers})),actions:legalActions(game)})}]})})).catch(()=>{});}catch{}
}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).then(()=>{$('#offline-status').textContent='已備妥離線快取 · 本機運算';}).catch(()=>{});
