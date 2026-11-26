
(() => {
 const clone=x=>JSON.parse(JSON.stringify(x));
 const sourceBills=[
 {id:'hotel',name:'西湖边的民宿',date:'11月21日',type:'home',category:'住宿',amount:72000},
 {id:'dinner',name:'周六的那顿杭帮菜',date:'11月21日',type:'food',category:'餐饮',amount:36000},
 {id:'taxi',name:'车站往返打车',date:'11月22日',type:'car',category:'交通',amount:12000},
 {id:'coffee',name:'湖边咖啡时间',date:'11月22日',type:'coffee',category:'饮品',amount:6000},
 {id:'lunch',name:'周日午餐',date:'11月22日',type:'food',category:'餐饮',amount:19800},
 {id:'shop',name:'便利店零食',date:'11月22日',type:'receipt',category:'购物',amount:4860}
];
const defaults=()=>({version:1,title:'杭州周末小旅行',mode:'aa',bills:clone(sourceBills.slice(0,4)),members:[{id:'me',name:'我',self:true,weight:1},{id:'rain',name:'小雨',weight:1},{id:'zhou',name:'阿舟',weight:1}],payments:[{id:'seed-1',member:'rain',amount:15000,time:'2026-11-22T11:30:00.000Z',allocations:{hotel:15000}},{id:'seed-2',member:'zhou',amount:12000,time:'2026-11-22T12:00:00.000Z',allocations:{dinner:12000}}]});

 window.BILL_SPLIT_DEMO_SEED=defaults();
 window.BILL_SPLIT_CONFIG=Object.freeze({...window.BILL_SPLIT_CONFIG,storageKey:'miaomiao-bill-split-demo-v1',demo:true});
 window.callNative={
  evaluateJsToNative(raw){
   const message=JSON.parse(raw);
   if(message.action==='getLocalBills')setTimeout(()=>window.onSuccessCallback(JSON.stringify({
    action:message.action,requestId:message.requestId,data:{
     items:sourceBills.map((b,i)=>({id:b.id,bookId:i%2?'demo-daily':'demo-trip',bookName:i%2?'日常账本':'旅行账本',name:b.name,amount:b.amount,date:b.date.includes('21')?'2026-11-21':'2026-11-22',category:b.category,icon:b.type})).reverse()
    }
   })),80);
   else if(message.action==='shareImg')setTimeout(()=>window.onSuccessCallback(JSON.stringify({action:message.action,requestId:message.requestId,data:{code:-1000002,msg:'模拟模式不调用系统分享'}})),100);
  }
 };
 document.addEventListener('DOMContentLoaded',()=>{const mark=document.createElement('div');mark.className='source-caption';mark.style.cssText='text-align:center;padding:8px';mark.textContent='模拟预览';document.querySelector('.topbar').after(mark);});
})();
