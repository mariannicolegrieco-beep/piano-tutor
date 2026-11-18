const contenitoreTastiera = document.getElementById('tastiera');
const testoStato = document.getElementById('stato-connessione');
const btnMidi = document.getElementById('btn-midi');
const btnMic = document.getElementById('btn-mic');
const btnPlay = document.getElementById('btn-play');
const btnReset = document.getElementById('btn-reset');
const btnIndietro = document.getElementById('btn-indietro');
const btnAvanti = document.getElementById('btn-avanti');
const btnMani = document.getElementById('btn-mani');
const btnVista = document.getElementById('btn-vista');
const inputSpartito = document.getElementById('input-spartito');
const areaPrincipale = document.getElementById('area-principale');
const areaSpartito = document.getElementById('area-spartito');
const osmdContainer = document.getElementById('osmd-container');
const messaggioGuida = document.getElementById('messaggio-guida');
const canvas = document.getElementById('canvas-cascata');
const ctx = canvas.getContext('2d');

const mappaTasti = {};
let audioCtx = null;
let osmd = null;

// Stato dello studio
let modalitaMani = 'ENTRAMBE'; // 'ENTRAMBE', 'D', 'S'
let modalitaVista = 0; // 0 = Completa, 1 = Pagina Intera, 2 = Solo Cascata
async function richiediResetPassword() {
  const campoEmail = document.getElementById("auth-email");
  const email = prompt("Inserisci l'email con cui ti sei registrato:", campoEmail ? campoEmail.value : "");
  if (!email) return;
  try {
    const res = await fetch("https://granata.pythonanywhere.com/api/piano-richiedi-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() })
    });
    const dati = await res.json();
    if (dati.ok) {
      alert("Richiesta inviata! L'amministratore ha ricevuto l'avviso su Telegram e ti fornirà a breve la nuova password.");
    } else {
      alert(dati.errore || "Email non trovata.");
    }
  } catch (e) {
    alert("Impossibile contattare il server.");
  }
}

let passiSpartito = Array.of(); // Ogni elemento è un passo (accordo o nota singola) del cursore OSMD
let indicePassoCorrente = 0;
let noteInAttesa = Array.of();

// 1. PULSANTI VISTA E SCELTA MANI
btnVista.addEventListener('click', () => {
    modalitaVista = (modalitaVista + 1) % 3;
    areaPrincipale.classList.remove('solo-spartito', 'solo-cascata');

    if (modalitaVista === 0) {
        btnVista.textContent = "📖 Vista: Completa";
    } else if (modalitaVista === 1) {
        btnVista.textContent = "📄 Vista: Pagina Intera";
        areaPrincipale.classList.add('solo-spartito');
    } else {
        btnVista.textContent = "🎹 Vista: Solo Cascata";
        areaPrincipale.classList.add('solo-cascata');
    }

    setTimeout(() => {
        adattaDimensioniCanvas();
        if (osmd) osmd.render();
        disegnaCascata();
    }, 60);
});

btnMani.addEventListener('click', () => {
    if (modalitaMani === 'ENTRAMBE') {
        modalitaMani = 'D';
        btnMani.textContent = "👉 Mani: Solo Destra";
    } else if (modalitaMani === 'D') {
        modalitaMani = 'S';
        btnMani.textContent = "👈 Mani: Solo Sinistra";
    } else {
        modalitaMani = 'ENTRAMBE';
        btnMani.textContent = "👐 Mani: Entrambe";
    }
    preparaPassoCorrente();
    disegnaCascata();
});

// 2. CARICAMENTO DI QUALSIASI FILE MUSICXML (.xml, .musicxml, .mxl)
inputSpartito.addEventListener('change', (evento) => {
    const file = evento.target.files.item(0);
    if (!file) return;

    testoStato.textContent = "Caricamento di " + file.name + "...";
    const reader = new FileReader();

    if (file.name.toLowerCase().endsWith('.mxl')) {
        reader.onload = (e) => caricaSpartitoInOSMD(e.target.result);
        reader.readAsBinaryString(file);
    } else {
        reader.onload = (e) => caricaSpartitoInOSMD(e.target.result);
        reader.readAsText(file);
    }
});

// 3. COSTRUZIONE TASTIERA (88 TASTI)
function creaTastiera() {
    const noteConDiesis = Array.of(1, 3, 6, 8, 10);
    let numeroTastiBianchi = 0;

    for (let midi = 21; midi <= 108; midi++) {
        if (!noteConDiesis.includes(midi % 12)) {
            numeroTastiBianchi++;
        }
    }

    let bianchiInseriti = 0;
    for (let midi = 21; midi <= 108; midi++) {
        const isNero = noteConDiesis.includes(midi % 12);
        const tasto = document.createElement('div');
        tasto.dataset.midi = midi;

        if (!isNero) {
            tasto.className = 'tasto-bianco';
            contenitoreTastiera.appendChild(tasto);
            bianchiInseriti++;
        } else {
            tasto.className = 'tasto-nero';
            const posizionePercentuale = (bianchiInseriti / numeroTastiBianchi) * 100;
            tasto.style.left = posizionePercentuale + '%';
            contenitoreTastiera.appendChild(tasto);
        }

        tasto.addEventListener('mousedown', () => { gestisciNotaPremuta(midi); suonaNotaSintetica(midi, 0.45); });
        tasto.addEventListener('mouseup', () => gestisciNotaRilasciata(midi));
        tasto.addEventListener('mouseleave', () => gestisciNotaRilasciata(midi));

        mappaTasti[midi] = tasto;
    }
}

function suonaNotaSintetica(midi, durataSec) {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const volumeBilanciato = Math.max(0.05, Math.min(0.4, 0.4 - ((midi - 21) / 87) * 0.32));
    gain.gain.setValueAtTime(volumeBilanciato, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + durataSec);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + durataSec);
}

// 4. MOTORE SPARTITO PROFESSIONALE (OSMD) E SINCRONIZZAZIONE
async function inizializzaOSMD() {
    if (typeof opensheetmusicdisplay === 'undefined') {
        osmdContainer.innerHTML = "<p style='color:red; padding:20px;'>Libreria spartiti non caricata. Controlla la connessione internet e ricarica la pagina.</p>";
        return;
    }

    osmdContainer.style.width = areaSpartito.clientWidth + "px";

    osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(osmdContainer, {
        autoResize: false,
        backend: "svg",
        drawingParameters: "compacttight",
        followCursor: true
    });
    await caricaSpartitoInOSMD(spartitoMusicXMLDemo);
}

async function caricaSpartitoInOSMD(contenutoXml) {
    try {
        testoStato.textContent = "Disegno spartito...";
               osmdContainer.style.width = "100%";
        await osmd.load(contenutoXml);
        osmd.zoom = 0.85;
        osmd.render();
        estraiPassiDaOSMD();
        vaiAlPasso(0);
        testoStato.textContent = "Spartito pronto (" + passiSpartito.length + " passi)";
    } catch (errore) {
        osmdContainer.innerHTML = "<p style='color:red; padding:20px;'>Errore spartito: " + errore.message + "</p>";
        testoStato.textContent = "Errore spartito";
    }
}

function estraiPassiDaOSMD() {
    passiSpartito = Array.of();
    const cursore = osmd.cursor;
    cursore.reset();

    let indice = 0;
    while (!cursore.Iterator.EndReached) {
        const voci = cursore.Iterator.CurrentVoiceEntries;
        const noteDelPasso = Array.of();

                voci.forEach(voce => {
            const staffObj = voce.ParentStaff;
            const staffNum = staffObj ? (staffObj.IdInMusicSheet ?? staffObj.id ?? staffObj.StaffNumber ?? 0) : 0;

            voce.Notes.forEach(nota => {
                if (!nota.isRest() && nota.Pitch) {
                    const midi = nota.halfTone + 12;
                    const mano = (staffNum === 1 || (staffNum === 2 && staffObj?.IdInMusicSheet === undefined) || midi < 60) ? 'S' : 'D';
                    const durata = nota.Length ? nota.Length.RealValue * 2.0 : 0.5;
                    const dito = (nota.Fingering && nota.Fingering.value) ? nota.Fingering.value : null;
                    noteDelPasso.push({
                        midi: midi,
                        mano: mano,
                        durata: Math.max(0.25, durata),
                        suonata: false,
                        dito: dito
                    });
                }
            });
        });

        if (noteDelPasso.length > 0) {
                      ['D', 'S'].forEach(m => {
                const noteMano = noteDelPasso.filter(x => x.mano === m).sort((a, b) => a.midi - b.midi);
                noteMano.forEach((item, idx) => {
                    if (!item.dito) {
                        const pos = item.midi % 12;
                        if (noteMano.length > 1) {
                            item.dito = m === 'D' ? (idx === 0 ? 1 : (idx === noteMano.length - 1 ? 5 : idx + 2)) : (idx === 0 ? 5 : (idx === noteMano.length - 1 ? 1 : Math.max(2, 5 - idx)));
                        } else {
                            item.dito = m === 'D' ? ([0, 5].includes(pos) ? 1 : ([2, 7].includes(pos) ? 2 : 3)) : ([0, 5].includes(pos) ? 5 : ([2, 7].includes(pos) ? 4 : 3));
                        }
                    }
                });
            });  
            passiSpartito.push({
                indice: indice,
                tempoInizio: indice * 0.65 + 1.0,
                note: noteDelPasso
            });
            indice++;
        }
        cursore.next();
    }

    cursore.reset();
    cursore.show();
}

function vaiAlPasso(nuovoIndice) {
    if (passiSpartito.length === 0) return;
    indicePassoCorrente = Math.max(0, Math.min(passiSpartito.length - 1, nuovoIndice));

    // Riallinea il cursore grafico di OSMD al passo scelto
    const cursore = osmd.cursor;
    cursore.reset();
    for (let i = 0; i < indicePassoCorrente; i++) {
        cursore.next();
    }
    cursore.show();

    // Aggiorna stato suonato/da suonare dei passi
    passiSpartito.forEach((passo, idx) => {
        passo.note.forEach(n => {
            n.suonata = idx < indicePassoCorrente;
            n.autoSuonata = false;
        });
    });

    const passoAttuale = passiSpartito.at(indicePassoCorrente);
    tempoCorrente = Math.max(0, passoAttuale.tempoInizio - 0.5);
    preparaPassoCorrente();
    centraCursoreOrizzontalmente();
    disegnaCascata();
}

function preparaPassoCorrente() {
    pulisciTastiSuggeriti();
    noteInAttesa = Array.of();

    if (indicePassoCorrente >= passiSpartito.length) return;
    const passo = passiSpartito.at(indicePassoCorrente);

    passo.note.forEach(nota => {
        if (nota.suonata) return;
        const manoAttiva = (modalitaMani === 'ENTRAMBE' || modalitaMani === nota.mano);

        if (manoAttiva) {
            noteInAttesa.push(nota);
            if (mappaTasti[nota.midi]) {
                mappaTasti[nota.midi].classList.add('suggerito-' + nota.mano);
            }
        } else if (!nota.autoSuonata) {
            nota.autoSuonata = true;
            nota.suonata = true;
            suonaNotaSintetica(nota.midi, 0.35);
        }
    });

    // Se questo passo conteneva solo note della mano disattivata, avanza subito al prossimo!
    if (noteInAttesa.length === 0 && indicePassoCorrente < passiSpartito.length - 1 && inRiproduzione) {
      setTimeout(() => vaiAlPasso(indicePassoCorrente + 1), Math.round(350 * (100 / bpmAttuale)));
    }
}

function centraCursoreOrizzontalmente() {
    if (!osmd || !osmd.cursor || !osmd.cursor.cursorElement) return;
    const elCursore = osmd.cursor.cursorElement;
    const rectCursore = elCursore.getBoundingClientRect();
    const rectArea = areaSpartito.getBoundingClientRect();

    if (rectCursore.bottom > rectArea.bottom - 20 || rectCursore.top < rectArea.top + 20) {
        areaSpartito.scrollTop += (rectCursore.top - rectArea.top - 40);
    }
}

btnIndietro.addEventListener('click', () => {
    vaiAlPasso(indicePassoCorrente - 1);
});

btnAvanti.addEventListener('click', () => {
    vaiAlPasso(indicePassoCorrente + 1);
});

// 5. MOTORE DELLA CASCATA SINCRONIZZATO CON OSMD
let inRiproduzione = false;
let tempoCorrente = 0;
let ultimoTimestamp = 0;

function adattaDimensioniCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', () => {
    adattaDimensioniCanvas();
    disegnaCascata();
});

btnPlay.addEventListener('click', () => {
    inRiproduzione = !inRiproduzione;
    btnPlay.textContent = inRiproduzione ? "⏸️ Pausa" : "▶️ Riprendi";
    messaggioGuida.style.display = "none";
    ultimoTimestamp = performance.now();
    if (inRiproduzione) {
        preparaPassoCorrente();
        requestAnimationFrame(cicloAnimazione);
    }
});

btnReset.addEventListener('click', () => {
    inRiproduzione = false;
    btnPlay.textContent = "▶️ Avvia";
    messaggioGuida.style.display = "block";
    areaSpartito.scrollLeft = 0;
    vaiAlPasso(0);
    tempoCorrente = 0;
    disegnaCascata();
});

function cicloAnimazione(timestamp) {
    if (!inRiproduzione) return;
    const deltaSecondi = (timestamp - ultimoTimestamp) / 1000;
    ultimoTimestamp = timestamp;

    const passoAttuale = passiSpartito.at(indicePassoCorrente);
    // Avanza col tempo finché il passo corrente non tocca la tastiera
    if (!passoAttuale || tempoCorrente < passoAttuale.tempoInizio) {
        tempoCorrente += deltaSecondi;
        if (passoAttuale && tempoCorrente >= passoAttuale.tempoInizio) {
            tempoCorrente = passoAttuale.tempoInizio;
            preparaPassoCorrente();
        }
    }

    disegnaCascata();
    requestAnimationFrame(cicloAnimazione);
}

function pulisciTastiSuggeriti() {
    Object.values(mappaTasti).forEach(t => {
        t.classList.remove('suggerito-D', 'suggerito-S');
    });
}

function disegnaCascata() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const velocitaPixelAlSecondo = 175;
    const rectCanvas = canvas.getBoundingClientRect();

    // Linee guida verticali sottili
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    Object.values(mappaTasti).forEach(tasto => {
        if (tasto.classList.contains('tasto-bianco')) {
            const x = tasto.getBoundingClientRect().left - rectCanvas.left;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        }
    });

    passiSpartito.forEach((passo, idx) => {
        if (idx < indicePassoCorrente) return;

        const distanzaInSecondi = passo.tempoInizio - tempoCorrente;
        const yFondo = canvas.height - (distanzaInSecondi * velocitaPixelAlSecondo);

        passo.note.forEach(nota => {
            if (nota.suonata) return;

            const altezzaBlocco = Math.max(16, nota.durata * velocitaPixelAlSecondo);
            const yCima = yFondo - altezzaBlocco;
            const manoAttiva = (modalitaMani === 'ENTRAMBE' || modalitaMani === nota.mano);

            if (yFondo > 0 && yCima < canvas.height) {
                const tastoTarget = mappaTasti[nota.midi];
                if (tastoTarget) {
                    const rectTasto = tastoTarget.getBoundingClientRect();
                    const x = rectTasto.left - rectCanvas.left + 2;
                    const larghezza = rectTasto.width - 4;

                    if (!manoAttiva) {
                        ctx.fillStyle = "rgba(166, 173, 200, 0.25)";
                    } else if (idx === indicePassoCorrente && tempoCorrente >= passo.tempoInizio - 0.05) {
                        ctx.fillStyle = "#f9e2af"; // Giallo brillante quando è il momento di suonarla
                                        } else {
                        ctx.fillStyle = nota.mano === 'D' ? "#22c55e" : "#f97316";
                    }

                    const yDisegno = Math.min(yCima, canvas.height - altezzaBlocco);
                    ctx.beginPath();
                    ctx.roundRect(x, yDisegno, larghezza, altezzaBlocco, 6);
                    ctx.fill();

                    if (nota.dito && manoAttiva) {
                        ctx.fillStyle = "#0f172a";
                        ctx.font = "bold 13px sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(nota.dito, x + larghezza / 2, yDisegno + altezzaBlocco / 2);
                    }
                }
            }
        });
    });

    Object.values(mappaTasti).forEach(tasto => {
        tasto.style.backgroundColor = "";
        const vecchioNum = tasto.querySelector(".num-dito-tasto");
        if (vecchioNum) vecchioNum.remove();
    });

    const passoAttuale = passiSpartito[indicePassoCorrente];
    if (passoAttuale) {
        passoAttuale.note.forEach(nota => {
            const manoAttiva = (modalitaMani === 'ENTRAMBE' || modalitaMani === nota.mano);
            if (!manoAttiva || nota.suonata) return;
            const tasto = mappaTasti[nota.midi];
            if (!tasto) return;

            tasto.style.backgroundColor = nota.mano === 'D' ? "#22c55e" : "#f97316";

            if (nota.dito) {
                const badge = document.createElement("span");
                badge.className = "num-dito-tasto";
                badge.textContent = nota.dito;
                badge.style.cssText = "position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.9);color:#0f172a;font-weight:bold;font-size:13px;padding:1px 5px;border-radius:4px;pointer-events:none;";
                tasto.appendChild(badge);
            }
        });
    }
}

// 6. GESTIONE NOTE PREMUTE, SUONO ERRORE, MIDI E MICROFONO
function suonaErrore() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(75, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.22);
}

function gestisciNotaPremuta(midi) {
    const passoAttuale = passiSpartito.at(indicePassoCorrente);
    const inAttesaOra = passoAttuale && tempoCorrente >= passoAttuale.tempoInizio - 0.1 && noteInAttesa.length > 0;

    if (inAttesaOra) {
        const notaTrovata = noteInAttesa.find(n => n.midi === midi && !n.suonata);

        if (notaTrovata) {
            if (mappaTasti[midi]) mappaTasti[midi].classList.add('premuto');
            notaTrovata.suonata = true;
            noteInAttesa = noteInAttesa.filter(n => n !== notaTrovata);

            if (mappaTasti[midi]) {
                mappaTasti[midi].classList.remove('suggerito-D', 'suggerito-S');
            }

            // Se tutte le note di questo passo sono state suonate, avanza il cursore dello spartito!
            if (noteInAttesa.length === 0) {
                if (indicePassoCorrente < passiSpartito.length - 1) {
                    indicePassoCorrente++;
                    osmd.cursor.next();
                    centraCursoreOrizzontalmente();
                    preparaPassoCorrente();
                } else {
                    inRiproduzione = false;
                    btnPlay.textContent = "▶️ Avvia";
                    testoStato.textContent = "Brano completato! Ottimo lavoro!";
                }
            }
            disegnaCascata();
        } else {
            // Nota sbagliata! Suono di errore e lampeggio rosso sul tasto
            suonaErrore();
            if (mappaTasti[midi]) {
                mappaTasti[midi].style.backgroundColor = '#f38ba8';
                setTimeout(() => {
                    if (mappaTasti[midi]) mappaTasti[midi].style.backgroundColor = '';
                }, 300);
            }
        }
    } else if (mappaTasti[midi]) {
        mappaTasti[midi].classList.add('premuto');
    }
}

function gestisciNotaRilasciata(midi) {
    if (mappaTasti[midi]) {
        mappaTasti[midi].classList.remove('premuto');
    }
}

btnMidi.addEventListener('click', async () => {
    if (!navigator.requestMIDIAccess) {
        testoStato.textContent = "Il tuo browser non supporta il MIDI. Usa Chrome o Edge.";
        return;
    }

    try {
        const midiAccess = await navigator.requestMIDIAccess();
        const inputs = Array.from(midiAccess.inputs.values());

        if (inputs.length === 0) {
            testoStato.textContent = "Nessuna tastiera rilevata. Controlla il cavo USB.";
            return;
        }

        inputs.forEach(input => {
            input.onmidimessage = gestisciMessaggioMidi;
        });

        btnMidi.classList.add('attivo');
        testoStato.textContent = "Collegato a: " + inputs.at(0).name;
    } catch (errore) {
        testoStato.textContent = "Errore collegamento MIDI: " + errore.message;
    }
});

function gestisciMessaggioMidi(messaggio) {
    const comando = messaggio.data.at(0);
    const notaMidi = messaggio.data.at(1);
    const velocita = messaggio.data.at(2);

    if (comando === 144 && velocita > 0) {
        gestisciNotaPremuta(notaMidi);
    } else if (comando === 128 || (comando === 144 && velocita === 0)) {
        gestisciNotaRilasciata(notaMidi);
    }
}

let ascoltoMicAttivo = false;
let ultimaNotaMic = null;

btnMic.addEventListener('click', async () => {
    if (ascoltoMicAttivo) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const sorgente = audioCtx.createMediaStreamSource(stream);
        const analizzatore = audioCtx.createAnalyser();
        analizzatore.fftSize = 2048;
        sorgente.connect(analizzatore);

        ascoltoMicAttivo = true;
        btnMic.classList.add('attivo');
        testoStato.textContent = "Microfono attivo: suona una nota sul piano!";

        const buffer = new Float32Array(analizzatore.fftSize);

        function analizzaSuono() {
            analizzatore.getFloatTimeDomainData(buffer);
            const frequenza = rilevaFrequenza(buffer, audioCtx.sampleRate);

            if (frequenza !== -1) {
                const notaMidi = Math.round(12 * (Math.log(frequenza / 440) / Math.log(2)) + 69);
                if (notaMidi >= 21 && notaMidi <= 108 && notaMidi !== ultimaNotaMic) {
                    if (ultimaNotaMic) gestisciNotaRilasciata(ultimaNotaMic);
                    gestisciNotaPremuta(notaMidi);
                    ultimaNotaMic = notaMidi;
                }
            } else if (ultimaNotaMic) {
                gestisciNotaRilasciata(ultimaNotaMic);
                ultimaNotaMic = null;
            }
            requestAnimationFrame(analizzaSuono);
        }

        analizzaSuono();
    } catch (errore) {
        testoStato.textContent = "Permesso microfono negato o non disponibile.";
    }
});

function rilevaFrequenza(buffer, sampleRate) {
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
        const valore = buffer.at(i);
        rms += valore * valore;
    }
    rms = Math.sqrt(rms / buffer.length);
    if (rms < 0.02) return -1;

    let r1 = 0, r2 = buffer.length - 1, soglia = 0.2;
    for (let i = 0; i < buffer.length / 2; i++) {
        if (Math.abs(buffer.at(i)) < soglia) { r1 = i; break; }
    }
    for (let i = 1; i < buffer.length / 2; i++) {
        if (Math.abs(buffer.at(buffer.length - i)) < soglia) { r2 = buffer.length - i; break; }
    }

    const bufTagliato = buffer.slice(r1, r2);
    const c = new Array(bufTagliato.length).fill(0);
    for (let i = 0; i < bufTagliato.length; i++) {
        for (let j = 0; j < bufTagliato.length - i; j++) {
            c[i] = c[i] + bufTagliato.at(j) * bufTagliato.at(j + i);
        }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1, maxpos = -1;
    for (let i = d; i < bufTagliato.length; i++) {
        if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
    }
    return sampleRate / maxpos;
}

// Avvio iniziale
creaTastiera();
adattaDimensioniCanvas();
inizializzaOSMD();
let bpmAttuale = 100;
let metronomoAttivo = false;
let timerMetronomo = null;
let battitoMetronomo = 0;

function suonaClickMetronomo(accento) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accento ? 1000 : 750, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
}

function aggiornaMetronomo() {
    if (timerMetronomo) clearInterval(timerMetronomo);
    if (!metronomoAttivo) return;
    const intervalloMs = (60 / bpmAttuale) * 1000;
    battitoMetronomo = 0;
    suonaClickMetronomo(true);
    timerMetronomo = setInterval(() => {
        battitoMetronomo = (battitoMetronomo + 1) % 4;
        suonaClickMetronomo(battitoMetronomo === 0);
    }, intervalloMs);
}

async function applicaNuovoSpartito(xmlTesto) {
    if (typeof caricaSpartitoXML === 'function') {
        await caricaSpartitoXML(xmlTesto);
    } else if (typeof caricaSpartito === 'function') {
        await caricaSpartito(xmlTesto);
    } else if (typeof osmd !== 'undefined' && osmd) {
        await osmd.load(xmlTesto);
        osmd.render();
        if (typeof estraiPassiDaOSMD === 'function') estraiPassiDaOSMD();
        if (typeof vaiAlPasso === 'function') vaiAlPasso(0);
    }
}

const selectBrano = document.getElementById('selectBranoPronto');
const btnEliminaBrano = document.getElementById('btnEliminaBrano');

function getBraniBaseVisibili() {
    if (typeof libreriaBrani === 'undefined') return [];
    const nascosti = JSON.parse(localStorage.getItem('pianoTutorBaseNascosti') || '[]');
    return Object.keys(libreriaBrani).filter(titolo => !nascosti.includes(titolo));
}

function aggiornaStatoCestino() {
    if (!btnEliminaBrano || !selectBrano) return;
    btnEliminaBrano.style.display = selectBrano.options.length > 1 ? 'inline-block' : 'none';
}

if (btnEliminaBrano) {
    btnEliminaBrano.addEventListener('click', async () => {
        const val = selectBrano.value;
        if (val.startsWith('RECENTE_')) {
            const idx = parseInt(val.replace('RECENTE_', ''), 10);
            const recenti = JSON.parse(localStorage.getItem('pianoTutorRecenti') || '[]');
            recenti.splice(idx, 1);
            localStorage.setItem('pianoTutorRecenti', JSON.stringify(recenti));
        } else {
            const nascosti = JSON.parse(localStorage.getItem('pianoTutorBaseNascosti') || '[]');
            if (!nascosti.includes(val)) nascosti.push(val);
            localStorage.setItem('pianoTutorBaseNascosti', JSON.stringify(nascosti));
        }

        aggiornaMenuRecenti();

        if (selectBrano.options.length > 0) {
            const nuovoVal = selectBrano.options[0].value;
            selectBrano.value = nuovoVal;
            if (nuovoVal.startsWith('RECENTE_')) {
                const recenti = JSON.parse(localStorage.getItem('pianoTutorRecenti') || '[]');
                if (recenti[0]) await applicaNuovoSpartito(recenti[0].xml);
            } else if (typeof libreriaBrani !== 'undefined' && libreriaBrani[nuovoVal]) {
                await applicaNuovoSpartito(libreriaBrani[nuovoVal]);
            }
        }
    });
}

function aggiornaMenuRecenti() {
    if (!selectBrano) return;
    const recenti = JSON.parse(localStorage.getItem('pianoTutorRecenti') || '[]');
    const baseVisibili = getBraniBaseVisibili();
    selectBrano.innerHTML = '';

    baseVisibili.forEach(titolo => {
        const opt = document.createElement('option');
        opt.value = titolo;
        opt.textContent = '🎵 ' + titolo;
        selectBrano.appendChild(opt);
    });

    recenti.forEach((brano, idx) => {
        const opt = document.createElement('option');
        opt.value = 'RECENTE_' + idx;
        opt.textContent = '⭐ ' + brano.nome;
        selectBrano.appendChild(opt);
    });
    aggiornaStatoCestino();
}
 
if (selectBrano) {
    aggiornaMenuRecenti();
    selectBrano.addEventListener('change', async (e) => {
        const val = e.target.value;
  aggiornaStatoCestino();      
        const mappaVecchi = {
            perElisa: "Per Elisa - L. van Beethoven",
            innoAllaGioia: "Inno alla Gioia - L. van Beethoven",
            minuettoBach: "Minuetto in Sol Maggiore - J.S. Bach"
        };
        if (val.startsWith('RECENTE_')) {
            const idx = parseInt(val.replace('RECENTE_', ''), 10);
            const recenti = JSON.parse(localStorage.getItem('pianoTutorRecenti') || '[]');
            if (recenti[idx]) await applicaNuovoSpartito(recenti[idx].xml);
        } else if (typeof libreriaBrani !== 'undefined') {
            const chiave = mappaVecchi[val] || val;
            if (libreriaBrani[chiave]) await applicaNuovoSpartito(libreriaBrani[chiave]);
        }
    });
}

const inputFileSpartito = document.getElementById('input-spartito');
if (inputFileSpartito) {
    inputFileSpartito.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const nomePulito = file.name.replace(/\.(xml|musicxml|mxl)$/i, '');
        const reader = new FileReader();
        reader.onload = (ev) => {
            const testo = ev.target.result;
            if (typeof testo === 'string' && testo.includes('<score-partwise')) {
                try {
                    let recenti = JSON.parse(localStorage.getItem('pianoTutorRecenti') || '[]');
                    recenti = recenti.filter(r => r.nome !== nomePulito);
                    recenti.unshift({ nome: nomePulito, xml: testo });
                    if (recenti.length > 5) recenti = recenti.slice(0, 5);
                    localStorage.setItem('pianoTutorRecenti', JSON.stringify(recenti));
                    aggiornaMenuRecenti();
                    if (selectBrano) selectBrano.value = 'RECENTE_0';
                } catch (err) {
                    console.warn('File troppo grande per la memoria rapida del browser');
                }
            }
        };
        reader.readAsText(file);
    });
}

const sliderVelocita = document.getElementById('sliderVelocita');
const testoBpm = document.getElementById('testoBpm');
if (sliderVelocita && testoBpm) {
    sliderVelocita.addEventListener('input', (e) => {
        bpmAttuale = parseInt(e.target.value, 10);
        testoBpm.textContent = bpmAttuale + ' BPM';
        if (metronomoAttivo) aggiornaMetronomo();
    });
}

const btnMetronomo = document.getElementById('btnMetronomo');
if (btnMetronomo) {
    btnMetronomo.addEventListener('click', () => {
        metronomoAttivo = !metronomoAttivo;
        btnMetronomo.textContent = metronomoAttivo ? '🥁 Metro: ON' : '🥁 Metro: OFF';
        btnMetronomo.style.background = metronomoAttivo ? '#0284c7' : '';
        aggiornaMetronomo();
    });
}
const URL_API_PIANO = "https://granata.pythonanywhere.com/api/piano-auth";
let modalitaRegistrazione = false;

const schermataLogin = document.getElementById("schermata-login");
const campoNome = document.getElementById("campo-nome");
const btnInviaAuth = document.getElementById("btn-invia-auth");
const linkSwitchAuth = document.getElementById("link-switch-auth");
const testoSwitchAuth = document.getElementById("testo-switch-auth");
const msgAuth = document.getElementById("msg-auth");
const btnAdmin = document.getElementById("btn-pannello-admin");
const btnLogout = document.getElementById("btn-logout-piano");

if (linkSwitchAuth) {
    linkSwitchAuth.addEventListener("click", (e) => {
        e.preventDefault();
        modalitaRegistrazione = !modalitaRegistrazione;
        campoNome.style.display = modalitaRegistrazione ? "block" : "none";
        btnInviaAuth.textContent = modalitaRegistrazione ? "Crea Account" : "Accedi";
        testoSwitchAuth.textContent = modalitaRegistrazione ? "Hai già un account?" : "Non hai un account?";
        linkSwitchAuth.textContent = modalitaRegistrazione ? "Accedi" : "Registrati";
        msgAuth.textContent = "";
    });
}

async function controllaSessioneUtente() {
    const salvato = JSON.parse(localStorage.getItem("pianoTutorUtente") || "null");
    if (!salvato || !salvato.email) return;
    try {
        const res = await fetch(URL_API_PIANO, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ azione: "verifica", email: salvato.email })
        });
        const data = await res.json();
        if (data.ok) {
            schermataLogin.style.display = "none";
            if (data.is_admin && btnAdmin) btnAdmin.style.display = "inline-block";
        } else {
            localStorage.removeItem("pianoTutorUtente");
        }
    } catch (err) {
        console.warn("Verifica server non riuscita:", err);
    }
}

if (btnInviaAuth) {
    btnInviaAuth.addEventListener("click", async () => {
        msgAuth.textContent = "Connessione in corso...";
        const payload = {
            azione: modalitaRegistrazione ? "registra" : "login",
            nome: document.getElementById("auth-nome").value,
            email: document.getElementById("auth-email").value,
            password: document.getElementById("auth-password").value
        };
        try {
            const res = await fetch(URL_API_PIANO, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.ok) {
                localStorage.setItem("pianoTutorUtente", JSON.stringify({ email: data.email, nome: data.nome }));
                schermataLogin.style.display = "none";
                if (data.is_admin && btnAdmin) btnAdmin.style.display = "inline-block";
            } else {
                msgAuth.textContent = data.errore || "Errore di accesso.";
            }
        } catch (err) {
            msgAuth.textContent = "Impossibile contattare il server.";
        }
    });
}

if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        localStorage.removeItem("pianoTutorUtente");
        location.reload();
    });
}

controllaSessioneUtente();
// === SINCRONIZZAZIONE SPARTITI CLOUD (PC <-> IPAD) ===
(function () {
  const API_BASE = "https://granata+pythonanywhere+com+api";

  function getEmailUtente() {
    try {
      const u = JSON.parse(localStorage.getItem("pianoTutorUtente") || "null");
      return u && u.email ? u.email.trim().toLowerCase() : "";
    } catch (e) {
      return "";
    }
  }

  async function scaricaSpartitiCloud() {
    const email = getEmailUtente();
    if (!email) return;
    try {
      const res = await fetch(API_BASE + "/piano-spartiti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const dati = await res.json();
      if (dati.ok && Array.isArray(dati.spartiti)) {
        const lista = dati.spartiti.map(s => ({ id: s.id, nome: s.titolo, xml: s.contenuto }));
        localStorage.setItem("pianoTutorRecenti", JSON.stringify(lista));
        if (typeof aggiornaMenuRecenti === "function") aggiornaMenuRecenti();
      }
    } catch (e) {
      console.warn("Errore sync cloud:", e);
    }
  }

  async function salvaSpartitoSulCloud(titolo, xmlTesto) {
    const email = getEmailUtente();
    if (!email || !titolo || !xmlTesto) return;
    try {
      await fetch(API_BASE + "/piano-salva-spartito", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, titolo, contenuto: xmlTesto })
      });
    } catch (e) {
      console.warn("Errore salvataggio cloud:", e);
    }
  }

  const inputFile = document.getElementById("input-spartito");
  if (inputFile) {
    inputFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const nomePulito = file.name.replace(/\.(xml|musicxml|mxl)$/i, "");
      setTimeout(async () => {
        const recenti = JSON.parse(localStorage.getItem("pianoTutorRecenti") || "[]");
        const trovato = recenti.find(r => r && r.nome === nomePulito);
        if (trovato && trovato.xml) {
          await salvaSpartitoSulCloud(trovato.nome, trovato.xml);
          await scaricaSpartitiCloud();
        }
      }, 800);
    });
  }

  const btnElimina = document.getElementById("btnEliminaBrano");
  if (btnElimina) {
    btnElimina.addEventListener("click", async () => {
      const email = getEmailUtente();
      const sel = document.getElementById("selectBranoPronto");
      if (!email || !sel) return;
      const val = sel.value;
      if (val && val.startsWith("RECENTE_")) {
        const idx = parseInt(val.replace("RECENTE_", ""), 10);
        const recenti = JSON.parse(localStorage.getItem("pianoTutorRecenti") || "[]");
        if (recenti[idx] && recenti[idx].id) {
          await fetch(API_BASE + "/piano-elimina-spartito", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, id: recenti[idx].id })
          });
        }
      }
    }, true);
  }

  window.addEventListener("load", () => {
    setTimeout(scaricaSpartitiCloud, 700);
  });
})();

