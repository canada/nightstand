import {configured,createTeamsAuth} from './teams-auth.js';
import {readCalendar,upcomingEvents,eventDate,calendarRange} from './teams-graph.js';

const el=(tag,className,text)=>{
  const node=document.createElement(tag);
  if(className)node.className=className;
  if(text!=null)node.textContent=text;
  return node;
};
function button(text,handler,className='teams-button') {
  const node=el('button',className,text);node.type='button';node.addEventListener('click',handler);return node;
}
const MESSAGES={
  access_denied:'予定表へのアクセスが許可されませんでした。Microsoft側の権限設定を確認してください。',
  rate_limited:'Microsoftが混み合っています。しばらくしてから更新してください。',
  invalid_range:'この年月の予定は取得できません。',
  invalid_response:'予定を正しく取得できませんでした。もう一度更新してください。',
  embedded:'接続するには、Nightstandを通常のブラウザタブで開いてください。',
  popup_window_error:'認証画面を開けませんでした。ポップアップを許可して、もう一度接続してください。',
  popup_bridge_timeout:'接続が完了しませんでした。認証画面を閉じ、もう一度接続してください。',
  user_cancelled:'接続を中止しました。'
};
const messageFor=error=>MESSAGES[error?.code || error?.errorCode || error?.message] || '予定を取得できませんでした。もう一度お試しください。';
const timeFormatter=new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false});

export function initTeamsCalendar({config,offset=0}) {
  const info=document.querySelector('.infop');
  const stack=el('div','info-stack');info.before(stack);stack.append(info);
  const panel=el('section','teams-panel');panel.id='teamsPanel';panel.setAttribute('aria-label','Teamsの予定');
  const heading=el('div','teams-heading');heading.append(el('h3','','予定'));
  const mainAction=button('Teamsに接続',()=>account || connecting?openDialog():auth?connect():openDialog());
  mainAction.id='teamsAction';heading.append(mainAction);
  const list=el('div','teams-events');list.id='teamsEvents';
  const status=el('p','teams-status');status.id='teamsStatus';status.setAttribute('role','status');
  panel.append(heading,list,status);stack.append(panel);

  const dialog=el('dialog','sheet');dialog.id='teamsDialog';dialog.setAttribute('aria-labelledby','teamsTitle');
  const dialogHeading=el('header','sheet-header');
  const titles=el('div');titles.append(el('p','eyebrow','CALENDAR'));
  const title=el('h2','','Teamsの予定');title.id='teamsTitle';titles.append(title);
  const close=button('×',()=>dialog.close(),'close-btn');close.setAttribute('aria-label','閉じる');
  dialogHeading.append(titles,close);
  const details=el('div','teams-details');details.id='teamsDetails';dialog.append(dialogHeading,details);document.body.append(dialog);
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)dialog.close();
  });

  let auth=null,account=null,events=[],truncated=false,connecting=false,loading=false;
  let errorMessage='',initializationError='',refreshTimer=null,abort=null;
  let session=0,request=0;

  function render() {
    panel.setAttribute('aria-busy',String(loading));
    mainAction.textContent=connecting?'接続中…':account?'一覧':configured(config)?'Teamsに接続':'接続の準備';
    mainAction.disabled=configured(config) && !auth && !initializationError;
    list.replaceChildren();
    if(account && !loading){
      const upcoming=upcomingEvents(events,offset);
      for(const event of upcoming.slice(0,2)){
        const row=button('',openDialog,'teams-event');
        row.append(el('time','teams-event-date',eventDate(event)),el('span','teams-event-title',event.title));
        list.append(row);
      }
      if(!upcoming.length && !errorMessage)list.append(el('p','teams-empty',offset===0?'これからの予定はありません':'この月の予定はありません'));
    }
    status.textContent=errorMessage || (loading?'予定を確認しています…':'');
    status.hidden=!status.textContent;
    renderDetails();
  }

  function renderDetails() {
    details.replaceChildren();
    details.append(el('p','sheet-note','予定はこのタブだけに表示します。再読み込み後は再接続してください。'));
    if(!configured(config)){
      details.append(el('p','teams-explanation','接続設定の準備が必要です。Microsoft側のアプリ登録が完了すると、この画面から接続できます。'));
      return;
    }
    if(initializationError){details.append(el('p','teams-explanation',initializationError));return;}
    if(connecting){
      details.append(el('p','teams-explanation','Microsoftの画面で接続を完了してください。'));
      details.append(button('接続を中止',()=>disconnect('接続を中止しました。')));return;
    }
    if(!account){
      if(errorMessage)details.append(el('p','teams-explanation',errorMessage));
      const connectButton=button(auth?'Microsoftアカウントで接続':'接続の準備中…',connect,'sheet-action');
      connectButton.disabled=!auth;details.append(connectButton);return;
    }
    details.append(el('p','teams-account',`接続中: ${account.name || account.username || 'Microsoftアカウント'}`));
    const actions=el('div','teams-actions');
    const refresh=button('更新',()=>loadMonth());refresh.disabled=loading;
    actions.append(refresh,button('このタブの接続を解除',()=>disconnect()));details.append(actions);
    const range=calendarRange(offset);
    details.append(el('h3','teams-month',`${range.start.getFullYear()}年${range.start.getMonth()+1}月`));
    if(errorMessage){details.append(el('p','teams-explanation',errorMessage));return;}
    if(loading){details.append(el('p','sheet-note','予定を確認しています…'));return;}
    if(!events.length){details.append(el('p','teams-explanation','この月の予定はありません。'));return;}
    const all=el('ol','teams-all-events');
    for(const event of events){
      const item=el('li','teams-detail-event');
      const date=eventDate(event)+(event.allDay?'':`–${timeFormatter.format(event.end)}`);
      item.append(el('p','teams-detail-date',date),el('p','teams-detail-title',event.title));all.append(item);
    }
    details.append(all);
    if(truncated)details.append(el('p','sheet-note','予定が多いため、一部を表示しています。'));
    details.append(el('p','sheet-note','時刻はこの端末の時刻で表示しています。'));
  }

  function openDialog(){renderDetails();if(!dialog.open)dialog.showModal();}

  function disconnect(message='') {
    session++;request++;abort?.abort();abort=null;
    clearInterval(refreshTimer);refreshTimer=null;
    const previous=account;
    account=null;events=[];truncated=false;connecting=false;loading=false;errorMessage=message;
    render();
    auth?.clear(previous).catch(()=>{});
  }

  function connect() {
    if(!auth || connecting)return;
    if(window.self!==window.top){errorMessage=MESSAGES.embedded;render();return;}
    const attempt=++session;
    request++;abort?.abort();events=[];account=null;connecting=true;errorMessage='';render();
    // Preserve the user gesture for popup blockers: no await before this call.
    let pending;
    try{pending=auth.connect();}catch(error){connecting=false;errorMessage=messageFor(error);render();return;}
    Promise.resolve(pending).then(result=>{
      if(attempt!==session){auth.clear(result.account).catch(()=>{});return;}
      connecting=false;
      if(!result.account){errorMessage='接続できませんでした。もう一度お試しください。';render();return;}
      account=result.account;
      clearInterval(refreshTimer);
      refreshTimer=setInterval(()=>{if(!document.hidden)loadMonth(true);},5*60e3);
      loadMonth();
    }).catch(error=>{
      if(attempt!==session)return;
      connecting=false;errorMessage=messageFor(error);render();
    });
  }

  async function loadMonth(background=false) {
    if(!auth || !account)return;
    const activeSession=session,currentRequest=++request,currentOffset=offset,currentAccount=account;
    abort?.abort();const controller=new AbortController();abort=controller;
    if(!background)events=[];
    loading=!background;errorMessage='';render();
    const stale=()=>activeSession!==session || currentRequest!==request || controller.signal.aborted;
    try{
      const token=await auth.token(currentAccount);
      if(stale())return;
      const result=await readCalendar({token,offset:currentOffset,signal:controller.signal});
      if(stale())return;
      events=result.events;truncated=result.truncated;
    }catch(error){
      if(stale())return;
      if(['sign_in_required','interaction_required','login_required','consent_required','no_tokens_found'].includes(error.code || error.errorCode)){
        disconnect('接続の確認が必要です。もう一度Teamsに接続してください。');return;
      }
      events=[];errorMessage=messageFor(error);
    }finally{
      if(!stale()){loading=false;render();}
    }
  }

  if(configured(config)){
    createTeamsAuth(config).then(result=>{auth=result;render();}).catch(error=>{
      initializationError=messageFor(error);render();
    });
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && account)loadMonth(true);});
  addEventListener('pagehide',()=>disconnect());
  render();
  return {setMonthOffset(next){
    if(next===offset)return;
    offset=next;request++;abort?.abort();events=[];errorMessage='';loading=false;truncated=false;
    render();if(account)loadMonth();
  }};
}
