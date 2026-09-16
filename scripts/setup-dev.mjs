import {spawnSync} from 'node:child_process';
const npm=process.platform==='win32'?'npm.cmd':'npm';
const commands=[[npm,['install','--no-save','--package-lock=false','playwright@1.58.2']],[process.execPath,['node_modules/playwright/cli.js','install','chromium']],['git',['config','--local','core.hooksPath','.githooks']]];
if(process.env.MAHJONG_CHROMIUM_PATH)commands.splice(1,1);
for(const [command,args] of commands){
 const r=spawnSync(command,args,{stdio:'inherit',shell:process.platform==='win32'&&command===npm});
 if(r.error||r.status!==0){console.error(r.error?.message||'Setup failed');process.exit(r.status||1);}
}
console.log('Pre-push verification enabled. Run: node scripts/preflight.mjs');
