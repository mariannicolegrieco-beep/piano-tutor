function creaNota(step, octave, duration, voice, type, staff, alter = 0, chord = false, beam = '') {
  const ch = chord ? '<chord/>' : '';
  const al = alter !== 0 ? `<alter>${alter}</alter>` : '';
  const bm = beam ? `<beam number="1">${beam}</beam>` : '';
  return `<note>${ch}<pitch><step>${step}</step>${al}<octave>${octave}</octave></pitch><duration>${duration}</duration><voice>${voice}</voice><type>${type}</type><staff>${staff}</staff>${bm}</note>`;
}

function creaPausa(duration, voice, type, staff) {
  return `<note><rest/><duration>${duration}</duration><voice>${voice}</voice><type>${type}</type><staff>${staff}</staff></note>`;
}

function costruisciBranoXML(titolo, quinta, battiti, tipoBattito, misure) {
  let xmlMisure = '';
  misure.forEach((m, idx) => {
    const attr = idx === 0 ? `
      <attributes>
        <divisions>4</divisions>
        <key><fifths>${quinta}</fifths></key>
        <time><beats>${battiti}</beats><beat-type>${tipoBattito}</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>` : '';
    const capo = (idx > 0 && idx % 3 === 0) ? '<print new-system="yes"/>' : '';
    xmlMisure += `<measure number="${idx + 1}">${capo}${attr}${m}</measure>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>${titolo}</work-title></work>
  <part-list><score-part id="P1"><part-name>Pianoforte</part-name></score-part></part-list>
  <part id="P1">${xmlMisure}</part>
</score-partwise>`;
}

const libreriaBrani = {
  "Per Elisa - L. van Beethoven": costruisciBranoXML("Per Elisa - L. van Beethoven", 0, 3, 8, [
    creaPausa(4, 1, 'quarter', 1) + creaNota('E', 5, 1, 1, '16th', 1, 0, false, 'begin') + creaNota('D', 5, 1, 1, '16th', 1, 1, false, 'end') + `<backup><duration>6</duration></backup>` + creaPausa(6, 2, 'quarter', 2),
    creaNota('E', 5, 1, 1, '16th', 1, 0, false, 'begin') + creaNota('D', 5, 1, 1, '16th', 1, 1, false, 'continue') + creaNota('E', 5, 1, 1, '16th', 1, 0, false, 'continue') + creaNota('B', 4, 1, 1, '16th', 1, 0, false, 'continue') + creaNota('D', 5, 1, 1, '16th', 1, 0, false, 'continue') + creaNota('C', 5, 1, 1, '16th', 1, 0, false, 'end') + `<backup><duration>6</duration></backup>` + creaPausa(6, 2, 'quarter', 2),
    creaNota('A', 4, 2, 1, 'eighth', 1) + creaPausa(2, 1, 'eighth', 1) + creaNota('C', 4, 1, 1, '16th', 1, 0, false, 'begin') + creaNota('E', 4, 1, 1, '16th', 1, 0, false, 'end') + `<backup><duration>6</duration></backup>` + creaNota('A', 2, 1, 2, '16th', 2, 0, false, 'begin') + creaNota('E', 3, 1, 2, '16th', 2, 0, false, 'continue') + creaNota('A', 3, 1, 2, '16th', 2, 0, false, 'end') + creaPausa(3, 2, 'eighth', 2),
    creaNota('A', 4, 1, 1, '16th', 1, 0, false, 'begin') + creaNota('B', 4, 1, 1, '16th', 1, 0, false, 'end') + creaPausa(2, 1, 'eighth', 1) + creaNota('E', 4, 1, 1, '16th', 1, 0, false, 'begin') + creaNota('G', 4, 1, 1, '16th', 1, 1, false, 'end') + `<backup><duration>6</duration></backup>` + creaNota('E', 2, 1, 2, '16th', 2, 0, false, 'begin') + creaNota('E', 3, 1, 2, '16th', 2, 0, false, 'continue') + creaNota('G', 3, 1, 2, '16th', 2, 1, false, 'end') + creaPausa(3, 2, 'eighth', 2),
    creaNota('B', 4, 1, 1, '16th', 1, 0, false, 'begin') + creaNota('C', 5, 1, 1, '16th', 1, 0, false, 'end') + creaPausa(2, 1, 'eighth', 1) + creaNota('E', 4, 1, 1, '16th', 1, 0, false, 'begin') + creaNota('E', 5, 1, 1, '16th', 1, 0, false, 'end') + `<backup><duration>6</duration></backup>` + creaNota('A', 2, 1, 2, '16th', 2, 0, false, 'begin') + creaNota('E', 3, 1, 2, '16th', 2, 0, false, 'continue') + creaNota('A', 3, 1, 2, '16th', 2, 0, false, 'end') + creaPausa(3, 2, 'eighth', 2),
    creaNota('D', 5, 1, 1, '16th', 1, 1, false, 'begin') + creaNota('E', 5, 1, 1, '16th', 1, 0, false, 'continue') + creaNota('D', 5, 1, 1, '16th', 1, 1, false, 'continue') + creaNota('E', 5, 1, 1, '16th', 1, 0, false, 'continue') + creaNota('B', 4, 1, 1, '16th', 1, 0, false, 'continue') + creaNota('D', 5, 1, 1, '16th', 1, 0, false, 'end') + `<backup><duration>6</duration></backup>` + creaPausa(6, 2, 'quarter', 2),
    creaNota('C', 5, 2, 1, 'eighth', 1) + creaNota('A', 4, 4, 1, 'quarter', 1) + `<backup><duration>6</duration></backup>` + creaNota('A', 2, 1, 2, '16th', 2, 0, false, 'begin') + creaNota('E', 3, 1, 2, '16th', 2, 0, false, 'continue') + creaNota('A', 3, 1, 2, '16th', 2, 0, false, 'end') + creaPausa(3, 2, 'eighth', 2)
  ]),

  "Inno alla Gioia - L. van Beethoven": costruisciBranoXML("Inno alla Gioia - Beethoven", 0, 4, 4, [
    creaNota('E', 4, 4, 1, 'quarter', 1) + creaNota('E', 4, 4, 1, 'quarter', 1) + creaNota('F', 4, 4, 1, 'quarter', 1) + creaNota('G', 4, 4, 1, 'quarter', 1) + `<backup><duration>16</duration></backup>` + creaNota('C', 3, 8, 2, 'half', 2) + creaNota('G', 3, 8, 2, 'half', 2),
    creaNota('G', 4, 4, 1, 'quarter', 1) + creaNota('F', 4, 4, 1, 'quarter', 1) + creaNota('E', 4, 4, 1, 'quarter', 1) + creaNota('D', 4, 4, 1, 'quarter', 1) + `<backup><duration>16</duration></backup>` + creaNota('G', 2, 8, 2, 'half', 2) + creaNota('B', 2, 8, 2, 'half', 2),
    creaNota('C', 4, 4, 1, 'quarter', 1) + creaNota('C', 4, 4, 1, 'quarter', 1) + creaNota('D', 4, 4, 1, 'quarter', 1) + creaNota('E', 4, 4, 1, 'quarter', 1) + `<backup><duration>16</duration></backup>` + creaNota('C', 3, 8, 2, 'half', 2) + creaNota('E', 3, 8, 2, 'half', 2),
    creaNota('E', 4, 6, 1, 'quarter', 1) + creaNota('D', 4, 2, 1, 'eighth', 1) + creaNota('D', 4, 8, 1, 'half', 1) + `<backup><duration>16</duration></backup>` + creaNota('G', 2, 16, 2, 'whole', 2),
    creaNota('E', 4, 4, 1, 'quarter', 1) + creaNota('E', 4, 4, 1, 'quarter', 1) + creaNota('F', 4, 4, 1, 'quarter', 1) + creaNota('G', 4, 4, 1, 'quarter', 1) + `<backup><duration>16</duration></backup>` + creaNota('C', 3, 8, 2, 'half', 2) + creaNota('G', 3, 8, 2, 'half', 2),
    creaNota('G', 4, 4, 1, 'quarter', 1) + creaNota('F', 4, 4, 1, 'quarter', 1) + creaNota('E', 4, 4, 1, 'quarter', 1) + creaNota('D', 4, 4, 1, 'quarter', 1) + `<backup><duration>16</duration></backup>` + creaNota('G', 2, 8, 2, 'half', 2) + creaNota('B', 2, 8, 2, 'half', 2),
    creaNota('C', 4, 4, 1, 'quarter', 1) + creaNota('C', 4, 4, 1, 'quarter', 1) + creaNota('D', 4, 4, 1, 'quarter', 1) + creaNota('E', 4, 4, 1, 'quarter', 1) + `<backup><duration>16</duration></backup>` + creaNota('C', 3, 8, 2, 'half', 2) + creaNota('F', 3, 8, 2, 'half', 2),
    creaNota('D', 4, 6, 1, 'quarter', 1) + creaNota('C', 4, 2, 1, 'eighth', 1) + creaNota('C', 4, 8, 1, 'half', 1) + `<backup><duration>16</duration></backup>` + creaNota('G', 2, 8, 2, 'half', 2) + creaNota('C', 3, 8, 2, 'half', 2)
  ]),

  "Minuetto in Sol Maggiore - J.S. Bach": costruisciBranoXML("Minuetto in Sol Maggiore - J.S. Bach", 1, 3, 4, [
    creaNota('D', 5, 4, 1, 'quarter', 1) + creaNota('G', 4, 2, 1, 'eighth', 1, 0, false, 'begin') + creaNota('A', 4, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('B', 4, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('C', 5, 2, 1, 'eighth', 1, 0, false, 'end') + `<backup><duration>12</duration></backup>` + creaNota('G', 3, 8, 2, 'half', 2) + creaNota('A', 3, 4, 2, 'quarter', 2),
    creaNota('D', 5, 4, 1, 'quarter', 1) + creaNota('G', 4, 4, 1, 'quarter', 1) + creaNota('G', 4, 4, 1, 'quarter', 1) + `<backup><duration>12</duration></backup>` + creaNota('B', 3, 12, 2, 'half', 2),
    creaNota('E', 5, 4, 1, 'quarter', 1) + creaNota('C', 5, 2, 1, 'eighth', 1, 0, false, 'begin') + creaNota('D', 5, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('E', 5, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('F', 5, 2, 1, 'eighth', 1, 1, false, 'end') + `<backup><duration>12</duration></backup>` + creaNota('C', 4, 12, 2, 'half', 2),
    creaNota('G', 5, 4, 1, 'quarter', 1) + creaNota('G', 4, 4, 1, 'quarter', 1) + creaNota('G', 4, 4, 1, 'quarter', 1) + `<backup><duration>12</duration></backup>` + creaNota('B', 3, 12, 2, 'half', 2),
    creaNota('C', 5, 4, 1, 'quarter', 1) + creaNota('D', 5, 2, 1, 'eighth', 1, 0, false, 'begin') + creaNota('C', 5, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('B', 4, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('A', 4, 2, 1, 'eighth', 1, 0, false, 'end') + `<backup><duration>12</duration></backup>` + creaNota('A', 3, 12, 2, 'half', 2),
    creaNota('B', 4, 4, 1, 'quarter', 1) + creaNota('C', 5, 2, 1, 'eighth', 1, 0, false, 'begin') + creaNota('B', 4, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('A', 4, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('G', 4, 2, 1, 'eighth', 1, 0, false, 'end') + `<backup><duration>12</duration></backup>` + creaNota('G', 3, 12, 2, 'half', 2),
    creaNota('F', 4, 4, 1, 'quarter', 1, 1) + creaNota('G', 4, 2, 1, 'eighth', 1, 0, false, 'begin') + creaNota('A', 4, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('B', 4, 2, 1, 'eighth', 1, 0, false, 'continue') + creaNota('G', 4, 2, 1, 'eighth', 1, 0, false, 'end') + `<backup><duration>12</duration></backup>` + creaNota('D', 3, 8, 2, 'half', 2) + creaNota('B', 2, 4, 2, 'quarter', 2),
    creaNota('A', 4, 12, 1, 'half', 1) + `<backup><duration>12</duration></backup>` + creaNota('D', 3, 12, 2, 'half', 2)
  ])
};

const spartitoMusicXMLDemo = libreriaBrani["Per Elisa - L. van Beethoven"];
