import {scoreHand,paymentFor,STARTING_SCORE,WINDS} from './scoring.mjs';
// Pure, deterministic Taiwan 16-tile table engine. No network or UI dependencies.
export const NAMES=['你','阿青','小梅','老陳'];
export const TILE_NAMES=[...Array.from({length:9},(_,i)=>`${i+1}萬`),...Array.from({length:9},(_,i)=>`${i+1}索`),...Array.from({length:9},(_,i)=>`${i+1}筒`),'東','南','西','北','白','發','中','春','夏','秋','冬','梅','蘭','竹','菊'];
const sort=p=>p.hand.sort((a,b)=>a.type-b.type||a.id-b.id);
const types=p=>p.hand.map(t=>t.type);
const count=(p,t)=>p.hand.filter(x=>x.type===t).length;
const requireThat=(ok,msg='目前不能執行這個動作')=>{if(!ok)throw new Error(msg);};
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function isWinning(hand,meldCount=0){
  if(hand.length!==17-3*meldCount||hand.some(t=>t<0||t>33))return false;
  const c=Array(34).fill(0);for(const t of hand)if(++c[t]>4)return false;
  function sets(){const i=c.findIndex(n=>n>0);if(i<0)return true;
    if(c[i]>=3){c[i]-=3;if(sets()){c[i]+=3;return true;}c[i]+=3;}
    if(i<27&&i%9<=6&&c[i+1]&&c[i+2]){c[i]--;c[i+1]--;c[i+2]--;const ok=sets();c[i]++;c[i+1]++;c[i+2]++;if(ok)return true;}return false;
  }
  for(let i=0;i<34;i++)if(c[i]>=2){c[i]-=2;const ok=sets();c[i]+=2;if(ok)return true;}return false;
}
export function allTiles(g){return [...g.wall,...g.players.flatMap(p=>[...p.hand,...p.flowers,...p.discards,...p.melds.flatMap(m=>m.tiles)])];}
function emit(g,kind,seat,tile=null,from=null,sequence=null){g.events.push({kind,seat,tile,from,sequence});}
export const seatWind=(g,seat)=>(seat-g.dealer+4)%4;
export const roundLabel=g=>`${WINDS[Math.floor(g.handNumber/4)]}風${WINDS[g.handNumber%4]}局`;
export function chiBan(sequence,called){const banned=[called],start=sequence[0];if(called===start&&start%9<6)banned.push(start+3);if(called===start+2&&start%9>0)banned.push(start-1);return banned;}
export function canDiscard(g,seat,id){const p=g.players[seat],t=p.hand.find(t=>t.id===id);return g.phase==='discard'&&g.turn===seat&&!!t&&(!p.ready||id===p.drawn)&&!(p.banned||[]).includes(t.type);}
function log(g,s){g.log.unshift(s);g.log=g.log.slice(0,60);g.message=s;}
function endDraw(g){g.phase='over';g.result={kind:'draw',winners:[],text:'流局 · 本局無人胡牌',deltas:[0,0,0,0]};log(g,'牌牆剩 16 張，本局流局。');}
function take(g,seat,back=false,initial=false){
  const p=g.players[seat];p.banned=[];p.drawSource=back?'kong':'wall';
  while(g.wall.length>(initial?0:16)){
    const tile=back?g.wall.pop():g.wall.shift();
    if(tile.type>=34){p.flowers.push(tile);back=true;if(!initial){p.drawSource='flower';emit(g,'flower',seat,tile.type);log(g,`${NAMES[seat]}補花 · ${TILE_NAMES[tile.type]}`);}continue;}
    p.hand.push(tile);sort(p);p.drawn=tile.id;p.passedWin=false;if(!initial)p.drawCount++;return true;
  }endDraw(g);return false;
}
// The UI defers the deal until its two-second dice display has completed.
// Headless callers can still start an immediately playable, deterministic deal.
export function createGame(seed=Date.now(),previous=null,{opening=false}={}){
  requireThat(!previous?.matchOver,'本將已結束，請重新開桌');
  const retained=previous&&(previous.result?.kind==='draw'||previous.result?.winners.includes(previous.dealer));
  const handNumber=previous?previous.handNumber+(retained?0:1):0;
  const diceRandom=rng(seed^0x1D1CE),dice=Array.from({length:3},()=>1+Math.floor(diceRandom()*6)),total=dice.reduce((a,b)=>a+b,0);
  const dealer=previous?(retained?previous.dealer:(previous.dealer+1)%4):opening?(total-1)%4:0;
  const wallSeat=previous?(dealer+total-1)%4:dealer;
  const g={seed,dealer,handNumber,streak:retained?previous.streak+1:0,matchOver:false,matchEndReason:null,opening:opening?{dice,total,wallSeat,firstDeal:!previous}:null,events:[],discardCount:0,totalCalls:0,round:previous?previous.round+1:1,turn:dealer,phase:'opening',wall:[],players:NAMES.map((name,i)=>({name,hand:[],melds:[],flowers:[],discards:[],score:previous?.players[i].score??STARTING_SCORE,drawn:null,passedWin:false,banned:[],drawCount:0,drawSource:null,kongChain:null,ready:false,readyWaits:[]})),log:[],pending:null,result:null,lastDiscard:null};
  let id=0;for(let t=0;t<42;t++)for(let j=0;j<(t<34?4:1);j++)g.wall.push({id:id++,type:t});
  const random=rng(seed);for(let i=g.wall.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[g.wall[i],g.wall[j]]=[g.wall[j],g.wall[i]];}
  if(opening){const cut=(wallSeat*36+total*2)%144;g.wall.push(...g.wall.splice(0,cut));log(g,`擲骰 ${dice.join('＋')}＝${total} · ${NAMES[dealer]}為東家先抓牌，從${NAMES[wallSeat]}的牌牆取牌`);}
  else completeOpening(g);
  return g;
}
export function completeOpening(g){
  requireThat(g.phase==='opening','本局已完成擲骰發牌');
  for(let j=0;j<16;j++)for(let d=0;d<4;d++)take(g,(g.dealer+d)%4,false,true);
  take(g,g.dealer,false,true);for(let i=0;i<4;i++)if(i!==g.dealer)g.players[i].drawn=null;
  g.phase='discard';g.turn=g.dealer;
  log(g,`${roundLabel(g)} · ${NAMES[g.dealer]}坐莊${g.streak?`・連莊 ${g.streak}`:''}`);
}
export function chiOptions(p,t){
  if(t>=27)return[];const result=[];
  for(let start=t-2;start<=t;start++)if(start>=0&&Math.floor(start/9)===Math.floor(t/9)&&start%9<=6){const sequence=[start,start+1,start+2],needed=sequence.filter(x=>x!==t);if(needed.every(x=>count(p,x)>0)){const remaining=p.hand.map(x=>x.type);for(const t of needed)remaining.splice(remaining.indexOf(t),1);if(remaining.some(x=>!chiBan(sequence,t).includes(x)))result.push(sequence);}}
  return result;
}
function offers(g,from,t,rob=false){
  const list=[];for(let d=1;d<4;d++){
    const seat=(from+d)%4,p=g.players[seat];
    if(!p.passedWin&&isWinning([...types(p),t],p.melds.length))list.push({seat,kind:'win',rank:3});
    if(rob||p.ready)continue;
    if(d!==1&&count(p,t)>=3&&g.wall.length>16)list.push({seat,kind:'kong',rank:2,type:t});
    if(count(p,t)>=2)list.push({seat,kind:'pong',rank:2,type:t});
    if(d===1)for(const sequence of chiOptions(p,t))list.push({seat,kind:'chi',rank:1,sequence});
  }return list;
}
export function legalActions(g){
  if(g.phase==='response')return [...g.pending.offers.filter(o=>o.seat===0),{kind:'pass'}];
  if(g.phase!=='discard'||g.turn!==0)return[];
  const p=g.players[0],a=[];if(canWinSelf(p))a.push({kind:'win'});
  if(!p.ready&&p.drawn!==null&&g.wall.length>16)for(let t=0;t<34;t++)if(count(p,t)===4||p.melds.some(m=>m.kind==='pong'&&m.tiles[0].type===t)&&count(p,t))a.push({kind:'kong',type:t});
  const choices=readyDiscards(g,0);if(choices.length)a.push({kind:'ready',discards:choices});return a;
}
function canWinSelf(p){return p.drawn!==null&&p.kongChain!=='needs-followup'&&isWinning(types(p),p.melds.length);}
function finish(g,winners,from,self=false,rob=false){
  const tile=self?g.players[winners[0]].hand.find(t=>t.id===g.players[winners[0]].drawn):g.pending?.tile;
  const deltas=[0,0,0,0],scores={},payments=[];
  for(const w of winners){scores[w]=scoreHand(g,w,{self,rob,tile});for(const payer of self?[0,1,2,3].filter(s=>s!==w):[from]){const payment=paymentFor(g,w,payer,scores[w]);payments.push(payment);deltas[payer]-=payment.amount;deltas[w]+=payment.amount;}}
  for(let s=0;s<4;s++)g.players[s].score+=deltas[s];
  g.matchEndReason=g.players.some(p=>p.score<0)?'bankruptcy':g.handNumber===15&&!winners.includes(g.dealer)?'round-limit':null;
  g.matchOver=!!g.matchEndReason;
  const rankings=g.players.map((p,seat)=>({seat,name:p.name,score:p.score})).sort((a,b)=>b.score-a.score||a.seat-b.seat);
  for(let i=0;i<rankings.length;i++)rankings[i].rank=i&&rankings[i].score===rankings[i-1].score?rankings[i-1].rank:i+1;
  g.result={kind:'win',winners,from,self,rob,deltas,tile,scores,payments,rankings,text:`${winners.map(w=>NAMES[w]).join('、')}${self?'自摸':rob?'搶槓胡':'胡牌'}`};g.phase='over';emit(g,self?'self-win':'win',winners[0],tile?.type,from);log(g,g.result.text);
}
function advance(g,from){g.pending=null;g.turn=(from+1)%4;g.phase='discard';if(take(g,g.turn))log(g,`${NAMES[g.turn]}摸牌`);}
function remove(p,t,n){const out=[];for(let i=0;i<n;i++){const at=p.hand.findIndex(x=>x.type===t);requireThat(at>=0);out.push(...p.hand.splice(at,1));}return out;}
export function readyDiscards(g,seat=0){
  const p=g.players[seat];if(g.phase!=='discard'||g.turn!==seat||p.ready)return[];
  return p.hand.filter(t=>canDiscard(g,seat,t.id)).map(t=>({id:t.id,waits:waits({...p,hand:p.hand.filter(x=>x.id!==t.id)})})).filter(o=>o.waits.length);
}
export function declareReady(g,seat,id){discard(g,seat,id,true);}
export function discard(g,seat,id,declaringReady=false){
  requireThat(canDiscard(g,seat,id),'這張牌目前不能打出（聽牌鎖手、吃後禁打或非你的回合）');const p=g.players[seat],idx=p.hand.findIndex(t=>t.id===id);requireThat(idx>=0);
  const declaration=declaringReady?readyDiscards(g,seat).find(o=>o.id===id):null;
  requireThat(!declaringReady||declaration,'打出這張牌後沒有聽牌，不能宣告聽牌');
  const [tile]=p.hand.splice(idx,1);p.drawn=null;p.banned=[];p.kongChain=null;g.discardCount++;p.discards.push(tile);g.lastDiscard={seat,tile};log(g,`${NAMES[seat]}打出 ${TILE_NAMES[tile.type]}`);
  if(declaration){p.ready=true;p.readyWaits=declaration.waits;emit(g,'ready',seat,tile.type);log(g,`${NAMES[seat]}宣告聽牌 · 打出 ${TILE_NAMES[tile.type]}，胡牌加 1 台`);}
  const reactionOffers=offers(g,seat,tile.type);
  g.pending={from:seat,tile,offers:reactionOffers,rob:false,kongOfferSeats:reactionOffers.filter(o=>o.kind==='kong').map(o=>o.seat)};queueResponse(g);
}
function queueResponse(g){
  const pending=g.pending;
  pending.ai=[1,2,3].map(seat=>aiChoice(g,seat,pending.offers.filter(o=>o.seat===seat))).filter(Boolean);
  const distance=seat=>(seat-pending.from+4)%4;
  pending.offers=pending.offers.filter(o=>o.seat!==0||!pending.ai.some(a=>a.rank>o.rank||(a.rank===o.rank&&o.kind!=='win'&&distance(a.seat)<distance(0))));
  if(pending.offers.some(o=>o.seat===0)){g.phase='response';return;}
  resolve(g,null);
}
function aiChoice(g,seat,options){
  const win=options.find(o=>o.kind==='win');if(win)return win;
  const kong=options.find(o=>o.kind==='kong');if(kong)return kong;
  const p=g.players[seat],baseline=handValue(types(p));
  let best=null,bestValue=baseline;
  for(const o of options){if(o.kind==='win')continue;const hand=types(p),needed=o.kind==='pong'?[g.pending.tile.type,g.pending.tile.type]:o.sequence.filter(t=>t!==g.pending.tile.type);for(const t of needed)hand.splice(hand.indexOf(t),1);
    const value=handValue(hand)+9;
    if(value>bestValue){bestValue=value;best=o;}
  }return best;
}
function resolve(g,human){
  const pending=g.pending,{from,tile}=pending;const chosen=[];
  for(let d=1;d<4;d++){const seat=(from+d)%4,opts=pending.offers.filter(o=>o.seat===seat),choice=seat===0?human:pending.ai.find(o=>o.seat===seat);if(choice)chosen.push(choice);}
  const wins=chosen.filter(o=>o.kind==='win');if(wins.length){const robbed=pending.rob||(pending.kongOfferSeats||[]).some(seat=>!wins.some(w=>w.seat===seat));finish(g,wins.map(o=>o.seat),from,false,robbed);return;}
  if(pending.rob){completeSelfKong(g,from,tile.type,pending.kongKind);return;}
  chosen.sort((a,b)=>b.rank-a.rank);const chosenAction=chosen[0];if(!chosenAction){advance(g,from);return;}
  const {seat,kind,sequence}=chosenAction,p=g.players[seat];
  g.players[from].discards.pop();const own=kind==='chi'?sequence.filter(t=>t!==tile.type).flatMap(t=>remove(p,t,1)):remove(p,tile.type,kind==='kong'?3:2);
  p.banned=kind==='chi'?chiBan(sequence,tile.type):[];g.totalCalls++;emit(g,kind,seat,tile.type,from,sequence);
  p.melds.push({kind,tiles:[...own,tile].sort((a,b)=>a.type-b.type),from});p.drawn=null;if(kind==='kong')p.kongChain='needs-followup';g.pending=null;g.turn=seat;g.phase='discard';
  log(g,`${NAMES[seat]}${kind==='chi'?'吃':kind==='pong'?'碰':'槓'} ${TILE_NAMES[tile.type]}`);if(kind==='kong')take(g,seat,true);
}
export function respond(g,kind,sequence=null){
  requireThat(g.phase==='response');const a=g.pending.offers.find(o=>o.seat===0&&o.kind===kind&&(kind!=='chi'||JSON.stringify(o.sequence)===JSON.stringify(sequence)));
  requireThat(kind==='pass'||a);if(g.pending.offers.some(o=>o.seat===0&&o.kind==='win')&&kind!=='win')g.players[0].passedWin=true;
  resolve(g,a||null);
}
export function winSelf(g,seat){requireThat(g.phase==='discard'&&g.turn===seat&&canWinSelf(g.players[seat]));finish(g,[seat],seat,true);}
function completeSelfKong(g,seat,t,kind){
  const p=g.players[seat],followsClaim=p.kongChain==='needs-followup';
  if(kind==='added'){
    const m=p.melds.find(m=>m.kind==='pong'&&m.tiles[0].type===t);m.tiles.push(...remove(p,t,1));m.kind='kong';emit(g,'added-kong',seat,t);log(g,`${NAMES[seat]}加槓 ${TILE_NAMES[t]}`);
  }else{
    p.melds.push({kind:'concealed',tiles:remove(p,t,4),from:seat});emit(g,'concealed-kong',seat);log(g,`${NAMES[seat]}暗槓`);
  }
  g.totalCalls++;g.pending=null;g.phase='discard';g.turn=seat;if(followsClaim)p.kongChain='eligible';take(g,seat,true);
}
export function selfKong(g,seat,t){
  requireThat(g.phase==='discard'&&g.turn===seat&&!g.players[seat].ready&&g.players[seat].drawn!==null&&g.wall.length>16);const p=g.players[seat];
  const concealed=count(p,t)===4,added=count(p,t)>0&&p.melds.some(m=>m.kind==='pong'&&m.tiles[0].type===t);requireThat(concealed||added);
  const kind=concealed?'concealed':'added',tile=p.hand.find(x=>x.type===t);
  if(kind==='concealed'&&p.kongChain!=='needs-followup'){completeSelfKong(g,seat,t,kind);return;}
  g.pending={from:seat,tile,offers:offers(g,seat,t,true),rob:true,kongKind:kind};queueResponse(g);
}
function handValue(hand){const c=Array(34).fill(0);for(const t of hand)c[t]++;let score=0;
  for(let t=0;t<34;t++)if(c[t]){score+=c[t]>=3?9:c[t]===2?4:0;if(t<27){if(t%9<8)score+=Math.min(c[t],c[t+1])*2;if(t%9<7)score+=Math.min(c[t],c[t+2]);}}
  return score;
}
export function chooseDiscard(p){
  if(p.ready)return p.hand.find(t=>t.id===p.drawn)||null;
  let best=null,bestScore=-Infinity;
  for(const tile of p.hand){if((p.banned||[]).includes(tile.type))continue;const h=p.hand.filter(x=>x.id!==tile.id).map(t=>t.type),score=handValue(h)+(tile.type>=27?.2:Math.abs(tile.type%9-4)*.015);if(score>bestScore){bestScore=score;best=tile;}}
  return best;
}
export function aiStep(g){
  requireThat(g.phase==='discard'&&g.turn!==0);const s=g.turn,p=g.players[s];
  if(canWinSelf(p)){winSelf(g,s);return;}
  if(!p.ready&&p.drawn!==null&&g.wall.length>16)for(let t=0;t<34;t++)if(count(p,t)===4||count(p,t)&&p.melds.some(m=>m.kind==='pong'&&m.tiles[0].type===t)){selfKong(g,s,t);return;}
  const chosen=chooseDiscard(p);if(!p.ready&&readyDiscards(g,s).some(o=>o.id===chosen.id))declareReady(g,s,chosen.id);else discard(g,s,chosen.id);
}
export function waits(p){const hand=types(p),owned=[...hand,...p.melds.flatMap(m=>m.tiles.map(t=>t.type))];if(hand.length!==16-3*p.melds.length)return[];return Array.from({length:34},(_,i)=>i).filter(t=>owned.filter(x=>x===t).length<4&&isWinning([...hand,t],p.melds.length));}
