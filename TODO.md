# TODO

## Inbox

- (leer)

## User Stories

### Einkaufsliste & Rezepte

- **Rezeptvorlage löschen**
    - Als Nutzer möchte ich eine Rezeptvorlage löschen können, damit ich veraltete oder fehlerhafte Vorlagen entfernen kann.
    - Akzeptanzkriterien:
        - Die Löschung ist in der Vorlagenansicht verfügbar.
        - Es gibt eine Bestätigung, um versehentliches Löschen zu verhindern.
        - Die Rezeptvorlage ist danach nicht mehr auswählbar.

### Einkaufsstatus & Abrechnung

- **Einkaufen-Status per Button setzen**
    - Als Nutzer möchte ich per Button angeben können, dass ich jetzt einkaufen gehe, damit alle anderen Nutzer den aktuellen Einkaufsstatus sehen.
    - Akzeptanzkriterien:
        - Statuswechsel ist für alle sichtbar (z. B. „geht einkaufen“, „war einkaufen“).
        - Zeitstempel wird gespeichert.

- **Nachzügler erfassen (ohne Einfluss auf Einkaufsliste)**
    - Als Nutzer möchte ich mich auch dann noch eintragen können, wenn jemand bereits einkaufen geht/war, damit ich als Nachzügler in der Abrechnung berücksichtigt werde, ohne die Einkaufsliste zu verändern.
    - Akzeptanzkriterien:
        - Eintrag als Nachzügler bleibt möglich, nachdem der Einkaufsstatus gesetzt wurde.
        - Einkaufsliste bleibt unverändert.
        - Nachzügler erscheinen in der Abrechnung.

### Benachrichtigungen

- **Erinnerung kurz vor dem Essenstermin**
    - Als Nutzer möchte ich kurz vor dem Essenstermin eine E‑Mail‑Erinnerung erhalten, damit ich mich ggf. noch ein‑ oder austragen kann.
    - Akzeptanzkriterien:
        - Konfigurierbarer Zeitraum vor dem Termin (z. B. 2–4 Stunden).
        - E‑Mail enthält Link oder klare Hinweise zum Ein‑/Austragen.

## Technische Aufgaben / Sonstiges

- **Abrechnung: E‑Mails versenden**
    - Automatischer Versand der Abrechnungs‑E‑Mails nach Abschluss an alle Teilnehmer außer den abrechnenden.

- **Backend modularisieren**
    - Keine „Gottklasse“, klare Module/Services, bessere Lesbarkeit und Wartbarkeit.
