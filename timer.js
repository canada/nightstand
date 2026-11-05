(() => {
  'use strict';
  const STORAGE_KEY = 'nsTimerV1';
  const FINISHED_BADGE_MS = 30000;
  const $ = id => document.getElementById(id);
  const circumference = 2*Math.PI*52;
  let timer = {status:'idle',duration:0,remaining:0,deadline:0};
  let audio = null;
  function save() { try {localStorage.setItem(STORAGE_KEY,JSON.stringify(timer));}catch{} }
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && ['running','paused','finished'].includes(saved.status) &&
          Number.isFinite(saved.duration) && saved.duration>0 && saved.duration<=86400000 &&
          Number.isFinite(saved.remaining) && saved.remaining>=0 && saved.remaining<=saved.duration &&
          Number.isFinite(saved.deadline)) timer=saved;
    }catch{}
  }
  function unlockAudio() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      if (audio.state==='suspended') audio.resume().catch(()=>{});
    }catch{}
  }
  function notify() {
    try {
      if (audio?.state==='running') {
        for (let i=0;i<3;i++) {
          const oscillator=audio.createOscillator(), gain=audio.createGain();
          const start=audio.currentTime+i*.35;
          oscillator.type='sine';oscillator.frequency.value=880;
          gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.2,start+.025);
          gain.gain.exponentialRampToValueAtTime(.001,start+.25);
          oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.27);
        }
      }
      navigator.vibrate?.([180,100,180,100,180]);
    }catch{}
  }
  function remaining() {return timer.status==='running'?Math.max(0,timer.deadline-Date.now()):timer.remaining;}
  function format(ms) {
    const seconds=Math.ceil(ms/1000), minutes=Math.floor(seconds/60);
    return `${String(minutes).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  }
  function durationLabel(ms) {
    const seconds=Math.round(ms/1000), minutes=Math.floor(seconds/60);
    return `${minutes?`${minutes}分`:''}${seconds%60?`${seconds%60}秒`:''}`;
  }
  function finish(sound=true) {
    timer.finishedAt=timer.deadline || Date.now();
    timer.status='finished';timer.remaining=0;timer.deadline=0;save();
    $('timerAnnouncement').textContent='タイマーが終了しました。';
    if(sound)notify();
  }
  function render() {
    const ms=remaining();
    if(timer.status==='running'&&ms<=0)finish();
    const idle=timer.status==='idle', done=timer.status==='finished';
    $('timerActive').hidden=idle;$('timerPresets').hidden=!idle;
    $('timerReadout').textContent=format(ms);
    $('timerState').textContent=done?'終了':timer.status==='paused'?'一時停止中':'残り時間';
    $('timerDuration').textContent=timer.duration?`${durationLabel(timer.duration)}のタイマー`:'';
    $('timerProgress').style.strokeDashoffset=String(circumference*(1-(timer.duration?ms/timer.duration:0)));
    $('timerToggle').textContent=done?'もう一度':timer.status==='paused'?'再開':'一時停止';
    $('timerCancel').textContent=done?'完了':'キャンセル';
    const finishedAt=Number.isFinite(timer.finishedAt)?timer.finishedAt:0;
    const badge=$('timerBadge');badge.hidden=idle || (done && Date.now()-finishedAt>=FINISHED_BADGE_MS);
    badge.textContent=done?'タイマー終了':`${timer.status==='paused'?'一時停止 · ':''}${format(ms)}`;
    badge.setAttribute('aria-label',done?'タイマー終了。開く':`残り${format(ms)}。タイマーを開く`);
    badge.classList.toggle('finished',done);
    $('timerActive').classList.toggle('finished',done);
  }
  function start(duration) {
    unlockAudio();timer={status:'running',duration,remaining:duration,deadline:Date.now()+duration};
    $('timerAnnouncement').textContent=`${durationLabel(duration)}のタイマーを開始しました。`;
    save();render();$('timerToggle').focus();
  }
  function init() {
    $('timerContents').innerHTML=`
      <section id="timerPresets" aria-label="よく使うタイマー">
        <p class="sheet-note">タップして開始</p>
        <div class="timer-presets">${[1,3,5,10,15,30].map(minutes=>`<button type="button" class="timer-preset" data-minutes="${minutes}" aria-label="${minutes}分のタイマーを開始"><span>${minutes}</span><small>分</small></button>`).join('')}</div>
        <form id="timerCustom" class="timer-custom">
          <p class="sheet-note">時間を指定</p>
          <div class="timer-custom-controls">
            <label><input id="timerMinutes" type="number" inputmode="numeric" min="0" max="1439" step="1" value="5" required aria-label="タイマーの分">分</label>
            <label><input id="timerSeconds" type="number" inputmode="numeric" min="0" max="59" step="1" value="0" required aria-label="タイマーの秒">秒</label>
            <button type="submit">開始</button>
          </div>
          <p id="timerCustomError" class="sheet-note" role="alert"></p>
        </form>
      </section>
      <section id="timerActive" hidden aria-label="タイマーの進行状況">
        <div class="timer-dial">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="timer-track" cx="60" cy="60" r="52"/><circle id="timerProgress" cx="60" cy="60" r="52"/></svg>
          <div class="timer-display"><p id="timerState"></p><p id="timerReadout"></p><p id="timerDuration"></p></div>
        </div>
        <div class="timer-actions"><button id="timerCancel" type="button">キャンセル</button><button id="timerToggle" type="button">一時停止</button></div>
      </section>
      <p class="sheet-note timer-note">画面を閉じても計測は続きます。通知音はこのページが動作中に鳴ります。</p>
      <p id="timerAnnouncement" class="sr-only" role="status" aria-live="polite"></p>`;
    $('timerProgress').style.strokeDasharray=String(circumference);
    document.querySelectorAll('[data-minutes]').forEach(button=>button.addEventListener('click',()=>start(Number(button.dataset.minutes)*60000)));
    $('timerCustom').addEventListener('submit',e=>{
      e.preventDefault();
      const minutes=$('timerMinutes').valueAsNumber, seconds=$('timerSeconds').valueAsNumber;
      const duration=(minutes*60+seconds)*1000;
      if(!Number.isInteger(minutes) || minutes<0 || minutes>1439 || !Number.isInteger(seconds) || seconds<0 || seconds>59 || duration<=0){
        $('timerCustomError').textContent='1秒以上の時間を設定してください。';return;
      }
      $('timerCustomError').textContent='';start(duration);
    });
    $('timerCustom').addEventListener('input',()=>{$('timerCustomError').textContent='';});
    $('timerCancel').addEventListener('click',()=>{
      timer={status:'idle',duration:0,remaining:0,deadline:0};save();render();
      document.querySelector('.timer-preset').focus();
    });
    $('timerToggle').addEventListener('click',()=>{
      unlockAudio();
      if(timer.status==='finished'){start(timer.duration);return;}
      const ms=remaining();
      if(timer.status==='running') {
        if(ms<=0){finish();render();return;}
        timer.remaining=ms;timer.status='paused';timer.deadline=0;
      }else{timer.deadline=Date.now()+timer.remaining;timer.status='running';}
      save();render();
    });
    restore();
    if(timer.status==='running'&&remaining()<=0)finish(false);
    render();setInterval(render,250);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')render();});
  }
  window.NightstandTimer={init,open(){unlockAudio();render();}};
})();
