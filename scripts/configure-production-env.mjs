// Read Supabase CLI key JSON from stdin; never log secret values.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const keys=JSON.parse(readFileSync(0,'utf8'));
const publishable=keys.find(k=>k.type==='publishable')??keys.find(k=>k.name==='anon');
const secret=keys.find(k=>k.type==='secret')??keys.find(k=>k.name==='service_role');
if(!publishable?.api_key||!secret?.api_key)throw new Error('Required Supabase keys unavailable');
const values={NEXT_PUBLIC_SUPABASE_URL:'https://lfxqunzxpagpuwsxlatx.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:publishable.api_key,SUPABASE_SECRET_KEY:secret.api_key,NEXT_PUBLIC_SITE_URL:'https://blindtest-friend.vercel.app',ROOM_CAPACITY:'32',RECOVERY_SECRET:randomBytes(32).toString('hex')};
writeFileSync('.env.production.local',Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n');
for(const [name,value] of Object.entries(values)){
 const args=`npx vercel@65.12.1 env add ${name} production --scope pikwaii93s-projects --yes${name==='SUPABASE_SECRET_KEY'||name==='RECOVERY_SECRET'?' --sensitive':''}`;
 const result=spawnSync('cmd.exe',['/d','/s','/c',args],{input:value,encoding:'utf8',env:process.env});
 if(result.status!==0)throw new Error(`Failed configuring ${name}: ${result.stderr.replaceAll(value,'[REDACTED]')}`);
 console.log(`${name}: configured for production`);
}
