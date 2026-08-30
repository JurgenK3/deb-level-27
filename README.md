# Deb: Level 27

Mini-gioco web mobile-first per un compleanno: 27 micro-livelli arcade ispirati alla vita di Deb.

## Caratteristiche

- HTML, CSS e JavaScript puro, senza backend o dipendenze
- ottimizzato per touch e Safari su iPhone
- 27 livelli: drag, corsa, schivata, raccolta, timing, memory, equilibrio e boss finale
- progressi salvati solo nel browser tramite `localStorage`
- nessun dato inviato a servizi esterni
- finale con coriandoli e pulsante regalo placeholder

## Avvio locale

Aprire `index.html` oppure servire la cartella con un qualsiasi server statico.

## Modificare il regalo

In `game.js`, nella funzione `finale()`, sostituire il contenuto del gestore `data-gift`. È possibile cambiare la schermata placeholder o impostare un link con `window.location.href = "..."`.

## Pubblicazione

Il progetto è pensato per GitHub Pages e non richiede una fase di build.
