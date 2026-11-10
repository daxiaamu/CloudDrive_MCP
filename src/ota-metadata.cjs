'use strict';

// Windows adaptation of the update manifest. APK fields and installer rules do
// not apply to this portable desktop application.
const crypto = require('node:crypto');
const MAX_SIZE = 4 * 1024 * 1024 * 1024;
const MAX_TEXT = 64 * 1024;
function fail(message) { throw Object.assign(new Error(message), {code:'INVALID_UPDATE_METADATA'}); }
// Three numeric components, each 0..999, make the mapping monotonic. A
// prerelease suffix controls channel; it never changes ordering within a core.
function versionCode(version) {
 const match=/^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})(?:-[0-9A-Za-z.-]+)?$/.exec(version||'');
 if(!match)fail('版本无法转换为版本代码');
 return Number(match[1])*1000000+Number(match[2])*1000+Number(match[3]);
}
function httpsUrl(value) {
  let url; try { url = new URL(value); } catch { fail('更新地址无效'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('更新地址必须是 HTTPS');
  return url;
}
function normalizeManifest(value, channel = 'stable') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== 1 || value.product !== 'CloudDriveMCP' || value.platform !== 'windows-x64') fail('更新清单产品或平台不匹配');
  if (!['stable','beta'].includes(value.channel) || channel === 'stable' && value.channel !== 'stable') fail('更新渠道不匹配');
  for (const key of ['versionCode','maxForcedVersionCode','policyRevision','size']) if (!Number.isSafeInteger(value[key]) || value[key] < 0) fail('更新清单数字无效');
  if (value.versionCode < 1 || value.size < 1 || value.size > MAX_SIZE || value.maxForcedVersionCode >= value.versionCode) fail('更新清单边界无效');
  if (typeof value.versionName !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.versionName) || value.versionName.length > 80) fail('更新版本无效');
  if (versionCode(value.versionName) !== value.versionCode) fail('版本名称和版本代码不一致');
  if (!/^[a-f0-9]{64}$/.test(value.sha256 || '')) fail('缺少有效的 SHA-256');
  if (!Array.isArray(value.urls) || value.urls.length < 5 || value.urls.length > 32) fail('更新源不足');
  const urls=value.urls.map(httpsUrl), hosts=new Set(urls.map(url=>url.hostname.toLowerCase()));
  if (hosts.size < 5) fail('更新源必须来自至少五个不同主机');
  if (value.publishedAt != null && (typeof value.publishedAt !== 'string' || !/(?:Z|[+-]\d\d:\d\d)$/.test(value.publishedAt) || !Number.isFinite(Date.parse(value.publishedAt)))) fail('发布时间无效');
  if (value.changelog !== undefined && (typeof value.changelog !== 'string' || value.changelog.length > MAX_TEXT)) fail('更新说明过长');
  return {schemaVersion:1,product:value.product,platform:value.platform,channel:value.channel,versionCode:value.versionCode,versionName:value.versionName,maxForcedVersionCode:value.maxForcedVersionCode,policyRevision:value.policyRevision,size:value.size,sha256:value.sha256,urls:urls.map(u=>u.href),publishedAt:value.publishedAt||null,changelog:value.changelog||''};
}
function fingerprint(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function assess(candidate, previous, currentCode) {
  if (!Number.isSafeInteger(currentCode) || currentCode < 0) fail('当前版本代码无效');
  if (previous && (candidate.policyRevision < previous.policyRevision || candidate.versionCode < previous.versionCode)) fail('更新清单回滚');
  if (previous && candidate.policyRevision === previous.policyRevision && fingerprint(candidate) !== previous.fingerprint) fail('更新清单版本冲突');
  return {available:candidate.versionCode > currentCode, forced:candidate.versionCode > currentCode && currentCode <= candidate.maxForcedVersionCode};
}
function createCheckSession(check) {
  let current=null;
  return {check() { if (!current) current=Promise.resolve().then(check).finally(()=>{current=null;});return current; }};
}
module.exports={MAX_SIZE,versionCode,normalizeManifest,assess,fingerprint,createCheckSession};
