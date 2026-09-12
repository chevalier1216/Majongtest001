import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as engine from '../dist/engine.mjs';
import * as scoring from '../dist/scoring.mjs';
// Execute the actual UI against a minimal HTML-backed host and deterministic clock.
// This verifies rendering and interaction gates; it is not a browser layout test.
function ui(){
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),nodes=new Map(),clock=new Map();let next=0;
 for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set('#'+id,{innerHTML:'',textContent:'',hidden:id==='call-notice',classList:{toggle(){}},addEventListener(){},querySelectorAll(){return[];},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;}});
 for(let s=0;s<4;s++)nodes.set(`[data-seat="${s}"]`,{textContent:'',classList:{toggle(){}}});
 const document={querySelector(s){if(s==='dialog[open]')return [...nodes.values()].find(n=>n.open)||null;if(!nodes.has(s))throw new Error('Missing HTML target '+s);return nodes.get(s);},querySelectorAll(){return[];}};
 const context=vm.createContext({...engine,...scoring,document,navigator:{},window:{},console,setTimeout:(fn,ms)=>{const id=++next;clock.set(id,{fn,ms});return id;},clearTimeout:id=>clock.delete(id)});
 const code=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');vm.runInContext(code,context);
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
 for(let seat=1;seat<4;seat++){
  const html=u.nodes.get('#seat'+seat).innerHTML;
  assert.equal((html.match(/flower-meld/g)||[]).length,1,`seat ${seat} flower group`);
  assert.equal((html.match(/class=\"tile/g)||[]).length,2,`seat ${seat} flower tiles`);
 }
});
