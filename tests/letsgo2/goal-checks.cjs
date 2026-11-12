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
reset();Object.assign(app.state.draft,{quickSetup:true,mode:'more',say:'I want more energy for my family',what:'Walk for ten minutes',sched:null});
assert.deepEqual(Array.from(app.steps()),['often']);assert.equal(app.stepValid('often'),false);app.finishSetup();assert.equal(app.state.habit,null);
app.state.draft.sched={type:'weekly',times:3};context.document.getElementById('reviewdays').value='30';app.finishSetup();assert.equal(app.state.screen,'tracker');assert.equal(app.state.habit.matters,'');assert.equal(app.state.habit.extra.intention,'I want more energy for my family');assert.equal(app.daySummary(M.today()).s,'today');assert.equal(app.coreStatus().done,1);assert.match(app.coreSetupCard(),/1 of 3/);assert.equal(M.tally(app.state.habit,M.today(),M.today(),M.today()).done,0);
for(const mode of ['full','focus']){app.state.settings.view=mode;const html=app.screens.tracker();assert.match(html,/Add my reason/);assert.match(html,/I want more energy for my family/);}
app.openCore('why');app.state.setupDraft.reason='To have something left for my kids';app.state.setupDraft.deeper='Being present as they grow up';app.state.setupDraft.towards='More energy after work';app.state.setupDraft.sign='Taking the stairs without stopping';assert.equal(app.state.habit.matters,'');app.saveCore();assert.equal(app.state.habit.matters,'To have something left for my kids');assert.equal(app.whyLine(),'Being present as they grow up');assert.equal(app.coreStatus().done,2);assert.match(app.coreSetupCard(),/Plan my way back/);
app.openCore('return');app.state.setupDraft.returnPlan='Take the smaller walk at my next planned opportunity';app.state.setupDraft.small='Walk for two minutes';app.saveCore();assert.equal(app.coreStatus().done,3);assert.equal(app.coreSetupCard(),'');assert.equal(app.state.habit.actions[0].small,'Walk for two minutes');assert.equal(app.state.habit.extra.hard.off,'Take the smaller walk at my next planned opportunity');assert.equal(M.tally(app.state.habit,M.today(),M.today(),M.today()).done,0);assert.match(app.screens.plan(),/My way back/);
// Editing and reopening setup retains the original words and existing check-ins.
app.openCore('why');app.state.setupDraft.reason='Unconfirmed draft';assert.equal(app.state.habit.matters,'To have something left for my kids');app.state.screen='tracker';app.openCore('why');assert.equal(app.state.setupDraft.reason,'Unconfirmed draft');
// Goal changes preserve previous words and all activity, with a resumable draft.
const originalId=app.state.habit.id;
app.state.habit.actions[0].entries[M.today()]={kind:'full',note:'My original check-in'};
const activity=JSON.stringify(app.state.habit.actions);
app.openGoal();const originalGoal=app.state.habit.title;
app.state.goalDraft.title='A goal that fits me now';app.state.goalDraft.intention='More time with my family';app.state.goalDraft.note='I learnt that evenings work better';
app.state.screen='tracker';app.openGoal();assert.equal(app.state.goalDraft.title,'A goal that fits me now');assert.equal(app.state.habit.title,originalGoal);
app.saveGoal();assert.equal(app.state.habit.id,originalId);assert.equal(JSON.stringify(app.state.habit.actions),activity);assert.equal(app.state.habit.title,'A goal that fits me now');
const revisions=app.state.habit.extra.goalHistory;assert.equal(revisions[revisions.length-1].note,'I learnt that evenings work better');assert.ok(revisions.some(r=>r.words.title===originalGoal));
const count=revisions.length;app.openGoal();app.saveGoal();assert.equal(revisions.length,count);
app.openGoal();app.state.goalDraft.title='';app.saveGoal();assert.equal(app.state.habit.title,'A goal that fits me now');
app.state.goalDraft.title='<script>unsafe</script>';assert.doesNotMatch(app.goalScreen(),/<script>unsafe/);
for(const mode of ['full','focus']){app.state.settings.view=mode;assert.match(app.screens.tracker(),/My goal · Edit/);}
console.log('Passed: goal revision history, resumed drafts, unchanged check-ins, no-op saves, blank validation, escaped text and both dashboard views.');
(async()=>{
 reset();app.setGuest({id:'local-test'});let calls=[];
 app.setBackend({functions:{invoke:async(name,{body})=>{calls.push(body.kind);return {data:body.kind==='understand'?{focuses:[{title:'Less scrolling',mode:'less',towards:'An AI-inferred feeling'}]}:{actions:[{text:'Charge my phone outside the bedroom',small:'Leave it on the dresser',schedule:{type:'days',days:[0,1,2,3,4,5,6]}}]},error:null};}}});
 Object.assign(app.state.draft,{quickSetup:true,mode:'less',say:'Stop scrolling in bed'});await app.coachUnderstand();assert.deepEqual(calls,['understand','actions']);assert.equal(app.state.draft.ownFeel,'');assert.doesNotMatch(app.screens.hearing(),/What would feel different/);app.hearingNext();assert.equal(app.state.screen,'often');assert.equal(app.state.draft.reduce,'Less scrolling');assert.match(app.screens.often(),/Stop scrolling in bed/);assert.match(app.screens.often(),/What I’ll do differently/);
 // Existing non-quick draft journeys remain intact.
 app.state.draft.quickSetup=false;app.state.draft.whyDone=false;assert.match(app.screens.hearing(),/What would feel different/);
 // A slow result from a previous draft must not overwrite the user's new start.
 reset();app.setGuest({id:'local-test'});let release;
 app.setBackend({functions:{invoke:()=>new Promise(resolve=>{release=resolve;})}});
 Object.assign(app.state.draft,{quickSetup:true,mode:'more',say:'The original plan'});const pending=app.coachUnderstand();await new Promise(resolve=>setImmediate(resolve));
 app.state.draft=app.fresh().draft;app.state.draft.say='My new plan';app.state.screen='say';release({data:{focuses:[{title:'Stale result'}]},error:null});await pending;assert.equal(app.state.draft.say,'My new plan');assert.equal(app.state.draft.coach,undefined);
 console.log('Passed: usable-plan validation, deferred core setup, preserved intention, exact purpose/vision, return plan, both views, no invented activity, cancelled drafts and shortened Build/Break routing.');
})().catch(e=>{console.error(e);process.exitCode=1;});
