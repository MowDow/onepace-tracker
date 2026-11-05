/**
 * One Pace Tracker – Sync-Speicher (Google Apps Script)
 *
 * Speichert den Fortschritt als JSON in den Script-Properties deines Google-Kontos.
 * Zugriff nur mit dem geheimen Schlüssel (TOKEN), den du unten in setup() erzeugst.
 *
 * Einrichtung:
 *  1. script.google.com → Neues Projekt → diesen Code einfügen → Speichern.
 *  2. Oben im Dropdown "setup" auswählen → Ausführen → Berechtigung erlauben.
 *     Im Ausführungsprotokoll erscheint dein Schlüssel (TOKEN). Kopieren.
 *  3. Bereitstellen → Neue Bereitstellung → Typ "Web-App"
 *       Ausführen als: Ich
 *       Zugriff: Jeder
 *     → Bereitstellen → Web-App-URL kopieren (endet auf /exec).
 */

const KEY_STATE = 'STATE_onepace';
const KEY_TOKEN = 'TOKEN';

/** Einmal manuell ausführen: erzeugt den geheimen Schlüssel und zeigt ihn im Protokoll. */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty(KEY_TOKEN);
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
    props.setProperty(KEY_TOKEN, token);
  }
  Logger.log('Dein Schlüssel (TOKEN): ' + token);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function authorized_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty(KEY_TOKEN);
  return !!expected && token === expected;
}

/** Lesen: GET …/exec?token=… */
function doGet(e) {
  const token = e && e.parameter ? e.parameter.token : '';
  if (!authorized_(token)) return json_({ ok: false, error: 'unauthorized' });
  const raw = PropertiesService.getScriptProperties().getProperty(KEY_STATE);
  return json_({ ok: true, state: raw ? JSON.parse(raw) : null });
}

/**
 * Schreiben: POST …/exec mit Body {token, state} (als text/plain).
 * Ältere Stände (updatedAt kleiner als gespeichert) werden nicht übernommen.
 */
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
  if (!authorized_(body.token)) return json_({ ok: false, error: 'unauthorized' });
  const state = body.state;
  if (!state || typeof state !== 'object') return json_({ ok: false, error: 'bad_state' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty(KEY_STATE);
    const current = raw ? JSON.parse(raw) : null;
    if (current && (current.updatedAt || 0) > (state.updatedAt || 0)) {
      return json_({ ok: true, stale: true, state: current });
    }
    const out = JSON.stringify(state);
    if (out.length > 8500) return json_({ ok: false, error: 'too_large' }); // Property-Limit ~9 KB
    props.setProperty(KEY_STATE, out);
    return json_({ ok: true, state: state });
  } finally {
    lock.releaseLock();
  }
}
