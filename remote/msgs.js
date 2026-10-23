/* Language of what the server says (JSON errors, toasts and alerts on the TV), ES5 for node 0.12.
   Each request sets it from the 'lang' cookie the phone pages keep (see i18n.js), else from
   Accept-Language, else English. It is one value for the whole server: node runs one request at a
   time, and a reply that arrives later for another phone in another language is harmless.
   Strings are written in Catalan in the code, like in the apps. */
var LANGS = { ca: 1, es: 1, en: 1 };
var cur = 'en';

function fromRequest(req) {
  var c = /(?:^|;\s*)lang=(ca|es|en)\b/.exec(req.headers.cookie || '');
  if (c) return c[1];
  var al = String(req.headers['accept-language'] || '').toLowerCase().split(',');
  for (var i = 0; i < al.length; i++) {
    var l = al[i].trim().slice(0, 2);
    if (LANGS[l]) return l;
  }
  return 'en';
}

var ES = {
  'origen no permès': 'origen no permitido',
  'nom no permès': 'nombre no permitido',
  'cal POST': 'hace falta POST',
  'tecla desconeguda': 'tecla desconocida',
  'id invàlid': 'id no válido',
  'missatge buit': 'mensaje vacío',
  'valor invàlid': 'valor no válido',
  '📱 Missatge': '📱 Mensaje',
  "D'acord": 'De acuerdo',
  "⏻ La TV s'apagarà d'aquí a {0} (a les {1})": '⏻ La TV se apagará dentro de {0} (a las {1})',
  "⏻ La TV s'apagarà d'aquí a 1 minut": '⏻ La TV se apagará dentro de 1 minuto',
  "⏻ Temporitzador d'apagada cancel·lat": '⏻ Temporizador de apagado cancelado',
  "la TV no obre fotos HEIC: a l'iPhone, Configuració > Càmera > Formats > Més compatible": 'la TV no abre fotos HEIC: en el iPhone, Ajustes > Cámara > Formatos > Más compatible',
  'format no compatible ({0})': 'formato no compatible ({0})',
  'desconegut': 'desconocido',
  'no hi ha prou espai a la TV': 'no hay espacio suficiente en la TV',
  'enllaç no vàlid': 'enlace no válido',
  'fitxer no compatible': 'archivo no compatible',
  'no hi ha cap foto, vídeo ni enllaç': 'no hay ninguna foto, vídeo ni enlace',
  'fitxer no trobat': 'archivo no encontrado',
  'nom invàlid': 'nombre no válido',
  'Només enllaços de YouTube, 3Cat o de fotos i vídeos directes (el servei tvlinks no està configurat)': 'Solo enlaces de YouTube, 3Cat o de fotos y vídeos directos (el servicio tvlinks no está configurado)',
  'resposta estranya del servei tvlinks': 'respuesta extraña del servicio tvlinks',
  "no s'ha trobat el vídeo": 'no se ha encontrado el vídeo',
  'el servei tvlinks ha trigat massa': 'el servicio tvlinks ha tardado demasiado',
  "el servei tvlinks no respon (l'ordinador és encès?)": 'el servicio tvlinks no responde (¿está encendido el ordenador?)',
  'no hi ha cap format que la TV pugui reproduir': 'no hay ningún formato que la TV pueda reproducir',
  'yt-dlp ha trigat massa': 'yt-dlp ha tardado demasiado',
  'Comandament TV': 'Mando TV',
  'Comandament': 'Mando',
  'Comandament i «Envia a la TV» per a la tele de casa': 'Mando y «Envía a la TV» para la tele de casa'
};
var EN = {
  'origen no permès': 'origin not allowed',
  'nom no permès': 'host name not allowed',
  'cal POST': 'POST required',
  'tecla desconeguda': 'unknown key',
  'id invàlid': 'invalid id',
  'missatge buit': 'empty message',
  'valor invàlid': 'invalid value',
  '📱 Missatge': '📱 Message',
  "D'acord": 'OK',
  "⏻ La TV s'apagarà d'aquí a {0} (a les {1})": '⏻ The TV will turn off in {0} (at {1})',
  "⏻ La TV s'apagarà d'aquí a 1 minut": '⏻ The TV will turn off in 1 minute',
  "⏻ Temporitzador d'apagada cancel·lat": '⏻ Sleep timer cancelled',
  "la TV no obre fotos HEIC: a l'iPhone, Configuració > Càmera > Formats > Més compatible": "the TV can't open HEIC photos: on the iPhone, Settings > Camera > Formats > Most Compatible",
  'format no compatible ({0})': 'unsupported format ({0})',
  'desconegut': 'unknown',
  'no hi ha prou espai a la TV': 'not enough space on the TV',
  'enllaç no vàlid': 'invalid link',
  'fitxer no compatible': 'unsupported file',
  'no hi ha cap foto, vídeo ni enllaç': 'no photo, video or link in it',
  'fitxer no trobat': 'file not found',
  'nom invàlid': 'invalid name',
  'Només enllaços de YouTube, 3Cat o de fotos i vídeos directes (el servei tvlinks no està configurat)': 'Only YouTube or 3Cat links, or direct photo and video links (the tvlinks service is not set up)',
  'resposta estranya del servei tvlinks': 'unexpected response from the tvlinks service',
  "no s'ha trobat el vídeo": 'video not found',
  'el servei tvlinks ha trigat massa': 'the tvlinks service took too long',
  "el servei tvlinks no respon (l'ordinador és encès?)": "the tvlinks service doesn't answer (is the computer on?)",
  'no hi ha cap format que la TV pugui reproduir': 'no format the TV can play',
  'yt-dlp ha trigat massa': 'yt-dlp took too long',
  'Comandament TV': 'TV Remote',
  'Comandament': 'TV Remote',
  'Comandament i «Envia a la TV» per a la tele de casa': 'Remote control and “Send to TV” for the home TV'
};

function T(s) {
  var d = cur === 'es' ? ES : cur === 'en' ? EN : null, r = (d && d[s]) || s, a = arguments;
  return a.length > 1 ? r.replace(/\{(\d)\}/g, function (m, i) { return a[+i + 1]; }) : r;
}

module.exports = {
  T: T,
  use: function (req) { cur = fromRequest(req); return cur; },
  lang: function () { return cur; }
};
