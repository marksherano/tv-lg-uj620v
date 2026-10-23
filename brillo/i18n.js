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
  "Ajustos d'imatge": 'Ajustes de imagen',
  'Perfils': 'Perfiles',
  'Programació horària': 'Programación horaria',
  "◀ ▶ canviar valor · ▲ ▼ moure's · OK aplicar / desar · ENRERE sortir": '◀ ▶ cambiar valor · ▲ ▼ moverse · OK aplicar / guardar · ATRÁS salir',
  'Llum de fons': 'Luz de fondo',
  'Brillantor': 'Brillo',
  'Contrast': 'Contraste',
  'Color': 'Color',
  'Nitidesa': 'Nitidez',
  'Temperatura': 'Temperatura',
  'Estalvi energia': 'Ahorro energía',
  'Confort visual': 'Confort visual',
  'Atenuació local': 'Atenuación local',
  'Contrast dinàmic': 'Contraste dinámico',
  'Gamma': 'Gamma',
  'No': 'No', 'Sí': 'Sí', 'Mín': 'Mín', 'Mitjà': 'Medio', 'Màx': 'Máx', 'Auto': 'Auto',
  'Baixa': 'Baja', 'Mitjana': 'Media', 'Alta': 'Alta', 'Baix': 'Bajo', 'Alt': 'Alto',
  'Alta 1': 'Alta 1', 'Alta 2': 'Alta 2',
  'Dia': 'Día', 'Tarda': 'Tarde', 'Nit': 'Noche', 'Cinema': 'Cine', 'Matí': 'Mañana',
  'Llum 90 · sense estalvi': 'Luz 90 · sin ahorro',
  'Llum 60 · to neutre': 'Luz 60 · tono neutro',
  'Llum 25 · confort visual': 'Luz 25 · confort visual',
  'Llum 40 · atenuació local': 'Luz 40 · atenuación local',
  'Personal {0}': 'Personal {0}',
  'Llum {0} · Bri. {1}': 'Luz {0} · Bri. {1}',
  'buit': 'vacío',
  'OK aplica': 'OK aplica',
  'OK aplica · ▶ desa': 'OK aplica · ▶ guarda',
  'OK desa': 'OK guarda',
  'Automàtic': 'Automático',
  '◀ ▶ hora (15 min) · OK canvia el perfil': '◀ ▶ hora (15 min) · OK cambia el perfil',
  'Idioma': 'Idioma',
  'OK canvia': 'OK cambia',
  'Entrada: {0}': 'Entrada: {0}',
  'Mode: {0}': 'Modo: {0}',
  'No puc llegir els ajustos: {0}': 'No puedo leer los ajustes: {0}',
  'Error en aplicar: {0}': 'Error al aplicar: {0}',
  "No s'ha pogut desar la configuració": 'No se ha podido guardar la configuración',
  'Programació activada': 'Programación activada',
  'Programació desactivada': 'Programación desactivada',
  'Desat a Personal {0}': 'Guardado en Personal {0}',
  'Perfil {0} aplicat': 'Perfil {0} aplicado',
  'Personal {0} aplicat': 'Personal {0} aplicado'
};

var T_EN = {
  "Ajustos d'imatge": 'Picture settings',
  'Perfils': 'Profiles',
  'Programació horària': 'Schedule',
  "◀ ▶ canviar valor · ▲ ▼ moure's · OK aplicar / desar · ENRERE sortir": '◀ ▶ change value · ▲ ▼ move · OK apply / save · BACK exit',
  'Llum de fons': 'Backlight',
  'Brillantor': 'Brightness',
  'Contrast': 'Contrast',
  'Color': 'Colour',
  'Nitidesa': 'Sharpness',
  'Temperatura': 'Temperature',
  'Estalvi energia': 'Energy saving',
  'Confort visual': 'Eye comfort',
  'Atenuació local': 'Local dimming',
  'Contrast dinàmic': 'Dynamic contrast',
  'Gamma': 'Gamma',
  'No': 'Off', 'Sí': 'On', 'Mín': 'Min', 'Mitjà': 'Medium', 'Màx': 'Max', 'Auto': 'Auto',
  'Baixa': 'Low', 'Mitjana': 'Medium', 'Alta': 'High', 'Baix': 'Low', 'Alt': 'High',
  'Alta 1': 'High 1', 'Alta 2': 'High 2',
  'Dia': 'Day', 'Tarda': 'Evening', 'Nit': 'Night', 'Cinema': 'Cinema', 'Matí': 'Morning',
  'Llum 90 · sense estalvi': 'Backlight 90 · no saving',
  'Llum 60 · to neutre': 'Backlight 60 · neutral tone',
  'Llum 25 · confort visual': 'Backlight 25 · eye comfort',
  'Llum 40 · atenuació local': 'Backlight 40 · local dimming',
  'Personal {0}': 'Custom {0}',
  'Llum {0} · Bri. {1}': 'Backlight {0} · Bri. {1}',
  'buit': 'empty',
  'OK aplica': 'OK applies',
  'OK aplica · ▶ desa': 'OK applies · ▶ saves',
  'OK desa': 'OK saves',
  'Automàtic': 'Automatic',
  '◀ ▶ hora (15 min) · OK canvia el perfil': '◀ ▶ time (15 min) · OK changes the profile',
  'Idioma': 'Language',
  'OK canvia': 'OK changes',
  'Entrada: {0}': 'Input: {0}',
  'Mode: {0}': 'Mode: {0}',
  'No puc llegir els ajustos: {0}': "Can't read the settings: {0}",
  'Error en aplicar: {0}': 'Error applying: {0}',
  "No s'ha pogut desar la configuració": "Couldn't save the settings",
  'Programació activada': 'Schedule on',
  'Programació desactivada': 'Schedule off',
  'Desat a Personal {0}': 'Saved to Custom {0}',
  'Perfil {0} aplicat': '{0} profile applied',
  'Personal {0} aplicat': 'Custom {0} applied'
};
