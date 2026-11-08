import fs from 'node:fs';
let w=fs.readFileSync('worker.mjs','utf8');
if(!w.includes('Captured process stderr')){
const old="const run=(cmd,args)=>execFileSync(cmd,args,{stdio:['ignore','pipe','pipe'],timeout:1800000,maxBuffer:10*1024*1024});";
if(!w.includes(old)||!w.includes("from './transport.mjs'"))throw Error('Worker changed; diagnostic patch refused');
w=w.replace(old,`// Captured process stderr is private; signed URLs and granted secrets are redacted.
const run=(cmd,args)=>{try{return execFileSync(cmd,args,{stdio:['ignore','pipe','pipe'],timeout:1800000,maxBuffer:10*1024*1024});}catch(e){let detail=[e.stderr,e.stdout].filter(Boolean).map(String).join('\\n')||String(e.message);detail=detail.replace(/https?:\\/\\/[^\\s]+/g,'[URL]');for(const key of ['TEABLE_API_TOKEN','REAP_API_KEY','CLOUDINARY_NAME','CLOUDINARY_PRESET']){const value=process.env[key];if(value)detail=detail.split(value).join('[REDACTED]');}throw Error(path.basename(cmd)+' exited '+e.status+': '+detail.slice(-3000));}};`);
w=w.replaceAll('String(e.message).slice(0,500)','String(e.message).slice(-3500)');
fs.writeFileSync('worker.mjs',w);
}
