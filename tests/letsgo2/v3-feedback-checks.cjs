const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../../letsgo2/model.js');
function node() { return {innerHTML:'',value:'',hidden:false,style:{},dataset:{},classList:{toggle(){},add(){},remove(){},contains(){return false;}},setAttribute(){},getAttribute(){return null;},addEventListener(){},removeEventListener(){},appendChild(){},remove(){},focus(){},querySelector(){return null;},querySelectorAll(){return [];}}; }
const nodes = {};
const storage = new Map();
const context = { console,Date,Intl,Math,JSON,Set,Map,Promise,String,Number,Object,Array,RegExp,Error,Uint8Array,crypto:require('node:crypto').webcrypto,
  document:{documentElement:node(),body:node(),getElementById(id){return nodes[id] ||= node();},querySelectorAll(){return [];},querySelector(){return null;},addEventListener(){},removeEventListener(){},createElement:node},
  location:{origin:'http://localhost',hostname:'localhost',pathname:'/',search:'',hash:''},history:{replaceState(){}},navigator:{userAgent:'test',language:'en-GB'},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},clearInterval(){},requestAnimationFrame(){},addEventListener(){},scrollTo(){},matchMedia(){return {matches:false,addEventListener(){}};},LGM:M};
context.window=context;
let source=fs.readFileSync('../../letsgo2/app.js','utf8');
const end=source.lastIndexOf('})();');
source=source.slice(0,end)+`window.testAPI = { get state(){return S;}, get ui(){return ui;}, screens, fresh, feedback, setBackend(x){sb=x;}, setUser(x){user=x;}, setGuest(x){guest=x;}, archiveView, render, todaySection, supportCard, stats, catchDay, testerReset, steps, stepValid, finishSetup, coreStatus, coreSetupCard, daySummary, openCore, saveCore, whyLine, coachUnderstand, hearingNext, openGoal, saveGoal, goalScreen };\n`+source.slice(end);
vm.createContext(context); vm.runInContext(source,context);
const app=context.testAPI;

function reset(){Object.assign(app.state,app.fresh());app.ui.planEdit=false;app.ui.finishing=null;app.setBackend(null);app.setUser(null);app.setGuest(null);}
// v3 feedback pass (Stu, 17 Nov 2026)
reset();
// Note 8: going back to Build a habit keeps what they typed.
Object.assign(app.state.draft,{quickSetup:true,mode:'more',say:'Get fitter'});
assert.match(app.screens.say(),/What would you like to achieve\?/);
assert.match(app.screens.say(),/Get fitter/);
// Note 22 and 11: the tough-day plan has its own section, with the dimmer switch explained, and "How often" is asked once.
Object.assign(app.state.draft,{what:'Walk for ten minutes',dimmer:'Walk to the end of the road'});
for(const mode of ['full','focus']){app.state.settings.view=mode;const h=app.screens.often();
  assert.match(h,/Let’s plan for the tough days/);assert.match(h,/Why have this\?/);assert.match(h,/dimmer switch/);assert.match(h,/Walk to the end of the road/);
  assert.equal((h.match(/How often\?/g)||[]).length,1);}
// Note 9, 14, 15: a clear finish moment with Stu before Today.
app.state.draft.sched={type:'weekly',times:3};context.document.getElementById('reviewdays').value='30';app.finishSetup();
assert.equal(app.state.screen,'ready');const r=app.screens.ready();assert.match(r,/Your plan is ready/);assert.match(r,/stuart\.jpg/);assert.match(r,/I showed up today/);assert.doesNotMatch(r,/data-log=/);
// Note 2 and 17: Ask Stu and plain support wording on Today, in both views.
for(const mode of ['full','focus']){app.state.settings.view=mode;const t=app.screens.tracker();assert.match(t,/askstu-entry/);}
app.state.settings.view='full';assert.match(app.screens.tracker(),/Finding today tough\?/);assert.doesNotMatch(app.screens.tracker(),/Make it work for today/);
// Note 25: everyday words on Support.
const s=app.screens.slipped();for(const w of ['I can’t get started','Life got busy','I’m getting back on track','I’ve lost my motivation'])assert.ok(s.includes(w),w);
// Note 24: each support option explains itself, with Join now and Find out more.
app.state.settings.tlrMember=false;const c=app.supportCard();assert.match(c,/<details class="ask supportopt">/);assert.match(c,/Join now/);assert.match(c,/Find out more first/);
// Note 5: signed in shows the email, not the code form.
app.setUser({id:'u1',email:'tester@example.com'});const a=app.screens.account();assert.match(a,/You’re signed in/);assert.match(a,/tester@example\.com/);assert.doesNotMatch(a,/Send my code/);app.setUser(null);
assert.match(app.screens.account(),/Send my code/);
console.log('Passed: kept typing on Build, tough-day section and dimmer explainer, single How often, finish moment with Stu, Ask Stu on Today in both views, plain support wording, expandable support options, signed-in account.');
