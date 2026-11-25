// Cloudflare Pages/Workers Edge Handler: UGS Game Stream Proxy (/api/ugs/*)
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const TURBOWARP_SCAFFOLDING_URL =
  'https://cdn.jsdelivr.net/npm/@turbowarp/packager@3.14.0/dist/scaffolding/scaffolding-min.js';

function injectScaffoldingProtection(html: string, scriptProxyUrl: string): string {
  const hasScaffoldingRef =
    html.includes('scaffolding') || html.includes('Scaffolding') || html.includes('getProjectData');
  const hasTurboWarpRef = html.includes('TurboWarp') || html.includes('turbowarp');
  const hasScriptJsRef = html.includes('script.js');

  if (!hasScaffoldingRef && !hasTurboWarpRef && !hasScriptJsRef) {
    return html;
  }

  const protectionScript = `<script>(function(){if(typeof window.Scaffolding!=='undefined'&&!window.Scaffolding._isPlaceholder)return;function ScaffoldingPlaceholder(){var self=this;this._isPlaceholder=true;this.width=480;this.height=360;this.setup=function(){return self};this.appendTo=function(){return self};this.vm={setTurboMode:function(){},setInterpolation:function(){},setFramerate:function(){},setRuntimeOptions:function(){},setCompilerOptions:function(){},renderer:{setMaxTextureDimension:function(){},setUseHighQualityRender:function(){}},runtime:{setEnforcePrivacy:function(){},audioEngine:{},v2BitmapAdapter:{},ioDevices:{video:{provider:{}}}},extensionManager:{loadExtensionURL:function(){}}};this.addCloudProvider=function(){};this.setUsername=function(){};this.setAccentColor=function(){};this.setExtensionSecurityManager=function(){};this.start=function(){};this.loadProject=function(){return Promise.resolve()};this.storage={onprogress:null,addWebStore:function(){},AssetType:{ImageVector:1,ImageBitmap:2,Sound:3,Font:4}};return this}window.Scaffolding={Scaffolding:ScaffoldingPlaceholder,Cloud:{WebSocketProvider:function(){}},_isPlaceholder:true};if(!window.scaffolding){window.scaffolding=new ScaffoldingPlaceholder()}})();</script>`;
  const runtimeScript = `<script src="${scriptProxyUrl}"></script>`;

  let updated = html.replace(
    /<script\s+src=["'](?:script|scaffolding|scaffolding-full|scaffolding-min)\.js["']\s*><\/script>/gi,
    runtimeScript
  );

  const injection = `\n${protectionScript}\n${runtimeScript}\n`;
  const firstScriptIdx = updated.indexOf('<script');
  if (firstScriptIdx >= 0 && firstScriptIdx < 500) {
    updated = updated.slice(0, firstScriptIdx) + injection + updated.slice(firstScriptIdx);
  } else if (updated.includes('<head>')) {
    updated = updated.replace('<head>', `<head>${injection}`);
  } else if (updated.includes('<HEAD>')) {
    updated = updated.replace('<HEAD>', `<HEAD>${injection}`);
  } else if (updated.includes('<html>')) {
    updated = updated.replace('<html>', `<html><head>${injection}</head>`);
  } else {
    updated = `${injection}\n${updated}`;
  }

  return updated;
}

export async function onRequest(context: {
  request?: Request;
  params: { path?: string | string[] };
}): Promise<Response> {
  const rawPath = context.params?.path;
  const ugsPath = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '');
  if (!ugsPath) {
    return new Response('Invalid UGS game path', { status: 400 });
  }

  const cleanPath = ugsPath.startsWith('/') ? ugsPath : `/${ugsPath}`;
  const fullPath = cleanPath.startsWith('/ugs/') ? cleanPath : `/ugs${cleanPath}`;

  const primaryUrl = `https://cdn.jsdelivr.net/gh/gmshelf/ugs@main${fullPath}`;
  const fallbackUrl = `https://raw.githubusercontent.com/gmshelf/ugs@main${fullPath}`;

  try {
    let response = await fetch(primaryUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      response = await fetch(fallbackUrl, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(6000),
      });
    }

    if (!response.ok) {
      const lower = fullPath.toLowerCase();
      if (
        lower.endsWith('script.js') ||
        lower.endsWith('scaffolding.js') ||
        lower.endsWith('scaffolding-full.js') ||
        lower.endsWith('scaffolding-min.js')
      ) {
        const scaffoldRes = await fetch(TURBOWARP_SCAFFOLDING_URL, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(6000),
        }).catch(() => null);
        const body = scaffoldRes && scaffoldRes.ok ? await scaffoldRes.text() : '/* TurboWarp Scaffolding Fallback */';
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'application/javascript; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=604800, immutable',
          },
        });
      }

      return new Response('UGS game file not found', { status: response.status });
    }

    const isHtml = fullPath.endsWith('.html') || fullPath.endsWith('.htm') || !fullPath.includes('.');
    if (isHtml) {
      const rawText = await response.text();
      let processedHtml = injectScaffoldingProtection(rawText, '/api/ugs/script.js');
      const baseTag = `<base href="https://cdn.jsdelivr.net/gh/gmshelf/ugs@main/ugs/">`;
      if (processedHtml.includes('<head>')) {
        processedHtml = processedHtml.replace('<head>', `<head>${baseTag}`);
      } else if (processedHtml.includes('<HEAD>')) {
        processedHtml = processedHtml.replace('<HEAD>', `<HEAD>${baseTag}`);
      } else if (processedHtml.includes('<html>')) {
        processedHtml = processedHtml.replace('<html>', `<html><head>${baseTag}</head>`);
      } else {
        processedHtml = `${baseTag}${processedHtml}`;
      }

      return new Response(processedHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'X-Frame-Options': 'ALLOWALL',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'X-Frame-Options': 'ALLOWALL',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new Response('Error proxying UGS game file', { status: 500 });
  }
}
