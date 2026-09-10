import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const accessFile=process.env.JOBPILOT_ACCESS_CONFIG||path.join(root,'.career-ops-web','mobile-access.json');
const profilesFile=path.join(root,'data','profiles.json');
const args=process.argv.slice(2);
const command=args[0]||'';
const value=name=>{const index=args.indexOf(`--${name}`);return index>=0?String(args[index+1]||'').trim():'';};
const email=value('email').toLowerCase();
const validEmail=input=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
const validId=input=>/^[a-z0-9][a-z0-9_-]{0,39}$/.test(input);
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const atomicJson=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);};
const access=fs.existsSync(accessFile)?readJson(accessFile):{host:'jobs.thegreatnovel.com',accounts:{}};
access.accounts ||= {};

function uniqueProfileId(registry,requested,emailAddress){
  if(requested){if(!validId(requested))throw new Error('Profile id must use lowercase letters, numbers, _ or -.');return requested;}
  const base=(emailAddress.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32)||'candidate');
  let id=base,index=2;while(registry.profiles.some(profile=>profile.id===id)){id=`${base.slice(0,34-String(index).length)}-${index++}`;}return id;
}
function ensureProfile(emailAddress,name,requestedId){
  const registry=readJson(profilesFile);registry.profiles ||= [];
  const existing=registry.profiles.find(profile=>profile.id===requestedId)||registry.profiles.find(profile=>profile.accountEmail===emailAddress);
  if(existing)return existing.id;
  const id=uniqueProfileId(registry,requestedId,emailAddress),displayName=name||emailAddress.split('@')[0];
  const relRoot=`.career-ops-web/profiles/${id}`;
  const profile={id,name:displayName,shortName:displayName,accountEmail:emailAddress,cvMarkdown:`${relRoot}/cv.md`,config:`${relRoot}/profile.yml`,notes:`${relRoot}/_profile.md`,candidatures:`${relRoot}/candidatures.json`};
  const directory=path.join(root,relRoot);fs.mkdirSync(directory,{recursive:true});
  const configFile=path.join(directory,'profile.yml');
  if(!fs.existsSync(configFile))fs.writeFileSync(configFile,`candidate:\n  full_name: ${JSON.stringify(displayName)}\n  email: ${JSON.stringify(emailAddress)}\ncv:\n  language: fr\ntarget_roles:\n  primary: []\n  contract_types: []\n`,'utf8');
  const notesFile=path.join(directory,'_profile.md');if(!fs.existsSync(notesFile))fs.writeFileSync(notesFile,'','utf8');
  const candidaturesFile=path.join(directory,'candidatures.json');if(!fs.existsSync(candidaturesFile))atomicJson(candidaturesFile,{candidate:displayName,updatedAt:new Date().toISOString(),jobs:[]});
  registry.profiles.push(profile);atomicJson(profilesFile,registry);return id;
}

if(command==='invite-user'){
  if(!validEmail(email))throw new Error('Pass --email with a valid Google account email.');
  const id=ensureProfile(email,value('name'),value('profile'));
  access.accounts[email]={role:'user',profileId:id};atomicJson(accessFile,access);
  console.log(`Invited user ${email}; own profile=${id}; CV required until uploaded.`);
}else if(command==='grant-admin'){
  if(!validEmail(email))throw new Error('Pass --email with a valid Google account email.');
  access.accounts[email]={role:'admin'};atomicJson(accessFile,access);console.log(`Admin granted: ${email}`);
}else if(command==='revoke'){
  if(!validEmail(email))throw new Error('Pass --email with a valid account email.');
  delete access.accounts[email];atomicJson(accessFile,access);console.log(`Access revoked: ${email}`);
}else if(command==='set-google-client'){
  const clientId=value('client-id');if(!/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId))throw new Error('Pass --client-id with the Google Web Client ID.');
  access.googleClientId=clientId;atomicJson(accessFile,access);console.log('Google Web Client ID saved in the private JobPilot access configuration.');
}else{
  console.log('Usage:\n  node web/scripts/manage-access.mjs grant-admin --email person@gmail.com\n  node web/scripts/manage-access.mjs invite-user --email person@gmail.com --name "Person Name" [--profile person]\n  node web/scripts/manage-access.mjs revoke --email person@gmail.com\n  node web/scripts/manage-access.mjs set-google-client --client-id 123.apps.googleusercontent.com');
  process.exitCode=command?1:0;
}
