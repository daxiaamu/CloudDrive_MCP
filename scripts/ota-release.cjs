'use strict';
// Run only after the release asset exists. No mirror is trusted until its
// complete contents have been compared with the locally downloaded asset.
const fs=require('node:fs'),fsp=require('node:fs/promises'),crypto=require('node:crypto'),path=require('node:path');
const {versionCode,normalizeManifest}=require('../src/ota-metadata.cjs');
const hosts=['ghfast.top','gh-proxy.com','ghproxy.net','gh.llkk.cc','ghp.keleyaa.com','gh-proxy.org','gh.3w.pm','gh.jasonzeng.dev','ghproxy.vip'];
async function hashFile(file){const h=crypto.createHash('sha256');for await(const c of fs.createReadStream(file))h.update(c);return h.digest('hex');}
async function verify(url,size,sha){
 const r=await fetch(url,{signal:AbortSignal.timeout(20*60*1000),headers:{'User-Agent':'CloudDriveMCP-release'}});
 if(!r.ok||new URL(r.url).protocol!=='https:'||!r.body)throw Error('HTTP or redirect failure');
 const h=crypto.createHash('sha256');let bytes=0;
 for await(const chunk of r.body){bytes+=chunk.length;if(bytes>size)throw Error('size exceeded');h.update(chunk);}
 if(bytes!==size||h.digest('hex')!==sha)throw Error('content mismatch');
}
async function main(){
 const release=JSON.parse(await fsp.readFile(process.env.OTA_RELEASE_JSON,'utf8'));
 const policy=JSON.parse(await fsp.readFile('updates/policy.json','utf8'));
 const version=String(release.tag_name||'').replace(/^v/,'');const code=versionCode(version);
 const assetName=`CloudDriveMCP-${version}-Windows-x64-Portable.zip`;
 const asset=(release.assets||[]).find(x=>x.name===assetName);
 if(!asset||!/^https:\/\/github\.com\/daxiaamu\/CloudDrive_MCP\/releases\/download\//.test(asset.browser_download_url))throw Error('release asset is missing');
 const file=path.join(process.env.OTA_ASSET_DIR,assetName);const size=(await fsp.stat(file)).size,sha=await hashFile(file);
 if(size!==asset.size)throw Error('release asset size mismatch');
 if(!Number.isSafeInteger(policy.policyRevision)||policy.policyRevision<0||policy.policyRevision>=1000||!Number.isSafeInteger(policy.maxForcedVersionCode)||!policy.reason)throw Error('invalid policy');
 const candidates=hosts.map(host=>`https://${host}/${asset.browser_download_url}`);
 const results=await Promise.all(candidates.map(async url=>{try{await verify(url,size,sha);console.log(`verified ${new URL(url).host}`);return url}catch(e){console.error(`failed ${new URL(url).host}: ${e.message}`);return null;}}));
 const urls=results.filter(Boolean);if(urls.length<5)throw Error(`only ${urls.length} validated mirrors; retaining previous metadata`);
 urls.push(asset.browser_download_url);
 const manifest=normalizeManifest({schemaVersion:1,product:'CloudDriveMCP',platform:'windows-x64',channel:release.prerelease?'beta':'stable',versionCode:code,versionName:version,maxForcedVersionCode:policy.maxForcedVersionCode,policyRevision:code*1000+policy.policyRevision,size,sha256:sha,urls,publishedAt:release.published_at,changelog:release.body||''},release.prerelease?'beta':'stable');
 await fsp.writeFile(process.env.OTA_OUTPUT,JSON.stringify(manifest,null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={verify,hashFile};
