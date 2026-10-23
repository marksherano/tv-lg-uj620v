/* UI language (ca / es / en), ES5. The same core is copied in every app; only the tables differ.
   Code writes its strings in Catalan and wraps them in T(); T_ES / T_EN translate them (missing
   entries fall back to Catalan). Chosen language in localStorage 'lang', else the system one, else English.
   Static HTML: elements with a data-t attribute get their text translated, data-th their inner HTML
   (for text with <b>/<code>; whitespace is collapsed to build the key), data-tp their placeholder. */
var LANGS = ['ca', 'es', 'en'], LANG_NAMES = { ca: 'Català', es: 'Español', en: 'English' };
var LANG = (function () {
  var s = null; try { s = localStorage.getItem('lang'); } catch (e) { /* no storage */ }
  if (LANG_NAMES[s]) return s;
  var n = String(navigator.language || '').slice(0, 2).toLowerCase();
  return LANG_NAMES[n] ? n : 'en';
})();
function T(s) {
  var d = LANG === 'es' ? T_ES : LANG === 'en' ? T_EN : null, r = (d && d[s]) || s, a = arguments;
  return a.length > 1 ? r.replace(/\{(\d)\}/g, function (m, i) { return a[+i + 1]; }) : r;
}
function setLang(l) { try { localStorage.setItem('lang', l); } catch (e) { /* no storage */ } LANG = l; }
function nextLang() { setLang(LANGS[(LANGS.indexOf(LANG) + 1) % LANGS.length]); return LANG; }
function translatePage(root) {
  var els = (root || document).querySelectorAll('[data-t], [data-th], [data-tp]');
  function key(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  for (var i = 0; i < els.length; i++) {
    var e = els[i];
    if (e.hasAttribute('data-t')) {
      if (!e.getAttribute('data-t')) e.setAttribute('data-t', key(e.textContent));
      e.textContent = T(e.getAttribute('data-t'));
    }
    if (e.hasAttribute('data-th')) {
      if (!e.getAttribute('data-th')) e.setAttribute('data-th', key(e.innerHTML));
      e.innerHTML = T(e.getAttribute('data-th'));
    }
    if (e.hasAttribute('data-tp')) {
      if (!e.getAttribute('data-tp')) e.setAttribute('data-tp', e.getAttribute('placeholder') || '');
      e.setAttribute('placeholder', T(e.getAttribute('data-tp')));
    }
  }
  if (document.documentElement) document.documentElement.lang = LANG;
}

var T_ES = {
  "Esperant contingut des del mòbil…": "Esperando contenido desde el móvil…",
  "{0} de {1}": "{0} de {1}",
  "❚❚ En pausa": "❚❚ En pausa",
  "OK pausa · ◀ ▶ 10 s": "OK pausa · ◀ ▶ 10 s",
  " · ▲ ▼ anterior / següent": " · ▲ ▼ anterior / siguiente",
  " · ENRERE sortir": " · ATRÁS salir",
  "❚❚ Passi aturat": "❚❚ Pase detenido",
  "▶ Passi automàtic": "▶ Pase automático",
  "◀ ▶ anterior / següent · OK atura el passi · ": "◀ ▶ anterior / siguiente · OK detiene el pase · ",
  "ENRERE sortir": "ATRÁS salir",
  "No s'ha pogut obrir la foto": "No se ha podido abrir la foto",
  "Aquesta TV no pot reproduir aquest vídeo": "Esta TV no puede reproducir este vídeo",
  "Carregant…": "Cargando…"
};

var T_EN = {
  "Esperant contingut des del mòbil…": "Waiting for something from the phone…",
  "{0} de {1}": "{0} of {1}",
  "❚❚ En pausa": "❚❚ Paused",
  "OK pausa · ◀ ▶ 10 s": "OK pause · ◀ ▶ 10 s",
  " · ▲ ▼ anterior / següent": " · ▲ ▼ previous / next",
  " · ENRERE sortir": " · BACK exit",
  "❚❚ Passi aturat": "❚❚ Slideshow stopped",
  "▶ Passi automàtic": "▶ Slideshow",
  "◀ ▶ anterior / següent · OK atura el passi · ": "◀ ▶ previous / next · OK stops the slideshow · ",
  "ENRERE sortir": "BACK exit",
  "No s'ha pogut obrir la foto": "Couldn't open the photo",
  "Aquesta TV no pot reproduir aquest vídeo": "This TV can't play this video",
  "Carregant…": "Loading…"
};
