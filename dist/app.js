const TODAY_ISO=nippoDkey(new Date());
const defaultTasks=[];
function nippoStorageKey(key){return key+'.'+(window.teamflowViewerUid||'signedout')}
function firebaseError(error){
 const code=error&&error.code||'';
 if(['auth/invalid-credential','auth/wrong-password','auth/user-not-found','auth/invalid-email'].includes(code))return 'お名前かパスワードが違います。';
 if(code==='auth/too-many-requests')return '試行回数が多いため、少し待ってからお試しください。';
 if(code==='auth/network-request-failed')return '通信できません。接続を確認してください。';
 if(code==='permission-denied'||code==='functions/permission-denied')return 'この操作を行う権限がありません。';
 return error&&error.message||'接続に失敗しました。もう一度お試しください。';
}
/* ===== 日報（店頭日報） ===== */
const NIPPO_STAFF=[{id:'fujikawa',name:'藤川',role:'manager',store:'matsue'},{id:'tanaka',name:'田中',role:'staff',store:'gakuen'},{id:'tsunematsu',name:'常松',role:'manager',store:'mitoya',title:'店長'},{id:'iwata',name:'岩田',role:'manager',store:'mitoya',title:'副店長'},{id:'kurosaki',name:'黒崎',role:'staff',store:'mitoya'},{id:'hino',name:'日野',role:'staff',store:'mitoya'}];
const NIPPO_STORES=[{id:'matsue',name:'イオン松江店'},{id:'gakuen',name:'イオン学園北店'},{id:'mitoya',name:'イオン三刀屋店'}];
const NIPPO_VISIT=[['mnp_new','MNP/新規',0],['kihen','機変',0],['au_uq','au⇔UQ',0],['keihen','契変',0],['sousa','操作',0],['koshou','故障',0],['kaiyaku','解約',0],['tsukisoi','付き添い',0],['other','その他',0]];
const NIPPO_PROP=[['o60','O60',1],['u18','U18',1],['money','マネ活',1],['ftth','FTTH',1],['denki','でんき',0],['card','カード',0],['plus1','＋１',0],['cellup','セルアップ',0]];
const NIPPO_WON=[['mnp','MNP',1,1],['new','新規',1,1],['kihen','機変',0,1],['uq_au','UQ→au',1,1],['other','その他',0,1],['yoyaku','予約のみ',0,0],['none','成約なし',0,0]];
const NIPPO_ATTACH=[['o60','O60',1],['u18','U18',1],['money','マネ活',1],['ftth','FTTH',1],['denki','でんき',0],['gold','ゴールド',0],['silver','シルバー',0],['jigin','じ銀',0],['plus1','＋１',0],['setup','設定サポ',0]];
const NIPPO_ENTRY=[['visits','接客した組数','①の元'],['used','診断シートを使った組数',''],['proposedGroups','提案した組数','②の元']];
const NIPPO_EXTRA=[['google','Google 口コミ'],['meishi','名刺'],['cp','紹介CP'],['coupon','クーポン']];
const NIPPO_KEYS=NIPPO_ENTRY.map(e=>e[0]).concat(NIPPO_PROP.map(p=>'prop_'+p[0])).concat(NIPPO_WON.map(w=>'won_'+w[0])).concat(NIPPO_ATTACH.map(a=>'attach_'+a[0])).concat(NIPPO_EXTRA.map(e=>e[0]));
const NIPPO_TODAY=new Date();
let nippoWarn='',nippoLogFilter='all',nippoUndo=null,nippoUndoTimer=null,nippoSync='local',nippoPending=new Set();
const NIPPO_PINNED_LAST=['other','yoyaku','none'];
let nippoOrderCache={};
const NIPPO_LOG_FILTERS=[['all','すべて',()=>true],['won','成約あり',l=>l.people.some(p=>{const w=NIPPO_WON.find(x=>x[0]===p.won);return w&&w[3]})],['noprop','提案なし',l=>l.people.every(p=>!p.prop.length)],['nosheet','シート未使用',l=>!l.used]];
function nippoEmpty(){const t={};NIPPO_KEYS.forEach(k=>t[k]=0);return t}
function nippoAddInto(a,b){NIPPO_KEYS.forEach(k=>a[k]+=(b[k]||0));return a}
function nippoWonTotal(t){return NIPPO_WON.reduce((s,w)=>w[3]?s+t['won_'+w[0]]:s,0)}
function nippoLab(arr,k){const f=arr.find(x=>x[0]===k);return f?f[1]:k}
function nippoHHMM(d){return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function nippoPct(x){return Math.round(x*100)+'%'}
function nippoF2(x){return x.toFixed(2)}
function nippoDkey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function nippoSampleToday(){
 const out={};
 NIPPO_STAFF.forEach(p=>{out[p.id]={logs:[],adj:{},note:'',submitted:false,submittedAt:'',changed:false}});
 return out
}
function nippoFreshPerson(){return {visit:null,visitNote:'',prop:[],propNone:false,won:null,attach:[],attachNone:false}}
function nippoNormalizePerson(p){return {visit:p&&p.visit!==undefined?p.visit:null,visitNote:p&&typeof p.visitNote==='string'?p.visitNote:'',prop:p&&Array.isArray(p.prop)?p.prop:[],propNone:!!(p&&p.propNone),won:p&&p.won!==undefined?p.won:null,attach:p&&Array.isArray(p.attach)?p.attach:[],attachNone:!!(p&&p.attachNone)}}
function nippoFreshDraft(){return {used:true,count:1,activePerson:0,people:[nippoFreshPerson()],editIndex:null}}
function nippoNormalizeDraft(d){
 d=d||{};
 const count=Math.max(1,Number(d.count)||1);
 const people=Array.isArray(d.people)&&d.people.length?d.people.map(nippoNormalizePerson):[nippoNormalizePerson(d)];
 while(people.length<count)people.push(nippoFreshPerson());
 return {used:d.used!==false,count,activePerson:Math.min(Math.max(0,Number(d.activePerson)||0),count-1),people,editIndex:Number.isInteger(d.editIndex)?d.editIndex:null}
}
function nippoFresh(){return {v:1,date:nippoDkey(NIPPO_TODAY),person:'fujikawa',store:'matsue',mode:'log',tab:'input',today:nippoSampleToday(),draft:nippoFreshDraft()}}
function nippoNormalizeLog(l){
 let won=l.won;if(Array.isArray(won))won=won.length?won[0]:null;
 const legacy={visit:l.visit!==undefined?l.visit:null,prop:l.prop||[],won,attach:l.attach||[]};
 const people=Array.isArray(l.people)&&l.people.length?l.people.map(nippoNormalizePerson):[legacy];
 return {t:l.t,used:!!l.used,count:l.count||people.length||1,people}
}
function nippoNormalizeStaffDay(d){d=d||{};return {logs:(d.logs||[]).map(nippoNormalizeLog),adj:d.adj||{},note:d.note||'',submitted:!!d.submitted,submittedAt:d.submittedAt||'',submittedBy:d.submittedBy||null,changed:!!d.changed}}
function nippoNormalizeToday(today){const out={};NIPPO_STAFF.forEach(p=>{out[p.id]=nippoNormalizeStaffDay((today||{})[p.id])});return out}
/* 個人ごとの端末設定（誰の画面を開いているか等）はローカル保存。
   実際の日報データ（today）は共有DBがあればそちらを正とし、なければローカルに保存する。 */
function nippoLoadLocalSession(){
 try{
  const raw=localStorage.getItem(nippoStorageKey('teamflow.nippo.session.v1'));
  if(raw){const s=JSON.parse(raw);if(s&&s.date===nippoDkey(NIPPO_TODAY))return {person:s.person||'fujikawa',store:s.store||'matsue',mode:s.mode||'log',tab:s.tab||'input',draft:nippoNormalizeDraft(s.draft)}}
 }catch(e){}
 return {person:'fujikawa',store:'matsue',mode:'log',tab:'input',draft:nippoFreshDraft()}
}
function nippoSaveLocalSession(){try{localStorage.setItem(nippoStorageKey('teamflow.nippo.session.v1'),JSON.stringify({date:nippoDkey(NIPPO_TODAY),person:nippoState.person,store:nippoState.store,mode:nippoState.mode,tab:nippoState.tab,draft:nippoState.draft}))}catch(e){}}
/* 日ごとの決定数の履歴。初回起動時のみ参考値を種として保存し、以降は日付が変わるたびに実際の集計値を追記していく。 */
function nippoDefaultHistory(){return []}
function nippoSaveHistory(arr){try{localStorage.setItem(nippoStorageKey('teamflow.nippo.history.v1'),JSON.stringify(arr.slice(-90)))}catch(e){}}
function nippoLoadHistory(){
 try{
  const raw=localStorage.getItem(nippoStorageKey('teamflow.nippo.history.v1'));
  if(raw){const arr=JSON.parse(raw);if(Array.isArray(arr))return arr}
 }catch(e){}
 const seed=nippoDefaultHistory();
 nippoSaveHistory(seed);
 return seed
}
function nippoArchiveDay(dateKey,patch){
 const hist=nippoLoadHistory();
 patch=typeof patch==='number'?{won:patch}:patch;
 const idx=hist.findIndex(h=>h.date===dateKey);
 if(idx>=0)hist[idx]=Object.assign({},hist[idx],patch,{date:dateKey});
 else hist.push(Object.assign({date:dateKey},patch));
 hist.sort((a,b)=>a.date.localeCompare(b.date));
 nippoSaveHistory(hist)
}
function nippoSnapshotForDay(dayToday){
 const total=nippoEmpty();
 const byStaff={};
 NIPPO_STAFF.forEach(p=>{
  const d=dayToday[p.id],t=nippoEmpty();
  if(d){
   (d.logs||[]).forEach(l=>{t.visits++;if(l.used)t.used++;let proposed=false;(l.people||[]).forEach(p=>{if(p.prop.length)proposed=true;p.prop.forEach(k=>t['prop_'+k]++);if(p.won)t['won_'+p.won]++;p.attach.forEach(k=>t['attach_'+k]++)});if(proposed)t.proposedGroups++});
   Object.keys(d.adj||{}).forEach(k=>{if(k in t)t[k]+=d.adj[k]})
  }
  byStaff[p.id]={visits:t.visits,proposed:t.proposedGroups,won:nippoWonTotal(t)};
  nippoAddInto(total,t)
 });
 const byStore={};
 NIPPO_STORES.forEach(s=>byStore[s.id]={visits:0,proposed:0,won:0});
 NIPPO_STAFF.forEach(p=>{if(p.store&&byStore[p.store]){byStore[p.store].visits+=byStaff[p.id].visits;byStore[p.store].proposed+=byStaff[p.id].proposed;byStore[p.store].won+=byStaff[p.id].won}});
 const propByCategory={};NIPPO_PROP.forEach(([k])=>{propByCategory[k]=total['prop_'+k]||0});
 const wonByCategory={};NIPPO_WON.forEach(([k])=>{wonByCategory[k]=total['won_'+k]||0});
 return {won:nippoWonTotal(total),visits:total.visits,proposed:total.proposedGroups,byStaff,byStore,propByCategory,wonByCategory}
}
function nippoStoreEmpty(){const o={};NIPPO_STORES.forEach(s=>o[s.id]={calls:0,wom:0,referral:0});return o}
function nippoLoadStoreTodayFallback(){
 try{
  const raw=localStorage.getItem(nippoStorageKey('teamflow.nippo.storetoday.v1'));
  if(raw){
   const s=JSON.parse(raw);
   if(s&&s.date===nippoDkey(NIPPO_TODAY)&&s.today)return Object.assign(nippoStoreEmpty(),s.today);
   if(s&&s.date&&s.today)nippoArchiveDay(s.date,{channels:s.today})
  }
 }catch(e){}
 return nippoStoreEmpty()
}
function nippoSaveStoreTodayFallback(){try{localStorage.setItem(nippoStorageKey('teamflow.nippo.storetoday.v1'),JSON.stringify({date:nippoDkey(NIPPO_TODAY),today:nippoStoreToday}))}catch(e){}}
function nippoLoadTodayFallback(){
 try{
  const raw=localStorage.getItem(nippoStorageKey('teamflow.nippo.today.v1'));
  if(raw){
   const s=JSON.parse(raw);
   if(s&&s.date===nippoDkey(NIPPO_TODAY)&&s.today)return nippoNormalizeToday(s.today);
   if(s&&s.date&&s.today)nippoArchiveDay(s.date,nippoSnapshotForDay(nippoNormalizeToday(s.today)))
  }
 }catch(e){}
 return nippoSampleToday()
}
function nippoSaveTodayFallback(){try{localStorage.setItem(nippoStorageKey('teamflow.nippo.today.v1'),JSON.stringify({date:nippoDkey(NIPPO_TODAY),today:nippoState.today}))}catch(e){}}
function nippoSave(){nippoSaveLocalSession()}
let nippoUsingDb=false,nippoNoteTimer=null,reportVersions={},firebaseProfile=null;
function nippoRenderSync(){
 const el=document.querySelector('#nippoSync');if(!el)return;
 const offline=typeof navigator!=='undefined'&&navigator.onLine===false;
 const [txt,cls]=offline?['電波なし：この端末に保存中','bad']:nippoSync==='saving'?['保存中…','']:nippoSync==='pending'?['送信待ち（電波が戻ると保存）','bad']:nippoSync==='saved'?['✓ 共有先に保存済み','ok']:['✓ この端末に保存済み','ok'];
 el.textContent=txt;el.className=cls
}
function nippoPersistToday(pid){
 if(!identityConfirmed||!firebaseProfile||pid!==firebaseProfile.staffId)return Promise.reject(new Error('ログインしてください。'));
 nippoSaveTodayFallback();
 const uid=identityUid,version=(reportVersions[pid]||0)+1;reportVersions[pid]=version;
 nippoPending.add(pid);nippoSync='saving';nippoRenderSync();
 const day=JSON.parse(JSON.stringify(nippoState.today[pid]));
 return window.teamflowFirebase.saveReport(nippoDkey(NIPPO_TODAY),pid,day).then(()=>{
  if(identityUid!==uid||reportVersions[pid]!==version)return;
  nippoPending.delete(pid);nippoSync=nippoPending.size?'pending':'saved';nippoRenderSync()
 }).catch(error=>{
  if(identityUid!==uid||reportVersions[pid]!==version)return;
  nippoSync='pending';nippoRenderSync();toast(firebaseError(error))
 })
}
window.addEventListener('online',()=>{nippoRenderSync();Array.from(nippoPending).forEach(pid=>nippoPersistToday(pid))});
window.addEventListener('offline',nippoRenderSync);
function nippoPersistTodayDebounced(pid){clearTimeout(nippoNoteTimer);nippoSaveTodayFallback();nippoPending.add(pid);nippoSync='saving';nippoRenderSync();nippoNoteTimer=setTimeout(()=>nippoPersistToday(pid),600)}
const nippoLocalSession=nippoLoadLocalSession();
let nippoState={date:nippoDkey(NIPPO_TODAY),person:nippoLocalSession.person,store:nippoLocalSession.store,mode:nippoLocalSession.mode,tab:nippoLocalSession.tab,draft:nippoLocalSession.draft,today:nippoLoadTodayFallback()};
let nippoStoreToday=nippoLoadStoreTodayFallback();
function nippoRole(){const staff=nippoCurrentStaff();return staff.role!=='manager'?'self':(staff.store?'store':'hq')}
function nippoInitBackend(){
 if(!firebaseProfile||firebaseProfile.mustChangePassword)return;
 const uid=identityUid;
 window.teamflowFirebase.subscribe((rows,metadata)=>{
  if(identityUid!==uid)return;
  const days={};
  for(const row of rows){
   if(!NIPPO_STAFF.some(p=>p.id===row.staffId))continue;
   days[row.date]=days[row.date]||nippoSampleToday();
   days[row.date][row.staffId]=nippoNormalizeStaffDay(row.day)
  }
  const today=days[nippoDkey(NIPPO_TODAY)]||nippoSampleToday();
  nippoPending.forEach(pid=>{today[pid]=nippoState.today[pid]});
  nippoState.today=today;
  nippoSaveHistory(Object.keys(days).sort().filter(date=>date!==nippoDkey(NIPPO_TODAY)).map(date=>({date,...nippoSnapshotForDay(days[date])})));
  nippoUsingDb=true;
  if(!nippoPending.size)nippoSync=metadata.fromCache?'local':metadata.hasPendingWrites?'pending':'saved';
  nippoRender();renderDashboard()
 },rows=>{
  if(identityUid!==uid)return;
  nippoStoreToday=nippoStoreEmpty();
  rows.forEach(row=>{
   if(row.date===nippoDkey(NIPPO_TODAY))nippoStoreToday[row.store]=row.channels;
   else nippoArchiveDay(row.date,{channels:{[row.store]:row.channels}})
  });
  if(nippoState.tab==='store')nippoRender();renderDashboard()
 },error=>{if(identityUid===uid){nippoUsingDb=false;nippoSync='pending';nippoRenderSync();toast(firebaseError(error))}})
}
let identityUid=null,identityConfirmed=false;
function clearFirebaseViewer(){
 clearTimeout(nippoNoteTimer);clearTimeout(nippoUndoTimer);nippoUndo=null;
 identityConfirmed=false;identityUid=null;firebaseProfile=null;window.teamflowViewerUid=null;
 nippoPending.clear();reportVersions={};nippoUsingDb=false;nippoSync='local';
 nippoState.today=nippoSampleToday();nippoState.draft=nippoFreshDraft();nippoStoreToday=nippoStoreEmpty();
 renderSettings();document.querySelector('#appShell').hidden=true;
}
function activateFirebaseViewer(profile){
 const staff=NIPPO_STAFF.find(p=>p.id===profile.staffId);
 if(!staff||staff.store!==profile.store||staff.role!==profile.role)throw new Error('社員の登録情報が一致しません。管理者にお問い合わせください。');
 clearFirebaseViewer();
 firebaseProfile=profile;identityUid=profile.uid;window.teamflowViewerUid=profile.uid;
 const local=nippoLoadLocalSession();nippoState.draft=local.person===staff.id?local.draft:nippoFreshDraft();
 nippoState.today=nippoLoadTodayFallback();nippoStoreToday=nippoLoadStoreTodayFallback();
 // 端末に残る別社員の値は表示しません。共有先から許可された範囲を再取得します。
 NIPPO_STAFF.filter(p=>p.id!==staff.id).forEach(p=>{nippoState.today[p.id]=nippoNormalizeStaffDay({})});
 if(profile.mustChangePassword){loginStaffId=staff.id;openPasswordSetup();return}
 applyIdentity(staff.id);nippoInitBackend()
}
function openPasswordSetup(){
 document.querySelector('#loginHeading').textContent='パスワードを変更';document.querySelector('#loginSub').textContent='初回ログイン・リセット後は変更が必要です。';
 document.querySelector('#loginChecking').hidden=true;
 document.querySelector('#loginPicker').hidden=false;document.querySelector('#loginScreen').hidden=false;
 document.querySelector('#loginTabs').innerHTML='';document.querySelector('#loginNames').innerHTML=`<option>${esc(NIPPO_STAFF.find(p=>p.id===loginStaffId).name)}さん</option>`;
 document.querySelector('#loginBody').innerHTML=`<form id="firstPasswordForm"><p>初期パスワードから、ご自分のパスワードに変更してください。</p>
 <label class="login-field">今のパスワード<input id="firstCurrentPassword" type="password" autocomplete="current-password" required></label>
 <label class="login-field">新しいパスワード<input id="firstNewPassword" type="password" autocomplete="new-password" required placeholder="6文字以上の半角小文字英字＋数字"></label>
 <label class="login-field">新しいパスワード（確認）<input id="firstConfirmPassword" type="password" autocomplete="new-password" required></label>
 <p id="loginError" class="login-error" hidden></p><button class="save-work-button" type="submit">変更して使い始める</button></form>`
}
function revealApp(){
 const login=document.querySelector('#loginScreen'),shell=document.querySelector('#appShell');
 if(login)login.hidden=true;
 if(shell)shell.hidden=false
}
function applyIdentity(staffId){
 const staff=NIPPO_STAFF.find(p=>p.id===staffId);
 if(!staff)return;
 if(nippoState.person!==staff.id)nippoState.draft.editIndex=null;
 nippoState.person=staff.id;
 nippoState.store=staff.store;
 nippoOrderCache={};
 identityConfirmed=true;
 nippoSave();
 nippoRender();
 renderSettings();
 revealApp()
}
const PASSWORD_RULE=/^(?=.*[a-z])(?=.*[0-9])[a-z0-9]{6,}$/;
const PASSWORD_RULE_MSG='パスワードは6文字以上の半角小文字英字と数字の組み合わせにしてください。';
let loginStaffId=null;
let loginStoreFilter=null;
function loginStoreKey(p){return p.store||'hq'}
function renderLoginTabs(){
 const tabsEl=document.querySelector('#loginTabs');
 const storeGroups=[...NIPPO_STORES.map(s=>({id:s.id,name:s.name})),{id:'hq',name:'本部'}].filter(g=>NIPPO_STAFF.some(p=>loginStoreKey(p)===g.id));
 if(!loginStoreFilter||!storeGroups.some(g=>g.id===loginStoreFilter)){
  const curStaff=NIPPO_STAFF.find(p=>p.id===loginStaffId);
  loginStoreFilter=curStaff?loginStoreKey(curStaff):(storeGroups[0]&&storeGroups[0].id)
 }
 tabsEl.innerHTML=storeGroups.map(g=>`<button type="button" data-store-tab="${g.id}" class="${g.id===loginStoreFilter?'active':''}">${esc(g.name.replace(/^イオン/,''))}</button>`).join('');
 renderLoginNames()
}
function renderLoginNames(){
 const namesEl=document.querySelector('#loginNames');
 const people=NIPPO_STAFF.filter(p=>loginStoreKey(p)===loginStoreFilter);
 if(!people.some(p=>p.id===loginStaffId))loginStaffId=people[0]?people[0].id:loginStaffId;
 namesEl.innerHTML=people.map(p=>`<option value="${p.id}" ${p.id===loginStaffId?'selected':''}>${esc(p.name)}さん${p.title?('（'+esc(p.title)+'）'):(p.role==='manager'?'（店長）':'')}</option>`).join('')
}
function renderLoginBody(){
 const saved='';
 document.querySelector('#loginHeading').textContent='ログイン';
 document.querySelector('#loginSub').textContent='お名前を選んで、パスワードを入力してください。';
 document.querySelector('#loginBody').innerHTML=`
  <form id="loginForm">
   <label class="login-field">パスワード<input type="password" id="loginPassword" autocomplete="current-password" placeholder="パスワードを入力" value="${esc(saved||'')}"></label>
   <label class="login-remember"><input type="checkbox" id="loginRemember" ${saved?'checked':''}>ログイン状態を保存する</label>
   <p class="login-error" id="loginError" hidden></p>
   <button type="submit" class="save-work-button">ログイン</button>
  </form> `
}
function renderLoginScreen(){
 renderLoginTabs();
 renderLoginBody()
}
function openIdentityPicker(){
 if(!loginStaffId)loginStaffId=NIPPO_STAFF[0].id;
 loginStoreFilter=null;
 renderLoginScreen();
 document.querySelector('#loginChecking').hidden=true;
 document.querySelector('#loginPicker').hidden=false;
 document.querySelector('#loginScreen').hidden=false
}
document.querySelector('#loginTabs').addEventListener('click',e=>{
 const b=e.target.closest('[data-store-tab]');
 if(!b)return;
 loginStoreFilter=b.dataset.storeTab;
 renderLoginTabs();
 renderLoginBody()
});
document.querySelector('#loginNames').addEventListener('change',e=>{
 loginStaffId=e.target.value;
 renderLoginBody()
});
document.querySelector('#loginPicker').addEventListener('submit',async e=>{
 e.preventDefault();
 if(!['loginForm','firstPasswordForm'].includes(e.target.id))return;
 const errorEl=document.querySelector('#loginError');errorEl.hidden=true;
 const button=e.target.querySelector('button[type="submit"]');button.disabled=true;
 try{
  if(e.target.id==='firstPasswordForm'){
   const next=document.querySelector('#firstNewPassword').value;
   if(!PASSWORD_RULE.test(next)||next.length>128)throw new Error(PASSWORD_RULE_MSG);
   if(next!==document.querySelector('#firstConfirmPassword').value)throw new Error('新しいパスワードが一致しません。');
   const profile=await window.teamflowFirebase.changePassword(document.querySelector('#firstCurrentPassword').value,next);
   activateFirebaseViewer(profile);
  }else{
   const profile=await window.teamflowFirebase.login(loginStaffId,document.querySelector('#loginPassword').value,document.querySelector('#loginRemember').checked);
   activateFirebaseViewer(profile)
  }
 }catch(error){errorEl.textContent=firebaseError(error);errorEl.hidden=false}
 finally{button.disabled=false}
});
function withTimeout(promise,ms){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('接続に時間がかかっています。再読み込みしてください。')),ms))])}
async function resolveViewerIdentity(){
 try{
  // 古い方式で保存した平文パスワードと簡易セッションを廃止します。
  localStorage.removeItem('teamflow.nippo.savedLogin.v1');sessionStorage.removeItem('teamflow.nippo.loginSession.v1');
  const profile=await withTimeout(window.teamflowFirebase.restore(),7000);
  if(profile)activateFirebaseViewer(profile);else openIdentityPicker()
 }catch(error){
  openIdentityPicker();const el=document.querySelector('#loginError');el.textContent=firebaseError(error);el.hidden=false
 }
}
window.teamflowFirebase.onSignedOut(()=>{clearFirebaseViewer();openIdentityPicker()});
function nippoTodayTotals(pid){
 const d=nippoState.today[pid],t=nippoEmpty();
 d.logs.forEach(l=>{t.visits++;if(l.used)t.used++;let proposed=false;(l.people||[]).forEach(p=>{if(p.prop.length)proposed=true;p.prop.forEach(k=>t['prop_'+k]++);if(p.won)t['won_'+p.won]++;p.attach.forEach(k=>t['attach_'+k]++)});if(proposed)t.proposedGroups++});
 Object.keys(d.adj).forEach(k=>{if(k in t)t[k]+=d.adj[k]});
 return t
}
function nippoStamp(d){if(d.submitted)d.changed=true}
const moduleConfig={
 news:{title:'お知らせ',icon:'♢',description:'件名と公開日がホームのお知らせカードに反映されます。',a:'件名',b:'公開日',bType:'date',c:'分類',options:['全社','システム','総務','重要'],defaults:[]}
};
let moduleData=loadModuleData(),activeModule='news';
let tasks=loadTasks(),selectedPhoto='',recognition=null;
let calendarCursor=new Date(TODAY_ISO+'T00:00:00');
let selectedDate=TODAY_ISO;
const list=document.querySelector('#todayList'),settingsList=document.querySelector('#settingsTaskList');
function loadTasks(){try{const saved=JSON.parse(localStorage.getItem('teamflow.todayTasks'));if(Array.isArray(saved)&&saved.length)return saved.map(t=>({...t,date:t.date||TODAY_ISO}));return defaultTasks}catch{return defaultTasks}}
function saveTasks(){try{localStorage.setItem('teamflow.todayTasks',JSON.stringify(tasks))}catch{toast('保存容量が不足しています。写真を小さくしてください')}}
function loadModuleData(){try{const saved=JSON.parse(localStorage.getItem('teamflow.modules'));const data={};Object.entries(moduleConfig).forEach(([k,c])=>data[k]=Array.isArray(saved?.[k])?saved[k]:c.defaults);return data}catch{return Object.fromEntries(Object.entries(moduleConfig).map(([k,c])=>[k,c.defaults]))}}
function saveModuleData(){localStorage.setItem('teamflow.modules',JSON.stringify(moduleData))}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function pad(n){return String(n).padStart(2,'0')}
function toISO(y,m,d){return `${y}-${pad(m+1)}-${pad(d)}`}
const WEEKDAYS=['日','月','火','水','木','金','土'];
function formatDateLabel(iso){const d=new Date(iso+'T00:00:00');return `${d.getMonth()+1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`}
function isoWeekNumber(d){const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-day);const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));return Math.ceil((((date-yearStart)/86400000)+1)/7)}
function renderTopbarDate(){
 const d=new Date(TODAY_ISO+'T00:00:00');
 const tp=document.querySelector('#topbarDate');if(tp)tp.textContent=`${d.getMonth()+1}月${d.getDate()}日`;
 const tw=document.querySelector('#topbarWeekday');if(tw)tw.textContent=WEEKDAYS[d.getDay()];
 const eb=document.querySelector('#homeEyebrow');if(eb)eb.textContent=`${d.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase()} · WEEK ${isoWeekNumber(d)}`;
 const sd=document.querySelector('#scheduleDateLabel');if(sd)sd.textContent=formatDateLabel(TODAY_ISO);
}
function renderTasks(){
 const todays=tasks.filter(t=>t.date===TODAY_ISO).sort((a,b)=>a.time.localeCompare(b.time));
 list.innerHTML=todays.length?todays.map(t=>{const i=tasks.indexOf(t);return `<div class="today-item ${t.done?'done':''} ${t.photo?'has-photo':''}"><input type="checkbox" ${t.done?'checked':''} data-index="${i}" aria-label="${esc(t.name)}を完了にする"><time>${esc(t.time)}</time>${t.photo?`<img class="task-photo-thumb" src="${t.photo}" alt="">`:''}<div class="task-copy"><span class="task-name">${esc(t.name)}</span>${t.note?`<small class="task-meta-note">${esc(t.note)}</small>`:''}</div><span class="status ${t.done?'done':t.status==='進行中'?'progress':'todo'}">${t.done?'完了':esc(t.status)}</span></div>`}).join(''):'<p class="empty-settings">今日の業務はまだ登録されていません。</p>';
 settingsList.innerHTML=todays.length?todays.map(t=>{const i=tasks.indexOf(t);return `<div class="settings-task"><time>${esc(t.time)}</time>${t.photo?`<img src="${t.photo}" alt="添付写真">`:'<span>—</span>'}<div class="settings-task-copy"><strong>${esc(t.name)}</strong><small>${esc(t.note||'メモなし')}</small></div><button data-delete="${i}" aria-label="${esc(t.name)}を削除">削除</button></div>`}).join(''):'<p class="empty-settings">登録されている業務はありません</p>';
 const completed=todays.filter(t=>t.done).length,total=todays.length,pct=total?Math.round(completed/total*100):0;
 document.querySelector('#taskCounter').innerHTML=`${completed} <small>/ ${total} 完了</small>`;
 document.querySelector('#settingsCounter').textContent=`${total}件を表示中`;
 document.querySelector('#doneCount').textContent=completed;
 document.querySelector('#remainingCount').textContent=total-completed;
 document.querySelector('#progressBar').style.width=pct+'%';
 document.querySelector('#progressLabel').textContent=pct+'%';
 document.querySelector('#completionSub').textContent=total?`${total}件中${completed}件完了`:'今日のタスクはまだありません';
 document.querySelector('.schedule-list').innerHTML=todays.length?todays.slice(0,5).map((t,i)=>`<div><time>${esc(t.time)}</time><i class="dot ${['teal','blue','coral','green'][i%4]}"></i><strong>${esc(t.name)}</strong><span>${t.done?'完了':esc(t.status)}</span></div>`).join(''):'<p class="empty-settings">本日の予定はありません</p>';
 if(document.querySelector('#calendarGrid'))renderCalendar();
 renderDashboard()
}
function renderCalendar(){
 const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();
 document.querySelector('#calMonthLabel').textContent=`${y}年${m+1}月`;
 const firstDay=new Date(y,m,1).getDay(),daysInMonth=new Date(y,m+1,0).getDate();
 const counts={};
 tasks.forEach(t=>{counts[t.date]=(counts[t.date]||0)+1});
 let cells='';
 for(let i=0;i<firstDay;i++)cells+='<span class="cal-cell empty"></span>';
 for(let d=1;d<=daysInMonth;d++){
  const iso=toISO(y,m,d),cls=['cal-cell'];
  if(iso===TODAY_ISO)cls.push('today');
  if(iso===selectedDate)cls.push('selected');
  const dot=counts[iso]?'<i class="cal-dot"></i>':'';
  cells+=`<button type="button" class="${cls.join(' ')}" data-date="${iso}">${d}${dot}</button>`
 }
 document.querySelector('#calendarGrid').innerHTML=cells;
 renderDayEvents()
}
function renderDayEvents(){
 document.querySelector('#selectedDateLabel').textContent=`${formatDateLabel(selectedDate)}のタスク`;
 const items=tasks.filter(t=>t.date===selectedDate).sort((a,b)=>a.time.localeCompare(b.time));
 document.querySelector('#dayEventList').innerHTML=items.length?items.map(t=>{const i=tasks.indexOf(t);return `<div class="day-event"><time>${esc(t.time)}</time><div class="day-event-copy"><strong>${esc(t.name)}</strong>${t.note?`<small>${esc(t.note)}</small>`:''}</div><button data-schedule-delete="${i}" aria-label="${esc(t.name)}を削除">削除</button></div>`}).join(''):'<p class="empty-settings">この日のタスクはまだありません</p>'
}
// 起動：どれかが失敗しても、ログイン画面までは必ず進める
[renderTopbarDate,renderTasks,renderHomeModules,nippoRender].forEach(f=>{try{f()}catch(e){(window.__bootErrors=window.__bootErrors||[]).push((f.name||'起動')+': '+(e&&e.message||e))}});
resolveViewerIdentity();
list.addEventListener('change',e=>{if(!e.target.matches('input'))return;const i=Number(e.target.dataset.index);tasks[i].done=e.target.checked;saveTasks();renderTasks();toast(tasks[i].done?'タスクを完了しました':'タスクを未完了に戻しました')});
settingsList.addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(!b)return;tasks.splice(Number(b.dataset.delete),1);saveTasks();renderTasks();toast('ホームの今日の業務から削除しました')});
function showView(view){document.querySelector('#homeView').classList.toggle('active',view==='home');document.querySelector('#workView').classList.toggle('active',view==='work');document.querySelector('#calendarView').classList.toggle('active',view==='calendar');document.querySelector('#dashboardView').classList.toggle('active',view==='dashboard');document.querySelector('#reportView').classList.toggle('active',view==='report');document.querySelector('#settingsView').classList.toggle('active',view==='settings');document.querySelector('#helpView').classList.toggle('active',view==='help');document.querySelector('#analysisView').classList.toggle('active',view==='analysis');document.querySelector('#moduleView').classList.remove('active');document.querySelectorAll('.nav-item,.mobile-nav a').forEach(x=>x.classList.toggle('active',x.dataset.view===view));const hashes={home:'home',work:'work-settings',calendar:'calendar',dashboard:'dashboard',report:'report',settings:'settings',help:'help',analysis:'analysis'};location.hash=hashes[view]||'home';if(view==='calendar')renderCalendar();if(view==='report')nippoRender();if(view==='dashboard')renderDashboard();if(view==='settings')renderSettings();if(view==='analysis')renderAnalysis();window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-view]').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();showView(x.dataset.view)}));
function renderSettings(){
 const panel=document.querySelector('#settingsPanel');
 if(!panel)return;
 const staff=nippoCurrentStaff(),storeObj=NIPPO_STORES.find(s=>s.id===staff.store);
 panel.innerHTML=`
  <section class="card"><div class="card-head"><div class="title-icon teal">⚙</div><h2>アカウント情報</h2></div>
   <dl class="report-copy">
    <dt>お名前</dt><dd>${esc(staff.name)}さん</dd>
    <dt>役割</dt><dd>${staff.title?esc(staff.title):(staff.role==='manager'?'店長':'社員')}</dd>
    <dt>店舗</dt><dd>${storeObj?esc(storeObj.name):'本部'}</dd>
   </dl>
  </section>
  <section class="card"><div class="card-head"><div class="title-icon blue">⚙</div><h2>パスワードを変更</h2></div>
   <form id="settingsPasswordForm">
    <label class="login-field">今のパスワード<input type="password" id="settingsCurrentPassword" autocomplete="current-password"></label>
    <label class="login-field">新しいパスワード<input type="password" id="settingsNewPassword" autocomplete="new-password" placeholder="6文字以上の半角小文字英字＋数字"></label>
    <label class="login-field">新しいパスワード（確認）<input type="password" id="settingsConfirmPassword" autocomplete="new-password"></label>
    <p class="login-error" id="settingsPasswordError" hidden></p>
    <button type="submit" class="save-work-button" style="width:auto;padding:12px 24px">変更する</button>
   </form>
  </section>
  ${identityConfirmed&&staff.role==='manager'?`
  <section class="card"><div class="card-head"><div class="title-icon coral">⚙</div><h2>スタッフのパスワードをリセット</h2></div>
   <p class="report-banner" id="resetPasswordInfo">自店のスタッフのパスワードを初期パスワードに戻します。次回ログイン時に変更が必要です。</p>
   <div class="report-people">${NIPPO_STAFF.filter(p=>p.id!==staff.id&&p.store===staff.store).map(p=>{
    const sObj=NIPPO_STORES.find(s=>s.id===p.store);
    return `<div><span>${esc(p.name)}さん（${sObj?esc(sObj.name):'本部'}）</span><button type="button" class="text-link" data-reset-pw="${p.id}">初期パスワードに戻す</button></div>`
   }).join('')}</div>
  </section>
  `:''}
 `
 if(identityConfirmed&&staff.role==='manager'){
  const uid=identityUid,banner=panel.querySelector('#resetPasswordInfo');
  window.teamflowFirebase.resetInfo().then(info=>{
   if(identityUid!==uid||!identityConfirmed||nippoCurrentStaff().role!=='manager'||!banner.isConnected)return;
   banner.textContent=`パスワードを忘れたスタッフを、初期パスワード（店長・副店長は「${info.manager}」、スタッフは「${info.staff}」）に戻します。次回ログイン時に変更が必要です。`
  }).catch(()=>{})
 }
}

document.querySelector('#settingsPanel').addEventListener('click',async e=>{
 const b=e.target.closest('[data-reset-pw]');if(!b||!identityConfirmed||nippoCurrentStaff().role!=='manager')return;
 const target=NIPPO_STAFF.find(p=>p.id===b.dataset.resetPw);
 if(!target||target.store!==nippoCurrentStaff().store)return;
 if(!confirm(`${target.name}さんのパスワードを初期パスワードに戻しますか？`))return;
 b.disabled=true;
 try{await window.teamflowFirebase.resetPassword(target.id);toast(`${target.name}さんのパスワードを初期パスワードに戻しました`)}
 catch(error){toast(firebaseError(error))}finally{b.disabled=false}
});
document.querySelector('.settings-view .report-tabbar').addEventListener('click',e=>{
 const b=e.target.closest('[data-stab]');if(!b)return;
 document.querySelectorAll('[data-stab]').forEach(x=>x.classList.toggle('active',x===b))
});
document.querySelector('#settingsPanel').addEventListener('submit',async e=>{
 e.preventDefault();if(e.target.id!=='settingsPasswordForm'||!identityConfirmed)return;
 const errorEl=document.querySelector('#settingsPasswordError');errorEl.hidden=true;
 const next=document.querySelector('#settingsNewPassword').value;
 if(!PASSWORD_RULE.test(next)||next.length>128){errorEl.textContent=PASSWORD_RULE_MSG;errorEl.hidden=false;return}
 if(next!==document.querySelector('#settingsConfirmPassword').value){errorEl.textContent='新しいパスワードが一致しません。';errorEl.hidden=false;return}
 const button=e.target.querySelector('button[type="submit"]');button.disabled=true;
 try{firebaseProfile=await window.teamflowFirebase.changePassword(document.querySelector('#settingsCurrentPassword').value,next);toast('パスワードを変更しました');e.target.reset()}
 catch(error){errorEl.textContent=firebaseError(error);errorEl.hidden=false}finally{button.disabled=false}
});
function showModule(key){activeModule=key;const c=moduleConfig[key];document.querySelector('#homeView').classList.remove('active');document.querySelector('#workView').classList.remove('active');document.querySelector('#calendarView').classList.remove('active');document.querySelector('#dashboardView').classList.remove('active');document.querySelector('#reportView').classList.remove('active');document.querySelector('#settingsView').classList.remove('active');document.querySelector('#helpView').classList.remove('active');document.querySelector('#analysisView').classList.remove('active');document.querySelector('#moduleView').classList.add('active');document.querySelectorAll('.nav-item,.mobile-nav a').forEach(x=>x.classList.toggle('active',x.dataset.module===key));document.querySelector('#moduleTitle').textContent=`${c.title}を設定`;document.querySelector('#moduleDescription').textContent=c.description;document.querySelector('#moduleIcon').textContent=c.icon;document.querySelector('#moduleListIcon').textContent=c.icon;document.querySelector('#moduleFormTitle').textContent=`${c.title}を追加`;document.querySelector('#moduleListTitle').textContent=`ホームに表示する${c.title}`;document.querySelector('#fieldALabel').childNodes[0].nodeValue=c.a;document.querySelector('#fieldBLabel').childNodes[0].nodeValue=c.b;document.querySelector('#fieldCLabel').childNodes[0].nodeValue=c.c;const b=document.querySelector('#moduleFieldB');b.type=c.bType||'text';b.value='';const select=document.querySelector('#moduleFieldC');select.innerHTML=c.options.map(o=>`<option>${esc(o)}</option>`).join('');document.querySelector('#moduleFieldA').value='';renderModuleEditor();location.hash=`manage-${key}`;window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-module]').forEach(x=>x.addEventListener('click',e=>{e.preventDefault();showModule(x.dataset.module)}));
function displayDate(value){if(!value)return'';const p=value.split('-');return p.length===3?`${Number(p[1])}/${Number(p[2])}`:value}
function updateNotifBadge(){
 const count=moduleData.news.length,btn=document.querySelector('.notification-button');
 if(!btn)return;
 btn.classList.toggle('has-unread',count>0);
 const badge=btn.querySelector('i');
 if(badge)badge.textContent=count>9?'9+':String(count);
 btn.setAttribute('aria-label',count>0?`通知、お知らせ${count}件`:'通知');
}
function renderPulse(){
 const doneEls=document.querySelectorAll('.js-week-done'),deltaEls=document.querySelectorAll('.js-week-delta'),barsEls=document.querySelectorAll('.js-week-bars'),rateEls=document.querySelectorAll('.js-submit-rate'),fracEls=document.querySelectorAll('.js-submit-frac'),barEls=document.querySelectorAll('.js-submit-bar');
 if(!doneEls.length)return;
 const today=new Date(TODAY_ISO+'T00:00:00');
 const days=[];
 for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(d.getDate()-i);days.push(toISO(d.getFullYear(),d.getMonth(),d.getDate()))}
 const perDay=days.map(iso=>tasks.filter(t=>t.date===iso&&t.done).length);
 const weekTotal=perDay.reduce((a,b)=>a+b,0);
 const prevDays=[];
 for(let i=13;i>=7;i--){const d=new Date(today);d.setDate(d.getDate()-i);prevDays.push(toISO(d.getFullYear(),d.getMonth(),d.getDate()))}
 const prevTotal=tasks.filter(t=>prevDays.includes(t.date)&&t.done).length;
 const maxDay=Math.max(...perDay,1);
 const barsHtml=perDay.map(v=>`<i style="height:${Math.max(6,Math.round(v/maxDay*100))}%"></i>`).join('');
 doneEls.forEach(el=>el.innerHTML=`${weekTotal}<small>件</small>`);
 barsEls.forEach(el=>el.innerHTML=barsHtml);
 deltaEls.forEach(el=>{
  if(!prevTotal)el.textContent=weekTotal?'先週比 データなし':'';
  else{const diff=Math.round((weekTotal-prevTotal)/prevTotal*100);el.textContent=`${diff>=0?'↑':'↓'} ${Math.abs(diff)}%`}
 });
 const submitted=NIPPO_STAFF.filter(p=>nippoState.today[p.id].submitted).length,totalStaff=NIPPO_STAFF.length,rate=totalStaff?Math.round(submitted/totalStaff*100):0;
 rateEls.forEach(el=>el.innerHTML=`${rate}<small>%</small>`);
 fracEls.forEach(el=>el.textContent=`${submitted}/${totalStaff}人 提出済み`);
 barEls.forEach(el=>el.style.width=rate+'%');
}
function renderHomeModules(){document.querySelector('.news-list').innerHTML=moduleData.news.length?moduleData.news.slice(0,5).map((x,i)=>`<p><i class="dot ${['coral','blue','green','gray'][i%4]}"></i><span>${esc(x.a)}</span><time>${displayDate(x.b)}</time></p>`).join(''):'<p class="empty-settings">お知らせはまだありません。</p>';updateNotifBadge();nippoRenderHomeSummary();renderDashboard()}
function nippoRenderHomeSummary(){
 const list=document.querySelector('.report-list');
 if(!list)return;
 list.innerHTML=NIPPO_STAFF.filter(p=>identityConfirmed&&(nippoCurrentStaff().role==='manager'?p.store===nippoCurrentStaff().store:p.id===nippoCurrentStaff().id)).map(p=>{
  const t=nippoTodayTotals(p.id),d=nippoState.today[p.id];
  return `<p><span>${esc(p.name)}</span><span class="report-mini-nums">接客${t.visits}・提案${t.proposedGroups}・決定${nippoWonTotal(t)}</span><b class="${d.submitted?'status-ontrack':'status-ask'}">${d.submitted?'送信済み':'未送信'}</b></p>`
 }).join('')
}
function nippoChip(set,item,active,extraClass,personIndex){
 return `<button type="button" class="chip-btn${active?' active'+(extraClass?' '+extraClass:''):''}" data-nchip="${set}:${item[0]}" data-nperson="${personIndex}">${item[2]?'<i class="chip-dot"></i>':''}${esc(item[1])}</button>`
}
function nippoStepRow(key,label,mark,isKey){
 return `<div class="stepper-row">${isKey?'<i class="chip-dot"></i>':''}<span>${esc(label)}${mark?`<b class="mk">${esc(mark)}</b>`:''}</span><div class="stepper-ctr"><button type="button" class="stepper-btn" data-nstep="${key}" data-d="-1" aria-label="${esc(label)}を1減らす">−</button><span class="stepper-val" data-ncount="${key}">0</span><button type="button" class="stepper-btn" data-nstep="${key}" data-d="1" aria-label="${esc(label)}を1増やす">＋</button></div></div>`
}
function nippoLoadUsage(){try{return JSON.parse(localStorage.getItem('teamflow.nippo.usage.v1'))||{}}catch(e){return {}}}
function nippoCountUsage(people){
 const all=nippoLoadUsage(),u=all[nippoState.store]=all[nippoState.store]||{visit:{},prop:{},won:{},attach:{}};
 people.forEach(p=>{if(p.visit)u.visit[p.visit]=(u.visit[p.visit]||0)+1;if(p.won)u.won[p.won]=(u.won[p.won]||0)+1;p.prop.forEach(k=>u.prop[k]=(u.prop[k]||0)+1);p.attach.forEach(k=>u.attach[k]=(u.attach[k]||0)+1)});
 try{localStorage.setItem('teamflow.nippo.usage.v1',JSON.stringify(all))}catch(e){}
}
// 並び順は画面を開いた時点で決め、使っている途中ではボタンが動かないようにする
function nippoOrdered(set,arr){
 const key=nippoState.store+':'+set;
 if(!nippoOrderCache[key]){
  const u=(nippoLoadUsage()[nippoState.store]||{})[set]||{},total=Object.values(u).reduce((a,b)=>a+b,0);
  nippoOrderCache[key]=total<10?arr.map(x=>x[0]):arr.map((x,i)=>({k:x[0],i,n:NIPPO_PINNED_LAST.includes(x[0])?-1:(u[x[0]]||0)})).sort((a,b)=>(b.n-a.n)||(a.i-b.i)).map(x=>x.k);
 }
 return nippoOrderCache[key].map(k=>arr.find(x=>x[0]===k)).filter(Boolean)
}
function nippoClonePerson(p){return {visit:p.visit,visitNote:p.visit==='other'?p.visitNote:'',prop:p.prop.slice(),propNone:!!p.propNone&&!p.prop.length,won:p.won,attach:p.attach.slice(),attachNone:!!p.attachNone&&!p.attach.length}}
// 2人以上の組では③〜⑥に「なし」を出す（③は visit='none'、④⑥は propNone/attachNone、⑤は既存の「成約なし」）
const NIPPO_NONE_CHIP=['__none','なし',0];
function nippoNoneChip(set,active,personIndex){return nippoChip(set,NIPPO_NONE_CHIP,active,'none-active',personIndex)}
function nippoMissing(dr){const out=[];dr.people.slice(0,dr.count).forEach((p,i)=>{const m=[];if(!p.visit)m.push('③ご来店内容');if(!p.won)m.push('⑤成約内容');if(m.length)out.push({i,m})});return out}
function nippoComposerHTML(){
 const dr=nippoState.draft;
 const activeIndex=Math.min(dr.activePerson||0,dr.count-1),person=dr.people[activeIndex],multi=dr.count>1;
 const personTabs=`<div class="nippo-person-tabs" role="tablist" aria-label="来店者の切り替え">${dr.people.slice(0,dr.count).map((_,i)=>`<button type="button" role="tab" data-nperson-tab="${i}" aria-selected="${i===activeIndex}" class="${i===activeIndex?'active':''}">${i+1}人目</button>`).join('')}</div>`;
 const personPanel=`
  <section class="nippo-person-block" role="tabpanel" aria-label="${activeIndex+1}人目の内容">
   <h3>${activeIndex+1}人目の内容</h3>
   ${dr.count>1&&activeIndex===0?`<p style="margin:10px 0 0;text-align:right"><button type="button" class="text-link" data-nact="copyfirst">この内容を2〜${dr.count}人目にも入れる</button></p>`:''}
   <div class="chip-section"><div class="chip-section-head">③ご来店内容<span class="chip-rule one">1つだけ選ぶ</span></div><div class="chips-row">${nippoOrdered('visit',NIPPO_VISIT).map(v=>nippoChip('visit',v,person.visit===v[0],'',activeIndex)).join('')}${multi?nippoNoneChip('visit',person.visit==='none',activeIndex):''}</div>${person.visit==='other'?`<input type="text" class="nippo-visit-note" data-nvisit-note="${activeIndex}" value="${esc(person.visitNote)}" placeholder="その他の内容を記入" style="width:100%;margin-top:10px;padding:10px 12px;border:1px solid #cdd8e1;border-radius:10px;font:inherit">`:''}</div>
   <div class="chip-section"><div class="chip-section-head">④提案内容<span class="chip-rule">いくつでも選べる</span></div><div class="chips-row">${nippoOrdered('prop',NIPPO_PROP).map(p=>nippoChip('prop',p,person.prop.includes(p[0]),'',activeIndex)).join('')}${multi?nippoNoneChip('prop',!!person.propNone,activeIndex):''}</div></div>
   <div class="chip-section"><div class="chip-section-head">⑤成約内容<span class="chip-rule one">1つだけ選ぶ</span></div><div class="chips-row">${nippoOrdered('won',NIPPO_WON).map(w=>nippoChip('won',multi&&w[0]==='none'?['none','なし',0]:w,person.won===w[0],w[0]==='none'?'none-active':'won-active',activeIndex)).join('')}</div></div>
   <div class="chip-section"><div class="chip-section-head">⑥付帯内容<span class="chip-rule">いくつでも選べる</span></div><div class="chips-row">${nippoOrdered('attach',NIPPO_ATTACH).map(a=>nippoChip('attach',a,person.attach.includes(a[0]),'',activeIndex)).join('')}${multi?nippoNoneChip('attach',!!person.attachNone,activeIndex):''}</div></div>
  </section>`;
 const editLog=dr.editIndex!==null?nippoState.today[nippoState.person].logs[dr.editIndex]:null,editing=!!editLog;
 return `${editing?`
  <p class="empty-settings" style="margin:0 0 12px;padding:10px;background:#fff6e5;border-radius:10px;color:#8a5a00">${esc(editLog.t)} の記録を修正中です</p>`:''}
  <label class="work-note" style="margin-top:0">①診断シートを使った
   <div class="yn-toggle">
    <button type="button" class="${dr.used?'active':''}" data-nused="1">使った</button>
    <button type="button" class="${!dr.used?'active':''}" data-nused="0">使っていない</button>
   </div>
  </label>
  <label class="work-note">②一組あたりの来店者数
   <select id="nippoCount">${[1,2,3,4,5,6].map(n=>`<option value="${n}" ${dr.count===n?'selected':''}>${n}人</option>`).join('')}</select>
  </label>
  ${personTabs}${activeIndex>0?`<button type="button" class="nippo-copyprev" data-nact="copyprevperson">↺ 前の人（${activeIndex}人目）と同じ内容にする</button>`:''}${personPanel}
  <div class="nippo-record-bar">
   ${nippoWarn?`<div class="nippo-warn" role="alert">${esc(nippoWarn)}<button type="button" class="text-link" data-nact="addlog" data-force="1">このまま記録する</button></div>`:''}
   <button type="button" class="save-work-button" data-nact="addlog">${editing?'修正を保存する':'この1組を記録する'}</button>
   ${editing?'<p style="text-align:center;margin:8px 0 0"><button type="button" class="text-link" data-nact="canceledit">修正をやめる</button></p>':''}
  </div>
 `
}
function nippoLogListHTML(d){
 if(!d.logs.length)return'<p class="empty-settings">まだ記録がありません。接客が終わったら、上で記録します。</p>';
 const f=NIPPO_LOG_FILTERS.find(x=>x[0]===nippoLogFilter)||NIPPO_LOG_FILTERS[0];
 const items=d.logs.slice().reverse().filter(f[2]);
 const bar=`<div class="nippo-log-filter" role="group" aria-label="記録の絞り込み">${NIPPO_LOG_FILTERS.map(x=>`<button type="button" data-nfilter="${x[0]}" class="${x[0]===f[0]?'active':''}" aria-pressed="${x[0]===f[0]}">${x[1]}<small>${d.logs.filter(x[2]).length}</small></button>`).join('')}</div>`;
 if(!items.length)return bar+'<p class="empty-settings">この条件に当てはまる記録はありません。</p>';
 return bar+items.map(l=>{
  const idx=d.logs.indexOf(l);
  const tagsOf=p=>`${p.visit==='none'?'<span class="report-log-tag muted">来店なし</span>':p.visit?`<span class="report-log-tag">来店 ${esc(p.visit==='other'&&p.visitNote?'その他（'+p.visitNote+'）':nippoLab(NIPPO_VISIT,p.visit))}</span>`:''}${p.prop.length?`<span class="report-log-tag">提案 ${p.prop.map(k=>nippoLab(NIPPO_PROP,k)).map(esc).join('・')}</span>`:'<span class="report-log-tag muted">提案なし</span>'}${p.won==='none'?'<span class="report-log-tag muted">成約なし</span>':p.won==='yoyaku'?'<span class="report-log-tag">予約のみ</span>':p.won?`<span class="report-log-tag won">成約 ${esc(nippoLab(NIPPO_WON,p.won))}</span>`:'<span class="report-log-tag muted">成約内容なし</span>'}${p.attach.length?`<span class="report-log-tag">付帯 ${p.attach.map(k=>nippoLab(NIPPO_ATTACH,k)).map(esc).join('・')}</span>`:p.attachNone?'<span class="report-log-tag muted">付帯なし</span>':''}`;
  const details=l.count>1?`<div class="nippo-log-people">${l.people.map((p,i)=>`<div class="nippo-log-person"><b>${i+1}人目</b><div class="report-log-tags">${tagsOf(p)}</div></div>`).join('')}</div>`:tagsOf(l.people[0]);
  return `<div class="report-log-row"><time>${esc(l.t)}</time><div class="nippo-log-body">${l.count>1?`<div class="report-log-tags"><span class="report-log-tag">${l.count}人</span>${l.used?'':'<span class="report-log-tag muted">シート未使用</span>'}</div>${details}`:`<div class="report-log-tags"><span class="report-log-tag">1人</span>${details}${l.used?'':'<span class="report-log-tag muted">シート未使用</span>'}</div>`}</div><div class="nippo-log-actions"><button type="button" class="text-link" data-nedit="${idx}">修正</button><button type="button" class="text-link" data-ndel="${idx}">取り消す</button></div></div>`
 }).join('')
}
function nippoRenderInput(){
 const d=nippoState.today[nippoState.person],log=nippoState.mode==='log';
 let leftTitle,leftInner,rightTitle,rightBadge='',rightInner;
 if(log){
  leftTitle='この1組';leftInner=nippoComposerHTML();
  rightTitle='きょうの記録';rightBadge=`<strong>${d.logs.length}<small>組</small></strong>`;
  rightInner=nippoLogListHTML(d);
 }else{
  leftTitle='入口';leftInner=NIPPO_ENTRY.map(e=>nippoStepRow(e[0],e[1],e[2],0)).join('');
  rightTitle='まとめて入力';
  rightInner=`
   <div class="report-subgroup"><h3>提案内容の数<small>いま特に伸ばしたい商材</small></h3>${NIPPO_PROP.map(p=>nippoStepRow('prop_'+p[0],p[1],'',p[2])).join('')}</div>
   <div class="report-subgroup"><h3>成約内容の数</h3>${NIPPO_WON.map(w=>nippoStepRow('won_'+w[0],w[1],'',w[2])).join('')}<div class="stepper-row total"><span>成約内容の合計<b class="mk">③の元</b></span><span class="stepper-total-val" data-ncount="wonTotal">0</span></div></div>
   <div class="report-subgroup"><h3>付帯内容の数</h3>${NIPPO_ATTACH.map(a=>nippoStepRow('attach_'+a[0],a[1],'',a[2])).join('')}</div>
  `;
 }
 const hint=log?'接客が終わるたびに、その場で30秒。':'閉店後に、診断シートの店舗記入欄の○を数えて入れます。';
 document.querySelector('#nippoPanel').innerHTML=`
  <div class="nippo-resend" id="nippoResend" hidden>送ったあとに記録を直しました。下の「直して送り直す」を押すと、店長に届きます。</div>
  ${log?`<div class="nippo-today-strip"><span>きょう</span><span>接客 <b data-ncount="visits">0</b>組</span><span>提案 <b data-ncount="proposedGroups">0</b>組</span><span>成約 <b data-ncount="wonTotal">0</b>件</span><em id="nippoSync"></em></div>`:''}
  <p class="hint" style="margin:0 0 16px;color:#8193a4;font-size:13px">${hint}</p>
  <div class="work-layout">
   <section class="card work-composer-card"><div class="card-head"><div class="title-icon teal">＋</div><h2>${leftTitle}</h2></div>${leftInner}</section>
   <section class="card configured-work"><div class="card-head"><div class="title-icon blue">☰</div><h2>${rightTitle}</h2>${rightBadge}</div>${rightInner}
    <div class="card-head" style="margin-top:22px"><h2>配布数</h2></div>
    ${NIPPO_EXTRA.map(e=>nippoStepRow(e[0],e[1])).join('')}
    <label class="work-note" style="margin-top:18px">ひとこと<small>今日うまくいった接客（任意）</small><textarea id="nippoNote" rows="3">${esc(d.note)}</textarea></label>
   </section>
  </div>
  <p class="foot" style="margin-top:16px;text-align:center;font-size:12px;color:#8193a4"><button type="button" class="text-link" data-nact="reset" style="margin-left:4px">今日の入力をリセット</button></p>
 `;
 nippoUpdateCounts()
}
function nippoRenderMe(){
 const pid=nippoState.person,t=nippoTodayTotals(pid),rate=t.visits?t.proposedGroups/t.visits:0,close=t.proposedGroups?nippoWonTotal(t)/t.proposedGroups:0;
 document.querySelector('#nippoPanel').innerHTML=`
  <p class="report-banner">この画面は、本人と店長だけが見られます。</p>
  <h2 class="report-sec-title">今日の自分の記録</h2>
  <div class="dashboard-kpis kpis-2">
   <div class="card kpi-card"><span>②提案した組の割合</span><strong>${Math.round(rate*100)}%</strong><small>提案した組数 ÷ 接客した組数</small></div>
   <div class="card kpi-card"><span>③提案1組あたりの決まった数</span><strong>${nippoF2(close)}件</strong><small>決まった数 ÷ 提案した組数</small></div>
  </div>
  <section class="card"><div class="card-head"><h2>最近7日の送信</h2></div>
   <ul class="report-days">
    <li><span>今日</span><b class="${nippoState.today[pid].submitted?'status-ontrack':'status-ask'}">${nippoState.today[pid].submitted?'送信済み':'未送信'}</b></li>
    <li><span>昨日</span><b class="status-ontrack">送信済み</b></li>
    <li><span>2日前</span><b class="status-ontrack">送信済み</b></li>
   </ul>
  </section>
 `
}
function nippoRenderRestricted(){
 document.querySelector('#nippoPanel').innerHTML=`<section class="card"><p class="report-banner">この画面は店長だけが見られます。</p></section>`
}
function nippoRenderStore(){
 const grand=nippoEmpty();
 const perStore=NIPPO_STORES.filter(s=>s.id===nippoCurrentStaff().store).map(s=>{
  const t=nippoEmpty();
  NIPPO_STAFF.filter(p=>p.store===s.id).forEach(p=>nippoAddInto(t,nippoTodayTotals(p.id)));
  nippoAddInto(grand,t);
  return {store:s,t}
 });
 document.querySelector('#nippoPanel').innerHTML=`
  <p class="report-banner">店長・副店長だけに表示する画面です。自店のデータをまとめて見られます。</p>
  <h2 class="report-sec-title">店舗別の今日の数字</h2>
  <section class="card"><div class="card-head"><h2>店舗別</h2></div>
   <table class="report-table"><thead><tr><th>店舗</th><th style="text-align:right">①来店組数</th><th style="text-align:right">②提案した組の割合</th><th style="text-align:right">③提案1組あたりの決まった数</th></tr></thead><tbody>
    ${perStore.map(({store,t})=>`<tr><th>${esc(store.name)}</th><td class="r">${t.visits}組</td><td class="r">${nippoPct(t.visits?t.proposedGroups/t.visits:0)}</td><td class="r">${nippoF2(t.proposedGroups?nippoWonTotal(t)/t.proposedGroups:0)}件</td></tr>`).join('')}
    <tr style="font-weight:800"><th>自店合計</th><td class="r">${grand.visits}組</td><td class="r">${nippoPct(grand.visits?grand.proposedGroups/grand.visits:0)}</td><td class="r">${nippoF2(grand.proposedGroups?nippoWonTotal(grand)/grand.proposedGroups:0)}件</td></tr>
   </tbody></table>
  </section>
  <section class="card"><div class="card-head"><h2>今日の送信</h2></div>
   <div class="report-people">${NIPPO_STAFF.filter(p=>p.store===nippoCurrentStaff().store).map(p=>{const d=nippoState.today[p.id],storeObj=NIPPO_STORES.find(s=>s.id===p.store);return `<div><span>${esc(p.name)}さん（${storeObj?esc(storeObj.name):'本部'}）</span><b class="${d.submitted?'status-ontrack':'status-ask'}">${d.submitted?'送信済み '+esc(d.submittedAt):'まだ'}</b></div>`}).join('')}</div>
  </section>
  <section class="card"><div class="card-head"><h2>電話・口コミ・紹介（週1回入力）</h2></div>
   <div>${NIPPO_STORES.filter(s=>s.id===nippoCurrentStaff().store).map(s=>{const c=nippoStoreToday[s.id]||{calls:0,wom:0,referral:0};return `<div class="store-channel-row"><strong>${esc(s.name)}</strong><label>電話<input type="number" min="0" inputmode="numeric" data-store-channel="calls" data-store="${s.id}" value="${c.calls}"></label><label>口コミ<input type="number" min="0" inputmode="numeric" data-store-channel="wom" data-store="${s.id}" value="${c.wom}"></label><label>紹介<input type="number" min="0" inputmode="numeric" data-store-channel="referral" data-store="${s.id}" value="${c.referral}"></label></div>`}).join('')}</div>
  </section>
  <section class="card"><div class="card-head"><h2>ふり返りシートに写す値（自店合計）</h2></div>
   <dl class="report-copy">
    <dt>接客した組数</dt><dd>${grand.visits}</dd>
    <dt>提案した組数</dt><dd>${grand.proposedGroups}</dd>
    <dt>決まった数の合計</dt><dd>${nippoWonTotal(grand)}</dd>
   </dl>
  </section>
 `
}
function nippoUpdateCounts(){
 const t=nippoTodayTotals(nippoState.person),d=nippoState.today[nippoState.person];
 document.querySelectorAll('[data-ncount]').forEach(el=>{const k=el.dataset.ncount;el.textContent=k==='wonTotal'?nippoWonTotal(t):t[k]});
 const sv=document.querySelector('#nippoSumVisits'),sp=document.querySelector('#nippoSumProposed'),sw=document.querySelector('#nippoSumWon');
 if(sv)sv.textContent=t.visits;
 if(sp)sp.textContent=t.proposedGroups;
 if(sw)sw.textContent=nippoWonTotal(t);
 const st=document.querySelector('#nippoSendState'),btn=document.querySelector('#nippoSendBtn');
 if(btn)btn.textContent=d.submitted?'直して送り直す':'今日の分を送る';
 if(st){
  st.textContent=d.submitted?(d.changed?'送ったあとに直した分は、まだ届いていません':'送信済み '+d.submittedAt):'まだ送っていません';
  st.className=d.submitted&&!d.changed?'ok':(d.changed?'bad':'')
 }
 const rs=document.querySelector('#nippoResend');if(rs)rs.hidden=!(d.submitted&&d.changed);
 if(btn)btn.classList.toggle('nippo-attn',!!(d.submitted&&d.changed));
 nippoRenderSync()
}
function nippoCurrentStaff(){return NIPPO_STAFF.find(p=>p.id===nippoState.person)||NIPPO_STAFF[0]}
function nippoRender(){
 const dt=NIPPO_TODAY;
 document.querySelector('#nippoDate').innerHTML=`${dt.getMonth()+1}月${dt.getDate()}日<span>（${WEEKDAYS[dt.getDay()]}）</span>`;
 const staff=nippoCurrentStaff(),storeObj=NIPPO_STORES.find(s=>s.id===staff.store);
 const storeLabelEl=document.querySelector('#nippoStoreLabel');
 if(storeLabelEl)storeLabelEl.textContent=`店舗：${storeObj?storeObj.name:(staff.store?'未設定':'本部')}`;
 const personLabelEl=document.querySelector('#nippoPersonLabel');
 if(personLabelEl)personLabelEl.textContent=`担当：${staff.name}さん${staff.title?('（'+staff.title+'）'):(staff.role==='manager'?'（店長）':'')}`;
 const isManager=identityConfirmed&&staff.role==='manager';
 document.querySelectorAll('[data-ntab]').forEach(b=>{
  b.classList.toggle('active',b.dataset.ntab===nippoState.tab)
 });
 document.querySelector('#nippoSendbar').style.display=nippoState.tab==='input'?'flex':'none';
 if(nippoState.tab==='input')nippoRenderInput();
 else if(nippoState.tab==='me')nippoRenderMe();
 else if(nippoState.tab==='store'){
  if(isManager)nippoRenderStore();
  else nippoRenderRestricted()
 }
 nippoUpdateCounts();
 nippoRenderHomeSummary()
}
document.querySelector('#reportView').addEventListener('click',async e=>{
 const b=e.target.closest('button');
 if(!b)return;
 if(!identityConfirmed)return;
 const pid=nippoState.person,d=nippoState.today[pid];
 if(b.dataset.ntab){nippoState.tab=b.dataset.ntab;nippoSave();nippoRender();window.scrollTo({top:0,behavior:'smooth'});return}
 if(b.dataset.nused){nippoState.draft.used=b.dataset.nused==='1';nippoWarn='';nippoRenderInput();return}
 if(b.dataset.npersonTab!==undefined){nippoState.draft.activePerson=Number(b.dataset.npersonTab);nippoSave();nippoRenderInput();return}
 if(b.dataset.nchip){
  const parts=b.dataset.nchip.split(':'),set=parts[0],k=parts[1],person=nippoState.draft.people[Number(b.dataset.nperson)||0];
  if(k==='__none'){
   if(set==='visit')person.visit=person.visit==='none'?null:'none';
   else{person[set+'None']=!person[set+'None'];if(person[set+'None'])person[set]=[]}
  }
  else if(set==='visit'||set==='won'){person[set]=(person[set]===k)?null:k}
  else{const arr=person[set],i=arr.indexOf(k);if(i>=0)arr.splice(i,1);else arr.push(k);person[set+'None']=false}
  nippoWarn='';nippoRenderInput();return
 }
 if(b.dataset.nfilter){nippoLogFilter=b.dataset.nfilter;nippoRenderInput();return}
 if(b.dataset.nact==='copyprevperson'){
  const dr=nippoState.draft,i=Math.min(dr.activePerson||0,dr.count-1);if(i<1)return;
  dr.people[i]=nippoClonePerson(dr.people[i-1]);
  nippoWarn='';nippoSave();nippoRenderInput();toast((i+1)+'人目に'+i+'人目と同じ内容を入れました');return
 }
 if(b.dataset.nact==='copyfirst'){
  const dr=nippoState.draft,first=dr.people[0];
  for(let i=1;i<dr.count;i++)dr.people[i]=nippoClonePerson(first);
  nippoWarn='';nippoSave();nippoRenderInput();toast('1人目の内容を'+(dr.count-1)+'人分に入れました');return
 }
 if(b.dataset.nact==='addlog'){
  const dr=nippoState.draft,editing=dr.editIndex!==null&&d.logs[dr.editIndex];
  const missing=nippoMissing(dr);
  if(missing.length&&!b.dataset.force){
   nippoWarn=missing.map(x=>(dr.count>1?(x.i+1)+'人目の':'')+x.m.join('と')).join('、')+'が未選択です。';
   dr.activePerson=missing[0].i;nippoRenderInput();
   const w=document.querySelector('.nippo-warn');if(w)w.scrollIntoView({block:'nearest',behavior:'smooth'});return
  }
  const entry={t:editing?d.logs[dr.editIndex].t:nippoHHMM(new Date()),used:dr.used,count:dr.count,people:dr.people.slice(0,dr.count).map(nippoClonePerson).map(p=>dr.count>1?p:Object.assign(p,{visit:p.visit==='none'?null:p.visit,propNone:false,attachNone:false}))};
  if(editing)d.logs[dr.editIndex]=entry;else{d.logs.push(entry);nippoCountUsage(entry.people)}
  nippoWarn='';nippoStamp(d);nippoState.draft=nippoFreshDraft();nippoSave();nippoPersistToday(pid);nippoRenderInput();nippoRenderHomeSummary();
  toast((editing?'記録を修正しました':'1組を記録しました')+(d.submitted?'。送り直しを忘れずに':''));return
 }
 if(b.dataset.nact==='canceledit'){nippoWarn='';nippoState.draft=nippoFreshDraft();nippoSave();nippoRenderInput();return}
 if(b.dataset.nedit!==undefined){
  const idx=Number(b.dataset.nedit),l=d.logs[idx];if(!l)return;
  nippoState.draft={used:l.used,count:l.count,activePerson:0,people:l.people.map(nippoClonePerson),editIndex:idx};
  nippoWarn='';nippoSave();nippoRenderInput();window.scrollTo({top:0,behavior:'smooth'});toast(l.t+' の記録を上で修正できます');return
 }
 if(b.dataset.ndel!==undefined){
  const idx=Number(b.dataset.ndel),l=d.logs[idx];if(!l)return;
  d.logs.splice(idx,1);
  const dr=nippoState.draft;
  if(dr.editIndex===idx)nippoState.draft=nippoFreshDraft();else if(dr.editIndex!==null&&dr.editIndex>idx)dr.editIndex--;
  nippoStamp(d);nippoSave();nippoPersistToday(pid);nippoRenderInput();nippoRenderHomeSummary();nippoShowUndo(pid,idx,l);return
 }
 if(b.dataset.nstep){
  const key=b.dataset.nstep,cur=nippoTodayTotals(pid)[key],nv=Math.max(0,cur+Number(b.dataset.d));
  if(nv!==cur){d.adj[key]=(d.adj[key]||0)+(nv-cur);nippoStamp(d);nippoPersistToday(pid)}
  nippoUpdateCounts();nippoRenderHomeSummary();return
 }
 if(b.id==='nippoSendBtn'){
  d.submitted=true;d.changed=false;d.submittedAt=nippoHHMM(new Date());
  d.submittedBy=identityUid;
  nippoPersistToday(pid);nippoUpdateCounts();nippoRenderHomeSummary();toast(navigator.onLine?'保存中です。共有先に保存済みの表示をご確認ください。':'電波が戻ると送信します');return
 }
 if(b.dataset.nact==='reset'){
  if(!confirm('自分の今日の入力をリセットしますか？'))return;
  nippoState.today[pid]=nippoNormalizeStaffDay({});nippoState.draft=nippoFreshDraft();nippoSave();nippoPersistToday(pid);
  nippoRender();toast('今日の入力をリセットしました');return
 }
});
function nippoShowUndo(pid,idx,log){
 nippoUndo={pid,idx,log};
 let bar=document.querySelector('#nippoUndoBar');
 if(!bar){
  bar=document.createElement('div');bar.id='nippoUndoBar';bar.className='nippo-undo';bar.setAttribute('role','status');
  bar.innerHTML='<span></span><button type="button">元に戻す</button>';
  bar.querySelector('button').addEventListener('click',()=>{
   if(!nippoUndo)return;
   const {pid,idx,log}=nippoUndo,d=nippoState.today[pid],at=Math.min(idx,d.logs.length);
   d.logs.splice(at,0,log);
   const dr=nippoState.draft;if(pid===nippoState.person&&dr.editIndex!==null&&dr.editIndex>=at)dr.editIndex++;
   nippoUndo=null;bar.classList.remove('show');
   nippoStamp(d);nippoSave();nippoPersistToday(pid);nippoRenderInput();nippoRenderHomeSummary();toast('記録を元に戻しました')
  });
  document.body.appendChild(bar)
 }
 bar.querySelector('span').textContent=log.t+' の記録を取り消しました';
 bar.classList.add('show');
 clearTimeout(nippoUndoTimer);nippoUndoTimer=setTimeout(()=>{bar.classList.remove('show');nippoUndo=null},6000)
}
document.querySelector('#reportView').addEventListener('change',e=>{
 if(e.target.id==='nippoCount'){
  const count=Number(e.target.value);nippoState.draft.count=count;nippoWarn='';
  while(nippoState.draft.people.length<count)nippoState.draft.people.push(nippoFreshPerson());
  nippoState.draft.activePerson=Math.min(nippoState.draft.activePerson||0,count-1);
  nippoSave();nippoRenderInput()
 }
});
document.querySelector('#nippoChangeWhoami').addEventListener('click',()=>document.querySelector('#logoutButton').click());
document.querySelector('#reportView').addEventListener('input',e=>{
 if(e.target.dataset.nvisitNote!==undefined){const person=nippoState.draft.people[Number(e.target.dataset.nvisitNote)||0];if(person){person.visitNote=e.target.value;nippoSave()}return}
 if(e.target.id==='nippoNote'&&identityConfirmed){const d=nippoState.today[nippoState.person];d.note=e.target.value;nippoStamp(d);nippoPersistTodayDebounced(nippoState.person);nippoUpdateCounts();return}
 const ch=e.target.closest('[data-store-channel]');
 if(ch){
  const sid=ch.dataset.store,key=ch.dataset.storeChannel;
  if(!identityConfirmed||nippoCurrentStaff().role!=='manager'||sid!==nippoCurrentStaff().store)return;
  nippoStoreToday[sid]=nippoStoreToday[sid]||{calls:0,wom:0,referral:0};
  nippoStoreToday[sid][key]=Math.max(0,parseInt(ch.value,10)||0);
  nippoSaveStoreTodayFallback();
  window.teamflowFirebase.saveChannels(nippoDkey(NIPPO_TODAY),sid,{...nippoStoreToday[sid]}).catch(error=>toast(firebaseError(error)));
  renderDashboard()
 }
});
function setKpiDelta(el,diff,suffix){
 if(!el)return;
 suffix=suffix||'';
 if(diff==null){el.textContent='';el.className='kpi-delta';return}
 const cls=diff>0?'up':diff<0?'down':'flat',arrow=diff>0?'▲':diff<0?'▼':'→',sign=diff>0?'+':'';
 el.textContent=` ${arrow}${sign}${diff}${suffix}（先週同曜日比）`;
 el.className='kpi-delta '+cls
}
function renderDashboard(){renderPulse();if(!document.querySelector('#kpiTaskRate'))return;const todays=tasks.filter(t=>t.date===TODAY_ISO);const completed=todays.filter(t=>t.done).length,total=todays.length,pct=total?Math.round(completed/total*100):0;document.querySelector('#kpiTaskRate').textContent=pct+'%';document.querySelector('#kpiTaskSub').textContent=total?`${total}件中${completed}件完了`:'今日のタスクはまだありません';document.querySelector('#kpiScheduleCount').textContent=`${total}件`;const submittedCount=NIPPO_STAFF.filter(p=>nippoState.today[p.id].submitted).length;document.querySelector('#kpiReportCount').textContent=`${submittedCount}/${NIPPO_STAFF.length}`;
 const m=getDashboardMetrics(),nippoTotal=m.nippoTotal,todayWon=m.todayWon;
 document.querySelector('#kpiNippoVisits').textContent=`${nippoTotal.visits}組`;
 document.querySelector('#kpiNippoRate').textContent=nippoPct(m.proposeRate||0);
 document.querySelector('#kpiNippoClose').textContent=nippoF2(m.closeRate||0)+'件';
 setKpiDelta(document.querySelector('#kpiVisitsDelta'),m.kpiDeltas.visits.diff,'組');
 setKpiDelta(document.querySelector('#kpiRateDelta'),m.kpiDeltas.proposeRate.diff,'pt');
 setKpiDelta(document.querySelector('#kpiCloseDelta'),m.kpiDeltas.closeRate.diff,'pt');
 document.querySelector('#kpiCardVisits').classList.toggle('worst',m.worstKpi==='visits');
 document.querySelector('#kpiCardRate').classList.toggle('worst',m.worstKpi==='proposeRate');
 document.querySelector('#kpiCardClose').classList.toggle('worst',m.worstKpi==='closeRate');
 const bannerEl=document.querySelector('#dashboardRoleBanner');
 if(bannerEl)bannerEl.textContent=m.role==='self'?'本人だけに表示：自分の数字だけを表示しています。':m.role==='store'?'店長として表示：自店のスタッフ全員分をまとめて表示しています。':'本部として表示：3店舗の合計・店舗別の数字を表示しています（個人の数字は表示しません）。';
 const memberSec=document.querySelector('#memberStatusSection'),staffSec=document.querySelector('#staffChartSection'),showTeamUi=m.role==='store';
 if(memberSec)memberSec.hidden=!showTeamUi;
 if(staffSec)staffSec.hidden=!showTeamUi;
 const channelsSec=document.querySelector('#channelsSection'),storeSec=document.querySelector('#storeCompareSection');
 if(channelsSec)channelsSec.hidden=(m.role==='self');
 if(storeSec)storeSec.hidden=(m.role==='self');
 const peopleEl=document.querySelector('#dashboardNippoPeople');
 if(peopleEl)peopleEl.innerHTML=m.staffTotals.map(s=>{const d=nippoState.today[s.id];return `<div><span>${esc(s.name)}</span><b class="${s.submitted?'status-ontrack':'status-ask'}">${s.submitted?'送信済み '+esc(d.submittedAt):'未送信'}</b></div>`}).join('');
 const staffEl=document.querySelector('#staffChart');
 if(staffEl){
  const sorted=m.staffTotals.slice().sort((a,b)=>b.won-a.won);
  const maxWon=Math.max(...sorted.map(s=>s.won),1);
  staffEl.innerHTML=sorted.length?sorted.map(s=>`<div class="breakdown-row"><span class="breakdown-label">${esc(s.name)}</span><div class="breakdown-track"><div class="breakdown-fill" style="width:${Math.round(s.won/maxWon*100)}%"></div></div><span class="breakdown-val">${s.won}件</span></div>`).join(''):'<p class="empty-settings">表示できるデータがありません</p>'
 }
 const addonEl=document.querySelector('#addonChart');
 if(addonEl){
  const maxA=Math.max(...m.addonProposals.map(a=>a.count),1);
  const bars=m.addonProposals.map(a=>`<div class="breakdown-row${a.count===0?' zero':''}"><span class="breakdown-label">${esc(a.label)}</span><div class="breakdown-track"><div class="breakdown-fill" style="width:${Math.round(a.count/maxA*100)}%"></div></div><span class="breakdown-val">${a.count}件</span></div>`).join('');
  const zeroNote=m.addonZero.length?`<p class="addon-zero-note">提案0件：${m.addonZero.map(a=>esc(a.label)).join('・')}</p>`:'';
  addonEl.innerHTML=bars+zeroNote
 }
 document.querySelector('#kpiCallsVal').textContent=m.channelsToday.calls+'件';
 document.querySelector('#kpiWomVal').textContent=m.channelsToday.wom+'件';
 document.querySelector('#kpiReferralVal').textContent=m.channelsToday.referral+'件';
 setKpiDelta(document.querySelector('#kpiCallsDelta'),m.cmpChannels?m.channelsToday.calls-m.cmpChannels.calls:null,'件');
 setKpiDelta(document.querySelector('#kpiWomDelta'),m.cmpChannels?m.channelsToday.wom-m.cmpChannels.wom:null,'件');
 setKpiDelta(document.querySelector('#kpiReferralDelta'),m.cmpChannels?m.channelsToday.referral-m.cmpChannels.referral:null,'件');
 const storeCompareEl=document.querySelector('#storeCompareTable');
 if(storeCompareEl)storeCompareEl.innerHTML=`<div class="store-compare-row head"><span>店舗</span><span>来店</span><span>提案率</span><span>決定率</span></div>`+m.byStore.map(s=>`<div class="store-compare-row"><span>${esc(s.name)}</span><span class="store-compare-cell ${s.worst==='visits'?'worst':''}">${s.visits}組</span><span class="store-compare-cell ${s.worst==='proposeRate'?'worst':''}">${s.proposeRate!=null?Math.round(s.proposeRate*100)+'%':'-'}</span><span class="store-compare-cell ${s.worst==='closeRate'?'worst':''}">${s.closeRate!=null?Math.round(s.closeRate*100)+'%':'-'}</span></div>`).join('');
 document.querySelector('#kpiMonthlyPct').textContent=Math.min(100,Math.round(m.monthlyPct*100))+'%';
 document.querySelector('#kpiMonthlySub').textContent=`目標${m.monthlyTarget}件中${m.monthlyAchieved}件`;
 document.querySelector('#kpiMonthlyBar').style.width=Math.min(100,Math.round(m.monthlyPct*100))+'%';
 const funnelEl=document.querySelector('#funnelChart');
 if(funnelEl){
  const maxV=nippoTotal.visits||1;
  const stages=[['来店',nippoTotal.visits,'組',100],['提案',nippoTotal.proposedGroups,'組',nippoTotal.visits?Math.round(nippoTotal.proposedGroups/nippoTotal.visits*100):0],['決定',todayWon,'件',nippoTotal.visits?Math.round(todayWon/nippoTotal.visits*100):0]];
  funnelEl.innerHTML=stages.map(([label,val,unit,pct])=>`<div class="funnel-row"><div class="funnel-bar" style="width:${Math.max(20,Math.round(val/maxV*100))}%">${esc(label)} ${val}${unit}</div><span class="funnel-pct">来店比 ${pct}%</span></div>`).join('')
 }
 const trendEl=document.querySelector('#trendBars');
 if(trendEl){
  const nippoHist=nippoLoadHistory();
  const trend=nippoHist.filter(h=>h.date!==nippoDkey(NIPPO_TODAY)).slice(-6).map(h=>h.won).concat([todayWon]),maxT=Math.max(...trend,1);
  trendEl.innerHTML=trend.map((v,i)=>`<i class="${i===trend.length-1?'today':''}" style="height:${Math.max(8,Math.round(v/maxT*100))}%" title="${v}件"></i>`).join('')
 }
 const breakdownEl=document.querySelector('#breakdownChart');
 if(breakdownEl){
  const rows=m.breakdown.slice().sort((a,b)=>b[1]-a[1]);
  const maxB=Math.max(...rows.map(r=>r[1]),1);
  breakdownEl.innerHTML=rows.map(([label,val])=>`<div class="breakdown-row"><span class="breakdown-label">${esc(label)}</span><div class="breakdown-track"><div class="breakdown-fill" style="width:${Math.round(val/maxB*100)}%"></div></div><span class="breakdown-val">${val}件</span></div>`).join('')
 }
}
function getDashboardMetrics(){
 const role=nippoRole(),viewer=nippoCurrentStaff(),showIndividual=role!=='hq';
 const scopeIds=role==='self'?[viewer.id]:(role==='store'?NIPPO_STAFF.filter(p=>p.store===viewer.store).map(p=>p.id):NIPPO_STAFF.map(p=>p.id));
 const todays=tasks.filter(t=>t.date===TODAY_ISO);
 const taskTotal=todays.length,taskDone=todays.filter(t=>t.done).length;
 const taskPct=taskTotal?Math.round(taskDone/taskTotal*100):null;
 const unsubmitted=showIndividual?NIPPO_STAFF.filter(p=>scopeIds.includes(p.id)&&!nippoState.today[p.id].submitted):[];
 const staffTotals=showIndividual?scopeIds.map(id=>{const p=NIPPO_STAFF.find(x=>x.id===id),t=nippoTodayTotals(id);return {id,name:p.name,store:p.store,visits:t.visits,proposed:t.proposedGroups,won:nippoWonTotal(t),submitted:nippoState.today[id].submitted}}):[];
 const nippoTotal=nippoEmpty();scopeIds.forEach(id=>nippoAddInto(nippoTotal,nippoTodayTotals(id)));
 const todayWon=nippoWonTotal(nippoTotal);
 const proposeRate=nippoTotal.visits?nippoTotal.proposedGroups/nippoTotal.visits:null;
 const closeRate=nippoTotal.proposedGroups?todayWon/nippoTotal.proposedGroups:null;
 const nippoHist=nippoLoadHistory();
 const recent=nippoHist.filter(h=>h.date!==nippoDkey(NIPPO_TODAY)).slice(-6).map(h=>h.won);
 const recentAvg=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:null;
 const curMonth=nippoDkey(NIPPO_TODAY).slice(0,7),monthlyTarget=60;
 const monthlyBase=nippoHist.filter(h=>h.date!==nippoDkey(NIPPO_TODAY)&&h.date.startsWith(curMonth)).reduce((s,h)=>s+h.won,0);
 const monthlyAchieved=monthlyBase+todayWon,monthlyPct=monthlyAchieved/monthlyTarget;
 const daysInMonth=new Date(NIPPO_TODAY.getFullYear(),NIPPO_TODAY.getMonth()+1,0).getDate();
 const paceExpected=NIPPO_TODAY.getDate()/daysInMonth;
 const breakdown=NIPPO_WON.filter(w=>w[3]).map(w=>[w[1],nippoTotal['won_'+w[0]]||0]);
 const breakdownTotal=breakdown.reduce((s,[,v])=>s+v,0);
 const topItem=breakdown.slice().sort((a,b)=>b[1]-a[1])[0];
 const weekAgoKey=nippoDkey(new Date(NIPPO_TODAY.getFullYear(),NIPPO_TODAY.getMonth(),NIPPO_TODAY.getDate()-7));
 const cmpEntry=nippoHist.find(h=>h.date===weekAgoKey)||null;
 const cmpScope=(field)=>{
  if(!cmpEntry)return null;
  if(role==='self')return cmpEntry.byStaff&&cmpEntry.byStaff[viewer.id]?cmpEntry.byStaff[viewer.id][field]:null;
  if(role==='store')return cmpEntry.byStore&&cmpEntry.byStore[viewer.store]?cmpEntry.byStore[viewer.store][field]:null;
  return field==='visits'?(cmpEntry.visits??null):field==='proposed'?(cmpEntry.proposed??null):(cmpEntry.won??null)
 };
 const cmpVisits=cmpScope('visits'),cmpProposed=cmpScope('proposed'),cmpWon=cmpScope('won');
 const cmpProposeRate=(cmpVisits&&cmpProposed!=null)?cmpProposed/cmpVisits:null;
 const cmpCloseRate=(cmpProposed&&cmpWon!=null)?cmpWon/cmpProposed:null;
 const kpiDeltas={
  visits:{cur:nippoTotal.visits,cmp:cmpVisits,diff:cmpVisits!=null?nippoTotal.visits-cmpVisits:null},
  proposeRate:{cur:proposeRate,cmp:cmpProposeRate,diff:(proposeRate!=null&&cmpProposeRate!=null)?Math.round(proposeRate*100)-Math.round(cmpProposeRate*100):null},
  closeRate:{cur:closeRate,cmp:cmpCloseRate,diff:(closeRate!=null&&cmpCloseRate!=null)?Math.round(closeRate*100)-Math.round(cmpCloseRate*100):null}
 };
 let worstKpi=null,worstRel=0;
 [['visits',nippoTotal.visits,cmpVisits],['proposeRate',proposeRate,cmpProposeRate],['closeRate',closeRate,cmpCloseRate]].forEach(([k,cur,cmp])=>{
  if(cur==null||cmp==null||cmp===0)return;
  const rel=(cur-cmp)/cmp;
  if(rel<-0.03&&rel<worstRel){worstRel=rel;worstKpi=k}
 });
 const addonProposals=NIPPO_PROP.map(([k,label])=>({key:k,label,count:scopeIds.reduce((s,id)=>s+(nippoTodayTotals(id)['prop_'+k]||0),0)}));
 const addonZero=addonProposals.filter(a=>a.count===0);
 const channelStoreIds=role==='self'?[]:(role==='store'?[viewer.store]:NIPPO_STORES.map(s=>s.id));
 const sumChannels=(getter)=>channelStoreIds.reduce((s,sid)=>{const c=getter(sid)||{calls:0,wom:0,referral:0};return {calls:s.calls+c.calls,wom:s.wom+c.wom,referral:s.referral+c.referral}},{calls:0,wom:0,referral:0});
 const channelsToday=sumChannels(sid=>nippoStoreToday[sid]);
 const cmpChannels=cmpEntry&&cmpEntry.channels?sumChannels(sid=>cmpEntry.channels[sid]):null;
 const byStore=role==='self'?[]:NIPPO_STORES.map(s=>{
  const t=nippoEmpty();
  NIPPO_STAFF.filter(p=>p.store===s.id).forEach(p=>nippoAddInto(t,nippoTodayTotals(p.id)));
  const won=nippoWonTotal(t),pRate=t.visits?t.proposedGroups/t.visits:null,cRate=t.proposedGroups?won/t.proposedGroups:null;
  const cmpS=cmpEntry&&cmpEntry.byStore?cmpEntry.byStore[s.id]:null;
  const cmpPRate=(cmpS&&cmpS.visits)?cmpS.proposed/cmpS.visits:null;
  const cmpCRate=(cmpS&&cmpS.proposed)?cmpS.won/cmpS.proposed:null;
  let sw=null,swRel=0;
  [['visits',t.visits,cmpS?cmpS.visits:null],['proposeRate',pRate,cmpPRate],['closeRate',cRate,cmpCRate]].forEach(([k,cur,cmp])=>{
   if(cur==null||cmp==null||cmp===0)return;
   const rel=(cur-cmp)/cmp;
   if(rel<-0.03&&rel<swRel){swRel=rel;sw=k}
  });
  return {id:s.id,name:s.name,visits:t.visits,proposed:t.proposedGroups,won,proposeRate:pRate,closeRate:cRate,worst:sw}
 });
 const submittedCount=NIPPO_STAFF.filter(p=>nippoState.today[p.id].submitted).length;
 return {role,viewer,showIndividual,scopeIds,taskTotal,taskDone,taskPct,unsubmitted,staffTotals,submittedCount,staffCount:NIPPO_STAFF.length,nippoTotal,todayWon,proposeRate,closeRate,recentAvg,curMonth,monthlyTarget,monthlyBase,monthlyAchieved,monthlyPct,daysInMonth,paceExpected,breakdown,breakdownTotal,topItem,cmpEntry,kpiDeltas,worstKpi,addonProposals,addonZero,channelsToday,cmpChannels,byStore}
}
const KPI_LABEL={visits:'来店組数',proposeRate:'提案した組の割合',closeRate:'提案1組あたりの決定率'};
function csvEscape(v){v=String(v??'');return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function exportDashboardCsv(){
 const m=getDashboardMetrics();
 const rows=[];
 rows.push(['日付',nippoDkey(NIPPO_TODAY)]);
 rows.push([]);
 rows.push(['サマリー']);
 rows.push(['表示範囲',m.role==='self'?'本人のみ':m.role==='store'?'店長（自店）':'本部（全店舗）']);
 rows.push(['タスク完了率',m.taskPct!==null?m.taskPct+'%':'-']);
 rows.push(['今日の予定件数',m.taskTotal+'件']);
 rows.push(['日報提出',`${m.submittedCount}/${m.staffCount}`]);
 rows.push([]);
 rows.push(['日報実績']);
 rows.push(['来店組数',m.nippoTotal.visits]);
 rows.push(['提案した組数',m.nippoTotal.proposedGroups]);
 rows.push(['決定数',m.todayWon]);
 rows.push(['提案率',m.proposeRate!==null?Math.round(m.proposeRate*100)+'%':'-']);
 rows.push(['決定率',m.closeRate!==null?Math.round(m.closeRate*100)+'%':'-']);
 rows.push(['来店組数の先週同曜日比',m.kpiDeltas.visits.diff!=null?m.kpiDeltas.visits.diff:'データなし']);
 rows.push(['提案率の先週同曜日比(pt)',m.kpiDeltas.proposeRate.diff!=null?m.kpiDeltas.proposeRate.diff:'データなし']);
 rows.push(['決定率の先週同曜日比(pt)',m.kpiDeltas.closeRate.diff!=null?m.kpiDeltas.closeRate.diff:'データなし']);
 rows.push(['一番下がった指標',m.worstKpi?KPI_LABEL[m.worstKpi]:'なし']);
 if(m.staffTotals.length){
  rows.push([]);
  rows.push(['スタッフ別実績']);
  rows.push(['名前','来店','提案','決定','日報']);
  m.staffTotals.forEach(s=>rows.push([s.name,s.visits,s.proposed,s.won,s.submitted?'提出済み':'未提出']))
 }
 rows.push([]);
 rows.push(['商材別内訳（決定数）']);
 m.breakdown.forEach(([label,val])=>rows.push([label,val]));
 rows.push([]);
 rows.push(['アドオン提案の状況']);
 m.addonProposals.forEach(a=>rows.push([a.label,a.count+'件',a.count===0?'提案0件':'']));
 if(m.role!=='self'){
  rows.push([]);
  rows.push(['電話・口コミ・紹介']);
  rows.push(['電話',m.channelsToday.calls+'件']);
  rows.push(['口コミ',m.channelsToday.wom+'件']);
  rows.push(['紹介',m.channelsToday.referral+'件']);
  rows.push([]);
  rows.push(['店舗別比較']);
  rows.push(['店舗','来店','提案率','決定率','一番下がった指標']);
  m.byStore.forEach(s=>rows.push([s.name,s.visits+'組',s.proposeRate!=null?Math.round(s.proposeRate*100)+'%':'-',s.closeRate!=null?Math.round(s.closeRate*100)+'%':'-',s.worst?KPI_LABEL[s.worst]:'']))
 }
 rows.push([]);
 rows.push(['今月の目標']);
 rows.push(['達成率',Math.round(m.monthlyPct*100)+'%']);
 rows.push(['目標',m.monthlyTarget+'件']);
 rows.push(['実績',m.monthlyAchieved+'件']);
 const csv=rows.map(r=>r.map(csvEscape).join(',')).join('\r\n');
 const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;
 a.download=`ダッシュボード_${nippoDkey(NIPPO_TODAY)}.csv`;
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url)
}
document.querySelector('#dashboardCsvBtn').addEventListener('click',exportDashboardCsv);
function computeInsights(m){
 m=m||getDashboardMetrics();
 const {taskPct,unsubmitted,todayWon,proposeRate,closeRate,recentAvg,monthlyAchieved,monthlyPct,paceExpected,breakdown,breakdownTotal,topItem,worstKpi,kpiDeltas,addonZero,byStore}=m;
 const insights=[];
 if(worstKpi){
  const d=kpiDeltas[worstKpi],pct=Math.round(Math.abs((d.cur-d.cmp)/d.cmp)*100);
  insights.push({severity:75,title:`「${KPI_LABEL[worstKpi]}」が先週の同じ曜日より落ち込んでいます（${pct}%減）`,cause:`${KPI_LABEL[worstKpi]}が3つの指標の中で最も下がっており、来店数・提案率・決定率のうちどこに手を打つべきかが分かります。`,action:worstKpi==='visits'?'口コミへの返信、機種変更時期の電話、来店を促すイベントを見直す。':worstKpi==='proposeRate'?'お待ちの間の声かけタイミングと、切り出しの一言をロープレする。':'2つ目の商材を見せる順番や、断られたときの返し方をロープレする。'})
 }
 if(addonZero.length){
  insights.push({severity:50,title:`提案0件のアドオンがあります（${addonZero.map(a=>a.label).join('・')}）`,cause:'一部のアドオン商材が今日は一度も提案されていません。声かけの型が定着していない可能性があります。',action:'アドオンの提案トークを朝礼で1つ選んで確認する。提案0件の商材から優先的にロープレする。'})
 }
 if(byStore&&byStore.length>1){
  const worstStore=byStore.find(s=>s.worst);
  if(worstStore)insights.push({severity:48,title:`${worstStore.name}の「${KPI_LABEL[worstStore.worst]}」が先週より下がっています`,cause:'3店舗の中でこの店舗のこの指標が下がっており、店舗単位で個別に見直す価値があります。',action:'該当店舗の店長とその指標にしぼって振り返りの時間を取る。'})
 }
 if(unsubmitted.length){
  insights.push({severity:70,title:`日報が未提出のメンバーがいます（${unsubmitted.length}名）`,cause:`${unsubmitted.map(p=>p.name).join('・')}さんの日報が未提出のため、今日の実績を正しく把握できていません。`,action:'終業前に日報入力のリマインドを送る、または入力項目を減らして出しやすくする。'})
 }
 if(proposeRate!==null&&proposeRate<0.5){
  insights.push({severity:60+Math.round((0.5-proposeRate)*100),title:`提案率が低めです（${nippoPct(proposeRate)}）`,cause:'来店した組のうち提案まで至った割合が低く、声かけ・ヒアリングの機会損失が考えられます。',action:'診断シートを使った声かけを徹底する。忙しい時間帯の接客フローを見直す。'})
 }
 if(closeRate!==null&&closeRate<0.3){
  insights.push({severity:65+Math.round((0.3-closeRate)*100),title:`決定率が低めです（提案した組の${nippoPct(closeRate)}）`,cause:'提案まで至った組のうち決定した割合が低く、クロージングや提案内容と客のニーズのマッチングに課題がある可能性があります。',action:'ロープレでクロージングトークを強化する。料金・乗り換えメリットの説明資料を整備する。'})
 }
 if(taskPct!==null&&taskPct<50){
  insights.push({severity:40,title:`今日の業務の完了率が低めです（${taskPct}%）`,cause:'業務量が多い、または優先順位が曖昧な可能性があります。',action:'業務を時間帯ごとに分けて登録する。優先度の高い業務から着手する。'})
 }
 if(recentAvg!==null&&recentAvg>0&&todayWon<recentAvg*0.8){
  insights.push({severity:55,title:'決定数が直近の平均より落ち込んでいます',cause:`直近6日平均${recentAvg.toFixed(1)}件に対し、本日は${todayWon}件です。来店数の減少や季節要因、競合キャンペーンなどが考えられます。`,action:'集客施策（チラシ・SNS・紹介キャンペーン）を強化する。来店動機を作るキャンペーンを検討する。'})
 }
 if(topItem&&breakdownTotal>=3&&topItem[1]/breakdownTotal>=0.6){
  insights.push({severity:35,title:`決定が「${topItem[0]}」に偏っています（全体の${Math.round(topItem[1]/breakdownTotal*100)}%）`,cause:'特定商材への依存度が高く、他商材の提案機会を逃している可能性があります。',action:'他商材の提案トークを研修する。セット提案を意識した接客フローにする。'})
 }
 if(monthlyAchieved>0&&monthlyPct<paceExpected-0.1){
  insights.push({severity:45,title:`今月の目標ペースがやや遅れています（達成率${Math.round(monthlyPct*100)}%）`,cause:`本日時点で期待されるペースは約${Math.round(paceExpected*100)}%ですが、実績は${Math.round(monthlyPct*100)}%です。`,action:'週次で中間目標を設定し、達成状況をチームで共有する。'})
 }
 insights.sort((a,b)=>b.severity-a.severity);
 return insights
}
function insightsToHtml(insights){
 if(!insights.length){
  return '<section class="card insight-card"><div class="card-head"><div class="title-icon teal">✓</div><h2>大きな課題は見当たりません</h2></div><p>現在の数値では特に気になる落ち込みはありません。この調子を維持しつつ、来店数そのものを増やす施策（集客・紹介キャンペーン等）を検討すると、さらに伸ばせる可能性があります。</p></section>'
 }
 return insights.map(i=>`<section class="card insight-card"><div class="card-head"><div class="title-icon coral">!</div><h2>${esc(i.title)}</h2></div><p><strong>原因の仮説：</strong>${esc(i.cause)}</p><p><strong>施策案：</strong>${esc(i.action)}</p></section>`).join('')
}
function buildAnalysisPrompt(m){
 const lines=[];
 lines.push('あなたは携帯販売店の実績改善に詳しい経営コンサルタントです。以下は本日のチームダッシュボードの実績データです。');
 lines.push(`来店組数：${m.nippoTotal.visits}組`);
 lines.push(`提案した組数：${m.nippoTotal.proposedGroups}組（来店比 ${m.proposeRate!==null?Math.round(m.proposeRate*100):0}%）`);
 lines.push(`決定数：${m.todayWon}件（提案比 ${m.closeRate!==null?Math.round(m.closeRate*100):0}%）`);
 lines.push(`直近6日の決定数平均：${m.recentAvg!==null?m.recentAvg.toFixed(1):'データなし'}件`);
 lines.push(`今月の目標達成率：${Math.round(m.monthlyPct*100)}%（目標${m.monthlyTarget}件中${m.monthlyAchieved}件、本日時点の期待ペースは約${Math.round(m.paceExpected*100)}%）`);
 lines.push(`今日のタスク完了率：${m.taskPct!==null?m.taskPct+'%':'タスク登録なし'}`);
 lines.push(`日報未提出：${m.unsubmitted.length?m.unsubmitted.map(p=>p.name).join('・')+'さん':'なし'}`);
 if(m.staffTotals.length){
  lines.push('スタッフ別の本日の実績：');
  m.staffTotals.forEach(s=>lines.push(`- ${s.name}：来店${s.visits}組／提案${s.proposed}組／決定${s.won}件／日報${s.submitted?'提出済み':'未提出'}`))
 }
 lines.push('商材別の決定内訳：'+(m.breakdown.map(([label,val])=>`${label} ${val}件`).join('、')||'なし'));
 lines.push('先週の同じ曜日との比較：来店'+(m.kpiDeltas.visits.diff!=null?(m.kpiDeltas.visits.diff>=0?'+':'')+m.kpiDeltas.visits.diff+'組':'データなし')+'／提案率'+(m.kpiDeltas.proposeRate.diff!=null?(m.kpiDeltas.proposeRate.diff>=0?'+':'')+m.kpiDeltas.proposeRate.diff+'pt':'データなし')+'／決定率'+(m.kpiDeltas.closeRate.diff!=null?(m.kpiDeltas.closeRate.diff>=0?'+':'')+m.kpiDeltas.closeRate.diff+'pt':'データなし')+(m.worstKpi?`（最も下がったのは「${KPI_LABEL[m.worstKpi]}」）`:''));
 if(m.addonZero.length)lines.push('本日提案が0件のアドオン：'+m.addonZero.map(a=>a.label).join('、'));
 if(m.role!=='self'){
  lines.push(`電話・口コミ・紹介（週次記録）：電話${m.channelsToday.calls}件／口コミ${m.channelsToday.wom}件／紹介${m.channelsToday.referral}件`);
  lines.push('店舗別の比較：'+m.byStore.map(s=>`${s.name}（来店${s.visits}組／提案率${s.proposeRate!=null?Math.round(s.proposeRate*100)+'%':'-'}／決定率${s.closeRate!=null?Math.round(s.closeRate*100)+'%':'-'}${s.worst?'・'+KPI_LABEL[s.worst]+'が先週より低下':''}）`).join('、'))
 }
 lines.push('');
 lines.push('この実績から読み取れる「原因」と、明日から実行できる具体的な「施策」を、それぞれ3つ程度、日本語で簡潔に箇条書きにしてください。見出しは「原因」「施策」としてください。');
 return lines.join('\n')
}
async function renderAnalysis(){
 const listEl=document.querySelector('#analysisList');
 if(!listEl)return;
 const m=getDashboardMetrics();
 const numbersHtml=`<h2 class="report-sec-title" style="margin-top:8px">数値から自動検出したポイント</h2><div class="insight-grid">${insightsToHtml(computeInsights(m))}</div>`;
 if(!(window.claude&&window.claude.use)){
  listEl.innerHTML=numbersHtml;
  return
 }
 listEl.innerHTML=`<h2 class="report-sec-title">AIによる分析</h2><div class="insight-grid"><section class="card insight-card ai-analysis-card"><div class="card-head"><div class="title-icon turquoise">✦</div><h2>AIが分析しています…</h2></div><p class="ai-analysis-status">ダッシュボードの数値をもとに、原因と施策を考えています。</p></section></div>`+numbersHtml;
 try{
  const sample=await withTimeout(window.claude.use('sample'),6000);
  if(!sample)throw new Error('no-sample');
  const res=await withTimeout(sample(buildAnalysisPrompt(m)),20000);
  const text=res&&res.text?res.text:'';
  if(!text)throw new Error('empty');
  const card=listEl.querySelector('.ai-analysis-card');
  if(card)card.innerHTML=`<div class="card-head"><div class="title-icon turquoise">✦</div><h2>AIによる分析</h2></div><div class="ai-analysis-text">${esc(text)}</div>`
 }catch(e){
  const heading=listEl.querySelector('.report-sec-title');
  const card=listEl.querySelector('.ai-analysis-card');
  if(card)card.closest('.insight-grid').remove();
  if(heading)heading.remove()
 }
}
function renderModuleEditor(){const items=moduleData[activeModule];document.querySelector('#moduleCounter').textContent=`${items.length}件を表示中`;document.querySelector('#moduleItemList').innerHTML=items.length?items.map((x,i)=>`<div class="module-entry"><div class="module-entry-copy"><strong>${esc(x.a)}</strong><span>${esc(moduleConfig[activeModule].b)}：${esc(displayDate(x.b)||'未設定')}</span><em>${esc(x.c)}</em></div><button data-module-delete="${i}">削除</button></div>`).join(''):'<p class="empty-settings">登録項目はありません</p>'}
document.querySelector('#moduleForm').addEventListener('submit',e=>{e.preventDefault();const a=document.querySelector('#moduleFieldA').value.trim(),b=document.querySelector('#moduleFieldB').value,c=document.querySelector('#moduleFieldC').value;if(!a)return;moduleData[activeModule].push({a,b,c});saveModuleData();renderModuleEditor();renderHomeModules();e.currentTarget.reset();document.querySelector('#moduleFieldC').innerHTML=moduleConfig[activeModule].options.map(o=>`<option>${esc(o)}</option>`).join('');toast(`ホームの「${moduleConfig[activeModule].title}」に反映しました`)});
document.querySelector('#moduleItemList').addEventListener('click',e=>{const b=e.target.closest('[data-module-delete]');if(!b)return;moduleData[activeModule].splice(Number(b.dataset.moduleDelete),1);saveModuleData();renderModuleEditor();renderHomeModules();toast('ホームから削除しました')});
function selectMethod(method){document.querySelectorAll('[data-method]').forEach(b=>b.classList.toggle('active',b.dataset.method===method));document.querySelectorAll('[data-panel]').forEach(p=>p.classList.toggle('active',p.dataset.panel===method))}
document.querySelectorAll('[data-method]').forEach(b=>b.addEventListener('click',()=>selectMethod(b.dataset.method)));
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
document.querySelector('#voiceButton').addEventListener('click',()=>{if(!SpeechRecognition){document.querySelector('#voiceStatus').textContent='このブラウザは音声入力に対応していません';return}if(recognition){recognition.stop();return}recognition=new SpeechRecognition();recognition.lang='ja-JP';recognition.interimResults=true;recognition.onstart=()=>{document.querySelector('#voiceButton').classList.add('listening');document.querySelector('#voiceStatus').textContent='聞いています…'};recognition.onresult=e=>{const text=Array.from(e.results).map(r=>r[0].transcript).join('');document.querySelector('#newTaskName').value=text;document.querySelector('#voiceStatus').textContent=text};recognition.onerror=()=>document.querySelector('#voiceStatus').textContent='聞き取れませんでした。もう一度お試しください';recognition.onend=()=>{recognition=null;document.querySelector('#voiceButton').classList.remove('listening')};recognition.start()});
document.querySelector('#taskPhoto').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>compressPhoto(reader.result);reader.readAsDataURL(file)});
function compressPhoto(src){const img=new Image();img.onload=()=>{const max=900,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);selectedPhoto=canvas.toDataURL('image/jpeg',.72);const preview=document.querySelector('#photoPreview');preview.querySelector('img').src=selectedPhoto;preview.hidden=false;document.querySelector('.photo-picker').hidden=true};img.src=src}
function removePhoto(){selectedPhoto='';const p=document.querySelector('#photoPreview');p.hidden=true;p.querySelector('img').removeAttribute('src');document.querySelector('.photo-picker').hidden=false;document.querySelector('#taskPhoto').value=''}
document.querySelector('#removePhoto').addEventListener('click',removePhoto);
document.querySelector('#workForm').addEventListener('submit',e=>{e.preventDefault();const name=document.querySelector('#newTaskName').value.trim(),time=document.querySelector('#newTaskTime').value||'09:00',note=document.querySelector('#newTaskNote').value.trim();if(!name){selectMethod('manual');document.querySelector('#newTaskName').focus();toast('業務名を入力してください');return}tasks.push({date:TODAY_ISO,name,time,note,photo:selectedPhoto,done:false,status:'未着手',custom:true});saveTasks();renderTasks();e.currentTarget.reset();document.querySelector('#newTaskTime').value='09:00';removePhoto();selectMethod('manual');toast('ホームの「今日の業務」に反映しました')});
document.querySelector('#eventForm').addEventListener('submit',e=>{e.preventDefault();const name=document.querySelector('#eventName').value.trim(),time=document.querySelector('#eventTime').value||'09:00',note=document.querySelector('#eventNote').value.trim();if(!name){document.querySelector('#eventName').focus();toast('タスク名を入力してください');return}tasks.push({date:selectedDate,time,name,note,done:false,status:'未着手',custom:true});saveTasks();renderTasks();e.currentTarget.reset();document.querySelector('#eventTime').value='09:00';toast(selectedDate===TODAY_ISO?'ホームの「今日の業務」に反映しました':`${formatDateLabel(selectedDate)}にタスクを追加しました`)});
document.querySelector('#dayEventList').addEventListener('click',e=>{const b=e.target.closest('[data-schedule-delete]');if(!b)return;tasks.splice(Number(b.dataset.scheduleDelete),1);saveTasks();renderTasks();toast('タスクを削除しました')});
document.querySelector('#calendarGrid').addEventListener('click',e=>{const b=e.target.closest('[data-date]');if(!b)return;selectedDate=b.dataset.date;renderCalendar();document.querySelector('#eventName').focus()});
document.querySelector('#calPrev').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()});
document.querySelector('#calNext').addEventListener('click',()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()});
let assistantBusy=false;
document.querySelector('#assistantForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const input=document.querySelector('#assistantInput'),text=input.value.trim(),replyEl=document.querySelector('#assistantReply');
 if(!text||assistantBusy)return;
 assistantBusy=true;
 replyEl.hidden=false;replyEl.classList.add('loading');replyEl.textContent='考えています…';
 try{
  // Claude上で公開しているときは Claude の AI を使い、それ以外（このMacで開いたとき）は従来のローカルAPIを使う
  const sample=window.claude&&window.claude.use?await withTimeout(window.claude.use('sample'),6000).catch(()=>null):null;
  let answer;
  if(sample){
   const r=await withTimeout(sample(text),30000);
   answer=r&&r.text;
  }else{
   const response=await fetch('http://localhost:3000/api/teamflow/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:text})});
   const res=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(res.error||'AIへの接続に失敗しました');
   answer=res.text;
  }
  replyEl.classList.remove('loading');
  replyEl.textContent=answer||'回答を取得できませんでした。';
}catch(err){
  replyEl.classList.remove('loading');
  replyEl.textContent=err.message||'AIアシストでエラーが発生しました。もう一度お試しください。';
 }
 assistantBusy=false;
 input.value=''
});
document.querySelectorAll('.suggestions button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelector('#assistantInput').value=btn.textContent;document.querySelector('#assistantInput').focus()}));document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('#searchInput').focus()}});document.querySelector('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.currentTarget.value.trim())toast(`「${e.currentTarget.value}」を検索しました`)});let toastTimer;function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2200)}
const sidebarEl=document.querySelector('#sidebar'),sidebarBackdrop=document.querySelector('#sidebarBackdrop'),menuButton=document.querySelector('#menuButton');
function openSidebar(){sidebarEl.classList.add('open');sidebarBackdrop.classList.add('show');menuButton.setAttribute('aria-expanded','true')}
function closeSidebar(){sidebarEl.classList.remove('open');sidebarBackdrop.classList.remove('show');menuButton.setAttribute('aria-expanded','false')}
menuButton.addEventListener('click',()=>{sidebarEl.classList.contains('open')?closeSidebar():openSidebar()});
sidebarBackdrop.addEventListener('click',closeSidebar);
sidebarEl.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeSidebar));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSidebar()});
if(location.hash==='#work-settings')showView('work');else if(location.hash==='#calendar')showView('calendar');else if(location.hash==='#dashboard')showView('dashboard');else if(location.hash==='#report')showView('report');else if(location.hash==='#settings')showView('settings');else if(location.hash==='#help')showView('help');else if(location.hash==='#analysis')showView('analysis');else if(location.hash.startsWith('#manage-')){const key=location.hash.replace('#manage-','');if(moduleConfig[key])showModule(key)}
if(document.modelContext?.registerTool){const updateTool={name:'update_today_task',title:'今日の業務を更新',description:'今日の業務の完了状態を更新します。',inputSchema:{type:'object',properties:{taskIndex:{type:'integer',minimum:0},completed:{type:'boolean'}},required:['taskIndex','completed'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:({taskIndex,completed})=>{if(!Number.isInteger(taskIndex)||taskIndex<0||taskIndex>=tasks.length||typeof completed!=='boolean')throw new Error('入力が正しくありません');tasks[taskIndex].done=completed;saveTasks();renderTasks();return {task:tasks[taskIndex].name,completed}}};const addTool={name:'add_today_task',title:'今日の業務を追加',description:'業務名と開始時刻を指定してホームの今日の業務に追加します。',inputSchema:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:60},time:{type:'string',pattern:'^([01]\\d|2[0-3]):[0-5]\\d$'},note:{type:'string',maxLength:180}},required:['name','time'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:({name,time,note=''})=>{if(typeof name!=='string'||!name.trim()||!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(time))throw new Error('入力が正しくありません');tasks.push({date:TODAY_ISO,name:name.trim(),time,note,done:false,status:'未着手',custom:true});saveTasks();renderTasks();return {added:true,name:name.trim(),time}}};Promise.all([document.modelContext.registerTool(updateTool),document.modelContext.registerTool(addTool)]).catch(()=>{})}

// サイドバーのログアウト：この端末の担当者のひも付けを外して、ログイン画面に戻す
document.querySelector('#logoutButton').addEventListener('click',async()=>{
 const staff=nippoCurrentStaff();if(!confirm(`${staff.name}さんをログアウトしますか？`))return;
 if(nippoPending.size){toast('保存中の日報があります。共有先に保存済みになるまでお待ちください。');return}
 closeSidebar();
 try{await window.teamflowFirebase.logout();clearFirebaseViewer();loginStaffId=staff.id;openIdentityPicker();toast('ログアウトしました')}
 catch(error){toast(firebaseError(error))}
});

// 「Claudeにサインインした状態で…」の案内は、Claude上で開いたときだけ出す（GitHub Pagesなどでは不要）
(()=>{const f=document.querySelector('#loginFootnote');if(f&&window.claude&&window.claude.use)f.hidden=false})();
