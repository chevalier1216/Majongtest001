import {readFileSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
const refs=readFileSync(0,'utf8').trim().split('\n').filter(Boolean).map(line=>line.split(/\s+/));
const updates=refs.filter(([,sha])=>!/^0+$/.test(sha));
if(!updates.length)process.exit(0);
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(updates.some(([,sha,,])=>sha!==head)){
 console.error('Push blocked: check out and verify the exact commit you intend to push.');process.exit(1);
}
if(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()){
 console.error('Push blocked: commit or preserve uncommitted files before verifying the release.');process.exit(1);
}
const result=spawnSync(process.execPath,['scripts/preflight.mjs'],{stdio:'inherit'});
process.exit(result.error||result.signal?1:result.status??1);
