import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const hook=fileURLToPath(new URL('../scripts/pre-push.mjs',import.meta.url));
test('pre-push rejects unverified refs and dirty candidates before running any tests',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mahjong-hook-'));
 try{
  const git=(...args)=>execFileSync('git',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','ignore']});
  git('init');git('-c','user.name=Gate Test','-c','user.email=test@example.test','commit','--allow-empty','-m','fixture');
  const head=git('rev-parse','HEAD').trim();
  const run=sha=>spawnSync(process.execPath,[hook],{cwd:dir,input:`refs/heads/fix/test ${sha} refs/heads/fix/test ${'0'.repeat(40)}\n`,encoding:'utf8'});
  assert.equal(run('0'.repeat(40)).status,0);
  const wrong=run('1'.repeat(40));assert.equal(wrong.status,1);assert.match(wrong.stderr,/exact commit/);
  writeFileSync(join(dir,'uncommitted.txt'),'unfinished');
  const dirty=run(head);assert.equal(dirty.status,1);assert.match(dirty.stderr,/uncommitted/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
