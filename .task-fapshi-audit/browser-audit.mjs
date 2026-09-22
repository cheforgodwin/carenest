import { writeFile } from 'node:fs/promises';
const tab = await (await fetch('http://127.0.0.1:9335/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
let next=0; const pending=new Map(); let errors=[]; let failures=[];
ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p?.reject(Error(m.error.message)):p?.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);else if(m.method==='Network.loadingFailed')failures.push(m.params.errorText)};
function send(method,params={}) {return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(pending.delete(id))reject(Error('CDP timeout '+method))},20000).unref()})}
const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
const results=[];
for(const viewport of [{name:'desktop',width:1366,height:900,mobile:false},{name:'mobile',width:390,height:844,mobile:true}]) {
await send('Emulation.setDeviceMetricsOverride',{...viewport,name:undefined,deviceScaleFactor:1});
for(const route of (viewport.mobile?['/','/signup','/privacy']:['/','/signup','/login','/terms','/privacy','/dashboard/customer'])) {
errors=[];failures=[];
const navigation=await send('Page.navigate',{url:'https://carenest237.com'+route});
await new Promise(r=>setTimeout(r,2500));
for(let i=0;i<20;i++){if(await evaluate("!!document.querySelector('h1,form') && document.readyState==='complete'"))break;await new Promise(r=>setTimeout(r,500))}
const page=await evaluate(`({url:location.href,title:document.title,text:document.body.innerText,links:[...document.querySelectorAll('a')].map(a=>({text:a.innerText,href:a.getAttribute('href')})),inputs:[...document.querySelectorAll('input,select')].map(i=>({type:i.type,name:i.name,required:i.required})),overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src'))})`);
const name=viewport.name+'-'+(route.replaceAll('/','-')||'home');
const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
await writeFile('.task-fapshi-audit/'+name+'.png',Buffer.from(shot.data,'base64'));
const item={viewport:viewport.name,route,navigationError:navigation.errorText||null,...page,errors:[...errors],failures:[...failures]};results.push(item);
console.log(JSON.stringify(item));
}
}
await writeFile('.task-fapshi-audit/browser-results.json',JSON.stringify(results,null,2));
await send('Page.close');ws.close();
