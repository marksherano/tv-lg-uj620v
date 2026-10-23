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
  "Adreça del servidor": "Dirección del servidor",
  "Usuari i contrasenya": "Usuario y contraseña",
  "Usuari": "Usuario",
  "Contrasenya": "Contraseña",
  "Entra": "Entrar",
  "▲ ▼ per moure't · OK per escriure o triar. Pots escriure amb el teclat del mòbil (Comandament → Teclat).": "▲ ▼ para moverte · OK para escribir o elegir. Puedes escribir con el teclado del móvil (Mando → Teclado).",
  "Cerca pel·lícules, sèries o capítols…": "Busca películas, series o capítulos…",
  "OK pausa · ◀ ▶ 10 s (mantén: 60 s) · ▲ subtítols · ▼ àudio · ENRERE sortir": "OK pausa · ◀ ▶ 10 s (mantén: 60 s) · ▲ subtítulos · ▼ audio · ATRÁS salir",
  "A continuació": "A continuación",
  "OK per començar-lo ara · ENRERE per cancel·lar": "OK para empezarlo ahora · ATRÁS para cancelar",
  "Carregant…": "Cargando…",
  "A–Z": "A–Z",
  "Novetats": "Novedades",
  "No vistos": "No vistos",
  "Any": "Año",
  "Aleatori": "Aleatorio",
  "Original": "Original",
  "Inici": "Inicio",
  "Cerca": "Buscar",
  "Ajustos": "Ajustes",
  "T": "T",
  "La sessió ha caducat: torna a entrar": "La sesión ha caducado: vuelve a entrar",
  "resposta invàlida": "respuesta no válida",
  "sense connexió amb el servidor": "sin conexión con el servidor",
  "No es pot connectar amb el servidor ({0})": "No se puede conectar con el servidor ({0})",
  "La biblioteca és buida": "La biblioteca está vacía",
  "Continuar veient": "Seguir viendo",
  "Següents capítols": "Siguientes capítulos",
  "Novetats a {0}": "Novedades en {0}",
  "{0} · {1} títol": "{0} · {1} título",
  "{0} · {1} títols": "{0} · {1} títulos",
  "Error: {0}": "Error: {0}",
  "Aquí no hi ha res": "Aquí no hay nada",
  "Carregant capítols…": "Cargando capítulos…",
  "Temporada {0}": "Temporada {0}",
  "Especials": "Especiales",
  "Aquesta sèrie no té capítols": "Esta serie no tiene capítulos",
  "Àudio: {0}": "Audio: {0}",
  "Subtítols: {0}": "Subtítulos: {0}",
  "▶ Continua ({0})": "▶ Continuar ({0})",
  "Des del principi": "Desde el principio",
  "▶ Reprodueix": "▶ Reproducir",
  "Marca com a no vist": "Marcar como no visto",
  "✓ Marca com a vist": "✓ Marcar como visto",
  "Tots els capítols": "Todos los capítulos",
  "No s'ha pogut desar ({0})": "No se ha podido guardar ({0})",
  "Marcat com a vist": "Marcado como visto",
  "Marcat com a no vist": "Marcado como no visto",
  "Escriu per cercar (amb el teclat de la TV o el del mòbil)": "Escribe para buscar (con el teclado de la TV o el del móvil)",
  "Prem OK per escriure": "Pulsa OK para escribir",
  "Cercant…": "Buscando…",
  "Pel·lícules": "Películas",
  "Sèries": "Series",
  "Capítols": "Capítulos",
  "{0} resultat": "{0} resultado",
  "{0} resultats": "{0} resultados",
  "No hi ha res que coincideixi amb «{0}»": "No hay nada que coincida con «{0}»",
  "Qualitat màxima (si la xarxa va justa, el servidor converteix el vídeo a menys qualitat)": "Calidad máxima (si la red va justa, el servidor convierte el vídeo a menos calidad)",
  "Tanca la sessió": "Cerrar sesión",
  "Compte": "Cuenta",
  "Idioma": "Idioma",
  "Connectat a {0} com a {1}": "Conectado a {0} como {1}",
  "Escriu l'adreça del servidor Jellyfin": "Escribe la dirección del servidor Jellyfin",
  "Connectant amb {0}…": "Conectando con {0}…",
  "resposta estranya": "respuesta extraña",
  "No hi ha cap servidor Jellyfin a {0} ({1})": "No hay ningún servidor Jellyfin en {0} ({1})",
  "Quick Connect està desactivat al servidor: entra amb usuari i contrasenya": "Quick Connect está desactivado en el servidor: entra con usuario y contraseña",
  "Al mòbil o l'ordinador, obre Jellyfin ({0}) → el teu usuari → <b>Quick Connect</b> i escriu:": "En el móvil o el ordenador, abre Jellyfin ({0}) → tu usuario → <b>Quick Connect</b> y escribe:",
  "Aquesta pantalla entrarà sola quan l'autoritzis.": "Esta pantalla entrará sola cuando lo autorices.",
  "Error en entrar: {0}": "Error al entrar: {0}",
  "Escriu l'usuari": "Escribe el usuario",
  "Entrant…": "Entrando…",
  "Usuari o contrasenya incorrectes": "Usuario o contraseña incorrectos",
  "No es pot connectar amb {0} ({1}). Torna-ho a provar quan el servidor estigui engegat.": "No se puede conectar con {0} ({1}). Vuelve a probar cuando el servidor esté encendido.",
  "❚❚ En pausa": "❚❚ En pausa",
  "Pista {0}": "Pista {0}",
  "El servidor no ho permet ({0})": "El servidor no lo permite ({0})",
  "No s'ha trobat el vídeo": "No se ha encontrado el vídeo",
  "Aquest vídeo no es pot reproduir en aquesta TV": "Este vídeo no se puede reproducir en esta TV",
  "Subtítols: {0} (▲ per canviar)": "Subtítulos: {0} (▲ para cambiar)",
  "Té subtítols: prem ▲ per activar-los": "Tiene subtítulos: pulsa ▲ para activarlos",
  "Salta la intro": "Saltar la intro",
  "Salta el resum": "Saltar el resumen",
  "Salta l'anunci": "Saltar el anuncio",
  "Salta l'avançament": "Saltar el avance",
  "Salta els crèdits": "Saltar los créditos",
  "Comença en {0} s": "Empieza en {0} s",
  "No s'ha pogut reproduir aquest vídeo": "No se ha podido reproducir este vídeo",
  "Només hi ha una pista d'àudio": "Solo hay una pista de audio",
  "Subtítols desactivats": "Subtítulos desactivados",
  "Aquest vídeo no té subtítols de text": "Este vídeo no tiene subtítulos de texto",
  "No s'han pogut carregar els subtítols": "No se han podido cargar los subtítulos",
  "Qualitat màxima: {0}": "Calidad máxima: {0}",
  "Sessió tancada": "Sesión cerrada"
};

var T_EN = {
  "Adreça del servidor": "Server address",
  "Usuari i contrasenya": "User and password",
  "Usuari": "User",
  "Contrasenya": "Password",
  "Entra": "Sign in",
  "▲ ▼ per moure't · OK per escriure o triar. Pots escriure amb el teclat del mòbil (Comandament → Teclat).": "▲ ▼ to move · OK to type or choose. You can type with the phone keyboard (Remote → Keyboard).",
  "Cerca pel·lícules, sèries o capítols…": "Search movies, shows or episodes…",
  "OK pausa · ◀ ▶ 10 s (mantén: 60 s) · ▲ subtítols · ▼ àudio · ENRERE sortir": "OK pause · ◀ ▶ 10 s (hold: 60 s) · ▲ subtitles · ▼ audio · BACK exit",
  "A continuació": "Up next",
  "OK per començar-lo ara · ENRERE per cancel·lar": "OK to start it now · BACK to cancel",
  "Carregant…": "Loading…",
  "A–Z": "A–Z",
  "Novetats": "Recently added",
  "No vistos": "Unwatched",
  "Any": "Year",
  "Aleatori": "Random",
  "Original": "Original",
  "Inici": "Home",
  "Cerca": "Search",
  "Ajustos": "Settings",
  "T": "S",
  "La sessió ha caducat: torna a entrar": "Your session expired: sign in again",
  "resposta invàlida": "invalid response",
  "sense connexió amb el servidor": "no connection to the server",
  "No es pot connectar amb el servidor ({0})": "Can't connect to the server ({0})",
  "La biblioteca és buida": "The library is empty",
  "Continuar veient": "Continue watching",
  "Següents capítols": "Next up",
  "Novetats a {0}": "Recently added in {0}",
  "{0} · {1} títol": "{0} · {1} title",
  "{0} · {1} títols": "{0} · {1} titles",
  "Error: {0}": "Error: {0}",
  "Aquí no hi ha res": "Nothing here",
  "Carregant capítols…": "Loading episodes…",
  "Temporada {0}": "Season {0}",
  "Especials": "Specials",
  "Aquesta sèrie no té capítols": "This show has no episodes",
  "Àudio: {0}": "Audio: {0}",
  "Subtítols: {0}": "Subtitles: {0}",
  "▶ Continua ({0})": "▶ Resume ({0})",
  "Des del principi": "From the start",
  "▶ Reprodueix": "▶ Play",
  "Marca com a no vist": "Mark as unwatched",
  "✓ Marca com a vist": "✓ Mark as watched",
  "Tots els capítols": "All episodes",
  "No s'ha pogut desar ({0})": "Couldn't save ({0})",
  "Marcat com a vist": "Marked as watched",
  "Marcat com a no vist": "Marked as unwatched",
  "Escriu per cercar (amb el teclat de la TV o el del mòbil)": "Type to search (with the TV keyboard or the phone one)",
  "Prem OK per escriure": "Press OK to type",
  "Cercant…": "Searching…",
  "Pel·lícules": "Movies",
  "Sèries": "Shows",
  "Capítols": "Episodes",
  "{0} resultat": "{0} result",
  "{0} resultats": "{0} results",
  "No hi ha res que coincideixi amb «{0}»": "Nothing matches “{0}”",
  "Qualitat màxima (si la xarxa va justa, el servidor converteix el vídeo a menys qualitat)": "Maximum quality (if the network is slow, the server converts the video to a lower quality)",
  "Tanca la sessió": "Sign out",
  "Compte": "Account",
  "Idioma": "Language",
  "Connectat a {0} com a {1}": "Connected to {0} as {1}",
  "Escriu l'adreça del servidor Jellyfin": "Type the address of the Jellyfin server",
  "Connectant amb {0}…": "Connecting to {0}…",
  "resposta estranya": "unexpected response",
  "No hi ha cap servidor Jellyfin a {0} ({1})": "No Jellyfin server at {0} ({1})",
  "Quick Connect està desactivat al servidor: entra amb usuari i contrasenya": "Quick Connect is disabled on the server: sign in with user and password",
  "Al mòbil o l'ordinador, obre Jellyfin ({0}) → el teu usuari → <b>Quick Connect</b> i escriu:": "On your phone or computer, open Jellyfin ({0}) → your user → <b>Quick Connect</b> and type:",
  "Aquesta pantalla entrarà sola quan l'autoritzis.": "This screen will sign in by itself once you authorise it.",
  "Error en entrar: {0}": "Error signing in: {0}",
  "Escriu l'usuari": "Type the user name",
  "Entrant…": "Signing in…",
  "Usuari o contrasenya incorrectes": "Wrong user or password",
  "No es pot connectar amb {0} ({1}). Torna-ho a provar quan el servidor estigui engegat.": "Can't connect to {0} ({1}). Try again when the server is on.",
  "❚❚ En pausa": "❚❚ Paused",
  "Pista {0}": "Track {0}",
  "El servidor no ho permet ({0})": "The server doesn't allow it ({0})",
  "No s'ha trobat el vídeo": "Video not found",
  "Aquest vídeo no es pot reproduir en aquesta TV": "This video can't be played on this TV",
  "Subtítols: {0} (▲ per canviar)": "Subtitles: {0} (▲ to change)",
  "Té subtítols: prem ▲ per activar-los": "Subtitles available: press ▲ to turn them on",
  "Salta la intro": "Skip intro",
  "Salta el resum": "Skip recap",
  "Salta l'anunci": "Skip ad",
  "Salta l'avançament": "Skip preview",
  "Salta els crèdits": "Skip credits",
  "Comença en {0} s": "Starts in {0} s",
  "No s'ha pogut reproduir aquest vídeo": "Couldn't play this video",
  "Només hi ha una pista d'àudio": "There is only one audio track",
  "Subtítols desactivats": "Subtitles off",
  "Aquest vídeo no té subtítols de text": "This video has no text subtitles",
  "No s'han pogut carregar els subtítols": "Couldn't load the subtitles",
  "Qualitat màxima: {0}": "Maximum quality: {0}",
  "Sessió tancada": "Signed out"
};
