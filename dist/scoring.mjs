// House rules are explicit: positional flowers, no automatic flower-only wins.
export const BASE=5000,PER_TAI=500,STARTING_SCORE=50000;
export const WINDS=['東','南','西','北'];
export const FLOWERS=['春','夏','秋','冬','梅','蘭','竹','菊'];
export const TAI_TABLE=[['門清／自摸','各 1'],['門清自摸','3（取代前兩項）'],['圈風／門風刻子','各 1'],['正花','每張 1'],['花槓','每組 2（取代該組正花）'],['三元刻子','每組 1'],['獨聽','1'],['平胡','2'],['全求人','2（不加獨聽）'],['三／四／五暗刻','2／5／8（擇一）'],['碰碰胡','4'],['混一色／清一色／字一色','4／8／8（擇一）'],['小／大三元','4／8（不加三元刻）'],['小／大四喜','8／16（大四喜不加風刻）'],['搶槓／海底／河底','各 1'],['槓上／花上自摸','加 1（海底不重複）'],['天胡／地胡','24／16（取代門清自摸）'],['八仙過海','8（須成胡，取代花台）'],['莊家／連莊','1＋2 × 連莊次數']];
export function decompose(hand,meldCount=0){
 if(hand.length!==17-meldCount*3)return[];const c=Array(34).fill(0);
 for(const t of hand)if(t<0||t>33||++c[t]>4)return[];
 const results=[];
 function sets(pair,groups){const i=c.findIndex(n=>n);if(i<0){results.push({pair,groups:[...groups]});return;}
  if(c[i]>=3){c[i]-=3;sets(pair,[...groups,{kind:'triplet',tiles:[i,i,i],closed:true}]);c[i]+=3;}
  if(i<27&&i%9<7&&c[i+1]&&c[i+2]){c[i]--;c[i+1]--;c[i+2]--;sets(pair,[...groups,{kind:'sequence',tiles:[i,i+1,i+2],closed:true}]);c[i]++;c[i+1]++;c[i+2]++;}
 }
 for(let i=0;i<34;i++)if(c[i]>=2){c[i]-=2;sets(i,[]);c[i]+=2;}return results;
}
export function flowerItems(g,seat){
 const owned=new Set(g.players[seat].flowers.map(t=>t.type));
 if(owned.size===8)return[{name:'八仙過海',tai:8}];
 const wind=(seat-g.dealer+4)%4,items=[];
 for(const base of [34,38]){
  if([0,1,2,3].every(i=>owned.has(base+i)))items.push({name:base===34?'花槓（春夏秋冬）':'花槓（梅蘭竹菊）',tai:2});
  else if(owned.has(base+wind))items.push({name:`正花（${FLOWERS[base+wind-34]}）`,tai:1});
 }return items;
}
export function scoreHand(g,seat,{self=false,rob=false,tile}={}){
 const p=g.players[seat],winning=tile?.type??p.hand.find(t=>t.id===p.drawn)?.type;
 const hand=p.hand.map(t=>t.type);if(!self)hand.push(winning);
 const shapes=decompose(hand,p.melds.length);if(!shapes.length)throw new Error('無法計台：不是合法胡牌');
 const exposed=p.melds.map(m=>({kind:m.kind==='chi'?'sequence':'triplet',tiles:m.tiles.map(t=>t.type),closed:m.kind==='concealed'}));
 const closed=p.melds.every(m=>m.kind==='concealed');
 const all=[...hand,...exposed.flatMap(m=>m.tiles)],suits=new Set(all.filter(t=>t<27).map(t=>Math.floor(t/9))),honors=all.some(t=>t>=27);
 const before=[...hand];before.splice(before.indexOf(winning),1);
 const waitTypes=Array.from({length:34},(_,t)=>t).filter(t=>all.filter(x=>x===t).length-(t===winning?1:0)<4&&decompose([...before,t],p.melds.length).length);
 const common=flowerItems(g,seat),add=(items,name,tai)=>items.push({name,tai});
 const heavenly=self&&seat===g.dealer&&g.discardCount===0&&g.totalCalls===0;
 const earthly=self&&seat!==g.dealer&&p.drawCount===1&&p.discards.length===0&&g.totalCalls===0;
 if(heavenly)add(common,'天胡',24);else if(earthly)add(common,'地胡',16);else if(closed&&self)add(common,'門清自摸',3);else{if(closed)add(common,'門清',1);if(self)add(common,'自摸',1);}
 if(rob)add(common,'搶槓',1);
 if(g.wall.length===16&&!rob)add(common,self?'海底撈月':'河底撈魚',1);
 else if(self&&!heavenly&&!earthly&&p.drawSource==='kong')add(common,'槓上開花',1);
 else if(self&&!heavenly&&!earthly&&p.drawSource==='flower')add(common,'花上自摸',1);
 if(!suits.size)add(common,'字一色',8);else if(suits.size===1)add(common,honors?'混一色':'清一色',honors?4:8);
 const fullDemand=!self&&p.melds.length===5&&p.melds.every(m=>m.kind!=='concealed');
 if(fullDemand)add(common,'全求人',2);else if(waitTypes.length===1)add(common,'獨聽',1);
 let best=null;
 for(const shape of shapes){
  const locations=[...(shape.pair===winning?[-1]:[]),...shape.groups.map((m,i)=>m.tiles.includes(winning)?i:null).filter(i=>i!==null)];
  for(const location of locations){
   const items=[...common],groups=[...shape.groups,...exposed],triplets=groups.filter(m=>m.kind==='triplet'),tripTypes=triplets.map(m=>m.tiles[0]);
   const dragonCount=tripTypes.filter(t=>t>=31).length,windCount=tripTypes.filter(t=>t>=27&&t<=30).length;
   if(dragonCount===3)add(items,'大三元',8);
   else if(dragonCount===2&&shape.pair>=31)add(items,'小三元',4);
   else for(const t of tripTypes.filter(t=>t>=31))add(items,`三元刻（${['白','發','中'][t-31]}）`,1);
   if(windCount===4)add(items,'大四喜',16);
   else{
    if(windCount===3&&shape.pair>=27&&shape.pair<=30)add(items,'小四喜',8);
    const roundWind=Math.floor((g.handNumber||0)/4),seatWind=(seat-g.dealer+4)%4;
    if(tripTypes.includes(27+roundWind))add(items,`圈風（${WINDS[roundWind]}）`,1);
    if(tripTypes.includes(27+seatWind))add(items,`門風（${WINDS[seatWind]}）`,1);
   }
   if(triplets.length===5)add(items,'碰碰胡',4);
   const concealed=triplets.filter(m=>m.closed).length-(!self&&location>=0&&shape.groups[location].kind==='triplet'?1:0);
   if(concealed>=3)add(items,['','','','三暗刻','四暗刻','五暗刻'][concealed],[0,0,0,2,5,8][concealed]);
   const winningGroup=shape.groups[location],twoSided=winningGroup?.kind==='sequence'&&((winning===winningGroup.tiles[0]&&winning%9!==6)||(winning===winningGroup.tiles[2]&&winning%9!==2));
   if(!self&&!honors&&!p.flowers.length&&!triplets.length&&waitTypes.length>1&&twoSided)add(items,'平胡',2);
   const tai=items.reduce((n,x)=>n+x.tai,0);if(!best||tai>best.tai)best={tai,items,groups,pair:shape.pair,waitTypes};
  }
 }return best;
}
export function paymentFor(g,winner,payer,score){
 const items=[...score.items];if(winner===g.dealer||payer===g.dealer)items.push({name:`莊家${g.streak?`・連${g.streak}拉${g.streak}`:''}`,tai:1+2*(g.streak||0)});
 const tai=items.reduce((n,x)=>n+x.tai,0);return{winner,payer,tai,items,base:BASE,perTai:PER_TAI,amount:BASE+tai*PER_TAI};
}
