// Fit each public rack within its fixed seat; never resize the table to its contents.
const table=document.querySelector('#table');
let frame;
function fit(){
 cancelAnimationFrame(frame);
 frame=requestAnimationFrame(()=>{
  for(const zone of table.querySelectorAll('.opponent-zones, .self-melds')){
   zone.style.zoom='1';
   const seat=zone.closest('.opponent')||zone.parentElement;
   const side=seat.classList.contains('west')||seat.classList.contains('east');
   const availableWidth=side?seat.clientWidth:zone.classList.contains('self-melds')?Math.max(1,seat.clientWidth-seat.querySelector('.self-info').offsetWidth-12):seat.clientWidth;
   const availableHeight=side?Math.max(1,seat.clientHeight-seat.querySelector('.player-badge').offsetHeight-seat.querySelector('.flower-target').offsetHeight-16):Math.max(1,seat.clientHeight-(zone.classList.contains('self-melds')?0:seat.querySelector('.player-badge').offsetHeight+4));
   const scale=Math.min(1,availableWidth/zone.scrollWidth,availableHeight/zone.scrollHeight);
   zone.style.zoom=String(scale);
  }
 });
}
new ResizeObserver(fit).observe(table);
new MutationObserver(fit).observe(table,{childList:true,subtree:true});
window.addEventListener('resize',fit);
fit();
