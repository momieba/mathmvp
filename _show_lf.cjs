const d=require(require('path').resolve(process.argv[2]));
const pick=process.argv[3]?process.argv[3].split(',').map(Number):d.exercises.map((_,i)=>i+1);
for(const i of pick){const e=d.exercises[i-1];console.log('---',e.key,e.placements[0].difficulty,e.type);console.log('P:',e.prompt);
if(e.type==='numeric')console.log('A:',JSON.stringify(e.answer));else console.log('O:',e.answer.options.map((o,j)=>(e.answer.correct.includes(j)?'*':' ')+o).join(' || '));
e.solution.steps.forEach(s=>console.log('  S:',s.text));console.log('  R:',e.solution.result);}
