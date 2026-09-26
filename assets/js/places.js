// Coordinates verified against OpenStreetMap (Nominatim) and sv.wikipedia.org.
// camera: preferred view when flying to the place.
export const PLACES = [
  {
    id: 'stadshuset',
    name: 'Stockholms stadshus',
    district: 'Kungsholmen',
    lngLat: [18.05421, 59.32749],
    camera: { zoom: 16.6, pitch: 68, bearing: -35 },
    text: 'Ragnar Östbergs nationalromantiska mästerverk, invigt 1923. Tornet är 106 meter högt och kröns av tre kronor. Nobelbanketten hålls i Blå hallen.',
  },
  {
    id: 'slottet',
    name: 'Stockholms slott',
    district: 'Gamla stan',
    lngLat: [18.07016, 59.32693],
    camera: { zoom: 16.8, pitch: 62, bearing: 20 },
    text: 'Kungens officiella residens, uppfört efter att slottet Tre Kronor brann 1697. Ritat av Nicodemus Tessin d.y. 1 430 rum, varav 660 med fönster.',
  },
  {
    id: 'stortorget',
    name: 'Stortorget',
    district: 'Gamla stan',
    lngLat: [18.07082, 59.325],
    camera: { zoom: 17.8, pitch: 70, bearing: -10 },
    text: 'Stockholms äldsta torg och platsen för Stockholms blodbad 1520. Börshuset på norra sidan rymmer Svenska Akademien och Nobelprismuseet.',
  },
  {
    id: 'riddarholmskyrkan',
    name: 'Riddarholmskyrkan',
    district: 'Riddarholmen',
    lngLat: [18.0646, 59.32468],
    camera: { zoom: 17.2, pitch: 66, bearing: 60 },
    text: 'Gravkyrka för svenska regenter från Gustav II Adolf till Gustav V. Den genombrutna gjutjärnsspiran kom till efter att blixten slog ned 1835.',
  },
  {
    id: 'riksdagshuset',
    name: 'Riksdagshuset',
    district: 'Helgeandsholmen',
    lngLat: [18.06837, 59.32767],
    camera: { zoom: 17.2, pitch: 64, bearing: 150 },
    text: 'Sveriges riksdag på Helgeandsholmen mellan Norrmalm och Gamla stan. Huvudbyggnaden stod klar 1905.',
  },
  {
    id: 'monteliusvagen',
    name: 'Monteliusvägen',
    district: 'Södermalm',
    lngLat: [18.06046, 59.32073],
    camera: { zoom: 16.4, pitch: 72, bearing: -20 },
    text: 'Promenadstig längs Mariabergets krön med en av stadens bästa vyer över Riddarfjärden, Stadshuset och Gamla stan.',
  },
  {
    id: 'skinnarviksberget',
    name: 'Skinnarviksberget',
    district: 'Södermalm',
    lngLat: [18.05078, 59.31993],
    camera: { zoom: 16.2, pitch: 70, bearing: 10 },
    text: 'En av innerstadens högsta naturliga punkter. Kala berghällar och fri sikt över Riddarfjärden och Kungsholmen.',
  },
  {
    id: 'mosebacke',
    name: 'Mosebacke torg',
    district: 'Södermalm',
    lngLat: [18.07446, 59.31808],
    camera: { zoom: 17, pitch: 66, bearing: -30 },
    text: 'Torget på Södermalms höjder där Strindbergs Röda rummet (1879) inleds med en utsikt över staden.',
  },
  {
    id: 'fotografiska',
    name: 'Fotografiska',
    district: 'Södermalm',
    lngLat: [18.0847, 59.318],
    camera: { zoom: 16.8, pitch: 64, bearing: 200 },
    text: 'Fotografimuseum sedan 2010 i Stadsgårdens tullhus från 1906, ritat av Ferdinand Boberg.',
  },
  {
    id: 'vasamuseet',
    name: 'Vasamuseet',
    district: 'Djurgården',
    lngLat: [18.09137, 59.32815],
    camera: { zoom: 17, pitch: 64, bearing: 120 },
    text: 'Regalskeppet Vasa sjönk på jungfruresan 1628 och bärgades 1961. Museet öppnade 1990 och skeppet är det enda bevarade 1600-talsskeppet i världen.',
  },
  {
    id: 'nordiska',
    name: 'Nordiska museet',
    district: 'Djurgården',
    lngLat: [18.09389, 59.32915],
    camera: { zoom: 17, pitch: 64, bearing: 30 },
    text: 'Grundat av Artur Hazelius 1873. Isak Gustaf Clasons slottsliknande byggnad invigdes 1907.',
  },
  {
    id: 'skansen',
    name: 'Skansen',
    district: 'Djurgården',
    lngLat: [18.10528, 59.32662],
    camera: { zoom: 16, pitch: 60, bearing: -60 },
    text: 'Världens äldsta friluftsmuseum, grundat 1891 av Artur Hazelius.',
  },
  {
    id: 'gronalund',
    name: 'Gröna Lund',
    district: 'Djurgården',
    lngLat: [18.09583, 59.32331],
    camera: { zoom: 17, pitch: 66, bearing: -140 },
    text: 'Sveriges äldsta nöjespark, öppnad 1883.',
  },
  {
    id: 'rosendal',
    name: 'Rosendals slott',
    district: 'Djurgården',
    lngLat: [18.11734, 59.32891],
    camera: { zoom: 16.8, pitch: 62, bearing: 0 },
    text: 'Lustslott uppfört 1823–1827 åt Karl XIV Johan.',
  },
  {
    id: 'waldemarsudde',
    name: 'Prins Eugens Waldemarsudde',
    district: 'Djurgården',
    lngLat: [18.11455, 59.32022],
    camera: { zoom: 16.8, pitch: 64, bearing: 160 },
    text: 'Konstnärsprinsen Eugens hem vid inloppet till Stockholm, museum sedan 1948.',
  },
  {
    id: 'kaknastornet',
    name: 'Kaknästornet',
    district: 'Gärdet',
    lngLat: [18.12694, 59.335],
    camera: { zoom: 15.8, pitch: 74, bearing: -120 },
    text: 'TV-tornet på Gärdet, invigt 1967 och 155 meter högt.',
  },
  {
    id: 'strandvagen',
    name: 'Strandvägen',
    district: 'Östermalm',
    lngLat: [18.08424, 59.33145],
    camera: { zoom: 16.4, pitch: 66, bearing: 80 },
    text: 'Paradgatan längs Nybroviken, bebyggd med palatsliknande hus kring sekelskiftet 1900.',
  },
  {
    id: 'kungstradgarden',
    name: 'Kungsträdgården',
    district: 'Norrmalm',
    lngLat: [18.07129, 59.33174],
    camera: { zoom: 17, pitch: 62, bearing: 180 },
    text: 'Stadens vardagsrum. Körsbärsträden blommar i april, och almstriden 1971 räddade parkens almar.',
  },
  {
    id: 'sergels',
    name: 'Sergels torg',
    district: 'Norrmalm',
    lngLat: [18.06403, 59.3322],
    camera: { zoom: 17.2, pitch: 64, bearing: -70 },
    text: 'Plattan och glasobelisken Kristallvertikalaccent av Edvin Öhrström från 1974.',
  },
  {
    id: 'stureplan',
    name: 'Stureplan',
    district: 'Östermalm',
    lngLat: [18.0725, 59.33637],
    camera: { zoom: 17.4, pitch: 66, bearing: 30 },
    text: 'Nöjeslivets nav. Mitt på torget står Svampen, regnskyddet i betong från 1937.',
  },
  {
    id: 'stadsbiblioteket',
    name: 'Stockholms stadsbibliotek',
    district: 'Vasastan',
    lngLat: [18.05476, 59.34334],
    camera: { zoom: 17, pitch: 62, bearing: -20 },
    text: 'Gunnar Asplunds bibliotek från 1928 med den ikoniska rotundan.',
  },
  {
    id: 'haga',
    name: 'Hagaparken',
    district: 'Solna',
    lngLat: [18.03459, 59.36303],
    camera: { zoom: 15.2, pitch: 58, bearing: 0 },
    text: 'Gustav III:s engelska landskapspark med Koppartälten och Haga slott.',
  },
  {
    id: 'tantolunden',
    name: 'Tantolunden',
    district: 'Södermalm',
    lngLat: [18.04976, 59.31307],
    camera: { zoom: 16, pitch: 60, bearing: -160 },
    text: 'Park på västra Södermalm med koloniträdgårdar och sluttningar ned mot Årstaviken.',
  },
  {
    id: 'hammarby',
    name: 'Hammarby sjöstad',
    district: 'Södermalm',
    lngLat: [18.10606, 59.30561],
    camera: { zoom: 15.6, pitch: 62, bearing: 60 },
    text: 'Tidigare industri- och hamnområde som sedan 1990-talet byggts om till en stadsdel med ett eget kretsloppssystem för energi, vatten och avfall.',
  },
  {
    id: 'globen',
    name: 'Avicii Arena',
    district: 'Johanneshov',
    lngLat: [18.08321, 59.29362],
    camera: { zoom: 16.4, pitch: 68, bearing: -30 },
    text: 'Världens största sfäriska byggnad, invigd 1989 och 110 meter i diameter. Hette Globen fram till 2021.',
  },
];

export const TOUR_ORDER = [
  'stadshuset',
  'riddarholmskyrkan',
  'stortorget',
  'slottet',
  'riksdagshuset',
  'kungstradgarden',
  'strandvagen',
  'vasamuseet',
  'gronalund',
  'kaknastornet',
  'fotografiska',
  'mosebacke',
  'monteliusvagen',
  'globen',
];

const normalize = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

export function findPlace(query) {
  const q = normalize(query);
  if (!q) return null;
  return (
    PLACES.find((p) => p.id === q) ||
    PLACES.find((p) => normalize(p.name) === q) ||
    PLACES.find((p) => p.id.startsWith(q) || normalize(p.name).startsWith(q)) ||
    PLACES.find((p) => normalize(p.name).includes(q)) ||
    null
  );
}

export { normalize };
