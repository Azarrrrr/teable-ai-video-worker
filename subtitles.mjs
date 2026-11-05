export function readWords(raw,duration){
 if(!Array.isArray(raw))throw Error('Reap transcript must be an array of timed words');
 const words=raw.filter(w=>!w.skip).map(w=>({text:String(w.word||'').trim(),start:Number(w.startMs)/1000,end:Number(w.endMs)/1000}));
 if(!words.length||words.some(w=>!w.text||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end<=w.start||w.end>duration+1))throw Error('Invalid Reap word timestamps');return words;
}
export function remapWords(sources,cuts){let offset=0;const result=[];for(const c of cuts){const words=sources[c.sourceIndex]?.words;if(!words)throw Error('Missing source transcript');for(const w of words){const start=Math.max(c.start,w.start),end=Math.min(c.end,w.end);if(end-start>0.015)result.push({text:w.text,start:offset+start-c.start,end:offset+end-c.start});}offset+=c.end-c.start;}return {words:result,duration:offset};}
const stamp=t=>{const ms=Math.max(0,Math.round(t*1000)),s=Math.floor(ms/1000);return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};
export function makeSrt(words){const cues=[];let group=[];for(const w of words){if(group.length&&(group.length>=6||w.end-group[0].start>2.8||w.start-group.at(-1).end>.6)){cues.push(group);group=[];}group.push(w);if(/[.!?]$/.test(w.text)){cues.push(group);group=[];}}if(group.length)cues.push(group);return cues.map((g,i)=>`${i+1}\n${stamp(g[0].start)} --> ${stamp(g.at(-1).end)}\n${g.map(w=>w.text.replace(/[<>]/g,'')).join(' ')}\n`).join('\n');}
