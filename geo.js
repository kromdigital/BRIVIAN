/* Países, estados o regiones y ciudades principales para el registro y "Editar perfil".
   Formato: "Estado: ciudad, ciudad, ..." (una línea por estado). Si falta tu ciudad, el formulario
   ofrece "Otra ciudad…". Para agregar un país nuevo con lista, añádelo en RAW y en MAIN_COUNTRIES. */
const RAW = {
  'México': `Aguascalientes: Aguascalientes, Jesús María, Calvillo, Rincón de Romos
Baja California: Tijuana, Mexicali, Ensenada, Tecate, Rosarito
Baja California Sur: La Paz, Los Cabos, Cabo San Lucas, San José del Cabo, Comondú
Campeche: Campeche, Ciudad del Carmen, Champotón, Escárcega
Chiapas: Tuxtla Gutiérrez, Tapachula, San Cristóbal de las Casas, Comitán, Palenque
Chihuahua: Chihuahua, Ciudad Juárez, Cuauhtémoc, Delicias, Parral
Ciudad de México: Álvaro Obregón, Azcapotzalco, Benito Juárez, Coyoacán, Cuauhtémoc, Gustavo A. Madero, Iztapalapa, Miguel Hidalgo, Tlalpan, Venustiano Carranza
Coahuila: Saltillo, Torreón, Monclova, Piedras Negras, Ramos Arizpe
Colima: Colima, Manzanillo, Tecomán, Villa de Álvarez
Durango: Durango, Gómez Palacio, Lerdo
Estado de México: Toluca, Ecatepec, Naucalpan, Nezahualcóyotl, Tlalnepantla, Texcoco, Metepec, Cuautitlán Izcalli
Guanajuato: León, Guanajuato, Irapuato, Celaya, Salamanca, San Miguel de Allende
Guerrero: Acapulco, Chilpancingo, Taxco, Iguala, Zihuatanejo
Hidalgo: Pachuca, Tulancingo, Tula de Allende, Huejutla
Jalisco: Guadalajara, Zapopan, Tlaquepaque, Tonalá, Tlajomulco, El Salto, Puerto Vallarta, Tepatitlán, Lagos de Moreno, Ciudad Guzmán
Michoacán: Morelia, Uruapan, Zamora, Lázaro Cárdenas, Pátzcuaro
Morelos: Cuernavaca, Cuautla, Jiutepec, Temixco
Nayarit: Tepic, Bahía de Banderas, Santiago Ixcuintla, Compostela
Nuevo León: Monterrey, San Pedro Garza García, San Nicolás de los Garza, Guadalupe, Apodaca, Santa Catarina, Escobedo
Oaxaca: Oaxaca de Juárez, Salina Cruz, Juchitán, Huatulco, Puerto Escondido
Puebla: Puebla, Tehuacán, Cholula, Atlixco, San Martín Texmelucan
Querétaro: Querétaro, San Juan del Río, Corregidora, El Marqués
Quintana Roo: Cancún, Playa del Carmen, Chetumal, Tulum, Cozumel
San Luis Potosí: San Luis Potosí, Soledad de Graciano Sánchez, Ciudad Valles, Matehuala
Sinaloa: Culiacán, Mazatlán, Los Mochis, Guasave
Sonora: Hermosillo, Ciudad Obregón, Nogales, San Luis Río Colorado, Guaymas
Tabasco: Villahermosa, Cárdenas, Comalcalco, Paraíso
Tamaulipas: Reynosa, Tampico, Matamoros, Nuevo Laredo, Ciudad Victoria
Tlaxcala: Tlaxcala, Apizaco, Huamantla
Veracruz: Veracruz, Xalapa, Coatzacoalcos, Córdoba, Orizaba, Poza Rica
Yucatán: Mérida, Valladolid, Progreso, Tizimín
Zacatecas: Zacatecas, Fresnillo, Guadalupe, Jerez`,

  'Estados Unidos': `Alabama: Birmingham, Montgomery, Huntsville, Mobile
Alaska: Anchorage, Fairbanks, Juneau
Arizona: Phoenix, Tucson, Mesa, Tempe, Scottsdale
Arkansas: Little Rock, Fayetteville, Fort Smith
California: Los Ángeles, San Diego, San José, San Francisco, Sacramento, Fresno, Long Beach, Oakland
Carolina del Norte: Charlotte, Raleigh, Greensboro, Durham
Carolina del Sur: Charleston, Columbia, Greenville
Colorado: Denver, Colorado Springs, Aurora, Boulder
Connecticut: Hartford, New Haven, Stamford, Bridgeport
Dakota del Norte: Fargo, Bismarck
Dakota del Sur: Sioux Falls, Rapid City
Delaware: Wilmington, Dover
Distrito de Columbia: Washington D. C.
Florida: Miami, Orlando, Tampa, Jacksonville, Fort Lauderdale, Hialeah
Georgia: Atlanta, Savannah, Augusta, Columbus
Hawái: Honolulu, Hilo
Idaho: Boise, Meridian, Nampa
Illinois: Chicago, Aurora, Naperville, Springfield
Indiana: Indianápolis, Fort Wayne, Evansville
Iowa: Des Moines, Cedar Rapids, Davenport
Kansas: Wichita, Kansas City, Topeka, Overland Park
Kentucky: Louisville, Lexington, Bowling Green
Luisiana: Nueva Orleans, Baton Rouge, Shreveport
Maine: Portland, Augusta, Bangor
Maryland: Baltimore, Annapolis, Rockville
Massachusetts: Boston, Worcester, Cambridge, Springfield
Míchigan: Detroit, Grand Rapids, Lansing, Ann Arbor
Minnesota: Mineápolis, Saint Paul, Rochester
Misisipi: Jackson, Gulfport, Biloxi
Misuri: Kansas City, San Luis, Springfield
Montana: Billings, Missoula, Bozeman
Nebraska: Omaha, Lincoln
Nevada: Las Vegas, Reno, Henderson
Nueva Hampshire: Manchester, Concord, Nashua
Nueva Jersey: Newark, Jersey City, Paterson, Trenton
Nueva York: Nueva York, Brooklyn, Queens, Buffalo, Rochester, Albany
Nuevo México: Albuquerque, Santa Fe, Las Cruces
Ohio: Columbus, Cleveland, Cincinnati, Toledo
Oklahoma: Oklahoma City, Tulsa, Norman
Oregón: Portland, Salem, Eugene
Pensilvania: Filadelfia, Pittsburgh, Allentown, Harrisburg
Rhode Island: Providence, Warwick, Cranston
Tennessee: Nashville, Memphis, Knoxville, Chattanooga
Texas: Houston, San Antonio, Dallas, Austin, El Paso, Fort Worth, McAllen
Utah: Salt Lake City, Provo, Ogden
Vermont: Burlington, Montpelier
Virginia: Richmond, Virginia Beach, Norfolk, Arlington
Virginia Occidental: Charleston, Morgantown, Huntington
Washington: Seattle, Spokane, Tacoma, Vancouver
Wisconsin: Milwaukee, Madison, Green Bay
Wyoming: Cheyenne, Casper, Laramie`,

  'Chile': `Arica y Parinacota: Arica
Tarapacá: Iquique, Alto Hospicio
Antofagasta: Antofagasta, Calama
Atacama: Copiapó, Vallenar
Coquimbo: La Serena, Coquimbo, Ovalle
Valparaíso: Valparaíso, Viña del Mar, Quilpué, Villa Alemana, San Antonio
Metropolitana de Santiago: Santiago, Puente Alto, Maipú, Las Condes, Providencia, Ñuñoa, La Florida
O'Higgins: Rancagua, San Fernando, Rengo
Maule: Talca, Curicó, Linares
Ñuble: Chillán, San Carlos
Biobío: Concepción, Talcahuano, Los Ángeles, Coronel
La Araucanía: Temuco, Villarrica, Pucón, Angol
Los Ríos: Valdivia, La Unión
Los Lagos: Puerto Montt, Osorno, Castro, Puerto Varas
Aysén: Coyhaique, Puerto Aysén
Magallanes y de la Antártica Chilena: Punta Arenas, Puerto Natales`,

  'Perú': `Amazonas: Chachapoyas, Bagua
Áncash: Huaraz, Chimbote
Apurímac: Abancay, Andahuaylas
Arequipa: Arequipa, Camaná, Mollendo
Ayacucho: Ayacucho, Huanta
Cajamarca: Cajamarca, Jaén, Chota
Callao: Callao, Ventanilla
Cusco: Cusco, Urubamba, Sicuani, Quillabamba
Huancavelica: Huancavelica
Huánuco: Huánuco, Tingo María
Ica: Ica, Chincha Alta, Pisco, Nazca
Junín: Huancayo, Tarma, La Oroya
La Libertad: Trujillo, Chepén, Huamachuco
Lambayeque: Chiclayo, Lambayeque, Ferreñafe
Lima: Lima, Miraflores, San Isidro, Santiago de Surco, San Juan de Lurigancho, Huacho, Barranca
Loreto: Iquitos, Yurimaguas
Madre de Dios: Puerto Maldonado
Moquegua: Moquegua, Ilo
Pasco: Cerro de Pasco, Oxapampa
Piura: Piura, Sullana, Talara, Paita
Puno: Puno, Juliaca
San Martín: Tarapoto, Moyobamba
Tacna: Tacna
Tumbes: Tumbes
Ucayali: Pucallpa`,

  'Argentina': `Ciudad Autónoma de Buenos Aires: Buenos Aires
Buenos Aires: La Plata, Mar del Plata, Bahía Blanca, Quilmes, Lanús, Tandil
Catamarca: San Fernando del Valle de Catamarca
Chaco: Resistencia, Presidencia Roque Sáenz Peña
Chubut: Comodoro Rivadavia, Trelew, Puerto Madryn, Esquel
Córdoba: Córdoba, Río Cuarto, Villa María, Villa Carlos Paz
Corrientes: Corrientes, Goya, Paso de los Libres
Entre Ríos: Paraná, Concordia, Gualeguaychú
Formosa: Formosa, Clorinda
Jujuy: San Salvador de Jujuy, Palpalá
La Pampa: Santa Rosa, General Pico
La Rioja: La Rioja, Chilecito
Mendoza: Mendoza, San Rafael, Godoy Cruz, Luján de Cuyo
Misiones: Posadas, Oberá, Puerto Iguazú
Neuquén: Neuquén, Plottier, San Martín de los Andes, Centenario
Río Negro: San Carlos de Bariloche, Viedma, General Roca, Cipolletti
Salta: Salta, San Ramón de la Nueva Orán, Tartagal
San Juan: San Juan, Rivadavia, Chimbas
San Luis: San Luis, Villa Mercedes
Santa Cruz: Río Gallegos, Caleta Olivia, El Calafate
Santa Fe: Rosario, Santa Fe, Rafaela, Venado Tuerto
Santiago del Estero: Santiago del Estero, La Banda
Tierra del Fuego: Ushuaia, Río Grande
Tucumán: San Miguel de Tucumán, Yerba Buena, Tafí Viejo`,
};

/* GEO[país][estado] = [ciudades] */
export const GEO = {};
for (const [country, text] of Object.entries(RAW)) {
  GEO[country] = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf(':');
    if (i < 1) continue;
    GEO[country][line.slice(0, i).trim()] = line.slice(i + 1).split(',').map((c) => c.trim()).filter(Boolean);
  }
}

/* Los países con lista completa van primero en el selector */
export const MAIN_COUNTRIES = ['México', 'Estados Unidos', 'Chile', 'Perú', 'Argentina'];
export const COUNTRIES = [...MAIN_COUNTRIES, 'Bolivia', 'Brasil', 'Canadá', 'Colombia', 'Costa Rica', 'Cuba', 'Ecuador', 'El Salvador',
  'España', 'Guatemala', 'Honduras', 'Nicaragua', 'Panamá', 'Paraguay', 'Puerto Rico', 'República Dominicana', 'Uruguay', 'Venezuela'];

/* ============================================================
   Normalización: "Jal", "jalisco", "JAL." y "Jalisco" son el MISMO estado.
   Se usa al leer cualquier perfil o publicación, y cada persona corrige su propio perfil al entrar.
   ============================================================ */
const nz = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const key = (s) => nz(s).replace(/[^a-z0-9ñ]/g, '');            // sin acentos, espacios ni puntos

const COUNTRY_ALIASES = {
  mx: 'México', mexico: 'México', mexicanos: 'México',
  eeuu: 'Estados Unidos', usa: 'Estados Unidos', us: 'Estados Unidos', unitedstates: 'Estados Unidos', estadosunidosdeamerica: 'Estados Unidos', estadosunidosdeamérica: 'Estados Unidos',
  espana: 'España', brazil: 'Brasil', canada: 'Canadá', rd: 'República Dominicana',
};
const COUNTRY_KEYS = new Map(COUNTRIES.map((c) => [key(c), c]));
export function canonCountry(v) {
  const k = key(v);
  return !k ? '' : COUNTRY_KEYS.get(k) || COUNTRY_ALIASES[k] || String(v).trim().replace(/\s+/g, ' ');
}

const STATE_ALIASES = {
  'México': {
    cdmx: 'Ciudad de México', df: 'Ciudad de México', distritofederal: 'Ciudad de México', mexicocity: 'Ciudad de México', ciudaddemexico: 'Ciudad de México',
    edomex: 'Estado de México', edodemex: 'Estado de México', estadomex: 'Estado de México', edomexico: 'Estado de México', edodemexico: 'Estado de México', edomx: 'Estado de México', mexico: 'Estado de México', mex: 'Estado de México', estadodemexico: 'Estado de México',
    ags: 'Aguascalientes', dgo: 'Durango', bc: 'Baja California', bcs: 'Baja California Sur', nl: 'Nuevo León', qro: 'Querétaro', qroo: 'Quintana Roo',
    gto: 'Guanajuato', slp: 'San Luis Potosí', tamps: 'Tamaulipas', hgo: 'Hidalgo', jal: 'Jalisco', mich: 'Michoacán', chis: 'Chiapas', yuc: 'Yucatán',
  },
  'Estados Unidos': {
    al: 'Alabama', ak: 'Alaska', az: 'Arizona', ar: 'Arkansas', ca: 'California', co: 'Colorado', ct: 'Connecticut', de: 'Delaware', fl: 'Florida', ga: 'Georgia',
    hi: 'Hawái', hawaii: 'Hawái', id: 'Idaho', il: 'Illinois', in: 'Indiana', ia: 'Iowa', ks: 'Kansas', ky: 'Kentucky', la: 'Luisiana', louisiana: 'Luisiana', me: 'Maine',
    md: 'Maryland', ma: 'Massachusetts', mi: 'Míchigan', mn: 'Minnesota', ms: 'Misisipi', mississippi: 'Misisipi', mo: 'Misuri', missouri: 'Misuri', mt: 'Montana', ne: 'Nebraska',
    nv: 'Nevada', nh: 'Nueva Hampshire', newhampshire: 'Nueva Hampshire', nj: 'Nueva Jersey', newjersey: 'Nueva Jersey', nm: 'Nuevo México', newmexico: 'Nuevo México',
    ny: 'Nueva York', newyork: 'Nueva York', nc: 'Carolina del Norte', northcarolina: 'Carolina del Norte', nd: 'Dakota del Norte', northdakota: 'Dakota del Norte',
    oh: 'Ohio', ok: 'Oklahoma', or: 'Oregón', pa: 'Pensilvania', pennsylvania: 'Pensilvania', ri: 'Rhode Island', sc: 'Carolina del Sur', southcarolina: 'Carolina del Sur',
    sd: 'Dakota del Sur', southdakota: 'Dakota del Sur', tn: 'Tennessee', tx: 'Texas', ut: 'Utah', vt: 'Vermont', va: 'Virginia', wa: 'Washington', wv: 'Virginia Occidental',
    westvirginia: 'Virginia Occidental', wi: 'Wisconsin', wy: 'Wyoming', dc: 'Distrito de Columbia', washingtondc: 'Distrito de Columbia',
  },
  'Chile': { rm: 'Metropolitana de Santiago', metropolitana: 'Metropolitana de Santiago', regionmetropolitana: 'Metropolitana de Santiago', santiago: 'Metropolitana de Santiago', araucania: 'La Araucanía', ohiggins: "O'Higgins", magallanes: 'Magallanes y de la Antártica Chilena' },
  'Perú': { limametropolitana: 'Lima', limaprovincias: 'Lima' },
  'Argentina': { caba: 'Ciudad Autónoma de Buenos Aires', capitalfederal: 'Ciudad Autónoma de Buenos Aires', ciudaddebuenosaires: 'Ciudad Autónoma de Buenos Aires', bsas: 'Ciudad Autónoma de Buenos Aires', pba: 'Buenos Aires', provinciadebuenosaires: 'Buenos Aires' },
};
const STATE_KEYS = {};
for (const [c, tree] of Object.entries(GEO)) STATE_KEYS[c] = Object.keys(tree).map((s) => [key(s), s]);

/* Estado canónico de un país con lista. Acepta abreviaturas ("Jal", "TX", "CDMX"), mayúsculas, acentos y puntos. */
export function canonState(country, v) {
  const raw = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const list = STATE_KEYS[country];
  if (!list) return raw;                                            // países sin lista: se deja como se escribió
  let k = key(raw);
  const exact = list.find(([sk]) => sk === k);
  if (exact) return exact[1];
  const alias = (STATE_ALIASES[country] || {})[k];
  if (alias) return alias;
  k = k.replace(/^(estadode|provinciade|regionde|departamentode)/, '');
  const exact2 = list.find(([sk]) => sk === k);
  if (exact2) return exact2[1];
  if (k.length >= 3) {
    const byPrefix = list.filter(([sk]) => sk.startsWith(k));        // "jal" → Jalisco, "guana" → Guanajuato
    if (byPrefix.length === 1) return byPrefix[0][1];
    const longer = list.filter(([sk]) => sk.length >= 4 && k.startsWith(sk)).sort((x, y) => y[0].length - x[0].length);   // "Lima Metropolitana"
    if (longer.length) return longer[0][1];
  }
  return raw;
}

const CITY_ALIASES = { gdl: 'Guadalajara', tlajomulcodezuniga: 'Tlajomulco', tlajomulcodezúñiga: 'Tlajomulco', monterey: 'Monterrey', nyc: 'Nueva York', newyork: 'Nueva York', losangeles: 'Los Ángeles', la: 'Los Ángeles' };
const CITY_KEYS = {};
for (const [c, tree] of Object.entries(GEO)) {
  CITY_KEYS[c] = {};
  for (const [s, cities] of Object.entries(tree)) CITY_KEYS[c][s] = new Map(cities.map((x) => [key(x), x]));
}
export function canonCity(country, state, v) {
  const raw = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const k = key(raw), tree = CITY_KEYS[country];
  if (!tree) return raw;
  const inState = tree[state] && tree[state].get(k);
  if (inState) return inState;
  const alias = CITY_ALIASES[k];
  if (alias && (!tree[state] || tree[state].has(key(alias)))) return alias;
  if (!tree[state]) {                                               // sin estado claro: solo si el nombre es único en el país
    const hits = Object.values(tree).map((m) => m.get(k)).filter(Boolean);
    if (new Set(hits).size === 1 && hits.length === 1) return hits[0];
  }
  return raw;
}