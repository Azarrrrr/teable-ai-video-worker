import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {pipeline} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {validateComposition,makeMusic} from './composition.mjs';
import {readWords,remapWords,makeSrt} from './subtitles.mjs';
import {parseSupplied,alignSupplied,reviewTimes} from './input-subtitles.mjs';
import {makeRequest,uploadOnce} from './transport.mjs';

const ENDPOINT='https://app.teable.ai';
const TABLE='tbl8C5PSp8zMd0m8uFc';
const F={subtitles:'fld5OPYwzIYtatgYMWY',subtitleFiles:'fld1TW6XlWt6t4SoNk0',name:'fldjFVLLLaW53G2hCuQ',source:'fldpLQ8VDnl3P0aDrxb',ratio:'flddru0xtP6m2r3LvN7',language:'fldI952JrzHg78e5i2N',status:'fldev3BDpc8jpttN8F0',instructions:'fldDO9vWGxQv3eo9Jui',plan:'fldJouJQwlAt3sHGQSq',reap:'fld2cq99GvTm5Vd0c9y',video:'fldb1ktJAIuGHDH1tq4',url:'fldkUJV8PvfPO2lrT4a',cover:'fldu7uLrlkNHjU3LrCw',coverUrl:'fldOPToJiRQWIcDWx45',error:'fldO0dbEgsQ4yl7bAJG',attempts:'fld99UF44XMB36J9Gi4',started:'fld2Ic3DR20O2Qlv8SV',completed:'fld6ERdntolDW10EgP8'};
const AI={html:'fldSdDHSQJ2iepWQOC8',context:'fldVfgtQMnT73gFMVqP',preview:'fldqMvvBOkTSGBrDLSn',media:'fld3hfZbmAVBBPpTLgK',validation:'fldXuUpXeu8xh7YDKQ6'};
const WORK=await fs.mkdtemp(path.join(os.tmpdir(),'video-job-'));
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:['ignore','pipe','pipe'],timeout:1800000,maxBuffer:10*1024*1024});
const probe=file=>JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file]));
const request=makeRequest();
async function api(route,body,method='POST'){const r=await request(`${ENDPOINT}/api${route}`,{method:body?method:'GET',headers:{Authorization:`Bearer ${process.env.TEABLE_API_TOKEN}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});return r.json();}
const update=(id,fields)=>api(`/table/${TABLE}/record/${id}`,{fieldKeyType:'id',typecast:true,record:{fields}},'PATCH');
async function download(url,file){if(new URL(url).protocol!=='https:')throw Error('Only HTTPS media URLs supported');const r=await request(url);const size=Number(r.headers.get('content-length')||0);if(size>500*1024*1024)throw Error('Input exceeds 500 MB limit');await pipeline(Readable.fromWeb(r.body),fsOpen(file));if((await fs.stat(file)).size>500*1024*1024)throw Error('Downloaded file exceeds limit');}
import {createWriteStream as fsOpen} from 'node:fs';
async function reap(route,body){const r=await request(`https://public.reap.video/api/v1/automation/${route}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${process.env.REAP_API_KEY}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return r.json();}
const attachmentCache=new Map();
async function attach(id,field,file,mime){const bytes=await fs.readFile(file),name=path.basename(file);const upload=async()=>{const form=new FormData();form.set('file',new Blob([bytes],{type:mime}),name);return api(`/table/${TABLE}/record/${id}/${field}/uploadAttachment`,form);};
 if(![AI.preview,'fldUiKDtSmDmy8BzKuc'].includes(field))return upload();
 return uploadOnce({known:attachmentCache.get(field)||[],name,size:bytes.length,upload,reconcile:async()=>{const row=await api(`/table/${TABLE}/record/${id}?fieldKeyType=id`);const saved=row.fields?.[field]||[];attachmentCache.set(field,saved);return saved;}});}
async function animate(source,ratio,composition,music,background,onStage=async()=>{},draft=false){const [fullW,fullH]=ratio==='16:9'?[1920,1080]:[1080,1920];const w=fullW,h=fullH; await onStage({phase:'normalizing'});const normalized=path.join(WORK,'normalized.mp4');run('ffmpeg',['-v','error','-y','-i',source,'-vf',`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30`,'-c:v','libx264','-preset','fast','-crf','22','-c:a','aac','-movflags','+faststart',normalized]);const duration=Number(probe(normalized).format.duration);
 let presenterTrack=[];
 if(composition?.includes('presenter.mp4')){
  run('/usr/bin/python3',[path.resolve('presenter.py'),normalized,path.join(WORK,'presenter-raw.mp4'),path.join(WORK,'presenter-track.json')]);
  run('ffmpeg',['-v','error','-y','-i',path.join(WORK,'presenter-raw.mp4'),'-an','-c:v','libx264','-crf','21','-pix_fmt','yuv420p',path.join(WORK,'presenter.mp4')]);
  const tracking=JSON.parse(await fs.readFile(path.join(WORK,'presenter-track.json'),'utf8'));presenterTrack=tracking.frames;
 }
 await fs.copyFile('node_modules/gsap/dist/gsap.min.js',path.join(WORK,'gsap.min.js'));
 await fs.writeFile(path.join(WORK,'index.html'),composition||`<!doctype html><html><head><meta charset="UTF-8"><script src="gsap.min.js"></script><style>body{margin:0;background:#000}#root{position:relative;width:${w}px;height:${h}px;overflow:hidden}video{width:100%;height:100%}#progress{position:absolute;bottom:0;left:0;width:100%;height:8px;background:#22d3ee;transform-origin:left}</style></head><body><div id="root" data-composition-id="film" data-start="0" data-duration="${duration}" data-width="${w}" data-height="${h}"><video class="clip" src="normalized.mp4" data-start="0" data-duration="${duration}" data-track-index="0" playsinline></video><div id="progress" class="clip" data-start="0" data-duration="${duration}" data-track-index="1"></div></div><script>const t=gsap.timeline({paused:true});t.fromTo('#progress',{scaleX:0},{scaleX:1,duration:${duration},ease:'none'},0);window.__timelines={film:t};</script></body></html>`);
 if(composition){const html=composition.replaceAll('{{PRESENTER_TRACK}}',JSON.stringify(presenterTrack)).replaceAll('{{DURATION}}',String(duration)).replaceAll('{{WIDTH}}',String(w)).replaceAll('{{HEIGHT}}',String(h));const report={passed:true,phase:'rendering',...await validateComposition(WORK,html,w,h,duration)};await onStage(report);await fs.writeFile(path.join(WORK,'validation.json'),JSON.stringify(report));}
 const rendered=path.join(WORK,'rendered.mp4');run(path.resolve('node_modules/.bin/hyperframes'),['render',WORK,'--output',rendered,'--workers','1','--fps','30','--quality','delivery','--no-best-effort','--quiet']);
 if(draft){const preview=path.join(WORK,'review-preview.mp4');run('ffmpeg',['-v','error','-y','-i',rendered,'-vf','scale='+fullW/2+':'+fullH/2,'-an','-c:v','libx264','-preset','fast','-crf','28','-movflags','+faststart',preview]);return preview;}
 await onStage({phase:'mixing audio'});const result=path.join(WORK,'final.mp4');
 if(composition){const bg=background||path.join(WORK,'music.wav');if(!background)await makeMusic(bg,duration,music);const audio=probe(normalized).streams.some(s=>s.codec_type==='audio');const args=['-v','error','-y','-i',rendered,'-i',normalized,'-stream_loop','-1','-i',bg];if(audio)args.push('-filter_complex','[2:a]volume=0.2,asplit=2[bed][duck];[1:a]asplit=2[voice][sc];[bed][sc]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=300[quiet];[voice][quiet]amix=inputs=2:duration=first:normalize=0[a]','-map','0:v:0','-map','[a]');else args.push('-map','0:v:0','-map','2:a:0');args.push('-t',String(duration),'-c:v','copy','-c:a','aac','-movflags','+faststart',result);if(audio){const ix=args.indexOf('[2:a]volume=0.2,asplit=2[bed][duck];[1:a]asplit=2[voice][sc];[bed][sc]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=300[quiet];[voice][quiet]amix=inputs=2:duration=first:normalize=0[a]');args[ix]='[2:a]volume=0.2[bed];[1:a]asplit=2[voice][sc];[bed][sc]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=300[quiet];[voice][quiet]amix=inputs=2:duration=first:normalize=0[a]';}run('ffmpeg',args);}else run('ffmpeg',['-v','error','-y','-i',rendered,'-i',normalized,'-map','0:v:0','-map','1:a?','-c:v','copy','-c:a','aac','-shortest','-movflags','+faststart',result]);const meta=probe(result);if(meta.streams.find(s=>s.codec_type==='video')?.width!==w||meta.streams.find(s=>s.codec_type==='video')?.height!==h||!meta.streams.some(s=>s.codec_type==='audio')||Math.abs(Number(meta.format.duration)-duration)>1)throw Error('Final video validation failed');return result;
}
async function processJob(id){let row=await api(`/table/${TABLE}/record/${id}?fieldKeyType=id`),f=row.fields||{};if(f[F.status]!=='Queued'){console.log('Job not queued; skipped');return;}
 if(!f[F.source]?.length||!['9:16','16:9'].includes(f[F.ratio])){await update(id,{[F.status]:'Needs Review',[F.error]:'Missing or invalid required inputs'});return;}
 let oldContext={};try{oldContext=JSON.parse(f[AI.context]||'{}');}catch{}
 const subtitleFiles=f[F.subtitleFiles]||[],subtitleTexts=[];
 if(subtitleFiles.length&&subtitleFiles.length!==f[F.source].length)throw Error('Supply one subtitle file per source in matching order');
 if(!subtitleFiles.length&&f[F.subtitles]&&f[F.source].length!==1)throw Error('Multiple sources need one subtitle file per source');
 for(const a of subtitleFiles){const r=await request(a.presignedUrl||a.url);const text=await r.text();if(text.length>1000000)throw Error('Subtitle file exceeds text limit');subtitleTexts.push(text);}
 if(!subtitleTexts.length&&f[F.subtitles])subtitleTexts.push(String(f[F.subtitles]));
 const inputFingerprint=createHash('sha256').update(JSON.stringify({sources:f[F.source].map(a=>({token:a.token||a.id||a.name,size:a.size})),ratio:f[F.ratio],language:f[F.language],instructions:f[F.instructions]||'',...(subtitleTexts.length?{subtitles:subtitleTexts}:{})})).digest('hex');
 if(oldContext.inputFingerprint&&oldContext.inputFingerprint!==inputFingerprint){await update(id,{[F.status]:'Needs Review',[F.error]:'Sources, language, ratio or instructions changed after AI preparation. Start a fresh job to preserve the existing Reap checkpoint.'});return;}
 for(const field of [AI.preview,'fldUiKDtSmDmy8BzKuc'])attachmentCache.set(field,f[field]||[]);
 oldContext.inputFingerprint=inputFingerprint;await update(id,{[AI.context]:JSON.stringify(oldContext)});
 let started=false,runId;
 const log=async(fields)=>{if(runId)await api(`/table/tbleluZXeKU6uicWjiv/record/${runId}`,{fieldKeyType:'id',typecast:true,record:{fields}},'PATCH');};
 try{
 const created=await api('/table/tbleluZXeKU6uicWjiv/record',{fieldKeyType:'id',typecast:true,records:[{fields:{fldfae553TlohKfowBW:`video-${process.env.GITHUB_RUN_ID||Date.now()}`,fldYqZIWbMbU4LJmiJB:id,fldQKzITMb6gNWgM2dH:'Running',fld0Y6066ttBkdOtiQP:process.env.GITHUB_RUN_ID||'',fld3fn593xNRvnUZpjQ:new Date().toISOString()}}]});runId=created.records?.[0]?.id;
 for(const key of ['TEABLE_API_TOKEN','REAP_API_KEY','CLOUDINARY_NAME','CLOUDINARY_PRESET'])if(!process.env[key])throw Error('Worker credential missing: '+key);
 await update(id,{[F.status]:'Processing',[F.error]:null,[F.completed]:null,[F.started]:new Date().toISOString(),[F.attempts]:Number(f[F.attempts]||0)+1});started=true;
 const parts=[];for(const [i,a] of f[F.source].entries()){const p=path.join(WORK,`source-${i}.mp4`);await download(a.presignedUrl||a.url,p);const m=probe(p);if(!m.streams.some(s=>s.codec_type==='audio'))throw Error('Source has no audio; cannot create speech captions');parts.push(p);}
 if(!f[AI.html]||oldContext.pipelineVersion!==3||oldContext.refreshVisualSamples){
  const sources=[];
  let savedTranscripts;try{savedTranscripts=JSON.parse(f.fldLNwP5v89GFBCsDSq||'null');}catch{}
  const sourceTranscripts=[];
  const transcriptionProjects=oldContext.transcriptionProjects||{};
  for(let i=0;i<parts.length;i++){
   const duration=Number(probe(parts[i]).format.duration);
   const supplied=subtitleTexts[i]?parseSupplied(subtitleTexts[i],duration):null;
   if(supplied?.words){sourceTranscripts.push({sourceIndex:i,duration,words:supplied.words,origin:'user-timed-cues'});continue;}
   if(!supplied&&savedTranscripts?.language===f[F.language]&&savedTranscripts?.inputFingerprint===inputFingerprint&&savedTranscripts?.sources?.[i]?.words?.length){sourceTranscripts.push(savedTranscripts.sources[i]);continue;}
   let project=transcriptionProjects[i]||(parts.length===1?f[F.reap]:null);
   if(!project){const up=await reap('get-upload-url',{filename:'source-'+i+'.mp4'});await request(up.uploadUrl,{method:'PUT',headers:{'Content-Type':'video/mp4'},body:await fs.readFile(parts[i])});const created=await reap('create-transcription',{uploadId:up.id});project=created.id;if(!project)throw Error('Reap transcription returned no ID');transcriptionProjects[i]=project;await update(id,{[AI.context]:JSON.stringify({...oldContext,transcriptionProjects})});}
   let details;
   for(let n=0;n<100;n++){details=await reap('get-project-details?projectId='+encodeURIComponent(project));if(details.status==='completed')break;if(['failed','error','invalid','expired'].includes(details.status))throw Error('Reap transcription failed: '+details.status);await new Promise(r=>setTimeout(r,20000));}
   if(details.status!=='completed'||!details.urls?.transcription)throw Error('Reap transcript not ready; saved project will be reused');
   if(f[F.language]&&details.language&&details.language!==(f[F.language]==='Español'?'es':'en')&&!details.translationLanguages?.includes(f[F.language]==='Español'?'es':'en'))throw Error('Reap transcript language differs from requested language; review transcription project');
   const raw=await(await request(details.urls.transcription)).json();const recognized=readWords(raw,duration);const words=supplied?alignSupplied(supplied.text,recognized):recognized;sourceTranscripts.push({sourceIndex:i,projectId:project,duration,words,origin:supplied?'user-text-aligned-to-recognition':'recognized-source'});
   await update(id,{fldLNwP5v89GFBCsDSq:JSON.stringify({version:1,language:f[F.language],inputFingerprint,sources:sourceTranscripts})});
  }
  await update(id,{fldLNwP5v89GFBCsDSq:JSON.stringify({version:1,language:f[F.language],inputFingerprint,sources:sourceTranscripts})});
  if(parts.length>8)throw Error('At most eight source videos supported');
  for(let i=0;i<parts.length;i++){
   const m=probe(parts[i]),duration=Number(m.format.duration);if(duration<3||duration>900)throw Error('Each source must be 3 seconds to 15 minutes');
   // Uniform samples plus detected visual cuts; labels are drawn directly into each cell.
   const sceneLog=run('ffprobe',['-v','error','-f','lavfi','-i',"movie='"+parts[i]+"',select=gt(scene\\,0.28)",'-show_entries','frame=pts_time','-of','csv=p=0']).toString();
   const boundaries=sceneLog.split(/\s+/).map(Number).filter(v=>v>.1&&v<duration-.1);
   const times=[...Array.from({length:18},(_,n)=>n*Math.max(0,duration-.15)/17),...boundaries.slice(0,12)].sort((a,b)=>a-b).filter((v,n,a)=>n===0||v-a[n-1]>.18).slice(0,30);
   const boards=[];
   for(let b=0;b<Math.ceil(times.length/6);b++){
    const boardName='analysis-'+i+'-'+b+'.jpg';
    if(!oldContext.refreshVisualSamples&&(f[AI.preview]||[]).some(a=>a.name===boardName)){console.log('Reused saved source analysis '+boardName);boards.push(boardName);continue;}
    console.log('Preparing source analysis '+boardName);const batch=times.slice(b*6,b*6+6);const files=[];
    for(let n=0;n<batch.length;n++){const file=path.join(WORK,'cell-'+i+'-'+b+'-'+n+'.jpg');run('ffmpeg',['-v','error','-y','-ss',String(batch[n]),'-i',parts[i],'-vf',"scale=240:420:force_original_aspect_ratio=decrease,pad=240:420:(ow-iw)/2:(oh-ih)/2,drawtext=text='source "+i+"  "+batch[n].toFixed(2)+"s':fontcolor=white:fontsize=17:box=1:boxcolor=black@0.8:x=5:y=5",'-frames:v','1','-q:v','3',file]);files.push(file);}
    const list=path.join(WORK,'cells.txt');await fs.writeFile(list,files.map(x=>"file '"+x+"'").join('\n'));const preview=path.join(WORK,'analysis-'+i+'-'+b+'.jpg');run('ffmpeg',['-v','error','-y','-f','concat','-safe','0','-i',list,'-vf','tile=3x2','-frames:v','1','-q:v','3',preview]);await attach(id,AI.preview,preview,'image/jpeg');boards.push(path.basename(preview));
   }
   sources.push({index:i,name:f[F.source][i].name,duration,width:m.streams.find(s=>s.codec_type==='video')?.width,height:m.streams.find(s=>s.codec_type==='video')?.height,previewNames:boards,sampleTimes:times,sceneBoundaries:boundaries.slice(0,30)});
  }
  await update(id,{[AI.context]:JSON.stringify({version:3,pipelineVersion:3,feedbackVersion:1,transcriptionProjects,inputFingerprint,sources,ratio:f[F.ratio],language:f[F.language],existingReapProject:false,limitations:'Reap timed transcript is supplied before AI planning. Edit original media; burn aligned subtitles only after animation and audio mixing.'}),[F.status]:'Planning',[F.error]:null});await log({fldQKzITMb6gNWgM2dH:'Completed',fldgIL91GLIOXQgQdTJ:new Date().toISOString()});console.log('Visual previews prepared; waiting for Teable AI composition');return;
 }
 let plan;try{plan=JSON.parse(f[F.plan]);}catch{throw Error('AI edit plan is not valid JSON');}
 let input=parts[0];
 if(true){if(!Array.isArray(plan.cuts)||!plan.cuts.length||plan.cuts.length>16)throw Error('AI cuts missing or too many');const segments=[];for(let n=0;n<plan.cuts.length;n++){const c=plan.cuts[n],p=parts[c.sourceIndex];if(!p)throw Error('AI selected invalid source index');const dur=Number(probe(p).format.duration),start=Number(c.start),end=Number(c.end);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>dur+.1||end-start<1)throw Error('AI cut outside source duration');const seg=path.join(WORK,`segment-${n}.mp4`);run('ffmpeg',['-v','error','-y','-ss',String(start),'-i',p,'-t',String(end-start),'-vf',f[F.ratio]==='16:9'?'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30':'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30','-c:v','libx264','-preset','fast','-crf','22','-ar','48000','-ac','2','-c:a','aac',seg]);segments.push(seg);}await fs.writeFile(path.join(WORK,'concat.txt'),segments.map(p=>`file '${p}'`).join('\n'));input=path.join(WORK,'edited.mp4');run('ffmpeg',['-v','error','-y','-f','concat','-safe','0','-i',path.join(WORK,'concat.txt'),'-c','copy',input]);}
 const duration=Number(probe(input).format.duration);if(duration<3||duration>900)throw Error('Edited video must be 3 seconds to 15 minutes');
 const transcript=JSON.parse(f.fldLNwP5v89GFBCsDSq||'null');if(transcript?.inputFingerprint!==inputFingerprint||transcript?.language!==f[F.language])throw Error('Transcript does not match current input');
 const mapped=remapWords(transcript.sources,plan.cuts);if(!mapped.words.length)throw Error('No subtitles align with AI-selected cuts');
 const srt=path.join(WORK,'final-subtitles.srt');await fs.writeFile(srt,makeSrt(mapped.words));
 await attach(id,AI.media,input,'video/mp4');
 let background;const supplied=f.fldOc9RSXxKV1pLFBu2;if(supplied?.length){const a=supplied[Math.min(supplied.length-1,Math.max(0,Number(plan.music?.attachmentIndex)||0))];background=path.join(WORK,'background.audio');await download(a.presignedUrl||a.url,background);}
 const htmlHash=createHash('sha256').update(f[AI.html]).digest('hex');
 if(oldContext.feedbackVersion===1&&oldContext.visualApprovedHash!==htmlHash){
  const draft=await animate(input,f[F.ratio],f[AI.html],plan.music,background,report=>update(id,{[AI.validation]:JSON.stringify({...report,phase:'low-resolution visual preview'})}),true);
  const previewTimes=reviewTimes(plan.scenes,plan.animationEvents,duration);
  const boards=[];for(let b=0;b<Math.ceil(previewTimes.length/6);b++){const batch=previewTimes.slice(b*6,b*6+6),files=[];for(let n=0;n<batch.length;n++){const file=path.join(WORK,'review-cell-'+b+'-'+n+'.jpg');run('ffmpeg',['-v','error','-y','-ss',String(batch[n]),'-i',draft,'-vf',"scale=240:420:force_original_aspect_ratio=decrease,pad=240:420:(ow-iw)/2:(oh-ih)/2,drawtext=text='"+batch[n].toFixed(2)+"s':fontcolor=white:fontsize=18:box=1:boxcolor=black@0.8:x=5:y=5",'-frames:v','1','-q:v','3',file]);files.push(file);}const list=path.join(WORK,'review-cells.txt');await fs.writeFile(list,files.map(x=>"file '"+x+"'").join('\n'));const board=path.join(WORK,'visual-review-'+htmlHash.slice(0,10)+'-'+b+'.jpg');run('ffmpeg',['-v','error','-y','-f','concat','-safe','0','-i',list,'-vf','tile=3x2','-frames:v','1','-q:v','3',board]);await attach(id,'fldUiKDtSmDmy8BzKuc',board,'image/jpeg');boards.push(path.basename(board));}
  await attach(id,AI.media,draft,'video/mp4');oldContext.visualReviewPending={hash:htmlHash,boards,times:previewTimes};delete oldContext.dispatchedAt;
  await update(id,{[AI.context]:JSON.stringify(oldContext),[F.status]:'Planning',[F.error]:null,[AI.validation]:JSON.stringify({phase:'awaiting AI visual review',previewResolution:'half output dimensions',htmlHash})});await log({fldQKzITMb6gNWgM2dH:'Completed',fldgIL91GLIOXQgQdTJ:new Date().toISOString()});return;
 }
 let final;try{final=await animate(input,f[F.ratio],f[AI.html],plan.music,background,report=>update(id,{[AI.validation]:JSON.stringify(report)}));}catch(e){await update(id,{[F.status]:'Planning',[F.error]:'Composition repair required: '+String(e.message).slice(0,1200),[AI.validation]:JSON.stringify({passed:false,error:String(e.message).slice(0,1200)})});await log({fldQKzITMb6gNWgM2dH:'Failed',fldARLTkp2ZjurZD6P4:'Composition returned to AI repair',fldgIL91GLIOXQgQdTJ:new Date().toISOString()});console.log('Composition requires Teable AI repair');return;}
 await update(id,{[AI.validation]:JSON.stringify({phase:'adding final subtitles',wordCount:mapped.words.length})});
 const subtitled=path.join(WORK,'final-subtitled.mp4');const [sw,sh]=f[F.ratio]==='16:9'?[1920,1080]:[1080,1920];
 const font=18,margin=32;
 run('ffmpeg',['-v','error','-y','-i',final,'-vf',"subtitles=filename='"+srt+"':force_style='FontName=Noto Sans,FontSize="+font+",PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,Alignment=2,MarginV="+margin+"'",'-c:v','libx264','-preset','fast','-crf','20','-c:a','copy','-movflags','+faststart',subtitled]);
 const out=probe(subtitled);if(Math.abs(Number(out.format.duration)-mapped.duration)>1||out.streams.find(x=>x.codec_type==='video')?.width!==sw||!out.streams.some(x=>x.codec_type==='audio'))throw Error('Final subtitled video validation failed');final=subtitled;await attach(id,'fldyRwudotBJI10gTeQ',srt,'application/x-subrip');
 await update(id,{[AI.validation]:JSON.stringify({...JSON.parse(await fs.readFile(path.join(WORK,'validation.json'),'utf8')),phase:'completed',subtitleStage:'after animation and audio mix',subtitleWords:mapped.words.length,pipelineVersion:3}),[F.status]:'Uploading'});await attach(id,F.video,final,'video/mp4');
 const motionPreview=path.join(WORK,'rendered-motion-preview.jpg');const finalDuration=Number(probe(final).format.duration);run('ffmpeg',['-v','error','-y','-i',final,'-vf',`fps=6/${finalDuration},scale=270:480:force_original_aspect_ratio=decrease,pad=270:480:(ow-iw)/2:(oh-ih)/2,tile=3x2`,'-frames:v','1','-q:v','3',motionPreview]);await attach(id,'fldUiKDtSmDmy8BzKuc',motionPreview,'image/jpeg');
 const cover=path.join(WORK,'cover.jpg');run('ffmpeg',['-v','error','-y','-ss','1','-i',final,'-frames:v','1','-q:v','3',cover]);const form=new FormData();form.set('file',new Blob([await fs.readFile(cover)],{type:'image/jpeg'}),'cover.jpg');form.set('upload_preset',process.env.CLOUDINARY_PRESET);form.set('public_id',`video-covers/${id}-${Date.now()}`);const cloud=await(await request(`https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_NAME)}/image/upload`,{method:'POST',body:form})).json();if(!cloud.secure_url)throw Error('Cover upload returned no URL');await attach(id,F.cover,cover,'image/jpeg');
 const saved=await api(`/table/${TABLE}/record/${id}?fieldKeyType=id`),videoUrl=saved.fields?.[F.video]?.at(-1)?.presignedUrl||saved.fields?.[F.video]?.at(-1)?.url||'';
 await update(id,{[F.url]:videoUrl,[F.status]:'Completed',[F.coverUrl]:cloud.secure_url,[F.completed]:new Date().toISOString(),[F.error]:null});await log({fldQKzITMb6gNWgM2dH:'Completed',fldzo0bwhRdF3GMEYwN:videoUrl,fldGQIAbOyOobOEJvod:cloud.secure_url,fldgIL91GLIOXQgQdTJ:new Date().toISOString()});console.log('Job completed; final video stored in Teable, cover in Cloudinary');
 }catch(e){await log({fldQKzITMb6gNWgM2dH:'Failed',fldARLTkp2ZjurZD6P4:String(e.message).slice(0,500),fldgIL91GLIOXQgQdTJ:new Date().toISOString()});if(started)await update(id,{[F.status]:'Failed',[F.error]:String(e.message).slice(0,500)});throw Error('Video processing failed; see private Teable job error');}
}
if(process.env.MODE==='selftest'){const input=path.join(WORK,'synthetic.mp4');run('ffmpeg',['-v','error','-y','-f','lavfi','-i','color=c=navy:s=320x568:r=30:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',input]);await animate(input,'9:16');console.log('Synthetic FFmpeg + HyperFrames render passed');}else if(process.env.JOB_ID){await processJob(process.env.JOB_ID);}else{throw Error('JOB_ID required');}
await fs.rm(WORK,{recursive:true,force:true});
