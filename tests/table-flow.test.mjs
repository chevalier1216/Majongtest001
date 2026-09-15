import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.mjs';
import {scoreHand,paymentFor} from '../dist/scoring.mjs';
const readyHand=[0,1,2,3,4,5,9,10,11,18,19,20,27,27,27,31];
function hand(g,seat,ts){g.players[seat].hand=ts.map((type,id)=>({type,id:seat*100+id}));g.players[seat].melds=[];g.players[seat].flowers=[];g.players[seat].banned=[];}
function readyGame(){const g=E.createGame(1);g.players.forEach((p,s)=>hand(g,s,[]));hand(g,0,[...readyHand,30]);g.players[0].drawn=16;g.wall=Array.from({length:40},(_,i)=>({id:800+i,type:8}));g.discardCount=8;return g;}
test('three dice block dealing until opening completes; dealer and cut affect actual deal',()=>{
 const g=E.createGame(42,null,{opening:true});assert.equal(g.phase,'opening');assert.equal(g.opening.dice.length,3);assert.ok(g.opening.dice.every(n=>n>=1&&n<=6));assert.equal(g.players.flatMap(p=>p.hand).length,0);assert.deepEqual(E.legalActions(g),[]);
 assert.equal(g.dealer,(g.opening.total-1)%4);assert.equal(E.seatWind(g,g.dealer),0);
 const first=g.wall.find(t=>t.type<34).id;E.completeOpening(g);assert.equal(g.phase,'discard');assert.equal(g.turn,g.dealer);assert.ok(g.players[g.dealer].hand.some(t=>t.id===first));assert.equal(g.players[g.dealer].hand.length,17);assert.equal(E.allTiles(g).length,144);assert.throws(()=>E.completeOpening(g));
 const next=E.createGame(43,{...g,result:{kind:'win',winners:[(g.dealer+1)%4]}},{opening:true});assert.equal(next.dealer,(g.dealer+1)%4);assert.equal(next.opening.wallSeat,(next.dealer+next.opening.total-1)%4);
});
test('declaring ready validates the discard, then only the drawn physical tile is legal',()=>{
 const g=readyGame(),p=g.players[0];assert.ok(E.readyDiscards(g,0).some(o=>o.id===16&&o.waits.includes(31)));E.declareReady(g,0,16);assert.equal(p.ready,true);assert.ok(p.readyWaits.includes(31));
 g.turn=0;g.phase='discard';p.hand.push({type:0,id:999});p.drawn=999;
 assert.equal(E.canDiscard(g,0,999),true);assert.equal(E.canDiscard(g,0,0),false);assert.equal(E.chooseDiscard(p).id,999);
 const before=JSON.stringify(g);assert.throws(()=>E.discard(g,0,0));assert.equal(JSON.stringify(g),before);assert.throws(()=>E.selfKong(g,0,27));assert.equal(E.legalActions(g).some(a=>a.kind==='kong'||a.kind==='ready'),false);
});
test('invalid ready declaration does not change the game',()=>{
 const g=readyGame(),before=JSON.stringify(g);assert.throws(()=>E.declareReady(g,0,3));assert.equal(JSON.stringify(g),before);
});
test('ready suppresses chi pong kong offers but preserves winning offers',()=>{
 const g=readyGame();g.players[0].hand.pop();g.players[0].ready=true;g.turn=3;hand(g,3,[27]);E.discard(g,3,300);assert.ok(!g.pending?.offers.some(o=>o.seat===0&&o.kind!=='win'));
 const w=readyGame();w.players[0].hand.pop();w.players[0].ready=true;w.turn=3;hand(w,3,[31]);E.discard(w,3,300);assert.equal(w.phase,'response');assert.deepEqual(E.legalActions(w).map(a=>a.kind),['win','pass']);
});
test('ready winner receives exactly one additional tai',()=>{
 const g=readyGame();hand(g,0,[...readyHand,31]);g.players[0].drawn=16;const before=scoreHand(g,0,{self:true,tile:{type:31}});g.players[0].ready=true;const after=scoreHand(g,0,{self:true,tile:{type:31}});assert.equal(after.tai,before.tai+1);assert.deepEqual(after.items.filter(x=>x.name==='宣告聽牌'),[{name:'宣告聽牌',tai:1}]);
});
test('negative balance ends the match with complete ranked scores; zero does not',()=>{
 for(const negative of [true,false]){
 const g=readyGame();hand(g,0,[...readyHand,31]);g.players[0].drawn=16;const s=scoreHand(g,0,{self:true,tile:{type:31}}),pay=paymentFor(g,0,1,s).amount;g.players[1].score=pay-(negative?1:0);E.winSelf(g,0);assert.equal(g.matchOver,negative);
 if(negative){assert.equal(g.matchEndReason,'bankruptcy');assert.equal(g.result.rankings.length,4);assert.equal(g.result.rankings.at(-1).score,-1);assert.throws(()=>E.createGame(1,g));}
 }
});
test('multiple winners are all paid before bankruptcy rankings are determined',()=>{
 const g=readyGame();hand(g,0,readyHand);hand(g,1,readyHand);hand(g,2,[31]);g.turn=2;g.players[2].score=1;
 E.discard(g,2,200);assert.equal(g.phase,'response');E.respond(g,'win');
 assert.equal(g.result.winners.length,2);assert.equal(g.result.payments.length,2);assert.equal(g.result.deltas.reduce((a,b)=>a+b,0),0);
 assert.ok(g.players[0].score>50000&&g.players[1].score>50000);assert.equal(g.result.rankings.at(-1).seat,2);assert.equal(g.matchOver,true);
});
