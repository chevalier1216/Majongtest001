import {browserOptions} from './browser-options.mjs';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {extname,join} from 'node:path';
import assert from 'node:assert/strict';
import {createGame,completeOpening} from '../dist/engine.mjs';
import {SaveGameService,SAVE_KEY} from '../dist/save-game.mjs';
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path.includes('..'))throw Error();const file=join('site',path==='/'?'index.html':path);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(4174,'127.0.0.1',r));const browser=await chromium.launch(browserOptions);
const url='http://127.0.0.1:4174/';
try{
 for(const viewport of [{width:1440,height:900},{width:844,height:390}]){
  const ctx=await browser.newContext({viewport,serviceWorkers:'block'});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // A real complete deal, waiting on the human, isolates reload from AI timer races.
  let raw;const service=new SaveGameService({getItem:()=>raw??null,setItem:(k,v)=>raw=v,removeItem:()=>raw=null});const game=createGame(5);service.save(game);
  await page.goto(url);await page.evaluate(([key,raw])=>localStorage.setItem(key,raw),[SAVE_KEY,raw]);await page.reload();
  await page.getByRole('button',{name:'繼續上次牌局',exact:true}).waitFor();
  const resumeShot=await page.screenshot({path:`qa-output/resume-${viewport.width}.png`});if(viewport.width===844)console.log('QA_RESUME_844 '+resumeShot.toString('base64'));
  assert.equal(await page.locator('#opening-notice').isVisible(),false);
  await page.waitForTimeout(1000);assert.equal(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY),raw);
  await page.getByRole('button',{name:'繼續上次牌局',exact:true}).click();
  assert.equal(await page.locator('#hand .tile').count(),17);
  await page.locator('#hand .tile').first().click();await page.getByRole('button',{name:/^打出 /}).click();
  const after=await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY);assert.notEqual(after,raw);
  await page.reload();await page.getByRole('button',{name:'繼續上次牌局',exact:true}).waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY),after);
  const saved=JSON.parse(after);await page.close();const reopened=await ctx.newPage();await reopened.goto(url);await reopened.getByRole('button',{name:'繼續上次牌局',exact:true}).waitFor();
  assert.match(await reopened.locator('#resume-summary').innerText(),new RegExp(saved.game.players[0].score.toLocaleString()));
  await reopened.getByRole('button',{name:'開始新遊戲',exact:true}).click();await reopened.getByRole('button',{name:'繼續打牌',exact:true}).click();assert.equal(await reopened.evaluate(k=>localStorage.getItem(k),SAVE_KEY),after);
  await reopened.getByRole('button',{name:'繼續上次牌局',exact:true}).click();
  const other=await ctx.newPage();await other.goto(url);await other.getByRole('button',{name:'繼續上次牌局',exact:true}).waitFor();await other.getByRole('button',{name:'開始新遊戲',exact:true}).click();await other.locator('#confirm-restart').click();
  await reopened.locator('#save-conflict').waitFor({state:'visible'});const latest=await other.evaluate(k=>localStorage.getItem(k),SAVE_KEY);assert.notEqual(latest,after);
  await other.screenshot({path:`qa-output/save-new-${viewport.width}.png`});
  assert.deepEqual(errors,[]);await ctx.close();
 }
 // Production service worker installs and can reopen the game offline.
 const ctx=await browser.newContext();const page=await ctx.newPage();await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForTimeout(300);await ctx.setOffline(true);await page.reload();await page.getByRole('button',{name:'繼續上次牌局',exact:true}).waitFor();await page.getByRole('button',{name:'繼續上次牌局',exact:true}).click();assert.equal(await page.locator('#boot-status').count(),0);await ctx.close();
 const profile=await mkdtemp(join(tmpdir(),'qingzhu-save-'));
 let persistent=await chromium.launchPersistentContext(profile,{...browserOptions,headless:true});let tab=await persistent.newPage();await tab.goto(url);await tab.waitForFunction(k=>localStorage.getItem(k),SAVE_KEY);await persistent.close();
 persistent=await chromium.launchPersistentContext(profile,{...browserOptions,headless:true});tab=await persistent.newPage();await tab.goto(url);await tab.getByRole('button',{name:'繼續上次牌局',exact:true}).waitFor();await persistent.close();await rm(profile,{recursive:true,force:true});
 const invalid=await browser.newContext({serviceWorkers:'block'});const bad=await invalid.newPage();await bad.goto(url);await bad.evaluate(k=>localStorage.setItem(k,'{bad'),SAVE_KEY);await bad.reload();await bad.locator('#resume-game').waitFor({state:'visible'});assert.equal(await bad.locator('#continue-game').isVisible(),false);assert.equal(await bad.evaluate(k=>localStorage.getItem(k),SAVE_KEY),'{bad');await invalid.close();
 console.log('SAVE_BROWSER_OK reload reopen new-game cancel conflict desktop landscape offline');
}finally{await browser.close();server.close();}
