import test from 'node:test';
import assert from 'node:assert/strict';
import { isWinning, createGame, discard, respond, selfKong, winSelf, aiStep, chooseDiscard, legalActions, allTiles } from '../dist/engine.mjs';

test('winning requires five sets and a pair, including exposed sets', () => {
  assert.equal(isWinning([0,1,2,3,4,5,9,10,11,18,19,20,27,27,27,31,31]),true);
  assert.equal(isWinning([0,1,2,3,4,5,9,10,11,18,19,20,27,27,27,31]),false);
  assert.equal(isWinning([0,1,2,3,4,5,9,10,11,31,31],2),true);
  assert.equal(isWinning([7,8,9,3,4,5,9,10,11,18,19,20,27,27,27,31,31]),false);
});

test('deal uses 144 unique physical tiles, flowers do not count toward hand', () => {
  const g=createGame(42);
  assert.equal(g.players[0].hand.length,17);
  for(let i=1;i<4;i++)assert.equal(g.players[i].hand.length,16);
  assert.equal(allTiles(g).length,144);
  assert.equal(new Set(allTiles(g).map(t=>t.id)).size,144);
  assert.ok(g.players.every(p=>p.hand.every(t=>t.type<34)));
});

test('illegal discard does not mutate game', () => {
  const g=createGame(10),before=JSON.stringify(g);
  assert.throws(()=>discard(g,1,g.players[1].hand[0].id));
  assert.equal(JSON.stringify(g),before);
});

test('seeded full games terminate and preserve all physical tiles', () => {
  for(let seed=1;seed<=30;seed++){
    const g=createGame(seed);let turns=0;
    while(g.phase!=='over' && turns++<600){
      if(g.phase==='response')respond(g,'pass');
      else if(g.turn===0){
        const actions=legalActions(g);
        if(actions.some(a=>a.kind==='win'))winSelf(g,0);
        else if(actions.some(a=>a.kind==='kong'))selfKong(g,0,actions.find(a=>a.kind==='kong').type);
        else discard(g,0,chooseDiscard(g.players[0]).id);
      }else aiStep(g);
      const tiles=allTiles(g);
      assert.equal(tiles.length,144,`seed ${seed} turn ${turns}`);
      assert.equal(new Set(tiles.map(t=>t.id)).size,144);
      assert.equal(g.players.reduce((s,p)=>s+p.score,0),200000);
    }
    assert.equal(g.phase,'over',`seed ${seed}`);
  }
});

function fixture(hands,turn){
  const g=createGame(99),pool=allTiles(g);g.players.forEach((p,i)=>{p.hand=(hands[i]||[]).map(type=>{const at=pool.findIndex(t=>t.type===type);assert.ok(at>=0,`missing physical tile type ${type}`);return pool.splice(at,1)[0];});p.melds=[];p.flowers=[];p.discards=[];p.drawn=null;p.kongChain=null;});g.wall=pool;g.turn=turn;g.phase='discard';g.pending=null;return g;
}
const ready=[0,1,2,3,4,5,9,10,11,18,19,20,27,27,27,31];
test('human can chi only from the previous seat',()=>{
  let g=fixture([[1,2,8],[],[],[0]],3);discard(g,3,g.players[3].hand[0].id);assert.equal(g.phase,'response');respond(g,'chi',[0,1,2]);assert.equal(g.turn,0);assert.equal(g.players[0].melds[0].kind,'chi');assert.equal(g.players[3].discards.length,0);
  g=fixture([[1,2],[0],[],[]],1);discard(g,1,g.players[1].hand[0].id);assert.notEqual(g.phase,'response');
});
test('computer win takes priority over a human pong',()=>{
  const g=fixture([[31,31],[31],ready,[]],1);discard(g,1,g.players[1].hand[0].id);assert.equal(g.phase,'over');assert.deepEqual(g.result.winners,[2]);assert.equal(g.players[0].melds.length,0);assert.equal(g.players[1].score,50000-g.result.payments[0].amount);
});
test('exposed kong consumes three tiles and draws replacement',()=>{
  const g=fixture([[5,5,5],[],[5],[]],2);discard(g,2,g.players[2].hand[0].id);respond(g,'kong');assert.equal(g.players[0].melds[0].tiles.length,4);assert.equal(g.players[0].hand.length,1);assert.equal(g.turn,0);
});
test('a player cannot kong a discard from their upper seat',()=>{
  const g=fixture([[5,5,5],[],[],[5]],3);discard(g,3,g.players[3].hand[0].id);
  assert.equal(legalActions(g).some(a=>a.kind==='kong'),false);
  assert.throws(()=>respond(g,'kong'));
});
test('the upper-seat kong ban is applied in every seating direction',()=>{
  for(let from=0;from<4;from++){
    const target=(from+1)%4,hands=[[],[],[],[]];hands[from]=[5];hands[target]=[5,5,5];
    const g=fixture(hands,from);discard(g,from,g.players[from].hand[0].id);
    if(target===0)assert.equal(legalActions(g).some(a=>a.kind==='kong'),false);
    else assert.equal(g.players[target].melds.some(m=>m.kind==='kong'),false);
  }
});
test('a player can still kong a discard that is not from their upper seat',()=>{
  const g=fixture([[5,5,5],[],[5],[]],2);discard(g,2,g.players[2].hand[0].id);
  assert.equal(legalActions(g).some(a=>a.kind==='kong'),true);
});
test('a winning claim takes priority over another player claiming exposed kong',()=>{
  const waitingOnEight=[0,1,2,3,4,5,6,7,9,10,11,18,19,20,27,27];
  const g=fixture([[8,8,8],waitingOnEight,[8],[]],2);discard(g,2,g.players[2].hand[0].id);
  assert.equal(g.phase,'over');assert.equal(g.result.rob,true);assert.deepEqual(g.result.winners,[1]);
  assert.ok(g.result.scores[1].items.some(item=>item.name==='搶槓'));
  assert.equal(g.players[0].melds.length,0);
});
test('added kong offers robbing before consuming the fourth tile',()=>{
  const g=fixture([[0,1,3,4,5,9,10,11,18,19,20,27,27,27,31,31],[2,2,2,2],[],[]],1);g.players[1].melds=[{kind:'pong',tiles:g.players[1].hand.splice(0,3),from:2}];g.players[1].drawn=g.players[1].hand[0].id;selfKong(g,1,2);assert.equal(g.phase,'response');assert.ok(legalActions(g).some(a=>a.kind==='win'));respond(g,'win');assert.equal(g.result.rob,true);assert.deepEqual(g.result.winners,[0]);assert.equal(g.players[1].melds[0].kind,'pong');
});
test('self draw pays from all three opponents exactly once',()=>{
  const g=fixture([[...ready,31],[],[],[]],0);g.players[0].drawn=g.players[0].hand.at(-1).id;winSelf(g,0);assert.equal(g.result.payments.length,3);assert.equal(g.result.deltas[0],-g.result.deltas.slice(1).reduce((s,n)=>s+n,0));assert.ok(g.result.payments.every(p=>p.amount===5000+p.tai*500));assert.throws(()=>winSelf(g,0));
});
test('last 16 tiles are never drawn',()=>{
  const g=fixture([[0],[],[],[]],0);g.wall=g.wall.slice(0,16);discard(g,0,g.players[0].hand[0].id);assert.equal(g.phase,'over');assert.equal(g.result.kind,'draw');assert.equal(g.wall.length,16);
});

test('claiming a winning discard as chi cannot convert it into self draw',()=>{
  const g=fixture([[0,1,3,4,5,9,10,11,18,19,20,27,27,27,31,31],[],[],[2]],3);
  discard(g,3,g.players[3].hand[0].id);respond(g,'chi',[0,1,2]);
  assert.equal(legalActions(g).some(a=>a.kind==='win'),false);
  assert.throws(()=>winSelf(g,0));
});

function setBackDraws(g,draws){
  for(const type of draws){
    const at=g.wall.findIndex(t=>t.type===type);assert.ok(at>=0);
    g.wall.push(...g.wall.splice(at,1));
  }
  // Back draws use pop(), so put the first requested tile last.
  for(let left=0,right=draws.length-1;left<right;left++,right--){
    const a=g.wall.length-draws.length+left,b=g.wall.length-draws.length+right;
    [g.wall[a],g.wall[b]]=[g.wall[b],g.wall[a]];
  }
}
const threeSetsWait=[0,1,2,9,10,11,27,27,27,31];
test('the first replacement after a claimed kong cannot be won',()=>{
  const g=fixture([[8,8,8,0,1,2,3,4,5,9,10,11,27,27,27,31],[],[8],[]],2);
  setBackDraws(g,[31]);discard(g,2,g.players[2].hand[0].id);respond(g,'kong');
  assert.equal(isWinning(g.players[0].hand.map(t=>t.type),1),true);
  assert.equal(legalActions(g).some(a=>a.kind==='win'),false);
  assert.throws(()=>winSelf(g,0));
});
test('AI also cannot win on the first replacement after a claimed kong',()=>{
  const g=fixture([[],[8,8,8,0,1,2,3,4,5,9,10,11,27,27,27,31],[],[8]],3);
  setBackDraws(g,[31]);discard(g,3,g.players[3].hand[0].id);
  assert.equal(g.turn,1);assert.equal(g.players[1].kongChain,'needs-followup');
  aiStep(g);assert.notEqual(g.phase,'over');assert.equal(g.result,null);
});
test('a standalone concealed kong still permits winning on its replacement tile',()=>{
  const oneMeldWait=[0,1,2,3,4,5,9,10,11,27,27,27,31];
  const g=fixture([[6,6,6,6,...oneMeldWait],[],[],[]],0);g.players[0].drawn=g.players[0].hand.find(t=>t.type===6).id;
  setBackDraws(g,[31]);selfKong(g,0,6);
  assert.equal(legalActions(g).some(a=>a.kind==='win'),true);
});
test('a follow-up concealed kong unlocks winning on its replacement tile',()=>{
  const g=fixture([[8,8,8,6,6,6,...threeSetsWait],[],[8],[]],2);
  setBackDraws(g,[6,31]);discard(g,2,g.players[2].hand[0].id);respond(g,'kong');
  selfKong(g,0,6);
  assert.equal(legalActions(g).some(a=>a.kind==='win'),true);
  winSelf(g,0);assert.equal(g.result.self,true);
});
test('a follow-up added kong unlocks winning on its replacement tile',()=>{
  const g=fixture([[8,8,8,...threeSetsWait],[],[8],[]],2),p=g.players[0];
  p.melds=[{kind:'pong',tiles:g.wall.splice(g.wall.findIndex(t=>t.type===6),1)
    .concat(g.wall.splice(g.wall.findIndex(t=>t.type===6),1),g.wall.splice(g.wall.findIndex(t=>t.type===6),1)),from:1}];
  setBackDraws(g,[6,31]);discard(g,2,g.players[2].hand[0].id);respond(g,'kong');
  selfKong(g,0,6);
  assert.equal(legalActions(g).some(a=>a.kind==='win'),true);
  winSelf(g,0);assert.equal(g.result.self,true);
});
test('robbing a follow-up concealed kong takes priority over the kong player win',()=>{
  const waitingOnSix=[4,5,12,13,14,18,19,20,21,22,23,28,28,28,32,32];
  const g=fixture([[8,8,8,6,6,6,...threeSetsWait],waitingOnSix,[8],[]],2);
  setBackDraws(g,[6,31]);discard(g,2,g.players[2].hand[0].id);respond(g,'kong');
  selfKong(g,0,6);
  assert.equal(g.phase,'over');assert.equal(g.result.rob,true);assert.deepEqual(g.result.winners,[1]);
});
