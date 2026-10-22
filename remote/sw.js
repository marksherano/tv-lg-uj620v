/* Service worker of the phone page. It caches nothing (the page always comes from the TV); it only
   exists so Android can install the page as an app and list it in the Share menu (manifest
   share_target). A share arrives as a POST to /compartir: files are parked in Cache Storage and
   /envia uploads them with its progress bar; a link goes to /envia?u=… */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'POST' || u.pathname !== '/compartir') return;
  e.respondWith(e.request.formData().then(function (form) {
    var files = form.getAll('media').filter(function (f) { return f && f.size; });
    if (files.length) {
      return caches.delete('compartit').then(function () { return caches.open('compartit'); }).then(function (c) {
        return Promise.all(files.map(function (f, i) {
          return c.put('/compartit/' + i, new Response(f, { headers: {
            'Content-Type': f.type || 'application/octet-stream', 'X-Name': encodeURIComponent(f.name || 'fitxer' + i) } }));
        }));
      }).then(function () { return Response.redirect('/envia?compartit=' + files.length, 303); });
    }
    // apps put the link in url, text ("Look at this! https://…") or even title
    var all = [form.get('url'), form.get('text'), form.get('title')].join(' ');
    var m = /https?:\/\/[^\s"'<>]+/.exec(all);
    return Response.redirect(m ? '/envia?u=' + encodeURIComponent(m[0]) : '/envia?compartit=0', 303);
  }).catch(function () { return Response.redirect('/envia?compartit=0', 303); }));
});
