const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const M=require('../../letsgo2/model.js');
const action=(rule,entries={})=>({id:'a',from:'2026-11-02',schedules:[{from:'2026-11-02',...rule}],entries});
const focus=a=>({start:'2026-11-02',length:30,pauses:[],actions:[a]});
let a=action({type:'days',days:[1,3,5]},{'2026-11-07':{kind:'full'}}),f=focus(a);
let t=M.tally(f,'2026-11-07','2026-11-07','2026-11-07');assert.equal(t.planned,0);assert.equal(t.done,1);
a=action({type:'weekly',times:3},{'2026-11-03':{kind:'full'},'2026-11-05':{kind:'small'}});f=focus(a);
assert.equal(M.tally(f,f.start,'2026-11-02','2026-11-02').done,0);
assert.equal(M.tally(f,f.start,'2026-11-03','2026-11-03').done,1);
assert.equal(M.tally(f,f.start,'2026-11-05','2026-11-05').done,2);
assert.equal(M.tally(f,'2026-11-05','2026-11-05','2026-11-05').done,1);
assert.equal(M.tally(f,f.start,'2026-11-07','2026-11-07').planned,2); // week still running: only what's done so far counts (Stu's rule, 10 Nov 2026)
a.entries['2026-11-06']={kind:'full'};a.entries['2026-11-07']={kind:'full'};
assert.equal(M.tally(f,f.start,'2026-11-07','2026-11-07').done,4);
assert.equal(M.tally(f,f.start,'2026-11-07','2026-11-07').planned,3);
a=action({type:'days',days:[1,3,5]},{'2026-11-03':{kind:'small'},'2026-11-04':{kind:'none'}});f=focus(a);
assert.equal(M.tally(f,f.start,'2026-11-07','2026-11-07').done,1);
f.pauses=[{from:'2026-11-04',to:'2026-11-04'}];assert.equal(M.tally(f,f.start,'2026-11-07','2026-11-07').planned,2);
const source=fs.readFileSync('../../letsgo2/app.js','utf8');
const tidy=source.slice(source.indexOf('  function tidyAction('),source.indexOf('  function hearingNext()'));
const ctx={};vm.createContext(ctx);vm.runInContext(tidy,ctx);
let clean=ctx.tidyAction({text:'Walk for 20 minutes after breakfast on Monday, Wednesday and Friday',schedule:{type:'days',days:[1,3,5]}});
assert.equal(clean.text,'Walk for 20 minutes');assert.equal(clean.cue,'have breakfast');
clean=ctx.tidyAction({text:'Read After the Fall for 10 minutes',schedule:{type:'days',days:[1]}});assert.equal(clean.text,'Read After the Fall for 10 minutes');
assert.equal((source.match(/    length: function/g)||[]).length,1);
console.log('Passed: extra vs planned, dated weekly counts, no target cap on activity, pauses, undo, cue extraction, preserved titles and one review screen.');
// Weekly targets follow dated schedule segments and never consume future or fixed-schedule events.
a=action({type:'weekly',times:3},{'2026-11-03':{kind:'full'},'2026-11-06':{kind:'full'}});f=focus(a);M.changeSchedule(a,'2026-11-05',{type:'days',days:[4,5]});
assert.equal(M.weeklyProgress(f,a,'2026-11-03','2026-11-03').done,1);
assert.equal(M.weeklyProgress(f,a,'2026-11-03','2026-11-03').target,3);
assert.equal(M.tally(f,f.start,'2026-11-07','2026-11-07').planned,3); // running week counts done so far (1) plus the two past fixed days
a=action({type:'weekly',times:1},{'2026-11-03':{kind:'full'},'2026-11-17':{kind:'small'}});f=focus(a);
assert.equal(M.isComeback(f,a,'2026-11-17','2026-11-17'),true);
a.entries['2026-11-18']={kind:'full'};assert.equal(M.isComeback(f,a,'2026-11-18','2026-11-18'),false);
console.log('Passed: schedule-segment targets, no future attribution and weekly comebacks.');
