import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
// Idempotent first-run bootstrap for a local preview only. Production migrations
// remain immutable in drizzle/ and are managed by the deployment platform.
mkdirSync('.wrangler/bootstrap',{recursive:true});
const sql=readFileSync('drizzle/0000_serious_nicolaos.sql','utf8').replaceAll('CREATE TABLE ','CREATE TABLE IF NOT EXISTS ').replaceAll('CREATE INDEX ','CREATE INDEX IF NOT EXISTS ');
writeFileSync('.wrangler/bootstrap/local.sql',sql);
const cli='node_modules/wrangler/bin/wrangler.js';
const result=spawnSync(process.execPath,[cli,'d1','execute','DB','--local','--config','wrangler.local.jsonc','--file','.wrangler/bootstrap/local.sql'],{stdio:'inherit'});
process.exit(result.status??1);
