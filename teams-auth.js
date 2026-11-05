import {CALENDAR_SCOPE} from './teams-graph.js';
const GUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let libraryPromise;

export function configured(config) {
  return GUID.test(config.clientId) && GUID.test(config.tenantId);
}

function loadLibrary() {
  if (!libraryPromise) libraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL('./vendor/msal-browser-5.27.0.min.js',import.meta.url).href;
    script.referrerPolicy='no-referrer';
    script.onload=()=>window.msal?resolve(window.msal):reject(new Error('auth_unavailable'));
    script.onerror=()=>reject(new Error('auth_unavailable'));
    document.head.append(script);
  });
  return libraryPromise;
}

export async function createTeamsAuth(config) {
  if (!configured(config)) throw new Error('not_configured');
  if (window.self!==window.top) throw new Error('embedded');
  const msal=await loadLibrary();
  const client=new msal.PublicClientApplication({
    auth:{clientId:config.clientId,authority:`https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri:new URL('./teams-auth-return.html',import.meta.url).href,navigateToLoginRequestUrl:false},
    cache:{cacheLocation:'memoryStorage'},
    system:{allowPlatformBroker:false,serverTelemetryEnabled:false,popupBridgeTimeout:120000,
      loggerOptions:{piiLoggingEnabled:false,loggerCallback:()=>{}}}
  });
  await client.initialize();
  return {
    // Called directly from a click handler, without awaiting network work first.
    connect:()=>client.loginPopup({scopes:[CALENDAR_SCOPE],prompt:'select_account'}),
    token:async account=>{
      const result=await client.acquireTokenSilent({account,scopes:[CALENDAR_SCOPE]});
      return result.accessToken;
    },
    clear:async account=>{
      client.setActiveAccount(null);
      await client.clearCache(account?{account}:undefined);
    }
  };
}
