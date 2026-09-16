import {allTiles,legalActions} from './engine.mjs';
export const SAVE_KEY='qingzhu.majongtest001.active';
export const GAME_VERSION='1.0.0';
const check=(ok)=>{if(!ok)throw new Error('存檔內容不完整或已損壞');};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
export function validateGame(g){
 check(!/[<>]/.test(JSON.stringify(g)));
 check(g&&['opening','discard','response','over'].includes(g.phase));
 check(int(g.seed,0,Number.MAX_SAFE_INTEGER)&&int(g.dealer,0,3)&&int(g.turn,0,3)&&int(g.handNumber,0,15)&&int(g.round,1,1000000)&&int(g.streak,0,1000000));
 check(typeof g.matchOver==='boolean'&&Array.isArray(g.players)&&g.players.length===4&&Array.isArray(g.wall)&&Array.isArray(g.log)&&g.log.every(x=>typeof x==='string'));
 for(const p of g.players){
  check(typeof p.name==='string'&&int(p.score,-1e12,1e12)&&Array.isArray(p.hand)&&Array.isArray(p.flowers)&&Array.isArray(p.discards)&&Array.isArray(p.melds)&&p.melds.length<=5);
  check(typeof p.ready==='boolean'&&typeof p.passedWin==='boolean'&&Array.isArray(p.readyWaits)&&Array.isArray(p.banned)&&[...p.readyWaits,...p.banned].every(t=>int(t,0,33)));
  check(p.drawn===null||p.hand.some(t=>t.id===p.drawn));
  check([null,'needs-followup','eligible'].includes(p.kongChain)&&[null,'wall','kong','flower'].includes(p.drawSource)&&int(p.drawCount,0,100000));
  check(p.hand.every(t=>t.type<34)&&p.discards.every(t=>t.type<34)&&p.flowers.every(t=>t.type>=34));
  for(const m of p.melds)check(['chi','pong','kong','concealed'].includes(m.kind)&&Array.isArray(m.tiles)&&m.tiles.length===(['kong','concealed'].includes(m.kind)?4:3)&&m.tiles.every(t=>t.type<34));
 }
 check(int(g.discardCount,0,100000)&&int(g.totalCalls,0,100000)&&typeof g.message==='string');
 if(g.lastDiscard!==null)check(g.lastDiscard&&int(g.lastDiscard.seat,0,3)&&g.lastDiscard.tile&&int(g.lastDiscard.tile.id,0,143));
 const tiles=allTiles(g);check(tiles.length===144&&new Set(tiles.map(t=>t.id)).size===144);
 check(tiles.every(t=>int(t.id,0,143)&&t.type===(t.id<136?Math.floor(t.id/4):t.id-102)));
 if(g.phase==='opening')check(g.wall.length===144&&g.opening&&g.opening.dice.length===3&&g.opening.dice.every(n=>int(n,1,6))&&g.opening.total===g.opening.dice.reduce((a,b)=>a+b,0)&&int(g.opening.wallSeat,0,3));
 if(g.phase==='response'){
  const p=g.pending;check(p&&int(p.from,0,3)&&p.tile&&tiles.some(t=>t.id===p.tile.id&&t.type===p.tile.type)&&Array.isArray(p.offers)&&Array.isArray(p.ai)&&typeof p.rob==='boolean');
  for(const o of [...p.offers,...p.ai])check(int(o.seat,0,3)&&['chi','pong','kong','win'].includes(o.kind)&&int(o.rank,1,3)&&(o.kind!=='chi'||Array.isArray(o.sequence)&&o.sequence.length===3&&o.sequence.every(t=>int(t,0,26))));
 }
 if(g.phase==='over'){
  const r=g.result;check(r&&['win','draw'].includes(r.kind)&&typeof r.text==='string'&&Array.isArray(r.winners)&&r.winners.every(s=>int(s,0,3))&&r.deltas?.length===4&&r.deltas.every(Number.isFinite));
  if(r.kind==='win'){check(r.scores&&Array.isArray(r.payments)&&r.winners.every(s=>r.scores[s]&&Array.isArray(r.scores[s].items)&&r.scores[s].items.every(i=>typeof i.name==='string'&&Number.isFinite(i.tai))));
   check(r.payments.every(p=>int(p.payer,0,3)&&int(p.winner,0,3)&&[p.base,p.perTai,p.tai,p.amount].every(Number.isFinite)&&Array.isArray(p.items)&&p.items.every(i=>typeof i.name==='string'&&Number.isFinite(i.tai))));
   check(Array.isArray(r.rankings)&&r.rankings.length===4&&r.rankings.every(p=>int(p.seat,0,3)&&typeof p.name==='string'&&Number.isFinite(p.score)&&int(p.rank,1,4)));
  }
 }else check(!g.matchOver);
 legalActions(g);return g;
}
export class SaveGameService{
 constructor(storage){this.storage=storage;this.expected=undefined;this.meta=null;}
 load(){
  try{
   const raw=this.storage.getItem(SAVE_KEY);this.expected=raw;
   if(raw===null)return {kind:'empty'};
   const s=JSON.parse(raw);if(s.saveVersion!==1||s.gameVersion!==GAME_VERSION)return {kind:'invalid',message:'此存檔版本無法載入，請開始新遊戲。'};
   check(typeof s.gameId==='string'&&Number.isFinite(Date.parse(s.createdAt))&&Number.isFinite(Date.parse(s.lastSavedAt)));
   validateGame(s.game);this.meta={gameId:s.gameId,createdAt:s.createdAt};
   return {kind:'saved',save:s};
  }catch(error){return {kind:'invalid',message:'無法讀取本機存檔；資料可能損壞，或瀏覽器不允許儲存。'};}
 }
 reset(){this.expected=this.storage.getItem(SAVE_KEY);this.meta=null;}
 save(game){
  const current=this.storage.getItem(SAVE_KEY);
  if(this.expected===undefined)this.expected=current;
  if(current!==this.expected){const e=new Error('另一個分頁已更新牌局，請重新載入以繼續。');e.code='conflict';throw e;}
  if(game.matchOver){this.storage.removeItem(SAVE_KEY);this.expected=null;this.meta=null;return null;}
  validateGame(game);
  const now=new Date().toISOString();const meta=this.meta||{gameId:`${game.seed}-${now}`,createdAt:now};
  const record={saveVersion:1,gameVersion:GAME_VERSION,...meta,lastSavedAt:now,game:{...game,events:[]}};
  const raw=JSON.stringify(record);this.storage.setItem(SAVE_KEY,raw);this.expected=raw;this.meta=meta;return record;
 }
}
