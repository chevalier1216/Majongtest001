import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as engine from '../dist/engine.mjs';
import * as saving from '../dist/save-game.mjs';
import * as scoring from '../dist/scoring.mjs';
// Execute the actual UI against a minimal HTML-backed host and deterministic clock.
// This verifies rendering and interaction gates; it is not a browser layout test.
function ui(finishDice=true){
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),nodes=new Map(),clock=new Map(),storage=new Map();let next=0;
 for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set('#'+id,{innerHTML:'',textContent:'',hidden:id==='call-notice',classList:{toggle(){}},addEventListener(){},querySelectorAll(){return[];},setAttribute(){},remove(){},showModal(){this.open=true;},close(){this.open=false;}});
 for(let s=0;s<4;s++)nodes.set(`[data-seat="${s}"]`,{textContent:'',classList:{toggle(){}}});
 const document={querySelector(s){if(s==='dialog[open]')return [...nodes.values()].find(n=>n.open)||null;if(!nodes.has(s))throw new Error('Missing HTML target '+s);return nodes.get(s);},querySelectorAll(){return[];}};
 const context=vm.createContext({...engine,...scoring,...saving,Date:class extends Date{static now(){return 5;}},document,navigator:{},window:{localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}},console,setTimeout:(fn,ms)=>{const id=++next;clock.set(id,{fn,ms});return id;},clearTimeout:id=>clock.delete(id)});
 const code=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');vm.runInContext(code,context);
 if(finishDice){const [id,timer]=[...clock].find(([,t])=>t.ms===2000);clock.delete(id);timer.fn();}
 return{context,nodes,clock,run:code=>vm.runInContext(code,context)};
}
test('UI loads all HTML targets and keeps unavailable hand tiles visible but disabled',()=>{
 const u=ui();assert.equal(u.nodes.get('#round-label').textContent,'東風東局');assert.match(u.nodes.get('#self-info').innerHTML,/50,000/);
 assert.equal((u.nodes.get('#hand').innerHTML.match(/data-tile=/g)||[]).length,17);
 assert.doesNotMatch(u.nodes.get('#hand').innerHTML,/is-muted/);
 u.run('game.players[0].banned=[game.players[0].hand[0].type];render()');assert.match(u.nodes.get('#hand').innerHTML,/is-muted/);assert.match(u.nodes.get('#hand').innerHTML,/disabled aria-disabled="true"/);
 u.run('game.turn=1;render()');assert.equal((u.nodes.get('#hand').innerHTML.match(/disabled aria-disabled/g)||[]).length,17);
});
test('claim notice pauses input for 1400ms, preserves tiles and resumes afterwards',()=>{
 const u=ui();u.run("playEvents([{kind:'pong',seat:1,tile:4,from:3}])");
 assert.equal(u.nodes.get('#call-notice').hidden,false);assert.match(u.nodes.get('#call-notice').innerHTML,/阿青/);assert.match(u.nodes.get('#call-notice').innerHTML,/接走老陳的 5萬/);
 assert.equal((u.nodes.get('#hand').innerHTML.match(/disabled aria-disabled/g)||[]).length,17);
 u.run('act(()=>game.players[0].score=0)');assert.equal(u.run('game.players[0].score'),50000);
 const [id,timer]=[...u.clock].find(([,t])=>t.ms===1400);u.clock.delete(id);timer.fn();
 assert.equal(u.nodes.get('#call-notice').hidden,true);assert.equal(u.run('animating'),false);assert.doesNotMatch(u.nodes.get('#hand').innerHTML,/is-muted/);
});
test('flower call notice uses the same face-up tile as the public area',()=>{
 const u=ui();u.run("playEvents([{kind:'flower',seat:0,tile:40,from:0}])");
 assert.match(u.nodes.get('#call-notice').innerHTML,/flower-face/);
 assert.match(u.nodes.get('#call-notice').innerHTML,/>竹</);
});
test('reaction prompt and its available actions render together on the table',()=>{
 const u=ui();assert.ok(u.nodes.has('#reaction-panel'));assert.ok(u.nodes.has('#reaction-message'));assert.ok(u.nodes.has('#reaction-actions'));
 u.run("game.phase='response';game.pending={from:3,tile:{id:999,type:10},offers:[{seat:0,kind:'pong',rank:2,type:10}],rob:false,ai:[]};render()");
 assert.equal(u.nodes.get('#reaction-panel').hidden,false);
 assert.match(u.nodes.get('#reaction-message').textContent,/老陳打出 2索/);
 assert.match(u.nodes.get('#reaction-actions').innerHTML,/>碰</);
 assert.match(u.nodes.get('#reaction-actions').innerHTML,/>過</);
 assert.equal(u.nodes.get('#actions').innerHTML,'');
});
test('flowers render as face-up tiles in every seat public area',()=>{
 const u=ui();u.run("for(let seat=0;seat<4;seat++)game.players[seat].flowers=[{id:200+seat,type:34+seat},{id:210+seat,type:38+seat}];render()");
 assert.equal((u.nodes.get('#self-melds').innerHTML.match(/flower-meld/g)||[]).length,1);
 assert.equal((u.nodes.get('#self-melds').innerHTML.match(/class=\"tile/g)||[]).length,2);
 assert.equal((u.nodes.get('#self-melds').innerHTML.match(/flower-face/g)||[]).length,2);
 assert.match(u.nodes.get('#self-melds').innerHTML,/>春</);
 assert.match(u.nodes.get('#self-melds').innerHTML,/>梅</);
 assert.match(u.nodes.get('#self-melds').innerHTML,/flower-tai/);
 assert.doesNotMatch(u.nodes.get('#self-info').innerHTML,/class=\"flowers\"/);
 for(let seat=1;seat<4;seat++){
  const html=u.nodes.get('#seat'+seat).innerHTML;
  assert.equal((html.match(/flower-meld/g)||[]).length,1,`seat ${seat} flower group`);
  assert.equal((html.match(/class=\"tile/g)||[]).length,2,`seat ${seat} flower tiles`);
  assert.match(html,/flower-tai/,`seat ${seat} flower tai stays with public tiles`);
  assert.doesNotMatch(html,/class=\"flowers\"/,`seat ${seat} has no text-only flower list`);
 }
});

test('opening shows three dice for 2000ms and blocks actions before dealing',()=>{
 const u=ui(false);assert.equal(u.nodes.get('#opening-notice').hidden,false);assert.equal((u.nodes.get('#opening-notice').innerHTML.match(/class="die die-/g)||[]).length,3);
 assert.equal(u.run('game.phase'),'opening');assert.equal(u.nodes.get('#hand').innerHTML,'');assert.match(u.nodes.get('#opening-notice').innerHTML,/你先抓牌/);
 u.run('act(()=>game.players[0].score=0)');assert.equal(u.run('game.players[0].score'),50000);
 const [id,timer]=[...u.clock].find(([,t])=>t.ms===2000);u.clock.delete(id);timer.fn();
 assert.equal(u.run('game.phase'),'discard');assert.equal(u.nodes.get('#opening-notice').hidden,true);assert.equal(u.run('game.players[0].hand.length'),17);
});
test('ready action requires a valid selected discard, displays waits and locks old tiles',()=>{
 const u=ui();u.run("game=createGame(1);for(const p of game.players){p.hand=[];p.melds=[];p.flowers=[];}game.players[0].hand=[0,1,2,3,4,5,9,10,11,18,19,20,27,27,27,31,30].map((type,id)=>({type,id}));game.players[0].drawn=16;render()");
 assert.match(u.nodes.get('#actions').innerHTML,/ready-action[^>]+disabled/);
 u.run('selected=3;renderActions()');assert.match(u.nodes.get('#actions').innerHTML,/ready-action[^>]+disabled/);
 u.run('selected=16;renderActions()');assert.doesNotMatch(u.nodes.get('#actions').innerHTML,/ready-action[^>]+disabled/);assert.match(u.nodes.get('#waits').textContent,/白/);
 u.run("handleAction({target:{closest:()=>({disabled:false,dataset:{actionIndex:legalActions(game).findIndex(a=>a.kind==='ready')}})}})");assert.equal(u.run('game.players[0].ready'),true);
 assert.match(u.nodes.get('#call-notice').innerHTML,/聽牌/);
 u.run("clearTimeout(eventTimer);animating=false;game.phase='discard';game.turn=0;game.players[0].hand.push({type:0,id:999});game.players[0].drawn=999;render()");
 assert.equal((u.nodes.get('#hand').innerHTML.match(/disabled aria-disabled/g)||[]).length,16);assert.match(u.nodes.get('#status').textContent,/已宣告聽牌/);
});
test('bankruptcy result shows ranked scores first and only offers a fresh match',()=>{
 const u=ui();u.run("game=createGame(1);for(const p of game.players){p.hand=[];p.melds=[];p.flowers=[];}game.players[0].hand=[0,1,2,3,4,5,9,10,11,18,19,20,27,27,27,31,31].map((type,id)=>({type,id}));game.players[0].drawn=16;game.players[1].score=1;winSelf(game,0);showResult()");
 assert.match(u.nodes.get('#result-title').textContent,/牌局結束/);assert.equal(u.nodes.get('#ranking-heading').textContent,'最終點數排名');assert.match(u.nodes.get('#scoreboard').innerHTML,/bankrupt/);assert.match(u.nodes.get('#next-round').textContent,/積分重置/);
 assert.ok(u.nodes.get('#scoreboard').innerHTML.indexOf('老陳')<u.nodes.get('#scoreboard').innerHTML.indexOf('阿青'));
 u.nodes.get('#next-round').onclick();assert.equal(u.run('game.phase'),'opening');assert.equal(u.run('game.players.every(p=>p.score===50000)'),true);
});
