
(() => {
 const sourceBills=[
 {id:'hotel',name:'西湖边的民宿',date:'11月21日',type:'home',category:'住宿',amount:72000},
 {id:'dinner',name:'周六的那顿杭帮菜',date:'11月21日',type:'food',category:'餐饮',amount:36000},
 {id:'taxi',name:'车站往返打车',date:'11月22日',type:'car',category:'交通',amount:12000},
 {id:'coffee',name:'湖边咖啡时间',date:'11月22日',type:'coffee',category:'饮品',amount:6000},
 {id:'lunch',name:'周日午餐',date:'11月22日',type:'food',category:'餐饮',amount:19800},
 {id:'shop',name:'便利店零食',date:'11月22日',type:'receipt',category:'购物',amount:4860}
];

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
})();
