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
  "Cerca": "Buscar",
  "● ARA · OK directe": "● AHORA · OK directo",
  "OK capítols": "OK capítulos",
  "OK per treure-ho": "OK para quitarlo",
  "Sortirà a la pestanya Inici": "Saldrá en la pestaña Inicio",
  "EN DIRECTE": "EN DIRECTO",
  "Continuar veient": "Seguir viendo",
  "Carregant…": "Cargando…",
  "No disponible": "No disponible",
  "Ara: {0}": "Ahora: {0}",
  "Error de connexió ({0})": "Error de conexión ({0})",
  "Error de connexió": "Error de conexión",
  "No hi ha vídeos disponibles": "No hay vídeos disponibles",
  "Prem OK per escriure": "Pulsa OK para escribir",
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
  "OK pausa · ◀ ▶ 10 s (mantén: 60 s) · ▲ subtítols · ENRERE sortir": "OK pausa · ◀ ▶ 10 s (mantén: 60 s) · ▲ subtítulos · ATRÁS salir",
  "Següent capítol": "Siguiente capítulo",
  "OK per començar-lo ara · ENRERE per sortir": "OK para empezarlo ahora · ATRÁS para salir",
  "Idioma: {0}": "Idioma: {0}",
  "Directe": "Directo",
  "Petits": "Peques",
  "Grans": "Mayores",
  "Novetats": "Novedades",
  "Les meves sèries": "Mis series",
  "A les meves sèries": "En mis series",
  "Afegeix a les meves sèries": "Añadir a mis series",
  "Afegida a les meves sèries": "Añadida a mis series",
  "Treta de les meves sèries": "Quitada de mis series",
  "Aquí sortiran els capítols que deixis a mitges i les sèries que marquis amb ☆": "Aquí saldrán los capítulos que dejes a medias y las series que marques con ☆",
  "SX3 en directe i programació d'avui": "SX3 en directo y programación de hoy",
  "Últims capítols de SX3": "Últimos capítulos de SX3",
  "Carregant sèries…": "Cargando series…",
  "No hi ha sèries disponibles": "No hay series disponibles",
  "Buscant les sèries que tenen capítols… {0}/{1}": "Buscando las series que tienen capítulos… {0}/{1}",
  "Sèries per als més petits": "Series para los más pequeños",
  "Sèries per als més grans": "Series para los mayores",
  "Escriu per cercar entre les sèries": "Escribe para buscar entre las series",
  "Cap sèrie coincideix amb «{0}»": "Ninguna serie coincide con «{0}»",
  "{0} sèrie": "{0} serie",
  "{0} sèries": "{0} series",
  "Cerca una sèrie…": "Busca una serie…"
};

var T_EN = {
  "Inici": "Home",
  "Cerca": "Search",
  "● ARA · OK directe": "● NOW · OK live",
  "OK capítols": "OK episodes",
  "OK per treure-ho": "OK to remove it",
  "Sortirà a la pestanya Inici": "It will show up in Home",
  "EN DIRECTE": "LIVE",
  "Continuar veient": "Continue watching",
  "Carregant…": "Loading…",
  "No disponible": "Not available",
  "Ara: {0}": "Now: {0}",
  "Error de connexió ({0})": "Connection error ({0})",
  "Error de connexió": "Connection error",
  "No hi ha vídeos disponibles": "No videos available",
  "Prem OK per escriure": "Press OK to type",
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
  "OK pausa · ◀ ▶ 10 s (mantén: 60 s) · ▲ subtítols · ENRERE sortir": "OK pause · ◀ ▶ 10 s (hold: 60 s) · ▲ subtitles · BACK exit",
  "Següent capítol": "Next episode",
  "OK per començar-lo ara · ENRERE per sortir": "OK to start it now · BACK to exit",
  "Idioma: {0}": "Language: {0}",
  "Directe": "Live",
  "Petits": "Little ones",
  "Grans": "Older kids",
  "Novetats": "New",
  "Les meves sèries": "My shows",
  "A les meves sèries": "In my shows",
  "Afegeix a les meves sèries": "Add to my shows",
  "Afegida a les meves sèries": "Added to my shows",
  "Treta de les meves sèries": "Removed from my shows",
  "Aquí sortiran els capítols que deixis a mitges i les sèries que marquis amb ☆": "Episodes you leave halfway and shows you mark with ☆ will show up here",
  "SX3 en directe i programació d'avui": "SX3 live and today's schedule",
  "Últims capítols de SX3": "Latest SX3 episodes",
  "Carregant sèries…": "Loading shows…",
  "No hi ha sèries disponibles": "No shows available",
  "Buscant les sèries que tenen capítols… {0}/{1}": "Finding the shows that have episodes… {0}/{1}",
  "Sèries per als més petits": "Shows for little ones",
  "Sèries per als més grans": "Shows for older kids",
  "Escriu per cercar entre les sèries": "Type to search the shows",
  "Cap sèrie coincideix amb «{0}»": "No show matches “{0}”",
  "{0} sèrie": "{0} show",
  "{0} sèries": "{0} shows",
  "Cerca una sèrie…": "Search for a show…"
};
