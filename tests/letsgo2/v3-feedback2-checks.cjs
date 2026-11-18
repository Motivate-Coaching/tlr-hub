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
// Feedback pass 2 (Stu, 18 Nov 2026)
reset();
// Note 35: nothing appears under "What I'm moving towards" unless they chose it.
Object.assign(app.state.draft,{quickSetup:true,mode:'more',say:'Swim in the ocean',what:'Swim in the ocean',sched:{type:'days',days:[1,2,3,4,5]},feel:[],ownFeel:''});
// Note 28: a second action comes through.
app.state.draft.second={text:'Lay out my swim things the night before',small:'',cue:'',schedule:null};
context.document.getElementById('reviewdays').value='30';app.finishSetup();
const r=app.screens.ready();
assert.doesNotMatch(r,/Proud|proud/);assert.doesNotMatch(r,/moving towards/);
assert.equal(app.state.habit.actions.length,2);assert.match(r,/Lay out my swim things/);
assert.doesNotMatch(r,/lighter version counts too/i);assert.match(r,/Add it to my calendar/);
// Notes 37 to 40: expandable tough day, other possible actions never repeat the focus, reminders, look back.
app.state.habit.actions[0].small='Put my swim bag by the door';
app.state.habit.later=[{kind:'focus',title:'Swim in the ocean'},{kind:'action',text:'Find a swim buddy'}];
const p=app.screens.plan();
assert.match(p,/What to do on a tough day/);assert.match(p,/Other possible actions/);assert.match(p,/Find a swim buddy/);
assert.doesNotMatch(p,/Waiting in Later/);assert.match(p,/Look back on my plan/);assert.doesNotMatch(p,/Review after/);assert.match(p,/Reminders/);
// Notes 42 to 45 and 48: Today in their voice, calendar, one show-up button, renamed walk card.
app.state.screen='tracker';
for(const mode of ['full','focus']){app.state.settings.view=mode;const t=app.screens.tracker();assert.doesNotMatch(t,/Your next move/);assert.doesNotMatch(t,/I did the smaller version/);assert.doesNotMatch(t,/Walk it through/);}
app.state.settings.view='full';const t=app.screens.tracker();
assert.match(t,/My next move/);assert.match(t,/Add this to my calendar/);assert.match(t,/Why is this habit important to me\?/);assert.match(t,/Tough day\? I did my lighter version/);
console.log('Passed: no made-up "proud", two actions, expandable plan sections, look back wording, Today in their voice with calendar and one show-up button.');
