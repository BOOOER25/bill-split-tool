const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
let html = fs.readFileSync(path.join(root, 'src/prototype.html'), 'utf8');
function replace(before, after) {
  if (!html.includes(before)) throw new Error('Build anchor missing: ' + before.slice(0, 80));
  html = html.replace(before, after);
}
const seedStart = html.indexOf('const sourceBills=[');
const seedEnd = html.indexOf("let current='rain'", seedStart);
if (seedStart < 0 || seedEnd < 0) throw new Error('Seed anchors missing');
const demoSource = html.slice(seedStart, html.indexOf('let state=defaults();', seedStart));
html = html.slice(0, seedStart) + `
const config=window.BILL_SPLIT_CONFIG,bridge=window.BillSplitNative;
let sourceBills=[],loadingBills=false,loadSerial=0;
const defaults=()=>({version:1,id:null,title:'分摊算账',mode:'aa',bills:[],members:[{id:'me',name:'我',self:true,weight:1}],payments:[]});
let book={schemaVersion:1,currentId:null,groups:[]},state=defaults(),storageMessage='',storageBlocked=false;
try{
 const raw=localStorage.getItem(config.storageKey);
 if(raw){
  const saved=JSON.parse(raw);
  if(saved?.schemaVersion!==1||!Array.isArray(saved.groups)||saved.groups.some(g=>!g.id||!Array.isArray(g.bills)||!Array.isArray(g.members)||!g.members.some(m=>m.self)||!Array.isArray(g.payments)))throw Error('数据格式错误');
  book=saved;state=clone(book.groups.find(g=>g.id===book.currentId)||book.groups[0]||defaults());
 }else if(config.demo&&window.BILL_SPLIT_DEMO_SEED){
  state=clone(window.BILL_SPLIT_DEMO_SEED);state.id='demo-group';
  book={schemaVersion:1,currentId:state.id,groups:[clone(state)]};
 }
}catch{storageBlocked=true;storageMessage='本地数据暂时无法读取，请勿清理原数据。';}
` + html.slice(seedEnd);
replace('<title>分摊算账</title>', `<title>分摊算账</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<script src="./config.js"></script>
<script src="./native-bridge.js"></script>`);
replace('<button class="button small" id="reset-demo">重置数据</button>', '<button class="button small" id="history-open">历史分摊</button><button class="button small" id="reset-demo" hidden>重置模拟</button>');
replace('<div class="workspace">', '<div id="storage-status" role="alert" hidden></div><div class="workspace">');
replace('function persist(){try{localStorage.setItem(\'together-split-v1\',JSON.stringify(state));}catch{}}', `
function renderStorageStatus(){
 const el=$('#storage-status');el.hidden=!storageMessage;el.textContent=storageMessage;
}
function persist(){
 try{
  if(storageBlocked)throw Error('原数据无法读取');
  if(state.id){
   const i=book.groups.findIndex(g=>g.id===state.id);
   if(i<0)book.groups.unshift(clone(state));else book.groups[i]=clone(state);
   book.currentId=state.id;
  }
  localStorage.setItem(config.storageKey,JSON.stringify(book));storageMessage='';renderStorageStatus();return true;
 }catch{storageMessage='未保存：本地存储不可用，请保持页面打开。';renderStorageStatus();return false;}
}`);
replace("state=clone(undoSnapshot);persist();render();undoSnapshot=null;", "state=clone(undoSnapshot.state);book=clone(undoSnapshot.book);current='all';persist();render();undoSnapshot=null;");
replace('function checkpoint(){undoSnapshot=clone(state);}', 'function checkpoint(){undoSnapshot={state:clone(state),book:clone(book)};}');
replace("function notify(message,undo=false){", "function notify(message,undo=false){if(storageMessage&&message.startsWith('已'))message='本次修改尚未保存，请查看页面提示';");
replace(" $('#new-group').innerHTML=icon('plus')+'新建分摊';", ` $('#new-group').innerHTML=icon('plus')+'新建分摊';
 renderStorageStatus();$('#reset-demo').hidden=!config.demo;$('#export-open').hidden=!state.id;
 if(!state.id){
  $('#group-title').textContent='分摊算账';$('#sidebar').innerHTML='';$('.workspace').classList.add('is-empty');
  $('#main').innerHTML='<section class="summary empty-start"><h2>新建一份分摊</h2><p>从所有账本最近 200 条支出中选择几笔，计算每个人应付的金额。</p><button class="button primary" id="empty-create">选择账单</button></section>';
  $('#empty-create').onclick=openCreate;return;
 }
 $('.workspace').classList.remove('is-empty');`);
replace("function closeModal(){$('#backdrop').hidden=true;", "function closeModal(){loadSerial++;bridge.setBackIntercept(false);$('#backdrop').hidden=true;");
replace(" modalKind=kind;$('#modal').className=", " bridge.setBackIntercept(true);modalKind=kind;$('#modal').className=");
const createStart = html.indexOf('function openCreate(){');
const createEnd = html.indexOf('function renderCreate(){', createStart);
html = html.slice(0, createStart) + `
async function openCreate(){
 const serial=++loadSerial;loadingBills=true;
 showModal('loading',modalHead('读取本地账单')+'<div class="empty">正在读取所有账本最近 200 条支出…</div>');
 try{
  const result=await bridge.getLocalBills();
  if(serial!==loadSerial||modalKind!=='loading')return;
  sourceBills=result.items;
  if(!sourceBills.length){showModal('empty-bills',modalHead('选择账单')+'<div class="empty">所有账本暂无支出。</div>');return;}
  const p=evenPercents(3);
  createDraft={step:1,selected:new Set(),title:'新的分摊',mode:'aa',members:['我','成员 2','成员 3'].map((name,i)=>({name,self:i===0,percent:(p[i]/100).toFixed(2)}))};
  renderCreate();
 }catch(error){
  if(serial!==loadSerial)return;
  showModal('load-error',modalHead('读取本地账单')+'<div class="empty">'+esc(error.message)+'</div><div class="modal-foot"><button class="button primary" id="retry-bills">重新读取</button></div>');
  $('#retry-bills').onclick=openCreate;
 }finally{loadingBills=false;}
}
function openHistory(){
 showModal('history',modalHead('历史分摊')+(book.groups.length?'<div class="history-list">'+book.groups.map(g=>'<button class="history-item" data-history="'+esc(g.id)+'"><b>'+esc(g.title)+'</b><span>'+g.bills.length+' 笔 · '+g.members.length+' 人</span></button>').join('')+'</div>':'<div class="empty">还没有分摊记录</div>'));
 $('#modal').querySelectorAll('[data-history]').forEach(el=>el.onclick=()=>{
  state=clone(book.groups.find(g=>g.id===el.dataset.history));current='all';tab='bills';undoSnapshot=null;persist();closeModal();render();
 });
}
` + html.slice(createEnd);
replace("checkpoint();state={version:1,title:d.title.trim()", "checkpoint();state={version:1,id:crypto.randomUUID?crypto.randomUUID():'group-'+Date.now()+'-'+Math.random().toString(36).slice(2),sourceScope:'all',createdAt:new Date().toISOString(),title:d.title.trim()");
replace("if(d.step===1)content=sourceBills.map", "if(d.step===1)content='<p class=\"source-caption\">所有账本 · 最近 '+sourceBills.length+' 条支出</p>'+sourceBills.map");
replace('${b.date} · ${b.category}</small>', '${esc(b.bookName||"")} · ${esc(b.date)} · ${esc(b.category)}</small>');
replace("b.date+' · '+b.category", "(b.bookName?esc(b.bookName)+' · ':'')+esc(b.date)+' · '+esc(b.category)");
html=html.replaceAll('${b.date} · ${b.category}', '${b.bookName?b.bookName+" · ":""}${b.date} · ${b.category}');
html = html.replaceAll('data-check="${b.id}"', 'data-check="${esc(b.id)}"').replaceAll('data-select="${b.id}"', 'data-select="${esc(b.id)}"');
replace("$('#export-download').onclick=async()=>{try{download(await exportBlob(),exportFileName());notify(exportMode==='image'?'图片已保存':'文字已下载');}catch{notify('生成失败，请重试');}};", `
$('#export-download').onclick=async()=>{
 const button=$('#export-download');button.disabled=true;
 try{
  if(exportMode==='image'&&bridge.platform()!=='browser'){
   if(!bridge.canShareImage()){notify('请长按预览图保存');return;}
   await bridge.shareImage(buildCanvas(exportScope).toDataURL('image/png'),3);notify('图片已保存');
  }else{download(await exportBlob(),exportFileName());notify('已发起文件下载');}
 }catch(error){if(error.code!==-1000002)notify(error.message);}finally{button.disabled=false;}
};`);
replace("const blob=await exportBlob(),file=new File([blob],exportFileName(),{type:blob.type});", `
if(exportMode==='image'&&bridge.platform()!=='browser'){
 if(!bridge.canShareImage()){notify('请长按预览图保存或发送');return;}
 showShareTargets();return;
}
if(exportMode==='text'&&bridge.platform()!=='browser'){$('#export-copy').click();return;}
const blob=await exportBlob(),file=new File([blob],exportFileName(),{type:blob.type});`);
replace("else{download(blob,exportFileName());notify('文件已保存，可选择文件发送给对方');}", "else{download(blob,exportFileName());notify('已发起下载，可选择文件发送给对方');}");
replace("if(exportMode==='image'){exportCanvas=buildCanvas(exportScope);$('#export-preview').appendChild(exportCanvas);}", `if(exportMode==='image'){exportCanvas=buildCanvas(exportScope);const img=new Image();img.alt='账单图片预览';img.src=exportCanvas.toDataURL('image/png');$('#export-preview').appendChild(img);}`);
replace("$('#reset-demo').onclick=()=>{checkpoint();state=defaults();current='rain';tab='bills';settledOpen=true;persist();render();notify('已恢复模拟数据',true);};", `
$('#history-open').onclick=openHistory;
$('#reset-demo').onclick=()=>{
 if(!config.demo)return;checkpoint();state=clone(window.BILL_SPLIT_DEMO_SEED);state.id='demo-group';
 book={schemaVersion:1,currentId:state.id,groups:[clone(state)]};current='rain';tab='bills';settledOpen=true;persist();render();notify('已恢复模拟数据',true);
};
bridge.subscribe(message=>{
 if(message.action==='backIntercept'&&modalKind)closeModal();
});
function showShareTargets(){
 $('#native-share-targets')?.remove();
 const el=document.createElement('div');el.id='native-share-targets';el.className='native-share-targets';
 el.innerHTML=['微信好友','朋友圈','QQ 好友','保存图片'].map((name,i)=>'<button class="button soft small" data-share-target="'+i+'">'+name+'</button>').join('');
 $('#export-share').closest('.receipt-actions').after(el);
 el.querySelectorAll('[data-share-target]').forEach(button=>button.onclick=async()=>{
  el.querySelectorAll('button').forEach(b=>b.disabled=true);$('#export-download').disabled=true;$('#export-share').disabled=true;
  try{
   await bridge.shareImage(buildCanvas(exportScope).toDataURL('image/png'),Number(button.dataset.shareTarget));
   notify(Number(button.dataset.shareTarget)===3?'图片已保存':'已分享');
  }catch(error){if(error.code!==-1000002)notify(error.message);}
  finally{el.remove();$('#export-download')?.removeAttribute('disabled');$('#export-share')?.removeAttribute('disabled');}
 });
}
`);
replace('</head>', `<style>
[hidden]{display:none!important}
#storage-status{padding:12px 16px;margin:10px 0;background:#fff0ed;border:1px solid #eeaa9a;border-radius:12px;color:#8f382b;font-size:13px}
.workspace.is-empty{display:block}.empty-start{text-align:center;padding:50px 24px}.empty-start p{font-size:13px;color:var(--muted);line-height:1.8;margin:18px 0 24px}
.history-item{display:flex;width:100%;justify-content:space-between;gap:18px;padding:18px 5px;border-bottom:1px dashed var(--line);text-align:left}
.history-item span,.source-caption{color:var(--muted);font-size:12px}
.export-preview img{display:block;width:100%;max-width:540px;height:auto;margin:auto;user-select:auto;-webkit-touch-callout:default}
.native-share-targets{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:16px 0}
@media(max-width:600px){#history-open{font-size:11px;padding:7px 4px}.history-item{flex-direction:column;gap:7px}}
</style></head>`);
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
for (const file of ['config.js', 'native-bridge.js']) fs.copyFileSync(path.join(root, 'src', file), path.join(dist, file));
fs.writeFileSync(path.join(dist, 'index.html'), html);
const mock = `
(() => {
 const clone=x=>JSON.parse(JSON.stringify(x));
 ${demoSource}
 window.BILL_SPLIT_DEMO_SEED=defaults();
 const books=[
  {id:'demo-daily',name:'日常账本'},
  {id:'demo-trip',name:'旅行账本'},
  {id:'demo-life',name:'生活账本'}
 ];
 const examples=[
  {name:'早餐豆浆和包子',amount:1250,category:'餐饮',type:'food'},
  {name:'地铁出行',amount:600,category:'交通',type:'car'},
  {name:'工作日午餐',amount:3200,category:'餐饮',type:'food'},
  {name:'下午的拿铁',amount:2600,category:'饮品',type:'coffee'},
  {name:'超市日用品',amount:8750,category:'购物',type:'receipt'},
  {name:'晚餐小火锅',amount:15800,category:'餐饮',type:'food'},
  {name:'网约车回家',amount:3480,category:'交通',type:'car'},
  {name:'便利店水果',amount:2380,category:'购物',type:'receipt'},
  {name:'周末电影',amount:9800,category:'娱乐',type:'receipt'},
  {name:'短途高铁',amount:12350,category:'交通',type:'car'},
  {name:'周末民宿',amount:42800,category:'住宿',type:'home'},
  {name:'猫咪的零食',amount:4590,category:'宠物',type:'receipt'},
  {name:'家里的水电费',amount:14680,category:'居家',type:'home'},
  {name:'面包店采购',amount:3820,category:'餐饮',type:'food'},
  {name:'书店买书',amount:6800,category:'购物',type:'receipt'},
  {name:'朋友聚餐',amount:28600,category:'餐饮',type:'food'}
 ];
 const demoBills=Array.from({length:200},(_,i)=>{
  const bill=i<sourceBills.length?sourceBills[sourceBills.length-1-i]:examples[(i-sourceBills.length)%examples.length];
  const book=books[i%books.length];
  return {
   id:'demo-bill-'+String(i+1).padStart(3,'0'),bookId:book.id,bookName:book.name,
   name:bill.name,amount:bill.amount+(i<sourceBills.length?0:Math.floor(i/examples.length)*137),
   date:new Date(Date.UTC(2026,10,26)-Math.floor(i/6)*86400000).toISOString().slice(0,10),
   category:bill.category,icon:bill.type
  };
 });
 window.BILL_SPLIT_CONFIG=Object.freeze({...window.BILL_SPLIT_CONFIG,storageKey:'miaomiao-bill-split-demo-v1',demo:true});
 window.callNative={
  evaluateJsToNative(raw){
   const message=JSON.parse(raw);
   if(message.action==='getLocalBills')setTimeout(()=>window.onSuccessCallback(JSON.stringify({
    action:message.action,requestId:message.requestId,data:{
     items:demoBills
    }
   })),80);
   else if(message.action==='shareImg')setTimeout(()=>window.onSuccessCallback(JSON.stringify({action:message.action,requestId:message.requestId,data:{code:-1000002,msg:'模拟模式不调用系统分享'}})),100);
  }
 };
 document.addEventListener('DOMContentLoaded',()=>{const mark=document.createElement('div');mark.className='source-caption';mark.style.cssText='text-align:center;padding:8px';mark.textContent='模拟预览';document.querySelector('.topbar').after(mark);});
})();
`;
fs.writeFileSync(path.join(root, 'dev/demo-bridge.js'), mock);
const demoHtml = html.replace('<script src="./config.js"></script>', '<script src="../config.js"></script><script src="./demo-bridge.js?v=200"></script>')
  .replace('<script src="./native-bridge.js"></script>', '<script src="../native-bridge.js"></script>');
fs.writeFileSync(path.join(root, 'dev/index.html'), demoHtml);
fs.writeFileSync(path.join(root, 'index.html'), demoHtml.replaceAll('../config.js', './config.js').replaceAll('../native-bridge.js', './native-bridge.js'));
for (const file of ['config.js', 'native-bridge.js']) fs.copyFileSync(path.join(dist, file), path.join(root, file));
fs.copyFileSync(path.join(root, 'dev/demo-bridge.js'), path.join(root, 'demo-bridge.js'));
console.log('Built dist/ (production) and dev/ (isolated demo).');
