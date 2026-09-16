import {cp,readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
async function files(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);out.push(...(e.isDirectory()?await files(p):[p]));}return out.sort();}
const source=await files('dist'),hash=createHash('sha256');for(const p of source){hash.update(p);hash.update(await readFile(p));}const version=hash.digest('hex').slice(0,16),prefix=`releases/${version}/`;
await rm('site',{recursive:true,force:true});await cp('dist','site',{recursive:true});await mkdir('site/'+prefix,{recursive:true});await cp('dist','site/'+prefix,{recursive:true});
let html=await readFile('dist/index.html','utf8');
html=html.replace(/(?:href|src)="(?:style\.css|responsive\.css(?:\?v=\d+)?|app\.mjs|viewport\.mjs)"/g,s=>s.replace('="','="'+prefix).replace(/\?v=\d+/,''));
await writeFile('site/index.html',html);
const assets=(await files('site/'+prefix)).map(p=>'./'+p.slice(5)).filter(p=>!p.endsWith('/sw.js')&&!p.endsWith('/index.html'));
await writeFile('site/sw.js',`const CACHE='qingzhu-release-${version}';const ASSETS=${JSON.stringify(['./','./index.html',...assets])};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('qingzhu-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(async()=>await caches.match(e.request)||(e.request.mode==='navigate'?await caches.match('./index.html'):null)||Response.error()));});
`);
await writeFile('site/404.html','<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>找不到頁面 · 青竹牌室</title><body style="background:#101f1c;color:#eee;font:18px sans-serif;padding:10vw"><h1>找不到這個頁面</h1><p>你的本機存檔不會因此被清除。</p><a style="color:#e0c18a" href="/Majongtest001/">返回青竹牌室</a></body></html>');
console.log('Built release '+version);
