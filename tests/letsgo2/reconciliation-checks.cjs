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
source=source.slice(0,end)+`window.testAPI = { get state(){return S;}, get ui(){return ui;}, screens, fresh, feedback, setBackend(x){sb=x;}, setUser(x){user=x;}, setGuest(x){guest=x;}, archiveView, render, todaySection, supportCard, stats, catchDay, testerReset };\n`+source.slice(end);
vm.createContext(context); vm.runInContext(source,context);
const app=context.testAPI;
const today=M.today(), day=M.addDays;
function action(id,text,rule){return {id,text,cue:'make coffee',small:'Two minutes',from:day(today,-6),schedules:[{from:day(today,-6),...rule}],entries:{},extra:{},createdAt:new Date().toISOString()};}
function setup(view='full'){
 const state=app.state;Object.assign(state,app.fresh());state.settings.view=view;state.settings.analytics=false;state.habit={id:'f1',title:'A little more time outdoors',mode:'more',towards:'I feel more energetic',matters:'I want to enjoy the day',deeper:'',sign:'Two afternoons outside',length:30,start:day(today,-6),status:'active',pauses:[],later:[{kind:'action',text:'Try a new route'}],feel:[],gives:[],extra:{mine:'I can begin small',mineQ:'Your own line',helpers:['Walking routes'],hard:{start:'Shoes beside the door'},worked:[{k:'start',a:'Take a friend'}]},actions:[action('walk','Walk for 20 minutes',{type:'days',days:[0,1,2,3,4,5,6]}),action('read','Read a chapter',{type:'weekly',times:3})]};state.archive=[];state.screen='tracker';state.stuSeen={};state.fb={};app.ui.struggle=null;app.ui.supportAct=null;app.ui.planEdit=false;
}
setup();let html=app.screens.tracker();assert.match(html,/A note from Stu/);assert.match(html,/I can begin small/);assert.match(html,/Back up my plan/);assert.match(html,/Past days/);
setup('focus');html=app.screens.tracker();assert.match(html,/A note from Stu/);assert.match(html,/I can begin small/);assert.match(html,/Detailed view/);assert.match(html,/Past days/);
setup();html=app.screens.plan();for(const text of ['Two afternoons outside','I can begin small','Walking routes','Review after','Reminders','Later'])assert.ok(html.includes(text),text);
html=app.screens.slipped();assert.match(html,/Talk to a real person/);assert.match(html,/My past wins/);assert.match(html,/Choose an action/);assert.match(html,/I want to enjoy the day/);
app.ui.struggle='start';html=app.screens.slipped();assert.match(html,/Take a friend/);assert.match(html,/data-log="full"/);assert.match(html,/data-log="small"/);
app.ui.supportAct='read';html=app.screens.slipped();assert.match(html,/Read a chapter/);assert.match(html,/Take a friend/);
app.state.habit.start=day(today,3);assert.match(app.todaySection(false),/Start today instead/);assert.doesNotMatch(app.todaySection(false),/data-log=/);
setup();app.state.archive=[JSON.parse(JSON.stringify(app.state.habit))];app.state.archive[0].actions[0].entries[today]={kind:'small',note:'A quiet route helped'};assert.match(app.screens.plan(),/data-archive-view="0"/);const active=JSON.stringify(app.state.habit);app.archiveView(0);assert.equal(JSON.stringify(app.state.habit),active);
// Completion kinds remain explicit, including a deliberate non-completion.
setup();app.state.habit.actions[0].entries[today]={kind:'none',note:'Keep this note'};const a=app.state.habit.actions[0];assert.equal(M.tally(app.state.habit,today,today,today).done,0);assert.equal(a.entries[today].note,'Keep this note');
// Feedback has no success receipt when persistence fails; marks sent only on acknowledgement.
(async()=>{app.setGuest({id:'test-guest'});let inserts=0;app.setBackend({from(){return {insert:async()=>{inserts++;return {error:{message:'rejected'}};}};}});assert.equal(await app.feedback('day3','A test'),false);assert.notEqual(app.state.fb.day3,true);
app.setBackend({from(){return {insert:async()=>{inserts++;return {error:null};}};}});assert.equal(await app.feedback('day3','A test'),true);assert.equal(app.state.fb.day3,true);assert.equal(inserts,2);
// Resetting the browser fixture signs out; it must never invoke account deletion.
let signedOut=0;app.setUser({id:'test-user'});app.setBackend({auth:{signOut:async()=>signedOut++},functions:{invoke(){throw new Error('Account deletion must not run');}}});await app.testerReset();assert.equal(signedOut,1);assert.equal(app.state.habit,null);
console.log('Passed: restored feature reachability in both views, contextual support, legacy notes, future start, read-only archives, feedback acknowledgements and safe local reset.');})().catch(e=>{console.error(e);process.exitCode=1;});
