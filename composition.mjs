import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import puppeteer from 'puppeteer';

export async function validateComposition(dir,html,w,h,duration){
 if(typeof html!=='string'||html.length<500||html.length>120000)throw Error('Composition HTML missing or invalid length');
 if(!html.includes('window.__timelines')||!html.includes('data-motion'))throw Error('Composition must register film timeline and data-motion elements');
 if(/https?:\/\/|\bfetch\s*\(|XMLHttpRequest|WebSocket|<iframe|<object|<embed|@import|\beval\s*\(/i.test(html))throw Error('Composition contains unsupported network or dynamic resources');
 const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'self\' data:; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; connect-src \'none\'; object-src \'none\'">';
 html=html.replace(/<head[^>]*>/i,m=>m+csp);
 await fs.writeFile(path.join(dir,'index.html'),html);
 const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent((req.url||'/').split('?')[0]);const file=path.resolve(dir,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(dir+path.sep))throw Error('Invalid path');const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.mp4':'video/mp4'})[ext]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();await page.setViewport({width:w,height:h});await page.setRequestInterception(true);page.on('request',r=>r.resourceType()==='media'?r.abort():r.continue());const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForFunction(()=>!!window.__timelines?.film,{timeout:15000});
 const result=await page.evaluate(({duration,w,h})=>{const t=window.__timelines?.film,root=document.querySelector('[data-composition-id="film"]');if(!t||!root)throw Error('Missing film timeline/root');if(Math.abs(Number(root.dataset.duration)-duration)>0.1||Number(root.dataset.width)!==w||Number(root.dataset.height)!==h)throw Error('Composition dimensions or duration do not match');if(t.duration()<Math.min(3,duration-0.1))throw Error('Animation timeline too short');const elements=[...document.querySelectorAll('[data-motion]')];if(elements.length<3)throw Error('Need at least three substantial animated elements');const samples=[];for(let i=0;i<=24;i++){t.seek((duration-0.05)*i/24,false);samples.push(elements.map(el=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();return {id:el.id,transform:s.transform,opacity:s.opacity,x:b.x,y:b.y,w:b.width,h:b.height,visible:Number(s.opacity)>0.1&&s.visibility!=='hidden'&&b.width>w*0.28&&b.height>h*0.06&&b.right>0&&b.bottom>0&&b.left<w&&b.top<h};}));}let moving=0;for(let e=0;e<elements.length;e++){const visible=samples.map(s=>s[e]).filter(s=>s.visible);if(visible.length>=2&&new Set(visible.map(s=>JSON.stringify([s.transform,s.opacity,s.x,s.y,s.w,s.h]))).size>=2)moving++;}if(moving<3)throw Error('Fewer than three visibly changing substantial elements');return {animatedElements:moving,sampleCount:samples.length,timelineDuration:t.duration(),dimensions:[w,h]};},{duration,w,h});
 if(errors.length)throw Error('Browser composition error: '+errors[0]);return result;
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}

export async function makeMusic(file,duration,music={}){
 const sr=24000,n=Math.ceil(duration*sr),data=Buffer.alloc(44+n*2);data.write('RIFF');data.writeUInt32LE(36+n*2,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(sr,24);data.writeUInt32LE(sr*2,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(n*2,40);
 const tempo=Math.max(65,Math.min(140,Number(music.tempo)||92)),beat=60/tempo,notes=music.mood==='reflective'?[0,3,7,10,7,3,5,7]:[0,4,7,11,7,4,2,7],root=Number(music.rootMidi)||48;
 for(let i=0;i<n;i++){const t=i/sr,b=Math.floor(t/beat),u=(t%beat)/beat,f=440*2**((Math.max(36,Math.min(60,root))+notes[b%notes.length]-69)/12);const env=Math.sin(Math.PI*Math.min(1,u*8))*Math.exp(-u*(music.mood==='energetic'?4:2));const melody=Math.sin(2*Math.PI*f*t)*env*.16,bass=Math.sin(2*Math.PI*(440*2**((root-12-69)/12))*t)*.08;const fade=Math.min(1,t/1.5,(duration-t)/2);data.writeInt16LE(Math.round(Math.max(-1,Math.min(1,(melody+bass)*fade))*32767),44+i*2);}await fs.writeFile(file,data);
}
