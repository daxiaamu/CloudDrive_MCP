'use strict';
const fs=require('node:fs'),{normalizeManifest,assess,fingerprint}=require('../src/ota-metadata.cjs');
const [input,output]=process.argv.slice(2),channel=output.includes('windows-beta.')?'beta':'stable';
const m=normalizeManifest(JSON.parse(fs.readFileSync(input,'utf8')),channel);
if(m.channel!==channel)throw Error('release channel mismatch');
if(fs.existsSync(output)){const old=normalizeManifest(JSON.parse(fs.readFileSync(output,'utf8')),channel);assess(m,{versionCode:old.versionCode,policyRevision:old.policyRevision,fingerprint:fingerprint(old)},0);}
const temp=output+'.tmp';fs.writeFileSync(temp,JSON.stringify(m,null,2)+'\n');fs.renameSync(temp,output);
