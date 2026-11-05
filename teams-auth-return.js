'use strict';
// This page runs only Microsoft's redirect bridge, never the dashboard.
window.msalRedirectBridge.broadcastResponseToMainFrame().catch(()=>{
  document.getElementById('status').textContent='接続を完了できませんでした。元のNightstand画面からもう一度お試しください。';
});
