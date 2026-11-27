# «Il Mondo di [Nome]» · prototipo interno v0.2

| Campo | Valore |
|---|---|
| Ambito | Edizione Compleanno · **solo Mondo 1 «Le radici»**: L1 «Primi passi» (platform), L2 «Il Bruco Goloso» (serpente), L3 «La Porta dei Ricordi» (quiz) |
| Specifiche | `03-design/gdd-v0.1.md` (§1.2, §2.0–2.1, §3, §4, §5, §7) · `04-creative/direzioni-artistiche-v0.1.md` (direzione B «Album di Carta», tecnica A) |
| Decisioni di Jurgen applicate | Ritaglio della testa **completamente automatico** (con «Rifai ritaglio» facoltativo) · corpi uomo e donna (bambino e bambina previsti, non inclusi) · voucher non incluso nel prototipo |
| Stato | Prototipo interno **non destinato alla vendita né ai clienti**. Grafica segnaposto. |
| Versione | **v0.2** — correzioni del ciclo QA su proto-v0.1 (vedi «Changelog» e `CORREZIONI.md`). La v0.1 resta invariata in `06-prototipi/proto-v0.1/`. |
| Data | 27/11/2026 |

## Come avviarlo

```bash
cd /home/box/progetto-giochi/06-prototipi/proto-v0.2
python3 -m http.server 8765
# poi apri http://localhost:8765/ nel browser
```

Va servito da un server (anche quello sopra): aperto con doppio clic (`file://`) i moduli JS e il modello del volto non si caricano.
Per provarlo da telefono o tablet sulla stessa rete Wi-Fi: `python3 -m http.server 8765 --bind 0.0.0.0` e apri `http://<IP-del-computer>:8765/`. Nota: alcuni browser mobili limitano funzioni su HTTP non locale; il rilevamento del volto non richiede la fotocamera, quindi di norma funziona lo stesso.

## Cosa contiene

```
index.html            schermate: configurazione, mappa, livello (canvas), quiz, vittoria, pausa
css/style.css         stile «Album di Carta»: palette Compleanno B, pannelli di carta, HUD a strisce, tasti touch
js/main.js            stato, salvataggio locale, configurazione, mappa, avvio livelli, pausa, «Prosegui comunque», vittoria
js/face.js            rilevamento del volto (MediaPipe) e ritaglio automatico ovale con bordo sticker
js/character.js       corpi SVG originali (uomo, donna) + testa fotografica, proporzione testa:corpo 1:1,5
js/paper.js           texture di carta generata nel browser, forme «strappate», coriandoli, candeline, Nuvolette
js/level1.js          L1 «Primi passi»
js/level2.js          L2 «Il Bruco Goloso»
js/level3.js          L3 «La Porta dei Ricordi»
lib/mediapipe/        MediaPipe Tasks Vision 1.2.3 (bundle JS + WebAssembly), licenza Apache-2.0
models/               blaze_face_short_range.tflite (modello MediaPipe Face Detector), licenza Apache-2.0
fonts/                Fraunces 700 e Atkinson Hyperlegible 400/700 (WOFF2) + testi della licenza OFL
test/e2e.mjs          test automatico end-to-end (Playwright)
test-assets/          immagini SOLO per i test (vedi sotto)
screenshots/          schermate prodotte dal test
```

### Flusso
1. **Configurazione** (simula il modulo del cliente, GDD §5): nome (2–16 caratteri, controllo del formato), forma grammaticale, età (preseleziona la modalità: Passeggiata sotto i 9 e dai 65 anni, altrimenti Avventura), modalità, corpo uomo/donna, foto del volto, consenso (testo provvisorio), 4 domande quiz precompilate con l'esempio fittizio del GDD §8 e modificabili.
2. **Ritaglio automatico**: la foto viene ridotta a max 1280 px nel browser, il volto viene trovato da MediaPipe, la testa viene ritagliata in un ovale 4:5 (≈1,55 × la larghezza del volto, centro alzato per includere i capelli), raddrizzata con la linea degli occhi (max ±15°), solo scala uniforme. Nessun bordo, contorno o cornice (v0.3, decisione di Jurgen del 27/11): resta solo la testa scontornata, con il bordo dell'ovale leggermente sfumato. Anteprima subito sul corpo scelto. **«Rifai ritaglio» è facoltativo**: cicla tra inquadratura standard, più larga e più stretta e, se la foto ha più volti, passa al volto successivo. Se il volto non c'è appare un messaggio e si chiede un'altra foto.
3. **Mappa del Mondo 1** come pagina d'album: sentiero cucito, tappe a bottone (64 px), lucchetti, stelle per tappa e totale, segnaposto con la testa del festeggiato, polaroid della cartolina che si riempie quando la si trova in L1, riquadro «Mondo 2 non incluso».
4. **L1 «Primi passi»**: scorrimento laterale nel giardino di casa (casetta con altalena), ~8.000 unità di percorso, 35 candeline, buche, piattaforme di cartoncino, Nuvolette Brontolone (si eliminano saltandoci sopra e scoppiano in coriandoli, di lato costano una vita), cartolina su una piattaforma alta, girandole come checkpoint, arco di palloncini come traguardo. Cartello del salto all'inizio; **nessun nemico prima di x=2000 e comunque nessuno nei primi 20 s**. Salto più alto tenendo premuto, tolleranze (coyote time, comando memorizzato, area di collisione ridotta) per modalità.
5. **L2 «Il Bruco Goloso»**: griglia a quadretti senza pareti (v0.3): uscendo da un lato il bruco rientra dal lato opposto, testa del bruco = testa fotografica (≥28 px CSS), dolcetti (+1), fetta di torta bonus ogni 5 dolcetti per 6 s (+2). Solo urtare la propria coda costa una vita; vite finite: Avventura riparte con la lunghezza dimezzata, Sfida da capo.
6. **L3 «La Porta dei Ricordi»**: 3 domande scelte a caso tra quelle complete, 4 risposte (3 in Passeggiata; 2 per vero/falso), commento di chi regala dopo ogni risposta, aiuto «elimina una risposta sbagliata» (sempre in Passeggiata, 1 volta in Avventura, mai in Sfida), 15 s per domanda in Sfida. La porta si apre sempre; stelle = risposte giuste.
7. **Vittoria**: personaggio grande (≥120 px), stelle 0–3, testo concordato col genere («Brava/Bravo/Ottimo lavoro»), sblocco della tappa successiva.

### Comandi
| | Tastiera | Touch |
|---|---|---|
| L1 | ← → o A D; Spazio, ↑ o W per saltare | ◀ ▶ in basso a sinistra, Salto in basso a destra (68–88 px) |
| L2 | Frecce o WASD | Scorrimento del dito; croce a schermo opzionale (pulsante «Croce: sì/no») |
| L3 | 1–4, oppure frecce + Invio | Tocco sulla risposta (pulsanti alti 56 px) |
| Pausa | Esc o P | Tasto in alto a destra (52 px): riprendi, ricomincia, cambia modalità, mappa |

### Modalità (GDD §3.2)
| | Passeggiata | Avventura | Sfida |
|---|---|---|---|
| Vite | infinite (un urto fa arretrare) | 5 | 3 |
| Velocità | 65% | 100% | 120% |
| Checkpoint L1 | ~ogni 1000 u | ~ogni 2000 u | solo a metà |
| Nemici L1 | 50% | 100% | 120% (+1) |
| Lunghezza L2 | 12 | 20 | 28 |
| «Prosegui comunque» | — | dopo 3 sconfitte | dopo 3 sconfitte |

### Stelle
- L1: 1 = completato · 2 = ≥80% delle candeline · 3 = ≥80% + cartolina (GDD §2.0).
- L2 (regola provvisoria, da tarare): 1 = completato · 2 = ≥80% delle torte bonus comparse · 3 = anche senza perdere vite.
- L3: 1 stella per risposta giusta.
- «Prosegui comunque»: 1 stella.

## Privacy: niente esce dal browser
- Nessuna chiamata di rete verso l'esterno: libreria, modello, WebAssembly e font sono serviti dalla cartella. Il test lo verifica registrando tutte le richieste (risultato: **0 richieste esterne**).
- **v0.2:** la foto si può scegliere ed elaborare solo dopo la dichiarazione di consenso (casella non spuntata all'apertura) e, se la persona festeggiata ha meno di 18 anni, anche la dichiarazione di responsabilità genitoriale. Togliendo una dichiarazione la foto e il ritaglio vengono scartati. Informativa breve accanto al caricamento (finalità, nessun invio a server o fornitori esterni, nessun addestramento di IA). Testi provvisori scritti da noi, da validare con un legale.
- La foto originale resta solo in memoria durante la configurazione e viene scartata quando si conferma. Si conserva solo la testa ritagliata (**WebP** 320×400 dove supportato, altrimenti PNG), insieme a nome, domande, progressi e data delle dichiarazioni, nel `localStorage` di quel browser (~40 KB; chiave `mondo-di-nome-proto-v02`, separata dalla v0.1). Se il browser blocca l'archivio locale il gioco funziona in memoria e avvisa che i progressi andranno persi. «Cancella tutti i dati» li elimina.
- Pagina `noindex`.

## Librerie e licenze
| Componente | Versione | Licenza | Uso |
|---|---|---|---|
| MediaPipe Tasks Vision (`@mediapipe/tasks-vision`, Google) | 1.2.3 | Apache-2.0 (`lib/mediapipe/LICENSE-Apache-2.0.txt`) | Rilevamento del volto nel browser (WebAssembly, CPU) |
| Modello BlazeFace short range (`blaze_face_short_range.tflite`, Google MediaPipe) | float16 «latest» al 27/11/2026 | Apache-2.0 (come da model card MediaPipe Face Detector) | Modello di rilevamento del volto |
| Fraunces (Undercase Type) | via `@fontsource/fraunces` | SIL OFL 1.1 (`fonts/OFL-Fraunces.txt`) | Titoli |
| Atkinson Hyperlegible (Braille Institute) | via `@fontsource/atkinson-hyperlegible` | SIL OFL 1.1 (`fonts/OFL-AtkinsonHyperlegible.txt`) | Testi, HUD, quiz |
| playwright-core (solo test, non incluso nel gioco) | 1.x | Apache-2.0 | Test automatico |

Tutta la grafica (corpi, scenari, nemici, oggetti, mappa, texture di carta) è disegnata in codice per questo prototipo: nessun asset esterno, nessun riferimento a marchi o personaggi di terzi.

## Immagini di test
- `test-assets/volto-test-sintetico.jpg`: ritratto **generato** con uno strumento di generazione di immagini, di una persona **inesistente**; serve solo a provare il rilevamento e il ritaglio. Non usarlo in materiali di vendita o marketing.
- `test-assets/qa-sintetica-senza-volto.png`: copia di `05-qa/dati-prova/v0.1/immagini/IMG-QUADRATA.png` (pittogramma sintetico del QA, senza volto), per verificare il caso «volto non trovato».
- `test-assets/qa-*` (v0.2): copie di immagini del QA (`05-qa/report/evidenze-proto-v0.1/immagini-derivate/` D02, D03, D04, D07, D17 e `05-qa/dati-prova/v0.1/immagini/IMG-BASSA-RES.png`), derivate dal volto sintetico o geometriche, per i controlli di qualità del volto. Solo per i test.

## Test automatico
```bash
cd /home/box/progetto-giochi/06-prototipi/proto-v0.2
python3 -m http.server 8765 &          # server locale
(cd test && npm install)               # una volta: installa playwright-core
CHROME=/usr/bin/google-chrome node test/e2e.mjs
```
Il test usa Chrome headless (83 controlli nella v0.2: quelli della v0.1 più le verifiche delle correzioni, marcate «v0.2 QA-PROTO-NNN») e prova: assenza di errori JS e di richieste esterne; volto trovato e ritagliato; immagine senza volto; «Rifai ritaglio»; anteprime uomo/donna; mappa e lucchetti; L1 (movimento, salto, pausa, nemici dopo 20 s, caduta = vita persa, 3 sconfitte → «Prosegui comunque», traguardo); L2 (svolta, crescita, urto con la siepe, vittoria); L3 (risposte da tastiera e mouse, porta, stelle); telefono orizzontale 740×360, telefono verticale 360×640 e tablet 1024×768 con eventi touch (tasti ≥48 px, scorrimento del dito in L2). Alcuni passaggi usano scorciatoie di test (teletrasporto del personaggio, allungamento del bruco) per non dover giocare tutto il livello. Gli screenshot finiscono in `screenshots/`.

## Changelog

### v0.2 — 27/11/2026
Correzioni delle anomalie del report QA `05-qa/report/report-proto-v0.1.md` (registro `05-qa/anomalie/registro-anomalie-v0.2.md`). Dettaglio, stato e verifica per ogni ID in **`CORREZIONI.md`**. Nessuna meccanica di gioco, struttura, stile o personalizzazione cambiata: in L1 ci sono solo due correzioni di equità (comparsa dei nemici, posizione delle girandole), senza nuovi elementi.
- **Consenso e minori** (QA-PROTO-002, 003, 021): casella non spuntata; caricamento foto disattivato finché mancano età valida e dichiarazioni; dichiarazione genitoriale obbligatoria sotto i 18 anni; informativa breve; data delle dichiarazioni salvata.
- **Nome leggibile** (001): titolo della mappa su due righe con il nome intero, mai troncato; su schermi ≤ 480 px il contatore stelle va sotto il titolo e la mappa si sposta sotto l'intestazione.
- **Qualità del volto** (004, 005, 017, 018): confidenza minima 0,7; volti sotto 100 px rifiutati e sotto 200 px con avviso; foto troppo scure rifiutate, poco illuminate/sovraesposte/poco contrastate con avviso; foto capovolte rifiutate (doppio controllo a 180°), inclinazione oltre 15° con avviso; avviso «viso vicino al bordo».
- **Dati senza tagli silenziosi** (006, 015, 016, 024): niente `maxlength` sul nome, contatore «N/16 caratteri (spazi esclusi)» ed errore esplicito oltre 16; nome normalizzato NFC; età intera 6–110 con messaggio (nessun valore sostituito); risposte del quiz tutte diverse.
- **Rete e archivio** (007, 014, 020, 030): rilevatore riprovabile dopo un errore, messaggio «Connessione assente…» e pulsante «Riprova» che conserva il modulo; precaricamento del riconoscimento del volto appena le dichiarazioni sono complete, con barra di avanzamento in percentuale; ogni accesso a `localStorage` protetto con copia in memoria (L2 parte anche senza archivio); avviso se l'archivio è bloccato o pieno; testa salvata in WebP (~37 KB invece di ~240 KB).
- **Ripresa e navigazione** (011, 025, 028): la ricarica riapre la mappa; Indietro durante un livello apre la pausa e un secondo Indietro torna alla mappa; cambiando il nome si chiede se tenere i progressi.
- **Layout** (009, 026, 013): altezze ≤ 420 px con quiz a griglia 2×2 senza porta, vittoria su due colonne, menu di pausa su due colonne e modale scorrevole, «Avanti» portato in vista; con la croce di L2 attiva il campo si sposta fuori dai tasti; ruotando lo schermo durante L2 il gioco si ferma e propone di ricominciare con un campo adatto; avviso «Ruota il telefono» aggiornato a ogni rotazione.
- **Correttezza** (012, 022, 023, 027, 029): un nemico di L1 compare solo se non è addosso al personaggio; girandole ad almeno 120 u dal bordo di una buca davanti; uscita durante «La porta si apre…» senza salto alla vittoria; zoom con le dita non più bloccato; errori gestiti e messaggio XNNPACK registrati come informazioni, non come errori.
- **Test**: `test/e2e.mjs` esteso da 36 a 83 controlli (consenso, minori, 320 px, rete assente, archivio bloccato/pieno, qualità del volto con le immagini derivate del QA copiate in `test-assets/qa-*`, rotazione, cronologia). Esito in `test/ultimo-esito-e2e.log`.
- Testo: «1 risposta giusta su 3» (prima «1 risposte giuste»).
- **Restano aperte** (vedi `CORREZIONI.md`): QA-PROTO-008 (durate, serve nuovo contenuto di design), 010 (mappa verticale dedicata, design del Creative Director), 019 (scelta del volto con più persone: tocca la decisione «ritaglio completamente automatico»).

### v0.1 — 27/11/2026
Prima versione: Mondo 1 (L1–L3), configurazione, ritaglio automatico, mappa, test e2e 36/36.

## Limiti noti (v0.2)
- **Durate da tarare**: L1 si attraversa in meno di 1 minuto correndo, contro i 2–3 minuti del GDD; L2 dura ~1–2 minuti. Valori di velocità e densità sono indicativi.
- **Ritaglio**: provato con una sola foto sintetica frontale (volto trovato con confidenza 0,91) e con un'immagine senza volto. Non provato su foto reali, di profilo, scure, con occhiali scuri, con più persone, su HEIC (non supportato: il browser non lo apre; serve conversione lato server o un decoder). Il modello «short range» funziona meglio quando il volto è grande: per foto con volti piccoli il codice riprova su 5 riquadri sovrapposti, ma non è garantito. L'ovale è calcolato con proporzioni fisse: capelli molto voluminosi possono uscire dal bordo. Nessun controllo sui contenuti inappropriati. Dalla v0.2 ci sono soglie provvisorie di dimensione, confidenza, luce e inclinazione (vedi `js/face.js`, oggetto `QUALITY`), tarate solo su immagini sintetiche.
- **Peso**: il file WebAssembly di MediaPipe è di ~14,7 MB (caricato solo alla prima foto). Per la produzione va valutato un caricamento differito o un modello più leggero.
- **Non inclusi**: accesso con utente e password, server Hetzner, schermata di apertura, prova comandi, comandi semplificati Senior (§3.4), modalità Piccoli/Senior (testo +25%, alto contrasto, lettura vocale), corpi bambino/bambina, foto aggiuntive (la cartolina è un segnaposto disegnato), Mondi 2–4, Festa, scrigno e voucher, audio, schermata di rotazione animata (c'è solo un avviso testuale in verticale su touch), salvataggio sul server.
- **Testi** provvisori; il testo del consenso va validato da un legale.
- **Prove su dispositivi reali**: non fatte. Verifiche solo con Chrome headless (desktop ed emulazione di telefono/tablet con touch). Safari iOS, Firefox e Android reali sono da provare.
- **Accessibilità**: contrasti dalla palette approvata, aree touch ≥48 px, nessun lampeggio oltre 3 Hz; non è stato fatto un audit completo (lettori di schermo, navigazione da tastiera della mappa ecc.).
