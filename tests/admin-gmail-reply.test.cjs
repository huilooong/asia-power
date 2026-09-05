const fs=require('fs');const vm=require('vm');const {test}=require('node:test');const assert=require('node:assert/strict');
const src=fs.readFileSync('js/admin-leads.js','utf8').replace("  document.addEventListener('DOMContentLoaded', initAdminLeads);",'  window.testApi={buildGmailReplyUrl,renderLeadCard};');
const window={location:{search:''}};vm.runInNewContext(src,{window,URLSearchParams,Date,Set});const api=window.testApi;
test('Gmail compose targets Sales with one encoded customer and subject, without internal summary',()=>{
 const lead={id:'T1',email:'buyer+parts@example.com',replySubject:'Re: G4KD & gearbox / 报价',clientIp:'private-ip'};
 const u=new URL(api.buildGmailReplyUrl(lead));assert.equal(u.origin,'https://mail.google.com');assert.equal(u.searchParams.get('authuser'),'sales@asia-power.com');assert.equal(u.searchParams.get('to'),lead.email);assert.equal(u.searchParams.get('su'),lead.replySubject);assert.equal(u.searchParams.get('body'),null);assert.equal(u.searchParams.get('bcc'),null);
});
test('missing or malformed emails do not produce a Gmail action',()=>{
 for(const email of ['',null,'invalid','a@example.com\r\nBcc:x@example.com','a@example.com,b@example.com'])assert.equal(api.buildGmailReplyUrl({email}),'');
});
test('Gmail remains available for follow-up on replied customers without marking them replied',()=>{
 const lead={id:'T1',source:'contact-form',name:'Demo',email:'buyer@example.com',replyStatus:'replied'};
 const html=api.renderLeadCard(lead);assert.match(html,/Gmail 回复/);assert.match(html,/noopener noreferrer/);assert.doesNotMatch(html,/data-mark-replied/);assert.equal(lead.replyStatus,'replied');
});
module.exports={api};
