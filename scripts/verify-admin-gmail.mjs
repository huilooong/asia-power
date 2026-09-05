import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
function get(url){const r=spawnSync('curl',['-fsS','--max-time','25','-A','AsiaPower-Release-bot/1.0',url],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;}
const html=get('https://asia-power.com/admin/leads.html');assert.match(html,/admin-leads\.js\?v=gmail-reply-20260905/);assert.match(html,/noindex/);
const js=get('https://asia-power.com/js/admin-leads.js?v=gmail-reply-20260905');assert.match(js,/function buildGmailReplyUrl/);assert.match(js,/Gmail 回复/);assert.match(js,/authuser: 'sales@asia-power.com'/);assert.match(js,/data-mark-replied/);console.log('PASS: admin page version, Gmail action, Sales account, existing status action');
