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
