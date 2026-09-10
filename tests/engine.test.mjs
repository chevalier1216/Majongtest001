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
      assert.equal(g.players.reduce((s,p)=>s+p.score,0),0);
    }
    assert.equal(g.phase,'over',`seed ${seed}`);
  }
});

function fixture(hands,turn){
  const g=createGame(99),pool=allTiles(g);g.players.forEach((p,i)=>{p.hand=(hands[i]||[]).map(type=>pool.splice(pool.findIndex(t=>t.type===type),1)[0]);p.melds=[];p.flowers=[];p.discards=[];p.drawn=null;});g.wall=pool;g.turn=turn;g.phase='discard';g.pending=null;return g;
}
const ready=[0,1,2,3,4,5,9,10,11,18,19,20,27,27,27,31];
test('human can chi only from the previous seat',()=>{
  let g=fixture([[1,2],[],[],[0]],3);discard(g,3,g.players[3].hand[0].id);assert.equal(g.phase,'response');respond(g,'chi',[0,1,2]);assert.equal(g.turn,0);assert.equal(g.players[0].melds[0].kind,'chi');assert.equal(g.players[3].discards.length,0);
  g=fixture([[1,2],[0],[],[]],1);discard(g,1,g.players[1].hand[0].id);assert.notEqual(g.phase,'response');
});
test('computer win takes priority over a human pong',()=>{
  const g=fixture([[31,31],[31],ready,[]],1);discard(g,1,g.players[1].hand[0].id);respond(g,'pong');assert.equal(g.phase,'over');assert.deepEqual(g.result.winners,[2]);assert.equal(g.players[0].melds.length,0);assert.equal(g.players[1].score,-100);
});
test('exposed kong consumes three tiles and draws replacement',()=>{
  const g=fixture([[5,5,5],[5],[],[]],1);discard(g,1,g.players[1].hand[0].id);respond(g,'kong');assert.equal(g.players[0].melds[0].tiles.length,4);assert.equal(g.players[0].hand.length,1);assert.equal(g.turn,0);
});
test('added kong offers robbing before consuming the fourth tile',()=>{
  const g=fixture([[0,1,3,4,5,9,10,11,18,19,20,27,27,27,31,31],[2,2,2,2],[],[]],1);g.players[1].melds=[{kind:'pong',tiles:g.players[1].hand.splice(0,3),from:2}];selfKong(g,1,2);assert.equal(g.phase,'response');assert.ok(legalActions(g).some(a=>a.kind==='win'));respond(g,'win');assert.equal(g.result.rob,true);assert.deepEqual(g.result.winners,[0]);assert.equal(g.players[1].melds[0].kind,'pong');
});
test('self draw pays from all three opponents exactly once',()=>{
  const g=fixture([[...ready,31],[],[],[]],0);g.players[0].drawn=g.players[0].hand.at(-1).id;winSelf(g,0);assert.deepEqual(g.result.deltas,[300,-100,-100,-100]);assert.throws(()=>winSelf(g,0));
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
