/* Service worker of the phone page. It caches nothing (the page always comes from the TV); it
   exists so Android can install the page as an app and list it in the Share menu (manifest
   share_target), and to send the app to tvlinks' "turn on" page when the TV is off. A share arrives
   as a POST to /compartir: files are parked in Cache Storage and /envia uploads them with its
   progress bar; a link goes to /envia?u=… */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  // TV off (no answer): open the "turn on the TV" page of tvlinks, whose address the page saved
  if (e.request.mode === 'navigate' && e.request.method === 'GET') {
    return e.respondWith(fetch(e.request).catch(function (err) {
      return caches.open('wake').then(function (c) { return c.match('/wake-url'); }).then(function (r) {
        if (!r) throw err;
        return r.text().then(function (url) { return Response.redirect(url, 302); });
      });
    }));
  }
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
