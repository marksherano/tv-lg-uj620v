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
  "Inici": "Inicio",
  "Directes": "Directos",
  "Guia": "Guía",
  "Últims vídeos": "Últimos vídeos",
  "Programes": "Programas",
  "Cerca": "Buscar",
  "Avui": "Hoy",
  "Demà": "Mañana",
  "Demà passat": "Pasado mañana",
  "● ARA · OK directe": "● AHORA · OK directo",
  "OK capítols": "OK capítulos",
  "Als meus programes": "En mis programas",
  "Afegeix als meus programes": "Añadir a mis programas",
  "OK per treure-ho": "OK para quitarlo",
  "Sortirà a la pestanya Inici": "Saldrá en la pestaña Inicio",
  "EN DIRECTE": "EN DIRECTO",
  "Continuar veient": "Seguir viendo",
  "Els meus programes": "Mis programas",
  "Aquí sortiran els vídeos que deixis a mitges i els programes que marquis amb ☆": "Aquí saldrán los vídeos que dejes a medias y los programas que marques con ☆",
  "Carregant programació…": "Cargando programación…",
  "No s'ha pogut carregar la programació": "No se ha podido cargar la programación",
  "No hi ha programació per a aquest dia": "No hay programación para este día",
  "Carregant…": "Cargando…",
  "Canals en directe": "Canales en directo",
  "No disponible": "No disponible",
  "Ara: {0}": "Ahora: {0}",
  "Error de connexió ({0})": "Error de conexión ({0})",
  "Error de connexió": "Error de conexión",
  "No hi ha vídeos disponibles": "No hay vídeos disponibles",
  "Últims capítols publicats": "Últimos capítulos publicados",
  "Programes de la A a la Z": "Programas de la A a la Z",
  "Carregant programes…": "Cargando programas…",
  "Escriu per cercar entre els programes": "Escribe para buscar entre los programas",
  "Prem OK per escriure": "Pulsa OK para escribir",
  "Cap programa coincideix amb «{0}»": "Ningún programa coincide con «{0}»",
  "{0} programa": "{0} programa",
  "{0} programes": "{0} programas",
  "❚❚ En pausa": "❚❚ En pausa",
  "No s'ha pogut reproduir aquest vídeo": "No se ha podido reproducir este vídeo",
  "Comença en {0} s": "Empieza en {0} s",
  "Subtítols: {0}": "Subtítulos: {0}",
  "Subtítols desactivats": "Subtítulos desactivados",
  "Aquest vídeo no té subtítols": "Este vídeo no tiene subtítulos",
  "No s'han pogut carregar els subtítols": "No se han podido cargar los subtítulos",
  "Aquest canal no està disponible ara": "Este canal no está disponible ahora",
  "{0} · en directe": "{0} · en directo",
  "Carregant vídeo…": "Cargando vídeo…",
  "No s'ha pogut obtenir el vídeo": "No se ha podido obtener el vídeo",
  "Aquest vídeo només està en un format que aquesta TV no pot reproduir": "Este vídeo solo está en un formato que esta TV no puede reproducir",
  "Subtítols: {0} (▲ per canviar)": "Subtítulos: {0} (▲ para cambiar)",
  "Té subtítols: prem ▲ per activar-los": "Tiene subtítulos: pulsa ▲ para activarlos",
  "Afegit als meus programes": "Añadido a mis programas",
  "Tret dels meus programes": "Quitado de mis programas",
  "Cerca un programa…": "Busca un programa…",
  "OK pausa · ◀ ▶ 10 s (mantén: 60 s) · ▲ subtítols · ENRERE sortir": "OK pausa · ◀ ▶ 10 s (mantén: 60 s) · ▲ subtítulos · ATRÁS salir",
  "Següent capítol": "Siguiente capítulo",
  "OK per començar-lo ara · ENRERE per sortir": "OK para empezarlo ahora · ATRÁS para salir",
  "Idioma: {0}": "Idioma: {0}"
};

var T_EN = {
  "Inici": "Home",
  "Directes": "Live",
  "Guia": "Guide",
  "Últims vídeos": "Latest",
  "Programes": "Shows",
  "Cerca": "Search",
  "Avui": "Today",
  "Demà": "Tomorrow",
  "Demà passat": "In 2 days",
  "● ARA · OK directe": "● NOW · OK live",
  "OK capítols": "OK episodes",
  "Als meus programes": "In my shows",
  "Afegeix als meus programes": "Add to my shows",
  "OK per treure-ho": "OK to remove it",
  "Sortirà a la pestanya Inici": "It will show up in Home",
  "EN DIRECTE": "LIVE",
  "Continuar veient": "Continue watching",
  "Els meus programes": "My shows",
  "Aquí sortiran els vídeos que deixis a mitges i els programes que marquis amb ☆": "Videos you leave halfway and shows you mark with ☆ will show up here",
  "Carregant programació…": "Loading the schedule…",
  "No s'ha pogut carregar la programació": "Couldn't load the schedule",
  "No hi ha programació per a aquest dia": "Nothing scheduled for this day",
  "Carregant…": "Loading…",
  "Canals en directe": "Live channels",
  "No disponible": "Not available",
  "Ara: {0}": "Now: {0}",
  "Error de connexió ({0})": "Connection error ({0})",
  "Error de connexió": "Connection error",
  "No hi ha vídeos disponibles": "No videos available",
  "Últims capítols publicats": "Latest episodes",
  "Programes de la A a la Z": "Shows from A to Z",
  "Carregant programes…": "Loading shows…",
  "Escriu per cercar entre els programes": "Type to search the shows",
  "Prem OK per escriure": "Press OK to type",
  "Cap programa coincideix amb «{0}»": "No show matches “{0}”",
  "{0} programa": "{0} show",
  "{0} programes": "{0} shows",
  "❚❚ En pausa": "❚❚ Paused",
  "No s'ha pogut reproduir aquest vídeo": "Couldn't play this video",
  "Comença en {0} s": "Starts in {0} s",
  "Subtítols: {0}": "Subtitles: {0}",
  "Subtítols desactivats": "Subtitles off",
  "Aquest vídeo no té subtítols": "This video has no subtitles",
  "No s'han pogut carregar els subtítols": "Couldn't load the subtitles",
  "Aquest canal no està disponible ara": "This channel isn't available now",
  "{0} · en directe": "{0} · live",
  "Carregant vídeo…": "Loading video…",
  "No s'ha pogut obtenir el vídeo": "Couldn't get the video",
  "Aquest vídeo només està en un format que aquesta TV no pot reproduir": "This video only comes in a format this TV can't play",
  "Subtítols: {0} (▲ per canviar)": "Subtitles: {0} (▲ to change)",
  "Té subtítols: prem ▲ per activar-los": "Subtitles available: press ▲ to turn them on",
  "Afegit als meus programes": "Added to my shows",
  "Tret dels meus programes": "Removed from my shows",
  "Cerca un programa…": "Search for a show…",
  "OK pausa · ◀ ▶ 10 s (mantén: 60 s) · ▲ subtítols · ENRERE sortir": "OK pause · ◀ ▶ 10 s (hold: 60 s) · ▲ subtitles · BACK exit",
  "Següent capítol": "Next episode",
  "OK per començar-lo ara · ENRERE per sortir": "OK to start it now · BACK to exit",
  "Idioma: {0}": "Language: {0}"
};
