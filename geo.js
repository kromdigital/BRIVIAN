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