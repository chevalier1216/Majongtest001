import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
// The same command runs before pushing and in CI. Any failure stops the chain.
const tests=readdirSync('tests').filter(p=>p.endsWith('.test.mjs')).sort().map(p=>'tests/'+p);
for(const args of [['--test',...tests],['scripts/build.mjs'],['tests/layout.browser.mjs'],['tests/save.browser.mjs']]){
 const result=spawnSync(process.execPath,args,{stdio:'inherit'});
 if(result.error)console.error(result.error.message);
 if(result.error||result.status!==0)process.exit(result.status||1);
}
console.log('PREFLIGHT_OK: rules, production build, layout, save/restore and offline checks passed.');
