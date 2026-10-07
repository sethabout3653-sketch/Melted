// Cloudflare Pages Function: Raw Game Stream Proxy
// Streams HTML games directly with permissive headers and edge caching
export async function onRequest(context: { params: { filename: string } }): Promise<Response> {
  let filename = context.params.filename;
  if (!filename) {
    return new Response('Invalid game filename', { status: 400 });
  }

  if (!filename.endsWith('.html')) {
    filename = `${filename}.html`;
  }

  const rawgithackUrl = `https://raw.githack.com/freebuisness/html/main/${filename}`;
  const githubRawUrl = `https://raw.githubusercontent.com/freebuisness/html/main/${filename}`;

  try {
    let response = await fetch(rawgithackUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      response = await fetch(githubRawUrl);
    }

    if (!response.ok) {
      return new Response(`Failed to fetch game package: ${response.statusText}`, {
        status: response.status,
      });
    }

    let html = await response.text();

    // Desktop Spoofing, GPU Acceleration, Inactivity Wake-Up, & Batch Save Sync for School Chromebooks
    const desktopSpoof = `<script>(function(){try{
var u='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
Object.defineProperty(navigator,'userAgent',{get:function(){return u},configurable:true});
Object.defineProperty(navigator,'platform',{get:function(){return'Win32'},configurable:true});
Object.defineProperty(navigator,'vendor',{get:function(){return'Google Inc.'},configurable:true});
if(navigator.userAgentData){Object.defineProperty(navigator,'userAgentData',{get:function(){return{brands:[{brand:'Chromium',version:'124'},{brand:'Google Chrome',version:'124'}],mobile:false,platform:'Windows',getHighEntropyValues:function(){return Promise.resolve({architecture:'x86',bitness:'64',mobile:false,platform:'Windows'})}}},configurable:true});}

var s=document.createElement('style');
s.textContent='canvas,#canvas,body{image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;transform:translate3d(0,0,0);backface-visibility:hidden;}';
(document.head||document.documentElement).appendChild(s);

var trackedAudio=[];
var OrigAudioCtx=window.AudioContext||window.webkitAudioContext;
if(OrigAudioCtx){
  var PatchedAudio=function(){
    var ctx=new OrigAudioCtx();
    trackedAudio.push(ctx);
    return ctx;
  };
  PatchedAudio.prototype=OrigAudioCtx.prototype;
  window.AudioContext=PatchedAudio;
  if(window.webkitAudioContext) window.webkitAudioContext=PatchedAudio;
}

function wakeGameEngine(){
  try{
    trackedAudio.forEach(function(ctx){
      if(ctx&&ctx.state==='suspended'){ctx.resume().catch(function(){});}
    });
    window.focus();
  }catch(e){}
}

window.addEventListener('focus',wakeGameEngine,true);
window.addEventListener('click',wakeGameEngine,true);
window.addEventListener('keydown',wakeGameEngine,true);
window.addEventListener('touchstart',wakeGameEngine,true);
document.addEventListener('visibilitychange',function(){if(!document.hidden)wakeGameEngine();});

var pendingSaveBatch={};
var saveFlushTimer=null;
function sendPendingSaves(){
  if(Object.keys(pendingSaveBatch).length===0)return;
  try{
    window.parent.postMessage({type:'FROSTED_SAVE_BATCH',data:pendingSaveBatch},'*');
    pendingSaveBatch={};
  }catch(e){}
}

var origSetItem=localStorage.setItem;
localStorage.setItem=function(k,v){
  try{
    origSetItem.apply(this,arguments);
    pendingSaveBatch[k]=String(v);
    if(!saveFlushTimer){
      saveFlushTimer=setTimeout(function(){
        saveFlushTimer=null;
        sendPendingSaves();
      },1000);
    }
  }catch(e){
    origSetItem.apply(this,arguments);
  }
};

window.addEventListener('beforeunload',sendPendingSaves);
window.addEventListener('pagehide',sendPendingSaves);

window.addEventListener('message',function(e){
  if(!e.data)return;
  if(e.data.type==='FROSTED_RESTORE_SAVES'&&e.data.saves){
    Object.keys(e.data.saves).forEach(function(k){try{origSetItem.call(localStorage,k,e.data.saves[k]);}catch(err){}});
    wakeGameEngine();
  }
  if(e.data.type==='RESUME_GAME'||e.data.type==='WAKE_GAME'){
    wakeGameEngine();
  }
});
}catch(e){}})();</script>`;

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${desktopSpoof}`);
    } else if (html.includes('<html>')) {
      html = html.replace('<html>', `<html><head>${desktopSpoof}</head>`);
    } else {
      html = `${desktopSpoof}${html}`;
    }

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'public, max-age=2592000, immutable',
      },
    });
  } catch (error: any) {
    return new Response(`Error streaming game: ${error?.message || error}`, { status: 500 });
  }
}
