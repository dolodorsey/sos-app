self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json?.()||{}}catch{data={body:event.data?.text?.()||'You have a new S.O.S. update.'}}
  const title=data.title||'S.O.S.';
  const options={body:data.body||'Open S.O.S. for details.',icon:'/favicon.png',badge:'/favicon.png',tag:data.notification_ref?`sos-${data.notification_ref}`:'sos-update',renotify:true,requireInteraction:data.type==='hero_offer'||data.type==='mission_offer',data:{url:data.url||'/app'}};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'/app',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const existing=list.find(client=>client.url.startsWith(self.location.origin));
    if(existing){existing.focus();existing.navigate(target);return existing}
    return clients.openWindow(target);
  }));
});
