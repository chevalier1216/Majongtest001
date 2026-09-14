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
const fixture="\nwindow.qaFixture=(count=2)=>{clearTimeout(timer);clearTimeout(eventTimer);animating=false;game.phase='discard';game.turn=0;for(let s=0;s<4;s++){game.players[s].flowers=Array.from({length:count},(_,i)=>({id:300+s*10+i,type:34+i}));game.players[s].melds=[{kind:'pong',tiles:[0,1,2].map(i=>({id:500+s*10+i,type:4}))}];}render();};";
const browser=await chromium.launch();
try{
 for(const [width,height] of [[1440,900],[1024,768],[844,390]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/app.mjs',route=>route.fulfill({contentType:'text/javascript',body:app+fixture}));
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'load'});
  await page.evaluate(()=>window.qaFixture());
  await page.evaluate(async()=>{await document.fonts.ready;const img=new Image();img.src='assets/flowers.png';await img.decode();});
  const measurements=await page.evaluate(()=>['#self-melds','#seat1','#seat2','#seat3'].map(selector=>{
   const zone=document.querySelector(selector);
   return {selector,tiles:[...zone.querySelectorAll('.meld .tile')].map(tile=>{
    const r=tile.getBoundingClientRect(),f=tile.querySelector('.face'),style=getComputedStyle(f);
    return {flower:tile.classList.contains('flower-tile'),w:r.width,h:r.height,transform:getComputedStyle(tile).transform,faceTransform:style.transform,faceWidth:parseFloat(style.width),label:tile.getAttribute('aria-label')};
   })};
  }));
  for(const seat of measurements){
   assert.equal(seat.tiles.length,5);
   const standard=seat.tiles.find(t=>!t.flower);
   for(const t of seat.tiles){
    assert.ok(Math.min(t.w,t.h)>=27.9,JSON.stringify({width,seat:seat.selector,t}));
    assert.ok(Math.abs(t.w-standard.w)<.1&&Math.abs(t.h-standard.h)<.1,'flower size differs');
    assert.equal(t.transform,standard.transform,'tile orientation differs');
    assert.equal(t.faceTransform,standard.faceTransform,'face orientation differs');
   }
  }
  assert.deepEqual(errors,[]);
  const normal=await page.screenshot({path:'qa-output/table-'+width+'.png',fullPage:true});
  console.log('LAYOUT '+JSON.stringify({width,height,measurements}));
  if(width===1440)console.log('QA_SCREENSHOT '+normal.toString('base64'));
  await page.evaluate(()=>window.qaFixture(8));
  const stress=await page.evaluate(()=>[...document.querySelectorAll('.flower-meld')].map(m=>({count:m.querySelectorAll('.tile').length,tiles:[...m.querySelectorAll('.tile')].map(t=>{const r=t.getBoundingClientRect();return Math.min(r.width,r.height)})})));
  assert.ok(stress.every(s=>s.count===8&&s.tiles.every(n=>n>=27.9)));
  await page.screenshot({path:'qa-output/eight-flowers-'+width+'.png',fullPage:true});
  await page.close();
 }
}finally{await browser.close();server.close();}
