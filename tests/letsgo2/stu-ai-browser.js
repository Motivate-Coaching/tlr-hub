const { chromium } = require('playwright');
const OUT = require('os').tmpdir() + '/'; // run from repo: python3 -m http.server 8771 --directory letsgo2
const STUB = `window.__calls=[];window.supabase={createClient:function(){var ch={on:function(){return ch},subscribe:function(){return ch}};var q=function(){var o={select:function(){return o},eq:function(){return o},order:function(){return o},limit:function(){return o},gte:function(){return o},in:function(){return o},maybeSingle:function(){return Promise.resolve({data:null})},single:function(){return Promise.resolve({data:null})},upsert:function(){return Promise.resolve({})},insert:function(){return Promise.resolve({})},then:function(r){return Promise.resolve({data:[]}).then(r)}};return o};return {auth:{getSession:function(){return Promise.resolve({data:{session:null}})},getUser:function(){return Promise.resolve({data:{user:null}})},onAuthStateChange:function(){return {data:{subscription:{unsubscribe:function(){}}}}},signInAnonymously:function(){return Promise.resolve({data:{user:{id:'g1',is_anonymous:true},session:{}}})}},from:q,rpc:function(){return Promise.resolve({data:null})},channel:function(){return ch},
functions:{invoke:function(n,o){var b=o&&o.body||{};window.__calls.push(n+':'+(b.kind||''));
 if(n==='letsgo-stu'){var k=b.kind;
  if(k==='note')return Promise.resolve({data:{at_risk:false,suggest:true,line:'You wrote “too tired in the mornings again”. Would it help to try it after lunch?',change:{type:'cue',value:'After I finish my lunch'}}});
  if(k==='struggle')return Promise.resolve({data:{at_risk:false,line:'Work has been mad, and that’s fair. A smaller version still counts.',today:'Walk round the block in your trainers.'}});
  if(k==='weekly')return Promise.resolve({data:{at_risk:false,line:'You showed up twice in full and once smaller, and came back after a gap. Evenings seem to suit you.',try:'Try one evening run next week.'}});
  if(k==='reflect')return Promise.resolve({data:{at_risk:false,draft:'Mornings were tough for me. Evenings felt easier, and I ran 3k without stopping.'}});
  if(k==='chat'){var last=b.messages[b.messages.length-1].text;if(/better off without me/.test(last))return Promise.resolve({data:{crisis:true}});return Promise.resolve({data:{reply:'Tie it to something you already do, like your first cup of tea. Which part of your day gets away from you first?',takeaway:'Pick a time for your run and note it down.',last:false,left:9}})}
 }
 if(n==='letsgo-check'){var res=b.items.map(function(i){if(/get fit/i.test(i.answer))return {id:i.id,fits:true,corrected:'',sharpen:{question:'“Get fit” is a big one. What would a first step look like?',options:['Walk 10 minutes after dinner','Do 5 squats after brushing my teeth']}};return {id:i.id,fits:true,corrected:''}});return Promise.resolve({data:{at_risk:false,results:res}})}
 return new Promise(function(){})}}};}};`;
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort()); await ctx.addInitScript(STUB);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const out = [];
  await p.goto('http://localhost:8771/index.html'); await p.waitForTimeout(600);
  const seed = async (scr, view) => { await p.evaluate(([scr, view]) => {
    const L = window.LGM, t = L.today(), d = L.addDays, iso = new Date().toISOString();
    const ent = {}; [-9,-8,-6,-5,-3,-2,-1].forEach((k,i) => ent[d(t,k)] = { kind: i===3?'small':'full', at: iso, note: i===4?'Too tired in the mornings again':'' });
    const act = (id, text, rule, e) => ({ id, text, cue: 'make coffee', small: 'Walk round the block', from: d(t,-9), schedules: [{ from: d(t,-9), ...rule }], entries: e||{}, extra: {}, createdAt: iso });
    const s = { v: 3, settings: { view, tz: 'Africa/Johannesburg' }, movedSeen: true, stuSeen: {}, fb: {},
      habit: { id: 'f1', title: 'Get fitter', mode: 'more', towards: 'Running 5k', matters: 'Keep up with my life', deeper: 'Feel strong in my body', sign: 'Stairs without puffing', length: 30, start: d(t,-9), status: 'active', pauses: [], later: [], feel: [], gives: [], extra: {}, actions: [act('run','Go for a run',{type:'days',days:[0,1,2,3,4,5,6]}, ent)], tasks: [] },
      archive: [], screen: scr };
    localStorage.setItem('letsgo-v2-state', JSON.stringify(s)); }, [scr, view]); await p.reload(); await p.waitForTimeout(900); };
  // 1. note -> tip on Today
  await seed('tracker', 'full');
  await p.evaluate(() => { window.__calls = []; });
  await p.click('text=Done').catch(()=>{}); await p.waitForTimeout(500); const nb = await p.$('[data-note]'); out.push('note button: ' + !!nb); if (nb) { await nb.click(); await p.waitForTimeout(500); }
  const hasNote = await p.$('#note'); out.push('note screen: ' + !!hasNote);
  if (hasNote) { await p.fill('#note', 'Too tired in the mornings again, kept snoozing'); await p.click('[data-act="savenote"]'); await p.waitForTimeout(900); }
  const tip = await p.$('.stutip'); out.push('1 note tip on Today: ' + (tip ? (await tip.innerText()).replace(/\s+/g, ' ').slice(0, 120) : 'NONE ' + await p.evaluate(() => window.__calls.join(','))));
  await p.screenshot({ path: OUT + 'stu-1-tip.png' });
  if (tip) { await p.click('[data-stu="tipyes"]'); await p.waitForTimeout(300); out.push('   applied cue: ' + await p.evaluate(() => JSON.parse(localStorage.getItem('letsgo-v2-state')).habit.actions[0].cue)); }
  // 2. struggle
  await seed('tracker', 'full'); await p.click('[data-tab="slipped"]'); await p.waitForTimeout(500); const sc = await p.$('[data-struggle="start"]'); if (sc) { await sc.click(); await p.waitForTimeout(300); }
  const sw = await p.$('#stuwhat'); out.push('2 struggle box: ' + !!sw);
  if (sw) { await p.fill('#stuwhat', 'Work has been mad, cannot face it'); await p.click('[data-stu="help"]'); await p.waitForTimeout(700); out.push('   reply: ' + ((await p.$('.stuhelp')) ? (await p.innerText('.stuhelp')).replace(/\s+/g, ' ').slice(0, 120) : 'NONE')); await p.screenshot({ path: OUT + 'stu-2-struggle.png', fullPage: true }); const did = await p.$('[data-stu="didsmall"]'); if (did) { await did.click(); await p.waitForTimeout(300); out.push('   logged today: ' + await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('letsgo-v2-state')); const e = s.habit.actions[0].entries[window.LGM.today()]; return e && e.kind + ' / ' + e.note; })); } }
  // 3. weekly
  await seed('progress', 'full'); await p.waitForTimeout(800);
  out.push('3 weekly: ' + ((await p.$('.stuweek')) ? (await p.innerText('.stuweek')).replace(/\s+/g, ' ').slice(0, 120) : 'NONE ' + await p.evaluate(() => window.__calls.join(','))));
  await p.screenshot({ path: OUT + 'stu-3-weekly.png' });
  // 4. reflect
  await seed('reflect', 'full'); const dr = await p.$('[data-stu="draft"]'); out.push('4 draft button: ' + !!dr);
  if (dr) { await dr.click(); await p.waitForTimeout(700); out.push('   noticed: ' + (await p.inputValue('#noticed')).slice(0, 80)); }
  // 5. chat
  await seed('tracker', 'full'); const en = await p.$('[data-stu="open"]'); out.push('5 Ask Stu entry on Today: ' + !!en);
  if (en) { await en.click(); await p.waitForTimeout(400); await p.fill('#stumsg', 'I keep putting my runs off. Any ideas?'); await p.click('[data-stu="send"]'); await p.waitForTimeout(700); out.push('   reply shown: ' + ((await p.$$('.chatlog .stuai')).length)); await p.screenshot({ path: OUT + 'stu-5-chat.png' });
    const keep = await p.$('[data-stu="keep"]'); if (keep) { await keep.click(); await p.waitForTimeout(300); out.push('   saved task: ' + await p.evaluate(() => (JSON.parse(localStorage.getItem('letsgo-v2-state')).habit.tasks || []).map(t => t.text).join('|'))); }
    await p.fill('#stumsg', 'Honestly everyone would be better off without me'); await p.click('[data-stu="send"]'); await p.waitForTimeout(700);
    out.push('   crisis card: ' + ((await p.$('.crisiscard')) ? (await p.innerText('.crisiscard')).replace(/\s+/g, ' ').slice(0, 160) : 'NONE') + ' | input left: ' + !!(await p.$('#stumsg')));
    await p.screenshot({ path: OUT + 'stu-6-crisis.png' }); }
  // 6. sharpen in setup
  await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:8771/index.html'); await p.waitForTimeout(700);
  await p.click('text=Build a habit'); await p.waitForTimeout(400); await p.fill('#sayans', 'get fit'); await p.click('[data-act="shape"]'); await p.waitForTimeout(700);
  out.push('6 sharpen card: ' + ((await p.$('.chkcard.sharpen')) ? (await p.innerText('.chkcard.sharpen')).replace(/\s+/g, ' ').slice(0, 140) : 'NONE'));
  await p.screenshot({ path: OUT + 'stu-7-sharpen.png' });
  const pick = await p.$('[data-chk="pick"]'); if (pick) { await pick.click(); await p.waitForTimeout(500); out.push('   picked: ' + await p.evaluate(() => (document.getElementById('sayans') || {}).value || JSON.parse(localStorage.getItem('letsgo-v2-state')).draft.say)); }
  // Focus view entry
  await seed('tracker', 'focus'); out.push('Focus view Ask Stu entry: ' + !!(await p.$('[data-stu="open"]')));
  out.push('errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  console.log(out.join('\n')); await br.close();
})();
