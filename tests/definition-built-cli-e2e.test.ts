import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

let root='';
afterEach(async()=>{if(root)await rm(root,{recursive:true,force:true});});
function cli(args:string[]){return spawnSync(process.execPath,[path.resolve('dist/cli/bin.js'),...args],{cwd:root,encoding:'utf8'});}

describe('built CLI Change 07 E2E',()=>{
  it('exposes define status without inventing a Definition or approval',async()=>{
    root=await mkdtemp(path.join(tmpdir(),'productkit-built-definition-'));const init=cli(['init']);expect(init.status).toBe(0);
    const status=cli(['define','status']);expect(status.status).toBe(0);expect(status.stdout).toContain('Definition: not created');expect(status.stdout).toContain('Policies: 0');
    await expect(readdir(path.join(root,'product','applications'))).rejects.toMatchObject({code:'ENOENT'});
    const help=cli(['define','application','--help']);expect(help.status).toBe(0);expect(help.stdout).toContain('recover');expect(help.stdout).toContain('rollback');
  });
});
