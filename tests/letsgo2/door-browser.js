// Invite-only front door (16 Nov 2026). Run from the repo root:
//   python3 -m http.server 8772 --directory letsgo2   then   node tests/letsgo2/door-browser.js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const OUT = require('os').tmpdir() + '/';
const TOKEN = '11111111-2222-3333-4444-555555555555';
// Fake Supabase: one invited person (founder@example.com, "Sam"); everyone else is refused by the code server.
const STUB = `window.__calls=[];(function(){var signedIn=JSON.parse(sessionStorage.getItem('stubUser')||'null');var ch={on:function(){return ch},subscribe:function(){return ch}};
var q=function(){var o={select:function(){return o},eq:function(){return o},order:function(){return o},limit:function(){return o},gte:function(){return o},in:function(){return o},is:function(){return o},maybeSingle:function(){return Promise.resolve({data:null,error:null})},single:function(){return Promise.resolve({data:null,error:null})},insert:function(){return Promise.resolve({data:null,error:null})},upsert:function(){return Promise.resolve({data:null,error:null})},update:function(){return o},delete:function(){return o},then:function(r){return Promise.resolve({data:[],error:null}).then(r)}};return o};
window.supabase={createClient:function(){return {channel:function(){return ch},removeChannel:function(){},from:q,
 rpc:function(n,a){window.__calls.push('rpc:'+n);
  if(n==='lg_invite_lookup')return Promise.resolve({data:a&&a.t==='${TOKEN}'?{email:'founder@example.com',name:'Sam'}:null,error:null});
  if(n==='lg_my_access')return Promise.resolve({data:signedIn&&signedIn.email==='founder@example.com'?{ok:true,kind:'founder',free_until:'2027-02-28'}:{ok:false},error:null});
  return Promise.resolve({data:null,error:null})},
 auth:{getSession:function(){return Promise.resolve({data:{session:signedIn?{user:signedIn}:null}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}},
  signInAnonymously:function(){return Promise.resolve({data:{user:{id:'g1',is_anonymous:true}},error:null})},
  verifyOtp:function(){signedIn={id:'u1',email:window.__lastEmail,user_metadata:{}};sessionStorage.setItem('stubUser',JSON.stringify(signedIn));return Promise.resolve({data:{user:signedIn},error:null})},
  updateUser:function(){return Promise.resolve({data:{user:signedIn},error:null})},
  signOut:function(){signedIn=null;sessionStorage.removeItem('stubUser');return Promise.resolve({error:null})}},
 functions:{invoke:function(n,o){var b=o&&o.body||{};window.__calls.push(n+':'+(b.action||b.kind||'')+':'+(b.door?'door':''));
  if(n==='showup-code'){if(b.action==='send'||b.action==='verify'){if(b.door&&b.email!=='founder@example.com')return Promise.resolve({data:null,error:{context:{json:function(){return Promise.resolve({error:'invite_only'})}}}});window.__lastEmail=b.email;return Promise.resolve({data:b.action==='send'?{ok:true}:{token_hash:'th'},error:null})}}
  return new Promise(function(){})}}};}};})();`;

(async () => {
  const br = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await ctx.addInitScript(STUB);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const text = async () => (await p.innerText('#view')).replace(/\s+/g, ' ');

  // 1. A personal invite link opens the front door with their name and email filled in, and the token leaves the address bar.
  await p.goto('http://localhost:8772/index.html?invite=' + TOKEN); await p.waitForTimeout(900);
  let t = await text();
  assert.match(t, /Welcome, Sam/); assert.match(t, /invite-only for now/);
  assert.equal(await p.inputValue('#aemail'), 'founder@example.com');
  assert.ok(!/invite=/.test(p.url()), 'token removed from the address bar');
  assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-screen')), 'door');
  await p.screenshot({ path: OUT + 'door-1-invite.png' });

  // 2. Someone who was forwarded the link and types their own email gets a clear no, and no code is sent.
  await p.fill('#aemail', 'stranger@example.com'); await p.check('#aconsent'); await p.click('[data-act="sendcode"]'); await p.waitForTimeout(400);
  t = await text(); assert.match(t, /isn’t on the invite list/);
  assert.ok(await p.evaluate(() => window.__calls.includes('showup-code:send:door')), 'sign-in asks for the invite check');
  await p.screenshot({ path: OUT + 'door-2-refused.png' });

  // 3. The invited person gets the code, types it, and is in.
  await p.fill('#aemail', 'founder@example.com'); await p.click('[data-act="sendcode"]'); await p.waitForTimeout(400);
  t = await text(); assert.match(t, /Check your email/); assert.match(t, /Founding members/i);
  await p.fill('#acode', '123456'); await p.waitForTimeout(1200);
  assert.notEqual(await p.evaluate(() => document.documentElement.getAttribute('data-screen')), 'door');
  const acc = await p.evaluate(() => JSON.parse(localStorage.getItem('letsgo-v2-access')));
  assert.equal(acc.ok, true); assert.equal(acc.kind, 'founder');
  await p.screenshot({ path: OUT + 'door-3-in.png' });

  // 4. Settings shows the founding member note.
  await p.evaluate(() => {
    const L = window.LGM, t = L.today(), d = L.addDays, iso = new Date().toISOString(), st = JSON.parse(localStorage.getItem('letsgo-v2-state'));
    st.habit = { id: 'f1', title: 'Get fitter', mode: 'more', towards: 'Running 5k', matters: 'Keep up', length: 30, start: d(t, -3), status: 'active', pauses: [], later: [], feel: [], gives: [], extra: {}, tasks: [],
      actions: [{ id: 'run', text: 'Go for a run', cue: 'make coffee', small: 'Walk round the block', from: d(t, -3), schedules: [{ from: d(t, -3), type: 'days', days: [0, 1, 2, 3, 4, 5, 6] }], entries: {}, extra: {}, createdAt: iso }] };
    st.screen = 'tracker'; localStorage.setItem('letsgo-v2-state', JSON.stringify(st)); });
  await p.reload(); await p.waitForTimeout(1200);
  assert.notEqual(await p.evaluate(() => document.documentElement.getAttribute('data-screen')), 'door', 'still in after a reload');
  await p.click('#settingsBtn'); await p.waitForTimeout(500);
  assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-screen')), 'settings');
  t = await text(); assert.match(t, /Founding member/i); assert.match(t, /Free until 28 February 2027/);
  await p.screenshot({ path: OUT + 'door-4-settings.png' });

  // 4b. Signing out closes the door again.
  await p.evaluate(() => { sessionStorage.removeItem('stubUser'); }); await p.reload(); await p.waitForTimeout(1200);
  assert.equal(await p.evaluate(() => document.documentElement.getAttribute('data-screen')), 'door');

  // 5. No invite link, no saved access: the door shows a blank email.
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.goto('http://localhost:8772/index.html'); await p.waitForTimeout(900);
  t = await text(); assert.match(t, /^Founding members Welcome /i); assert.equal(await p.inputValue('#aemail'), '');

  assert.deepEqual(errs, []);
  console.log('Passed: invite link prefill and token removal, refused stranger with no code sent, founder sign-in and saved access, founding note in Settings, signed-out door, blank door.');
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
