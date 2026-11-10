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
source=source.slice(0,end)+`window.testAPI = { get state(){return S;}, get ui(){return ui;}, screens, fresh, feedback, setBackend(x){sb=x;}, setUser(x){user=x;}, setGuest(x){guest=x;}, archiveView, render, todaySection, supportCard, stats, catchDay, testerReset, steps, stepValid, finishSetup, coreStatus, coreSetupCard, daySummary, openCore, saveCore, whyLine, coachUnderstand, hearingNext, discoveryState, findScreen, findAct, reflectAI, findSave, discoveryKey, goBack };\n`+source.slice(end);
vm.createContext(context); vm.runInContext(source,context);
const app=context.testAPI;

function reset(){Object.assign(app.state,app.fresh());app.ui.planEdit=false;app.ui.finishing=null;app.setBackend(null);app.setUser(null);app.setGuest(null);}

function button(i){return {dataset:{i:String(i)}};}
function resetFinder(answer='More energy for my family') {
 reset();Object.assign(app.state.find={version:2,step:1,answers:{},answer,mode:'more',answerVersions:[],rounds:[]});app.state.screen='find';app.ui.aiBusy=false;
 app.setGuest({id:'qa-guest'});return app.state.find;
}
function result(name='Energy'){return {data:{areas:[{name,insight:'It sounds like you want more energy for your family',noticed:'You mentioned family',challenges:[{title:'A short walk',daily:'Walk for ten minutes'},{title:'An easier evening',daily:'Prepare tomorrow’s bag'}]}]},error:null};}
(async()=>{
 let f=resetFinder();f.step=0;assert.match(app.findScreen(),/A few months from now/);assert.doesNotMatch(app.findScreen(),/Skip this one|1 of 2|Add your email/);
 context.document.getElementById('findans').value='More energy for my family';app.findAct('next');assert.equal(f.step,1);assert.equal(f.answerVersions[0].text,f.answer);
 let calls=[];app.setBackend({functions:{invoke:async(name,{body})=>{calls.push({name,body});return result();}}});await app.reflectAI();
 assert.equal(calls[0].body.answers.proud,'More energy for my family');assert.equal(calls[0].body.horizon,'three months');assert.match(app.findScreen(),/Why these could fit/);assert.match(app.findScreen(),/Walk for ten minutes/);assert.doesNotMatch(app.findScreen(),/Does this ring true|Most prominent/);
 for(const mode of ['full','focus']){app.state.settings.view=mode;assert.match(app.findScreen(),/Too demanding/);assert.match(app.findScreen(),/Different approach/);assert.match(app.findScreen(),/Edit my answer/);}
 app.findAct('easier');await app.reflectAI();assert.match(calls[1].body.answers.tried,/smaller, easier/);assert.equal(calls[1].body.focus,'Energy');assert.equal(f.answer,'More energy for my family');assert.equal(f.rounds.length,1);
 app.findAct('different');await app.reflectAI();assert.match(calls[2].body.answers.tried,/different practical approach/);
 app.findAct('editanswer');context.document.getElementById('findans').value='More time with my family';app.findSave();app.findAct('next');assert.equal(f.answerVersions.length,2);await app.reflectAI();
 app.state.draft.anchor='A stale cue';app.state.draft.matters='A stale reason';app.state.draft.sched={type:'days',days:[1]};
 app.findAct('take',button(0));assert.equal(app.state.screen,'often');assert.equal(app.state.draft.what,'Walk for ten minutes');assert.equal(app.state.draft.sched,null);assert.equal(app.state.draft.anchor,'');assert.equal(app.state.draft.matters,'');assert.equal(app.state.draft.say,'More time with my family');assert.equal(app.state.draft.discovery.versions.length,2);assert.equal(app.state.habit,null);assert.match(app.screens.often(),/How often/);
 app.state.draft.sched={type:'weekly',times:2};context.document.getElementById('reviewdays').value='30';app.finishSetup();assert.equal(app.state.habit.extra.discovery.original,'More time with my family');assert.equal(app.state.habit.extra.intention,'More time with my family');assert.equal(Object.keys(app.state.habit.actions[0].entries).length,0);
 // Break retains a constructive replacement action and no automatic schedule.
 f=resetFinder('Less scrolling at night');f.mode='less';app.setBackend({functions:{invoke:async()=>({data:{areas:[{name:'Scrolling in bed',insight:'You want quieter evenings',challenges:[{title:'Scrolling in bed',daily:'Charge my phone in the kitchen'}]}]}})}});await app.reflectAI();app.findAct('take',button(0));assert.equal(app.state.draft.mode,'less');assert.equal(app.state.draft.reduce,'Scrolling in bed');assert.equal(app.state.draft.what,'Charge my phone in the kitchen');assert.equal(app.state.draft.sched,null);
 // Guest failure keeps a usable manual route without requesting email.
 f=resetFinder('Learn guitar');app.setGuest(null);app.setBackend(null);await app.reflectAI();assert.match(app.findScreen(),/Write my own action/);assert.doesNotMatch(app.findScreen(),/Add your email/);context.document.getElementById('ownch').value='Practise one chord';app.findAct('own');assert.equal(app.state.screen,'often');assert.equal(app.state.draft.what,'Practise one chord');
 // Late responses cannot overwrite edits or another discovery.
 f=resetFinder('Original');let release;app.setBackend({functions:{invoke:()=>new Promise(r=>{release=r;})}});const pending=app.reflectAI();await new Promise(r=>setImmediate(r));app.findAct('editanswer');f.answer='New words';release(result('Stale'));await pending;assert.equal(f.ai,undefined);assert.equal(f.answer,'New words');assert.equal(app.ui.aiBusy,false);
 // Old unfinished responses remain available when the flow is shortened.
 reset();app.state.find={step:1,answers:{years:'Learn to paint',proud:'Finish my first painting'}};f=app.discoveryState();assert.match(f.answer,/Learn to paint/);assert.match(f.answer,/Finish my first painting/);assert.equal(f.legacyAnswers.years,'Learn to paint');
 // Unusable output and care do not turn into challenge plans.
 f=resetFinder();app.setBackend({functions:{invoke:async()=>({data:{areas:[{name:'Bad shape',challenges:'not an array'}]}})}});await app.reflectAI();assert.match(app.findScreen(),/couldn’t find ideas/);
 f=resetFinder();app.setBackend({functions:{invoke:async()=>({data:{care:'Please talk to someone you trust.',areas:[]}})}});await app.reflectAI();assert.match(app.findScreen(),/beyond what I can help with here/);assert.match(app.findScreen(),/findahelpline.com/);assert.doesNotMatch(app.findScreen(),/talk to someone you trust/);assert.doesNotMatch(app.findScreen(),/data-find="take"/);
 console.log('Passed: single opening question, direct actionable ideas, refinements, source editing/history, Build/Break, manual fallback, no invented schedules/activity, original words on dashboard, stale-response guards and care handling.');
})().catch(e=>{console.error(e);process.exitCode=1;});
