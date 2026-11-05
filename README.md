# One Pace Tracker – Wano

Persönlicher Tracker für Onigashima Paced + End of Wano: Drive-Player direkt auf der Seite, „Next up“, gesehene Folgen, Sync zwischen Laptop, iPad und Handy.

- **Seite:** `index.html` (GitHub Pages)
- **Sync-Speicher:** `apps-script/Code.gs` (Google Apps Script Web-App im eigenen Google-Konto, geschützt per Schlüssel)

## Einrichtung Sync (einmalig)

1. [script.google.com](https://script.google.com) → **Neues Projekt** → Inhalt von `apps-script/Code.gs` einfügen → Speichern.
2. Im Funktions-Dropdown **`setup`** wählen → **Ausführen** → Berechtigungen erlauben.
   Im Ausführungsprotokoll steht dein **Schlüssel**.
3. **Bereitstellen → Neue Bereitstellung** → Typ **Web-App**
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
   → Web-App-URL (endet auf `/exec`) kopieren.
4. Tracker öffnen → ⚙ → URL + Schlüssel eintragen → **Verbinden**.
5. ⚙ → **Geräte-Link kopieren** → auf iPad/Handy einmal öffnen. Fertig.

Bei Code-Änderungen am Script: **Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Version: Neue Version** (dann bleibt die URL gleich).

## Zeitstempel

- **Manuell (überall):** unter dem Player Zeit eintippen (`1725` = 17:25) → „Zeit speichern“. Auf jedem Gerät erscheint dann „▶ Ab 17:25 weiterschauen“.
- **Automatisch (Userscript):** speichert die Position bei Pause, alle ~10 s während der Wiedergabe und beim Schließen; springt beim Laden an die gespeicherte Stelle.
  Installation: [userscript/onepace-autotime.user.js](https://raw.githubusercontent.com/MowDow/onepace-tracker/main/userscript/onepace-autotime.user.js) öffnen
  - Laptop: Erweiterung **Tampermonkey** (Chrome/Edge/Firefox) installieren, dann den Link öffnen → „Installieren“.
  - iPad/iPhone: App **Userscripts** (App Store, kostenlos) → in Safari als Erweiterung aktivieren und „Immer erlauben“ für alle Websites → Link in Safari öffnen → installieren.
  - Android: Chrome kann keine Erweiterungen – **Firefox** + Tampermonkey nutzen.

## Daten

Episodenliste aus der Tabelle „Onigashima Paced Info“, Stand 05.11.2026. Bei neu hochgeladenen Folgen ändern sich die Drive-IDs → Liste neu erzeugen.
