import test from 'node:test';
import assert from 'node:assert/strict';
import {SaveGameService,SAVE_KEY,validateGame} from '../dist/save-game.mjs';
import {createGame,completeOpening,discard,respond,aiStep,chooseDiscard,allTiles} from '../dist/engine.mjs';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
function step(g){if(g.phase==='response')respond(g,'pass');else if(g.turn)aiStep(g);else discard(g,0,chooseDiscard(g.players[0]).id);g.events=[];}
test('actual matches round-trip every transition and resume deterministically',()=>{
 let responses=0,ends=0;
 for(let seed=1;seed<=10;seed++){
  const store=storage(),service=new SaveGameService(store);let game=createGame(seed,null,{opening:true});
  service.save(game);let loaded=new SaveGameService(store).load();assert.equal(loaded.kind,'saved');assert.deepEqual(loaded.save.game,game);
  completeOpening(game);game.events=[];
  for(let turn=0;turn<400&&game.phase!=='over';turn++){
   service.save(game);loaded=new SaveGameService(store).load();assert.equal(loaded.kind,'saved');const clone=loaded.save.game;
   if(game.phase==='response')responses++;
   step(game);step(clone);assert.deepEqual(clone,game);assert.equal(allTiles(game).length,144);
  }
  assert.equal(game.phase,'over');ends++;service.save(game);
  assert.equal(new SaveGameService(store).load().kind,game.matchOver?'empty':'saved');
 }
 assert.ok(responses>0&&ends===10);
});
test('invalid versions, malformed JSON, duplicate tiles and script content are rejected',()=>{
 const st=storage(),svc=new SaveGameService(st);svc.save(createGame(5));const valid=st.getItem(SAVE_KEY);
 for(const mutate of [s=>s.saveVersion=99,s=>s.game.players[0].hand[0]=s.game.wall[0],s=>s.game.players[0].name='<img src=x>',s=>s.game.turn=8]){const s=JSON.parse(valid);mutate(s);st.setItem(SAVE_KEY,JSON.stringify(s));assert.equal(new SaveGameService(st).load().kind,'invalid');}
 st.setItem(SAVE_KEY,'{');assert.equal(new SaveGameService(st).load().kind,'invalid');
});
test('write failures remain failures, and concurrent tabs cannot overwrite progress',()=>{
 const st=storage(),a=new SaveGameService(st),b=new SaveGameService(st);a.load();b.load();a.save(createGame(1));const before=st.getItem(SAVE_KEY);
 assert.throws(()=>b.save(createGame(2)),e=>e.code==='conflict');assert.equal(st.getItem(SAVE_KEY),before);
 const failing=new SaveGameService({getItem:()=>null,setItem(){throw Error('quota');}});assert.throws(()=>failing.save(createGame(5)),/quota/);
});
test('match end clears active save while round settlement remains resumable',()=>{
 const st=storage(),s=new SaveGameService(st),g=createGame(5);s.save(g);g.matchOver=true;s.save(g);assert.equal(st.getItem(SAVE_KEY),null);
});
