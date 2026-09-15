import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.png':'image/png'};
const app=await readFile('dist/app.mjs','utf8');
const server=createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name.includes('..')){res.writeHead(400).end();return;}
  const file=join('dist',name==='/'?'index.html':name);
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
await mkdir('qa-output',{recursive:true});
const fixture="\nclearTimeout(openingTimer);\nwindow.qaFixture=(count=2,groups=3)=>{\n clearTimeout(timer);clearTimeout(eventTimer);clearTimeout(openingTimer);animating=false;\n if(game.phase==='opening')completeOpening(game);\n game.phase='discard';game.turn=0;document.querySelector('#opening-notice').hidden=true;\n for(let s=0;s<4;s++){\n  const p=game.players[s];p.ready=false;\n  p.flowers=Array.from({length:count},(_,i)=>({id:300+s*10+i,type:34+i}));\n  p.melds=Array.from({length:groups},(_,g)=>({kind:g===0?'chi':g===1?'pong':'kong',tiles:Array.from({length:g<2?3:4},(_,i)=>({id:500+s*100+g*4+i,type:g===0?i:g===1?4:18+g}))}));\n  p.hand=p.hand.slice(0,16-3*groups+(s===0?1:0));p.drawn=s===0?p.hand.at(-1)?.id:null;\n  p.discards=Array.from({length:12},(_,i)=>({id:1000+s*20+i,type:(s*7+i)%34}));\n }\n render();\n};\nwindow.qaReady=()=>{\n clearTimeout(timer);clearTimeout(eventTimer);animating=false;document.querySelector('#call-notice').hidden=true;\n game=createGame(5);game.discardCount=8;game.turn=0;\n game.players[0].hand=[0,1,2,3,4,5,9,10,11,18,19,20,27,27,27,31,30].map((type,id)=>({type,id}));\n game.players[0].melds=[];game.players[0].flowers=[];game.players[0].drawn=16;selected=null;render();\n};\nwindow.qaReadyDraw=()=>{\n clearTimeout(timer);clearTimeout(eventTimer);animating=false;document.querySelector('#call-notice').hidden=true;\n game.phase='discard';game.turn=0;game.players[0].hand.push({type:0,id:999});game.players[0].drawn=999;render();\n};\nwindow.qaBankrupt=()=>{\n clearTimeout(timer);clearTimeout(eventTimer);animating=false;game=createGame(5);game.discardCount=8;\n const p=game.players[0];p.hand=[0,1,2,3,4,5,9,10,11,18,19,20,27,27,27,31,31].map((type,id)=>({type,id}));p.melds=[];p.flowers=[];p.drawn=16;p.ready=true;\n game.players[1].score=1;winSelf(game,0);game.events=[];resultShown=false;render();\n};";

const browser=await chromium.launch();
try{
 for(const [width,height] of [[1440,900],[1024,768],[844,390]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/app.mjs',route=>route.fulfill({contentType:'text/javascript',body:app+fixture}));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'load'});
  assert.equal(await page.locator('#opening-notice .die').count(),3);
  assert.equal(await page.locator('#hand .tile').count(),0);
  assert.equal(await page.locator('#opening-notice').isVisible(),true);
  const diceBox=await page.locator('#opening-notice').boundingBox();
  console.log('DICE_BOX '+JSON.stringify({width,height,diceBox}));
  assert.ok(diceBox.y>=0&&diceBox.y+diceBox.height<=height,'dice result must fit the viewport');
  const diceShot=await page.screenshot({path:'qa-output/dice-'+width+'.png',fullPage:true});
  if(width===844)console.log('QA_DICE_844 '+diceShot.toString('base64'));
  await page.evaluate(()=>window.qaFixture());
  await page.evaluate(async()=>{await document.fonts.ready;const img=new Image();img.src='assets/flowers.png';await img.decode();});
  for(const stress of [false,true]){
   if(stress)await page.evaluate(()=>window.qaFixture(8,5));
   const measurements=await page.evaluate(()=>['#self-melds','#seat1','#seat2','#seat3'].map(selector=>{
    const zone=document.querySelector(selector),rack=zone.querySelector('.opponent-melds')||zone,publicW=parseFloat(getComputedStyle(document.querySelector('#table')).getPropertyValue('--public-tile-w'));
    const rect=r=>({x:r.x,y:r.y,w:r.width,h:r.height});
    return {selector,publicW,rack:{...rect(rack.getBoundingClientRect()),overflow:getComputedStyle(rack).overflow},tiles:[...zone.querySelectorAll('.meld .tile')].map(tile=>{
     const f=tile.querySelector('.face'),style=getComputedStyle(f);
     return {flower:tile.classList.contains('flower-tile'),...rect(tile.getBoundingClientRect()),transform:getComputedStyle(tile).transform,faceTransform:style.transform,label:tile.getAttribute('aria-label')};
    })};
   }));
   const rotation=matrix=>matrix==='none'?'none':matrix.slice(matrix.indexOf('(')+1).split(',').slice(0,4).map(Number).join(',');
   console.log('LAYOUT '+JSON.stringify({width,height,stress,measurements}));
   for(const seat of measurements){
    const side=seat.selector==='#seat1'||seat.selector==='#seat3',standard=seat.tiles.find(t=>!t.flower),meldTiles=seat.tiles.filter(t=>!t.flower),flowers=seat.tiles.filter(t=>t.flower);
    assert.equal(flowers.length,stress?8:2);
    assert.equal(meldTiles.length,stress?18:10);
    assert.equal(seat.rack.overflow,'visible','public rack must not scroll');
    for(const t of flowers){
     const expected=seat.publicW*(seat.selector==='#self-melds'?1:1.35);
     assert.ok(Math.abs(Math.min(t.w,t.h)-expected)<.1,JSON.stringify({width,seat:seat.selector,t,expected}));
     assert.equal(rotation(t.transform),rotation(standard.transform),'tile orientation differs');
     assert.equal(rotation(t.faceTransform),rotation(standard.faceTransform),'face orientation differs');
    }
    for(let i=1;i<meldTiles.length;i++){
     const a=meldTiles[i-1],b=meldTiles[i];
     assert.ok(Math.abs(side?b.x-a.x:b.y-a.y)<.2,'melds must stay in one continuous line');
     assert.ok(side?b.y>=a.y+a.h-.2:b.x>=a.x+a.w-.2,'melds overlap');
    }
    for(const t of seat.tiles){
     assert.ok(Math.min(t.w,t.h)>=37.5,'public tile became too small');
     assert.ok(t.x>=seat.rack.x-.2&&t.x+t.w<=seat.rack.x+seat.rack.w+.2&&t.y>=seat.rack.y-.2&&t.y+t.h<=seat.rack.y+seat.rack.h+.2,'tile escapes its public rack');
    }
   }
   const pageWidth=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(pageWidth<=width,'horizontal page overflow '+pageWidth+'>'+width);
   const shot=await page.screenshot({path:'qa-output/'+(stress?'full-racks-':'table-')+width+'.png',fullPage:true});
   if(!stress&&(width===1440||width===844))console.log('QA_SCREENSHOT_'+width+' '+shot.toString('base64'));
  }
  await page.evaluate(()=>window.qaReady());
  const ready=page.getByRole('button',{name:'宣告聽牌 ＋1台'});
  assert.equal(await ready.isEnabled(),false);
  await page.locator('#hand [data-tile="16"]').click();assert.equal(await ready.isEnabled(),true);
  assert.match(await page.locator('#waits').innerText(),/白/);
  await ready.click();assert.match(await page.locator('#call-notice').innerText(),/聽牌/);
  await page.evaluate(()=>window.qaReadyDraw());
  assert.equal(await page.locator('#hand .tile:disabled').count(),16);
  assert.equal(await page.locator('#hand [data-tile="999"]').isEnabled(),true);
  await page.screenshot({path:'qa-output/ready-'+width+'.png',fullPage:true});
  await page.evaluate(()=>window.qaBankrupt());
  assert.equal(await page.locator('#result').isVisible(),true);
  assert.equal(await page.locator('#ranking-heading').innerText(),'最終點數排名');
  const headingBox=await page.locator('#result-title').boundingBox();assert.ok(headingBox.y>=0&&headingBox.y+headingBox.height<=height,'result title must be visible on opening');
  const names=await page.locator('#scoreboard .score-row>span:first-child').allTextContents();assert.match(names.at(-1),/阿青/);
  assert.match(await page.locator('#winning-hands').innerText(),/宣告聽牌/);
  assert.match(await page.locator('#next-round').innerText(),/積分重置/);
  const ranks=await page.screenshot({path:'qa-output/rankings-'+width+'.png',fullPage:true});
  if(width===1440)console.log('QA_RANKINGS_1440 '+ranks.toString('base64'));
  assert.deepEqual(errors,[]);await page.close();
 }
}finally{await browser.close();server.close();}
