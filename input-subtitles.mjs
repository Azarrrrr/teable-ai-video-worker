// Supplied cue times belong to their source, never the edited timeline.
export function parseSupplied(text,duration){
 const source=String(text).replace(/^\uFEFF/,'').replace(/\r/g,'').trim();
 if(!source)throw Error('Empty subtitle input');
 if(!source.includes('-->'))return {text:source,words:null};
 const stamp=s=>{const p=s.replace(',','.').split(':').map(Number);return p.reduce((n,v)=>n*60+v,0);};
 const words=[];let previous=0;
 for(const block of source.split(/\n\s*\n/)){
  const lines=block.split('\n'),i=lines.findIndex(l=>l.includes('-->'));if(i<0)continue;
  const m=lines[i].match(/([\d:. ,]+)\s*-->\s*([\d:.,]+)/);if(!m)throw Error('Invalid subtitle timestamp');
  const start=stamp(m[1].trim()),end=stamp(m[2]);
  const text=lines.slice(i+1).join(' ').replace(/<[^>]*>/g,'').trim();
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<previous||start<0||end<=start||end>duration+.15||!text)throw Error('Subtitle cues overlap, exceed source duration or contain no text');
  // Retain the complete cue as one unit: do not invent word timings.
  words.push({text,start,end});previous=end;
 }
 if(!words.length)throw Error('No valid SRT/VTT cues found');return {text:words.map(w=>w.text).join(' '),words};
}
const key=s=>s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu,'');
export function alignSupplied(text,recognized){
 const tokens=text.trim().split(/\s+/),n=tokens.length,m=recognized.length;
 if(!n||!m||n*m>4000000)throw Error('Subtitle alignment input empty or too large');
 const dp=Array.from({length:n+1},()=>new Uint16Array(m+1));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)dp[i][j]=key(tokens[i])&&key(tokens[i])===key(recognized[j].text)?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 if(dp[0][0]/n<.7)throw Error('Supplied text does not sufficiently match source speech; provide timed SRT/VTT');
 const matches=[];let i=0,j=0;while(i<n&&j<m){if(key(tokens[i])&&key(tokens[i])===key(recognized[j].text)){matches.push([i,j]);i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
 // Distribute unmatched corrected words only within adjacent recognized anchors.
 const anchors=[[-1,-1],...matches,[n,m]],out=[];
 for(let a=1;a<anchors.length;a++){const [ti,rj]=anchors[a], [pi,pj]=anchors[a-1];const from=pj<0?0:recognized[pj].end,to=rj===m?recognized.at(-1).end:recognized[rj].start,count=ti-pi-1;
  if(count&&to<=from)throw Error('Cannot safely align corrected subtitle phrase; supply timed cues');
  for(let k=0;k<count;k++)out.push({text:tokens[pi+1+k],start:from+(to-from)*k/count,end:from+(to-from)*(k+1)/count});
  if(ti<n)out.push({...recognized[rj],text:tokens[ti]});
 }return out;
}
export function reviewTimes(scenes,events,duration){
 const times=new Set([0,Math.max(0,duration-.1)]);
 for(const s of scenes)for(const t of [s.start-.2,s.start+.2,(s.start+s.end)/2,s.end-.2])if(t>=0&&t<duration)times.add(+t.toFixed(3));
 for(const e of events||[])for(let n=0;n<=6;n++){const t=e.start+(e.end-e.start)*n/6;if(t>=0&&t<duration)times.add(+t.toFixed(3));}
 const ordered=[...times].sort((a,b)=>a-b).filter((t,i,a)=>!i||t-a[i-1]>=1/30);
 return ordered.length<=120?ordered:Array.from({length:120},(_,i)=>ordered[Math.round(i*(ordered.length-1)/119)]);
}
