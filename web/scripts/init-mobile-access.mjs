import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'data/profiles.json'), 'utf8'));
const owner = registry.profiles.find(p => p.id === registry.defaultProfileId);
if (!owner) throw new Error('Default profile missing.');
const profile = yaml.load(fs.readFileSync(path.join(root,owner.config), 'utf8'));
const email = String(profile.candidate?.email || '').trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Set the owner email in the default profile before enabling remote login.');
const destination = path.join(root, '.career-ops-web/mobile-access.json');
const shareIndex = process.argv.indexOf('--share-with');
const sharedEmail = shareIndex >= 0 ? String(process.argv[shareIndex + 1] || '').trim().toLowerCase() : '';
if (shareIndex >= 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sharedEmail)) throw new Error('Pass a valid email after --share-with.');
if (fs.existsSync(destination)) {
  const data=JSON.parse(fs.readFileSync(destination,'utf8'));
  if (sharedEmail) {
    const updated={...data,workspaceMode:'shared',accounts:{...data.accounts,[email]:{role:'admin'},[sharedEmail]:{role:'admin'}}};
    fs.writeFileSync(destination+'.tmp',JSON.stringify(updated,null,2)+'\n',{mode:0o600});fs.renameSync(destination+'.tmp',destination);
    console.log('Shared workspace admin granted.');
  } else if(process.argv.includes('--sync-owner-profiles')) {
    const updated={...data,accounts:{...data.accounts,[email]:{role:'admin'}}};
    fs.writeFileSync(destination+'.tmp',JSON.stringify(updated,null,2)+'\n',{mode:0o600});fs.renameSync(destination+'.tmp',destination);
    console.log('Owner migrated to dynamic admin access. Other accounts were not widened.');
  } else console.log('Existing mobile access configuration preserved.');
} else {
  const data = { host: 'jobs.thegreatnovel.com', accounts: { [email]: {role:'admin'} } };
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,JSON.stringify(data,null,2)+'\n',{mode:0o600});
  console.log('Owner-only mobile access initialized as admin.');
}
