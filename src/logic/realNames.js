// Real-world reference data used ONLY so the name generators can refuse a collision.
// Pure data, no logic besides the tiny hash helper. Nothing in here is ever shown to the player.
//
//   REAL_CLUB_GAZETTEER   plain-text list of well-known real club names and the town / city names they
//                         are built on (written from memory, NOT exhaustive). names.js reduces every entry
//                         to a "core" (accent-folded, generic words such as FC / United / City / Real
//                         removed) and rerolls any generated club or place whose core is in the list.
//   REAL_PLAYER_HASHES    FNV-1a 32-bit hashes (8 hex digits each) of the normalised "first last" form of
//                         well-known professional players. Hashed on purpose: the source does not carry
//                         plaintext real names. Normalisation = lowercase, accents folded, every run of
//                         non alphanumerics collapsed to one space (see normKey in names.js).
//
// To extend the player list: hashKey(normKey('First Last')) and append the 8 hex digits (any order, the
// loader ignores whitespace). To extend the gazetteer: append plain entries, comma or newline separated.

/** FNV-1a 32 bit hash of a string (UTF-16 code units). */
export function hashKey(s, h = 0x811c9dc5) {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const list = (str) => str.split(/\s*[,\n]\s*/).map((s) => s.trim()).filter(Boolean);

export const REAL_CLUB_GAZETTEER = Object.freeze([
  // ---- England: top flight, Championship, League One/Two, notable non-league and their towns
  ...list(`Arsenal, Chelsea, Liverpool, Everton, Tottenham Hotspur, Tottenham, Manchester United, Manchester City, Manchester, Newcastle United, Newcastle, West Ham United, West Ham, Aston Villa, Birmingham,
Leeds United, Leeds, Leicester City, Leicester, Wolverhampton Wanderers, Wolverhampton, Wolves, Brighton and Hove Albion, Brighton, Hove, Crystal Palace, Fulham, Brentford, Southampton, Nottingham Forest, Nottingham, Notts County,
Burnley, Sheffield United, Sheffield Wednesday, Sheffield, Norwich City, Norwich, Watford, Bournemouth, Ipswich Town, Ipswich, Derby County, Derby, Stoke City, Stoke, West Bromwich Albion, West Brom, Sunderland,
Middlesbrough, Blackburn Rovers, Blackburn, Bolton Wanderers, Bolton, Cardiff City, Cardiff, Swansea City, Swansea, Coventry City, Coventry, Portsmouth, Reading, Charlton Athletic, Charlton, Queens Park Rangers, Huddersfield Town,
Huddersfield, Luton Town, Luton, Wigan Athletic, Wigan, Hull City, Hull, Barnsley, Blackpool, Bristol City, Bristol Rovers, Bristol, Millwall, Preston North End, Preston, Rotherham United, Rotherham, Oxford United, Oxford City, Oxford,
Peterborough United, Peterborough, Plymouth Argyle, Plymouth, Wycombe Wanderers, Wycombe, Cambridge United, Cambridge, Cheltenham Town, Cheltenham, Exeter City, Exeter, Fleetwood Town, Fleetwood, Lincoln City, Lincoln,
Morecambe, Port Vale, Burton Albion, Burton, Accrington Stanley, Accrington, Shrewsbury Town, Shrewsbury, Northampton Town, Northampton, Charlton, Gillingham, Doncaster Rovers, Doncaster, Crewe Alexandra, Crewe, Mansfield Town, Mansfield,
Walsall, Wrexham, Wrexham AFC, Salford City, Salford, Stockport County, Stockport, Sutton United, Sutton, Swindon Town, Swindon, Tranmere Rovers, Tranmere, Harrogate Town, Harrogate, Colchester United, Colchester, Crawley Town, Crawley,
Grimsby Town, Grimsby, Newport County, Newport, Forest Green Rovers, Forest Green, Bradford City, Bradford, Carlisle United, Carlisle, Barrow, Rochdale, Oldham Athletic, Oldham, Bury, Scunthorpe United, Scunthorpe, Southend United,
Southend, Leyton Orient, Leyton, Orient, Stevenage, Hartlepool United, Hartlepool, Gateshead, York City, York, Altrincham, Aldershot Town, Aldershot, Dagenham and Redbridge, Dagenham, Woking, Bromley, Maidenhead United, Maidenhead,
Solihull Moors, Solihull, Eastleigh, Boreham Wood, Wealdstone, Halifax Town, Halifax, Chesterfield, Torquay United, Torquay, Yeovil Town, Yeovil, Dover Athletic, Dover, Ebbsfleet United, Ebbsfleet, Maidstone United, Maidstone,
Braintree Town, Braintree, Chelmsford City, Chelmsford, Welling United, Welling, Hereford, Kidderminster Harriers, Kidderminster, Macclesfield Town, Macclesfield, Telford United, Telford, Stalybridge Celtic, Stalybridge,
Nuneaton Borough, Nuneaton, Rushden and Diamonds, Rushden, Kettering Town, Kettering, Grantham Town, Grantham, Boston United, Boston, Gainsborough Trinity, Gainsborough, Scarborough, Whitby Town, Whitby, Guiseley, Bishop Auckland,
Blyth Spartans, Blyth, Spennymoor Town, Spennymoor, Darlington, Workington, Southport, Chorley, Fylde, Kendal Town, Kendal, Lancaster City, Lancaster, Ashton United, Ashton, Droylsden, Mossley, Hyde United, Hyde, Witton Albion,
Northwich Victoria, Northwich, Runcorn, Warrington, Widnes, Vauxhall Motors, Marine, Skelmersdale United, Skelmersdale, Burscough, Bamber Bridge, Leek Town, Leek, Buxton, Matlock Town, Matlock, Alfreton Town, Alfreton, Ilkeston,
Belper Town, Belper, Stafford Rangers, Stafford, Rugby Town, Rugby, Redditch United, Redditch, Bromsgrove Sporting, Bromsgrove, Worcester City, Worcester, Gloucester City, Gloucester, Cirencester, Swindon Supermarine,
Ashford Town, Ashford, Folkestone Invicta, Folkestone, Margate, Ramsgate, Sittingbourne, Faversham, Whitstable, Herne Bay, Tonbridge Angels, Tonbridge, Dartford, Gravesend, Erith, Bexley, Carshalton Athletic, Carshalton,
Kingstonian, Kingston, Tooting and Mitcham United, Tooting, Mitcham, Wimbledon, AFC Wimbledon, Dulwich Hamlet, Dulwich, Hampton and Richmond Borough, Hampton, Richmond, Staines Town, Staines, Slough Town, Slough, Windsor,
Hayes and Yeading, Hayes, Uxbridge, Harrow Borough, Harrow, Wealdstone, Enfield Town, Enfield, Barnet, Hendon, Hitchin Town, Hitchin, Hemel Hempstead Town, Hemel Hempstead, St Albans City, St Albans, Watford, Luton,
Dunstable, Bedford Town, Bedford, Biggleswade, Cambridge City, Histon, Ely City, Ely, King's Lynn Town, King's Lynn, Lynn, Dereham, Gorleston, Lowestoft Town, Lowestoft, Great Yarmouth, Yarmouth, Bury Town, Bury St Edmunds,
Sudbury, Haverhill, Newmarket Town, Newmarket, Thetford, Brightlingsea, Harlow Town, Harlow, Chesham United, Chesham, Aylesbury United, Aylesbury, Banbury United, Banbury, Brackley Town, Brackley, Towcester, Daventry, Corby Town,
Corby, Stamford, Spalding United, Spalding, Boston, Louth, Lincoln, Cleethorpes, Bridlington Town, Bridlington, Hornsea, Beverley, Selby Town, Selby, Goole, Thorne, Worksop Town, Worksop, Retford, Newark, Loughborough,
Hinckley, Coalville Town, Coalville, Shepshed, Melton Town, Melton Mowbray, Oakham, Market Harborough, Lutterworth, Barwell, Stratford, Warwick, Leamington, Kenilworth, Bedworth, Atherstone, Tamworth, Lichfield, Burntwood,
Cannock, Rugeley, Stone Dominoes, Stone, Newcastle Town, Crewe, Nantwich Town, Nantwich, Congleton Town, Congleton, Winsford United, Winsford, Sandbach, Middlewich, Ellesmere Port, Chester, Bangor City, Rhyl, Prestatyn Town,
Prestatyn, Colwyn Bay, Llandudno, Caernarfon Town, Caernarfon, Bala Town, Bala, Connah's Quay Nomads, Connah's Quay, Airbus UK Broughton, Airbus, Flint Town United, Flint, Holywell, Mold, Newtown, Welshpool, Aberystwyth Town,
Aberystwyth, Barry Town United, Barry Town, Barry, Penybont, Bridgend Town, Bridgend, Pontypridd, Merthyr Town, Merthyr Tydfil, Merthyr, Llanelli, Carmarthen Town, Carmarthen, Haverfordwest County, Haverfordwest, Cwmbran Town,
Cwmbran, Taff's Well, Caerau, Cefn Druids, Cefn, Penrith, Keswick, Whitehaven, Cleator Moor, Penzance, Truro City, Truro, Bodmin, Newquay, Falmouth, St Austell, Saltash, Tavistock, Okehampton, Barnstaple, Bideford, Taunton Town,
Taunton, Bridgwater, Weston-super-Mare, Weston, Clevedon, Paulton Rovers, Paulton, Bath City, Bath, Frome Town, Frome, Salisbury, Weymouth, Dorchester Town, Dorchester, Poole Town, Poole, Wimborne Town, Wimborne, Christchurch,
Havant and Waterlooville, Havant, Gosport Borough, Gosport, Fareham Town, Fareham, Basingstoke Town, Basingstoke, Farnborough, Farnham, Guildford City, Guildford, Woking, Walton Casuals, Epsom and Ewell, Epsom, Leatherhead,
Dorking, Horsham, Crawley Down, Burgess Hill Town, Burgess Hill, Lewes, Eastbourne Borough, Eastbourne Town, Eastbourne, Hastings United, Hastings, Bognor Regis Town, Bognor Regis, Bognor, Worthing, Littlehampton, Chichester City,
Chichester, Whitehawk, Hove, Shoreham, Newhaven, Peacehaven, Bexhill, Rye, Hythe Town, Hythe, Deal Town, Deal, Canterbury City, Canterbury, Cheshunt, Hertford Town, Hertford, Ware, Hoddesdon, Potters Bar Town, Potters Bar,
Billericay Town, Billericay, Basildon United, Basildon, Canvey Island, Concord Rangers, Southend Manor, Maldon, Heybridge Swifts, Witham Town, Witham, Clacton, Harwich, Felixstowe, Leiston, Needham Market, Stowmarket,
Whitley Bay, Whickham, Morpeth Town, Morpeth, Ashington, Alnwick, Berwick Rangers, Berwick, Consett, Chester-le-Street, Durham City, Durham, Washington, Jarrow, South Shields, Hebburn Town, Hebburn, North Shields, Tynemouth,
Redcar, Guisborough, Stockton, Billingham Synthonia, Billingham, Thornaby, Bedlington, Cramlington, Seaham, Peterlee, Tow Law Town, Tow Law, Shildon, Newton Aycliffe, Newton Heath, Rotherham, Ossett, Wakefield, Pontefract, Castleford,
Featherstone, Barnsley, Penistone, Stocksbridge Park Steels, Stocksbridge, Frickley, Brighouse Town, Brighouse, Farsley, Pudsey, Bingley, Keighley, Skipton, Ilkley, Otley, Wetherby, Knaresborough, Ripon, Thirsk, Northallerton,
Richmond, Pickering, Malton, Driffield, Easingwold, Nelson, Colne, Clitheroe, Darwen, Rossendale United, Rossendale, Padiham, Great Harwood, Atherton Collieries, Atherton, Leigh, Chadderton, Radcliffe, Prestwich, Whitefield, Trafford,
Stretford, Urmston, Sale, Altrincham, Wythenshawe, Cheadle, Hazel Grove, Bredbury, Glossop North End, Glossop, Chapel-en-le-Frith, New Mills, Whaley Bridge, Brigg Town, Brigg, Barton Town, Barton, Winterton, Kirton, Holbeach United,
Holbeach, Wisbech Town, Wisbech, March Town United, March, Chatteris, Huntingdon, St Neots Town, St Neots, Godmanchester Rovers, Godmanchester, St Ives, Peterborough Sports, Stotfold, Arlesey Town, Arlesey, Letchworth, Baldock,
Royston Town, Royston, Bishop's Stortford, Stansted, Saffron Walden Town, Saffron Walden, Halstead, Coggeshall, Tiptree, Burnham Ramblers, Burnham, Wivenhoe, Dagenham, Romford, Hornchurch, Aveley, Tilbury, Grays Athletic, Grays,
East Thurrock, Thurrock, Purfleet, Leyton, Walthamstow, Haringey Borough, Haringey, Tottenham, Edgware Town, Edgware, Wembley, Hanwell Town, Hanwell, Southall, Hillingdon Borough, Hillingdon, Northwood, Ruislip, Ashford Town Middlesex,
Bedfont, Hampton, Feltham, Hounslow, Chertsey Town, Chertsey, Egham Town, Egham, Camberley, Frimley Green, Ash United, Alton Town, Alton, Petersfield, Horndean, Andover, Romsey, Eastleigh, Totton, Lymington, Brockenhurst,
Ryde, Newport IOW, Cowes, Isle of Wight`),
  // ---- Scotland, Wales, Ireland
  ...list(`Celtic, Rangers, Heart of Midlothian, Hearts, Hibernian, Hibs, Aberdeen, Dundee United, Dundee, Motherwell, Kilmarnock, St Mirren, St Johnstone, Ross County, Livingston, Partick Thistle, Greenock Morton,
Morton, Hamilton Academical, Hamilton, Inverness Caledonian Thistle, Inverness, Falkirk, Dunfermline Athletic, Dunfermline, Raith Rovers, Raith, Queen of the South, Ayr United, Ayr, Arbroath, Montrose, Forfar Athletic, Forfar,
Brechin City, Brechin, Cove Rangers, Cove, Peterhead, Elgin City, Elgin, Buckie Thistle, Buckie, Keith, Huntly, Fraserburgh, Formartine United, Formartine, Turriff United, Turriff, Banks o' Dee, Brora Rangers, Brora, Clachnacuddin,
Nairn County, Nairn, Wick Academy, Wick, Stenhousemuir, Alloa Athletic, Alloa, Stirling Albion, Stirling, Clyde, Airdrieonians, Airdrie, Cowdenbeath, East Fife, Annan Athletic, Annan, Stranraer, Albion Rovers, Queens Park,
Dumbarton, Dumfries, East Stirlingshire, Edinburgh City, Edinburgh, Glasgow, Hawick, Gala Fairydean, Gala, Selkirk, Kelso, Peebles, Spartans, Civil Service Strollers, Linlithgow, Bo'ness, Bonnyrigg Rose, Bonnyrigg, Tranent,
Musselburgh, Dalkeith, Livingston, Broxburn, Bathgate, Whitburn, Armadale, Grangemouth, Larbert, Bo'ness United, Kirkcaldy, Glenrothes, Kelty Hearts, Kelty, Lochgelly, Burntisland, Leven, Cupar, St Andrews, Crieff, Perth,
Auchterarder, Blairgowrie, Forfar, Kirriemuir, Carnoustie, Broughty Ferry, Lochee, Dundee North End, Stonehaven, Inverurie Locos, Inverurie, Ellon, Oban, Fort William, Dingwall, Tain, Dornoch, Thurso, Kirkwall, Lerwick,
Stornoway, Largs, Irvine, Kilwinning, Troon, Prestwick, Girvan, Cumnock, Auchinleck Talbot, Auchinleck, Beith, Kilbirnie, Johnstone, Paisley, Renfrew, Clydebank, Dumbarton, Alexandria, Helensburgh, Greenock, Port Glasgow,
Gourock, Coatbridge, Motherwell, Wishaw, Larkhall, Lanark, Carluke, Rutherglen, Cambuslang, East Kilbride, Cumbernauld, Kilsyth, Kirkintilloch, Bearsden, Milngavie, Falkirk, Denny, Bonnybridge, Dunblane, Callander, Tillicoultry,
Alva, Dollar, Kinross, Aberdeen, Inverness, Dundee, Perth,
Cardiff City, Swansea City, Newport County, Wrexham, Merthyr Town, The New Saints, TNS, Total Network Solutions, Llansantffraid, Oswestry, Bangor, Rhyl, Porthmadog, Pwllheli, Blaenau Ffestiniog, Llangefni, Holyhead, Amlwch,
Shamrock Rovers, Bohemians, Bohemian, Shelbourne, St Patrick's Athletic, Dundalk, Derry City, Derry, Cork City, Cork, Sligo Rovers, Sligo, Galway United, Galway, Waterford, Limerick, Finn Harps, Bray Wanderers, Bray,
Drogheda United, Drogheda, Athlone Town, Athlone, Longford Town, Longford, Kilkenny City, Kilkenny, Wexford, Cobh Ramblers, Cobh, Treaty United, Treaty, Dublin, Tallaght, Tolka Rovers, Tolka, Home Farm, Belvedere,
Linfield, Glentoran, Cliftonville, Crusaders, Coleraine, Larne, Glenavon, Portadown, Ballymena United, Ballymena, Carrick Rangers, Carrick, Dungannon Swifts, Dungannon, Newry City, Newry, Warrenpoint Town, Warrenpoint,
Loughgall, Ards, Bangor, Lisburn, Lurgan, Armagh, Omagh, Enniskillen, Limavady, Ballyclare, Ballymoney, Banbridge, Annagh United, Institute, Knockbreda, Dergview, Tobermore United, Tobermore`),
  // ---- Spain
  ...list(`Real Madrid, Madrid, Barcelona, Atletico Madrid, Atletico de Madrid, Sevilla, Real Betis, Betis, Valencia, Villarreal, Athletic Bilbao, Athletic Club, Bilbao, Real Sociedad, San Sebastian, Donostia, Celta Vigo, Celta, Vigo,
Getafe, Espanyol, Osasuna, Pamplona, Mallorca, Palma, Girona, Rayo Vallecano, Vallecas, Alaves, Vitoria, Gasteiz, Granada, Levante, Cadiz, Elche, Almeria, Real Valladolid, Valladolid, Deportivo La Coruna, La Coruna, Coruna, Malaga,
Sporting Gijon, Gijon, Real Zaragoza, Zaragoza, Las Palmas, Tenerife, Racing Santander, Santander, Real Oviedo, Oviedo, Eibar, Leganes, Real Murcia, Murcia, Albacete, Numancia, Soria, Huesca, Mirandes, Miranda de Ebro,
Cartagena, Lugo, Ponferradina, Ponferrada, Fuenlabrada, Alcorcon, Rayo Majadahonda, Majadahonda, Sabadell, Terrassa, Badalona, Cornella, Hospitalet, L'Hospitalet, Lleida, Tarragona, Gimnastic de Tarragona, Reus, Figueres, Olot,
Llagostera, Europa, Gracia, Andorra, Ibiza, Formentera, Menorca, Atletico Baleares, Poblense, Constancia, Inca, Manacor, Alcoyano, Alcoy, Elda, Orihuela, Hercules, Alicante, Benidorm, Villajoyosa, Torrevieja, Castellon,
Villarreal, Vila-real, Onda, Burriana, Sagunto, Saguntino, Gandia, Alzira, Ontinyent, Paterna, Mestalla, Valencia Mestalla, Villareal, Lorca, Yeclano, Yecla, Jumilla, Caravaca, Aguilas, Mazarron, Cieza, Totana, Linares,
Jaen, Martos, Baeza, Ubeda, Antequera, Ronda, Marbella, Estepona, Fuengirola, Torremolinos, Velez-Malaga, Velez, Motril, Almunecar, Guadix, Baza, Roquetas, El Ejido, Ejido, Poli Ejido, Vera, Huercal-Overa, Huercal, Linares Deportivo,
Cordoba, Lucena, Puente Genil, Cabra, Montilla, Pozoblanco, Villanueva de Cordoba, Ecija, Utrera, Dos Hermanas, Alcala de Guadaira, Alcala, Mairena, Coria, Sanlucar, Jerez, Xerez, Puerto Real, Chiclana, Algeciras, La Linea, San Roque,
Ceuta, Melilla, Huelva, Recreativo de Huelva, Recreativo, Lepe, Ayamonte, Isla Cristina, Almonte, Badajoz, Merida, Don Benito, Villanovense, Villanueva de la Serena, Caceres, Plasencia, Coria, Navalmoral, Talavera, Toledo, Ciudad Real,
Puertollano, Manzanares, Valdepenas, Alcazar de San Juan, Tomelloso, Cuenca, Guadalajara, Azuqueca, Albacete, Hellin, Almansa, Villarrobledo, Segovia, Avila, Salamanca, Zamora, Leon, Cultural Leonesa, Astorga, Burgos, Aranda, Palencia,
Arandina, Ponferrada, Bembibre, Logrono, Calahorra, Haro, Pamplona, Tudela, Tafalla, Huesca, Barbastro, Ejea, Teruel, Calamocha, Alcaniz, Fraga, Monzon, Binefar, Lleida, Balaguer, Tremp, Vic, Manresa, Igualada, Mataro, Granollers,
Sant Andreu, Sant Cugat, Rubi, Martorell, Vilafranca, Vilanova, Sitges, Reus Deportiu, Valls, Tortosa, Amposta, Vinaros, Benicarlo, Pontevedra, Ourense, Orense, Lugo, Santiago, Compostela, Ferrol, Racing de Ferrol, Betanzos, Arosa,
Cultural Durango, Durango, Barakaldo, Portugalete, Sestao, Sestao River, Getxo, Leioa, Basconia, Bermeo, Amorebieta, Llodio, Laudio, Eibar, Tolosa, Irun, Real Union, Hondarribia, Zarautz, Beasain, Pasaia, Lemona, Gernika, Santurtzi,
Laredo, Castro, Torrelavega, Gimnastica, Gimnastica de Torrelavega, Escobedo, Santoña, Llanes, Langreo, Mieres, Aviles, Real Aviles, Lealtad, Siero, Navarro, Tuilla, Covadonga, Caudal, Cangas, Colunga, Ribadesella,
Tenerife, Las Palmas, Lanzarote, Fuerteventura, Maspalomas, Telde, Marino, Arucas, Vecindario, Mensajero, Palma, La Palma, Gomera, Granadilla, Tenerife B, Laguna, La Laguna, Orotava, Guimar, Candelaria`),
  // ---- Italy
  ...list(`Juventus, Torino, Inter, Internazionale, AC Milan, Milan, Napoli, Naples, Roma, AS Roma, Lazio, Atalanta, Bergamo, Fiorentina, Florence, Firenze, Bologna, Genoa, Genova, Sampdoria, Udinese, Udine, Sassuolo,
Hellas Verona, Verona, Chievo, Cagliari, Lecce, Empoli, Parma, Monza, Spezia, La Spezia, Salernitana, Salerno, Cremonese, Cremona, Brescia, Palermo, Bari, Venezia, Venice, Frosinone, Como, Pisa, Cesena, Catania, Reggina,
Reggio Calabria, Reggio Emilia, Reggiana, Modena, Carpi, Mantova, Mantua, Padova, Padua, Vicenza, Treviso, Triestina, Trieste, Pordenone, Cittadella, Ascoli, Ancona, Perugia, Ternana, Terni, Spezia, Pescara, Foggia, Taranto,
Avellino, Benevento, Casertana, Caserta, Juve Stabia, Castellammare, Nocerina, Nocera, Cosenza, Catanzaro, Crotone, Lamezia Terme, Lamezia, Messina, Siracusa, Syracuse, Trapani, Akragas, Agrigento, Sassari, Torres, Olbia,
Arezzo, Siena, Livorno, Lucchese, Lucca, Pistoiese, Pistoia, Prato, Empoli, Carrarese, Carrara, Massa, Viareggio, Pontedera, Grosseto, Pianese, Montevarchi, Gubbio, Foligno, Spoleto, Viterbo, Viterbese, Latina, Frosinone,
Rieti, Fondi, Cassino, Sora, Formia, Gaeta, Potenza, Matera, Melfi, Bisceglie, Andria, Barletta, Monopoli, Fidelis Andria, Altamura, Brindisi, Francavilla, Virtus Francavilla, Gallipoli, Nardo, Martina Franca, Molfetta,
Ravenna, Rimini, Forli, Imolese, Imola, Faenza, Ferrara, SPAL, Piacenza, Lodigiani, Fidenza, Sambenedettese, San Benedetto, Fano, Fermana, Fermo, Jesina, Jesi, Matelica, Macerata, Maceratese, Civitanovese, Civitanova,
Teramo, Chieti, L'Aquila, Avezzano, Giulianova, Lanciano, Vasto, Campobasso, Isernia, Termoli, Cuneo, Alessandria, Novara, Vercelli, Pro Vercelli, Biella, Casale, Asti, Savona, Imperia, Sanremo, Albenga, Entella, Chiavari,
Lavagnese, Rapallo, Varese, Como, Lecco, Legnano, Busto Arsizio, Pro Patria, Gallarate, Saronno, Monza, Cremona, Crema, Pergolettese, Lodi, Pavia, Vigevano, Voghera, Bergamo, Albinoleffe, Alzano, Seriate, Brescia, Lumezzane,
Salo, Feralpisalo, Desenzano, Mantova, Pordenone, Udine, Gorizia, Monfalcone, Portogruaro, San Donato, Belluno, Bassano, Bassano Virtus, Schio, Legnago, Chioggia, Mestre, Venezia Mestre, Rovigo, Adria, Bolzano, Bozen, Merano,
Bressanone, Trento, Rovereto, Aosta, Aostana, Chivasso, Ivrea, Pinerolo, Saluzzo, Alba, Bra, Fossano, Mondovi, Savigliano, Nichelino, Moncalieri, Rivoli, Orbassano, Cuneo`),
  // ---- Germany
  ...list(`Bayern Munich, Bayern Munchen, Bayern, Munich, Munchen, Borussia Dortmund, Dortmund, Bayer Leverkusen, Leverkusen, RB Leipzig, Leipzig, Eintracht Frankfurt, Frankfurt, VfL Wolfsburg, Wolfsburg, Borussia Monchengladbach,
Monchengladbach, Gladbach, VfB Stuttgart, Stuttgart, Werder Bremen, Bremen, SC Freiburg, Freiburg, FC Koln, Koln, Cologne, Hertha BSC, Hertha, Berlin, Union Berlin, Mainz 05, Mainz, FC Augsburg, Augsburg, TSG Hoffenheim,
Hoffenheim, Schalke 04, Schalke, Gelsenkirchen, Hamburger SV, Hamburg, Hannover 96, Hannover, Hanover, Fortuna Dusseldorf, Dusseldorf, FC St Pauli, St Pauli, Holstein Kiel, Kiel, Hansa Rostock, Rostock, Dynamo Dresden, Dresden,
1 FC Nurnberg, Nurnberg, Nuremberg, Karlsruher SC, Karlsruhe, Darmstadt 98, Darmstadt, Arminia Bielefeld, Bielefeld, VfL Bochum, Bochum, Greuther Furth, Furth, Heidenheim, Paderborn, 1860 Munchen, Kaiserslautern,
Eintracht Braunschweig, Braunschweig, Brunswick, Magdeburg, Halle, Hallescher, Erzgebirge Aue, Aue, Chemnitz, Zwickau, Plauen, Jena, Carl Zeiss Jena, Erfurt, Rot-Weiss Erfurt, Cottbus, Energie Cottbus, Babelsberg, Potsdam,
Frankfurt Oder, Viktoria Berlin, Tennis Borussia, Tennis Borussia Berlin, Hertha Zehlendorf, Wacker Nordhausen, Nordhausen, Meuselwitz, Greifswald, Neubrandenburg, Schwerin, Lubeck, VfB Lubeck, Flensburg, Norderstedt, Oldenburg,
VfL Osnabruck, Osnabruck, Emden, Meppen, SV Meppen, Lotte, Rheine, Munster, Preussen Munster, Wiedenbruck, Rot-Weiss Essen, Essen, Rot-Weiss Oberhausen, Oberhausen, MSV Duisburg, Duisburg, Wuppertal, Wuppertaler SV,
Rot-Weiss Ahlen, Ahlen, Hamm, Lippstadt, Verl, Wiedenbruck, Bocholt, Velbert, Uerdingen, KFC Uerdingen, Krefeld, Aachen, Alemannia Aachen, Dren, Bonn, Bonner SC, Siegen, Siegburg, Troisdorf, Trier, Eintracht Trier, Koblenz,
TuS Koblenz, Worms, Wormatia Worms, Mannheim, Waldhof Mannheim, Sandhausen, Walldorf, Heidelberg, Pforzheim, Offenburg, Villingen, Balingen, Reutlingen, Tubingen, Ulm, SSV Ulm, Aalen, Sonnenhof Grossaspach, Grossaspach, Stuttgarter
Kickers, Kickers, Offenbach, Kickers Offenbach, Hanau, Aschaffenburg, Viktoria Aschaffenburg, Wurzburg, Wurzburger Kickers, Schweinfurt, Bamberg, Bayreuth, Hof, Regensburg, Jahn Regensburg, Straubing, Passau, Burghausen,
Wacker Burghausen, Rosenheim, Unterhaching, Ingolstadt, Schanzer, Memmingen, Kempten, Buchbach, Garching, Freiburger FC, Saarbrucken, Saarbrucken 1, Homburg, Elversberg, SV Elversberg, Neunkirchen, Saarlouis, Pirmasens,
Ludwigshafen, Frankenthal, Speyer, Karlsruher, Kassel, KSV Hessen Kassel, Baunatal, Gottingen, Goettingen, Goslar, Wolfenbuttel, Celle, Luneburg, Verden, Rotenburg, Stade, Buxtehude, Altona, Altona 93, Eimsbutteler, Barmbek, Victoria Hamburg,
Teutonia, Bergedorf, Wilhelmshaven, Jever, Leer, Aurich, Norden, Cuxhaven, Bremerhaven, Lehe, Hemelingen, Atlas Delmenhorst, Delmenhorst, Vechta, Cloppenburg, Lohne, Papenburg, Nordhorn, Lingen, Bad Kreuznach, Idar-Oberstein,
Weiden, Amberg, Schwandorf, Cham, Deggendorf, Landshut, Dingolfing, Vilshofen, Pfarrkirchen, Altotting, Traunstein, Miesbach, Bad Reichenhall, Garmisch, Kaufbeuren, Fussen, Landsberg, Dachau, Furstenfeldbruck, Erding, Freising,
Ismaning, Pullach, Hallbergmoos, Taufkirchen, Haar, Poing, Vaterstetten, Gruenwald, Starnberg, Weilheim, Penzberg, Wolfratshausen, Geretsried`),
  // ---- France
  ...list(`Paris Saint-Germain, Paris Saint Germain, PSG, Paris FC, Paris, Olympique de Marseille, Olympique Marseille, Marseille, Olympique Lyonnais, Olympique Lyon, Lyon, AS Monaco, Monaco, LOSC Lille, Lille, OGC Nice, Nice,
Stade Rennais, Rennes, RC Lens, Lens, Stade de Reims, Reims, FC Nantes, Nantes, Montpellier, RC Strasbourg, Strasbourg, Toulouse, FC Metz, Metz, Girondins de Bordeaux, Bordeaux, AS Saint-Etienne, Saint-Etienne,
Saint Etienne, Angers, Angers SCO, Stade Brestois, Brest, Clermont Foot, Clermont, Clermont-Ferrand, Lorient, Auxerre, AJ Auxerre, Troyes, ESTAC, Ajaccio, AC Ajaccio, Gazelec Ajaccio, SC Bastia, Bastia, Le Havre, Caen,
Stade Malherbe Caen, Guingamp, EA Guingamp, Dijon, Nancy, AS Nancy Lorraine, Sochaux, Amiens, Valenciennes, Nimes, Nimes Olympique, Orleans, Chateauroux, Le Mans, Laval, Stade Lavallois, Quevilly, Quevilly-Rouen, Rouen, Red Star,
Red Star Saint-Ouen, Saint-Ouen, Versailles, Pau, Pau FC, Niort, Chamois Niortais, Bourg-en-Bresse, Bourg-Peronnas, Grenoble, Annecy, Annecy FC, Chambery, Thonon, Evian, Evian Thonon Gaillard, Gaillard, Martigues, Istres, Aubagne,
Fréjus, Frejus, Frejus Saint-Raphael, Cannes, AS Cannes, Antibes, Grasse, Hyeres, Toulon, Sporting Toulon, La Seyne, Draguignan, Avignon, AC Arles-Avignon, Arles, Carcassonne, Beziers, AS Beziers, Sete, Perpignan, Canet, Narbonne,
Tarbes, Lourdes, Bayonne, Biarritz, Anglet, Bergerac, Perigueux, Agen, SU Agen, Montauban, Castres, Albi, Rodez, Rodez Aveyron, Millau, Cahors, Brive, Limoges, Poitiers, La Rochelle, Angouleme, Cognac, Saintes, Rochefort, Les Sables,
La Roche-sur-Yon, La Roche, Cholet, Saumur, Tours, Tours FC, Blois, Vierzon, Bourges, Nevers, Moulins, Montlucon, Vichy, Aurillac, Le Puy, Saint-Chamond, Saint-Priest, Villefranche, Roanne, Feurs, Firminy, Annonay, Valence, Romans,
Vienne, Bourgoin-Jallieu, Bourgoin, Chambery, Albertville, Aix-les-Bains, Aix, Aix-en-Provence, Gap, Digne, Manosque, Salon, Marignane, Vitrolles, Miramas, Port-de-Bouc, Beauvais, Creil, Compiegne, Senlis, Chantilly, Noisy-le-Sec,
Noisy, Bobigny, Drancy, Bondy, Montreuil, Vincennes, Saint-Maur, Creteil, Creteil-Lusitanos, Vitry, Ivry, Orly, Evry, Corbeil, Massy, Palaiseau, Rambouillet, Mantes, Poissy, Conflans, Cergy, Pontoise, Argenteuil, Sarcelles, Villepinte,
Aulnay, Tremblay, Meaux, Melun, Fontainebleau, Provins, Sens, Auxerre, Joigny, Troyes, Chaumont, Langres, Epinal, Nancy, Toul, Verdun, Bar-le-Duc, Sedan, CS Sedan Ardennes, Charleville, Charleville-Mezieres, Reims, Epernay, Chalons,
Chalons-en-Champagne, Vitry-le-Francois, Saint-Dizier, Mulhouse, Colmar, FC Mulhouse, Illzach, Haguenau, Schiltigheim, Sarreguemines, Forbach, Thionville, Yutz, Longwy, Hayange, Creutzwald, Saint-Avold, Epinal, Besancon,
Belfort, Montbeliard, Vesoul, Pontarlier, Dole, Lons-le-Saunier, Macon, Chalon, Chalon-sur-Saone, Le Creusot, Montceau, Autun, Beaune, Dijon, Auxerre, Mantes-la-Jolie, Lisieux, Evreux, Vernon, Dieppe, Fecamp, Bolbec, Elbeuf, Louviers,
Granville, Avranches, Cherbourg, AS Cherbourg, Saint-Lo, Flers, Alencon, Argentan, Lannion, Guingamp, Saint-Brieuc, Dinan, Dinard, Saint-Malo, Vitre, Fougeres, Lorient, Vannes, Pontivy, Ploermel, Concarneau, US Concarneau, Quimper,
Quimperle, Douarnenez, Landerneau, Morlaix, Brest, Saint-Pierre, Saint-Denis, Saint-Louis, Le Port, Le Tampon, Saint-Joseph, Saint-Paul, Nouméa, Noumea, Papeete, Pointe-a-Pitre, Fort-de-France, Cayenne, Kourou,
Dunkerque, USL Dunkerque, Calais, Boulogne, US Boulogne, Boulogne-sur-Mer, Arras, Bethune, Lievin, Henin-Beaumont, Douai, Lens, Valenciennes, Cambrai, Maubeuge, Roubaix, Tourcoing, Wasquehal, Villeneuve-d'Ascq, Seclin, Lambersart,
Marcq, Armentieres, Hazebrouck, Saint-Omer, Abbeville, Amiens, Saint-Quentin, Soissons, Laon, Chauny, Beauvais, Clermont-de-l'Oise, Compiègne, Noyon`),
  // ---- Portugal, Netherlands, Belgium
  ...list(`Benfica, FC Porto, Porto, Sporting CP, Sporting Lisbon, Sporting Clube de Portugal, Lisbon, Lisboa, Braga, Sporting Braga, Vitoria Guimaraes, Guimaraes, Vitoria Setubal, Setubal, Boavista, Belenenses, Maritimo,
Funchal, Nacional, Nacional da Madeira, Madeira, Pacos de Ferreira, Pacos, Gil Vicente, Barcelos, Rio Ave, Vila do Conde, Famalicao, Moreirense, Moreira de Conegos, Santa Clara, Ponta Delgada, Azores, Estoril, Estoril Praia,
Cascais, Arouca, Casa Pia, Farense, Faro, Portimonense, Portimao, Olhanense, Olhao, Louletano, Loule, Lagos, Lagoa, Tondela, Academica, Coimbra, Aveiro, Beira-Mar, Feirense, Santa Maria da Feira, Penafiel, Chaves, Desportivo de Chaves,
Vizela, Varzim, Povoa de Varzim, Leixoes, Matosinhos, Salgueiros, Espinho, Trofa, Paços, Fafe, Felgueiras, Lourosa, Oliveirense, Oliveira de Azemeis, Sporting Covilha, Covilha, Guarda, Viseu, Academico de Viseu, Mirandela, Bragança,
Braganca, Vila Real, Gondomar, Ermesinde, Maia, Lusitania, Angra, Praiense, Praia da Vitoria, Torreense, Torres Vedras, Caldas, Leiria, Uniao de Leiria, Pombal, Marinhense, Marinha Grande, Ourem, Fatima, Tomar, Torres Novas,
Santarem, Alverca, Vila Franca, Sacavem, Amadora, Estrela da Amadora, Oriental, Odivelas, Loures, Mafra, Sintra, Queluz, Belas, Alcochete, Montijo, Barreirense, Barreiro, Seixal, Almada, Sesimbra, Palmela, Pinhal Novo, Moita,
Beja, Evora, Lusitano Evora, Portalegre, Elvas, Estremoz, Montemor, Sines, Odemira, Castelo Branco, Fundao, Mortagua, Anadia, Mealhada, Agueda, Albergaria, Sever do Vouga, Sao Joao da Madeira, Vale de Cambra, Arouca, Castelo de Paiva,
Ajax, PSV Eindhoven, PSV, Eindhoven, Feyenoord, Rotterdam, AZ Alkmaar, AZ, Alkmaar, FC Twente, Twente, Enschede, FC Utrecht, Utrecht, Vitesse, Arnhem, Heerenveen, SC Heerenveen, FC Groningen, Groningen, Sparta Rotterdam, Sparta,
NEC Nijmegen, NEC, Nijmegen, Go Ahead Eagles, Deventer, Heracles Almelo, Heracles, Almelo, PEC Zwolle, Zwolle, Fortuna Sittard, Sittard, RKC Waalwijk, Waalwijk, Willem II, Tilburg, NAC Breda, Breda, ADO Den Haag, Den Haag,
The Hague, Excelsior, Cambuur, Leeuwarden, FC Emmen, Emmen, Roda JC, Kerkrade, VVV-Venlo, Venlo, MVV Maastricht, MVV, Maastricht, De Graafschap, Doetinchem, FC Volendam, Volendam, Telstar, Velsen, FC Dordrecht, Dordrecht,
FC Den Bosch, Den Bosch, Helmond Sport, Helmond, TOP Oss, Oss, Jong Ajax, Jong PSV, Almere City, Almere, FC Eindhoven, SC Cambuur, Haarlem, HFC Haarlem, Hilversum, Gooische, Amstelveen, Hoofddorp, Zaandam, Purmerend,
Hoorn, Den Helder, Alphen, Leiden, ADO, Katwijk, Noordwijk, Lisse, Delft, Schiedam, Vlaardingen, Capelle, Spijkenisse, Barendrecht, Ridderkerk, Gouda, Zoetermeer, Rijswijk, Gorinchem, Tiel, Culemborg, Veenendaal, Wageningen, Ede,
Apeldoorn, Harderwijk, Kampen, Meppel, Hoogeveen, Assen, Veendam, Winschoten, Delfzijl, Drachten, Sneek, Harlingen, Franeker, Heerlen, Sittard, Geleen, Weert, Roermond, Venray, Horst, Boxmeer, Cuijk, Uden, Veghel, Eindhoven,
Oirschot, Best, Veldhoven, Valkenswaard, Bergen op Zoom, Roosendaal, Etten-Leur, Oosterhout, Zevenbergen, Terneuzen, Goes, Middelburg, Vlissingen,
Anderlecht, Club Brugge, Brugge, Bruges, Standard Liege, Standard, Liege, KRC Genk, Genk, Gent, KAA Gent, Ghent, Antwerp, Royal Antwerp, Beerschot, Mechelen, KV Mechelen, Charleroi, Sporting Charleroi, Cercle Brugge,
Union Saint-Gilloise, Union SG, Saint-Gilloise, Kortrijk, KV Kortrijk, Zulte Waregem, Waregem, Oostende, KV Oostende, Ostend, Eupen, KAS Eupen, OH Leuven, Leuven, Westerlo, Sint-Truiden, STVV, Sint-Truiden, Lokeren, Lierse, Lier,
Waasland-Beveren, Beveren, Roeselare, Mouscron, Excelsior Mouscron, Tubize, Seraing, RFC Seraing, Molenbeek, RWDM, Racing Mechelen, Berchem, Beerschot-Wilrijk, Dessel, Lommel, Patro Eisden, Maasmechelen, Hasselt, Tongeren, Herentals,
Turnhout, Geel, Mol, Westerlo, Aalst, Eendracht Aalst, Dender, Denderleeuw, Ninove, Ronse, Oudenaarde, Zottegem, Dendermonde, Sint-Niklaas, Temse, Hamme, Lokeren, Eeklo, Deinze, Harelbeke, Menen, Ieper, Ypres, Poperinge, Diksmuide,
Torhout, Tielt, Izegem, Roeselare, Waregem, Avelgem, Tournai, Mons, RAEC Mons, Mons-Hainaut, Binche, La Louviere, Tubize, Braine, Nivelles, Wavre, Waterloo, Ottignies, Namur, Dinant, Dison, Verviers, Visé, Vise, Herve, Spa, Stavelot,
Arlon, Virton, Bastogne, Marche, Libramont, Mouscron`),
  // ---- Turkey, Greece
  ...list(`Galatasaray, Fenerbahce, Besiktas, Trabzonspor, Trabzon, Istanbul, Istanbul Basaksehir, Basaksehir, Sivasspor, Sivas, Konyaspor, Konya, Alanyaspor, Alanya, Antalyaspor, Antalya, Kasimpasa, Gaziantep, Gaziantep FK,
Gaziantepspor, Hatayspor, Hatay, Antakya, Kayserispor, Kayseri, Rizespor, Rize, Caykur Rizespor, Giresunspor, Giresun, Adana Demirspor, Adana, Adanaspor, Demirspor, Ankaragucu, Ankara, Ankaraspor, Genclerbirligi,
Buyuksehir Belediye Erzurumspor, Erzurum, Erzurumspor, Samsunspor, Samsun, Bursaspor, Bursa, Eskisehirspor, Eskisehir, Denizlispor, Denizli, Goztepe, Izmir, Karsiyaka, Altay, Bucaspor, Menemen, Manisaspor, Manisa, Akhisar,
Akhisarspor, Akhisar Belediyespor, Balikesirspor, Balikesir, Bandirmaspor, Bandirma, Kocaelispor, Kocaeli, Izmit, Sakaryaspor, Sakarya, Adapazari, Duzcespor, Duzce, Bolu, Boluspor, Zonguldak, Zonguldakspor, Karabukspor, Karabuk,
Bartinspor, Bartin, Kastamonu, Kastamonuspor, Sinop, Sinopspor, Corum, Corumspor, Çorum, Amasya, Amasyaspor, Tokat, Tokatspor, Yozgat, Yozgatspor, Kirikkale, Kirsehir, Nevsehir, Nigde, Aksaray, Karaman, Karamanspor, Mersin, Mersin Idmanyurdu,
Tarsus, Tarsus Idman Yurdu, Osmaniye, Osmaniyespor, Kahramanmaras, Kahramanmarasspor, Adiyaman, Adiyamanspor, Malatya, Malatyaspor, Yeni Malatyaspor, Elazig, Elazigspor, Diyarbakir, Diyarbakirspor, Sanliurfa, Urfaspor, Sanliurfaspor,
Mardin, Batman, Siirt, Van, Vanspor, Bitlis, Mus, Agri, Kars, Karsspor, Ardahan, Artvin, Hopa, Ordu, Orduspor, Ordu 1967, Fatsa, Unye, Bafra, Carsamba, Terme, Tirebolu, Gumushane, Bayburt, Erzincan, Erzincanspor, Tunceli, Bingol,
Bingolspor, Hakkari, Sirnak, Cizre, Silopi, Midyat, Kiziltepe, Viransehir, Siverek, Bismil, Corlu, Corluspor, Tekirdag, Tekirdagspor, Edirne, Edirnespor, Kirklareli, Luleburgaz, Canakkale, Canakkalespor, Gelibolu, Biga, Bigaspor,
Yalova, Yalovaspor, Gebze, Gebzespor, Darica, Pendik, Pendikspor, Kartal, Kartalspor, Maltepe, Maltepespor, Umraniye, Umraniyespor, Tuzla, Eyup, Eyupspor, Sultanbeyli, Sile, Beykoz, Fatih Karagumruk, Karagumruk, Fatih, Bakirkoy,
Bayrampasa, Zeytinburnu, Gaziosmanpasa, Sariyer, Sisli, Kagithane, Beylerbeyi, Uskudar, Kadikoy, Atasehir, Ataspor, Bagcilar, Bagcilarspor, Esenler, Esenyurt, Esenyurtspor, Avcilar, Beylikduzu, Buyukcekmece, Silivri, Catalca,
Tuzlaspor, Altinordu, Altay, Ege, Aydin, Aydinspor, Nazilli, Nazillispor, Soke, Kusadasi, Mugla, Mugla Bodrumspor, Bodrum, Bodrumspor, Fethiye, Marmaris, Dalaman, Mugla Menteseli, Burdur, Isparta, Isparta 32, Afyon, Afyonspor,
Afyonkarahisar, Usak, Usakspor, Kutahya, Kutahyaspor, Bilecik, Inegol, Inegolspor, Mudanya, Gemlik, Gemlikspor, Orhangazi, Bozuyuk, Cankiri, Karabuk, Beypazari, Polatli, Golbasi, Kecioren, Keciorengucu, Etimesgut, Etimesgutspor, Mamak,
Yenimahalle, Sincan, Cubuk, Kizilcahamam, Eregli, Eregli Belediyespor, Alapli, Devrek, Caycuma, Gokcebey, Safranbolu, Bulancak, Gorele, Eynesil, Vakfikebir, Akcaabat, Arsin, Yomra, Of, Surmene, Macka, Arhavi, Findikli, Pazar,
Ardesen, Cayeli, Guneysu, Pazar Rize, Kemalpasa, Torbali, Odemis, Tire, Bergama, Aliaga, Foca, Cesme, Urla, Karabaglar, Bornova, Buca, Cigli, Bayrakli, Gaziemir, Narlidere, Balcova, Konak, Alsancak, Basmane,
Olympiacos, Olympiakos, Piraeus, Panathinaikos, AEK Athens, AEK, Athens, PAOK, Thessaloniki, Aris, Aris Thessaloniki, Xanthi, Volos, Volos NFC, Lamia, Atromitos, Peristeri, Asteras Tripolis, Tripoli, Tripolis, OFI, OFI Crete,
Heraklion, Iraklio, Chania, Rethymno, Panionios, Nea Smyrni, Smyrni, Panserraikos, Serres, Veria, Kallithea, Egaleo, Aigaleo, Panachaiki, Patras, Patra, Ionikos, Nikaia, Levadiakos, Livadeia, Platanias, Apollon Smyrnis, Ergotelis,
Kerkyra, Corfu, Panetolikos, Agrinio, Doxa Drama, Drama, Kavala, Kavala FC, Apollon Pontou, Pierikos, Katerini, Larissa, AEL, Trikala, Karditsa, Kozani, Edessa, Giannina, PAS Giannina, Ioannina, Preveza, Arta, Chalkida, Chalkis, Thiva,
Thebes, Livadia, Atalanti, Karpenisi, Amfissa, Delphi, Nafplio, Argos, Kalamata, Messini, Sparti, Sparta, Mani, Pyrgos, Olympia, Zakynthos, Zante, Kefalonia, Argostoli, Lefkada, Mytilene, Lesvos, Chios, Samos, Rhodes, Rodos, Kos,
Kalymnos, Naxos, Paros, Syros, Santorini, Mykonos, Tinos, Andros, Euboea, Evia, Skiathos, Skopelos, Alexandroupoli, Komotini, Didymoteicho, Orestiada, Nea Salamina, Nea Ionia, Nea Filadelfia, Marousi, Chaidari, Peristeri, Ilioupoli,
Glyfada, Vouliagmeni, Voula, Elefsina, Megara, Salamina, Aspropyrgos, Acharnes, Menidi, Lavrio, Marathon, Rafina, Markopoulo, Koropi, Spata, Paiania, Kifisia, Penteli, Vrilissia, Halandri, Agia Paraskevi, Zografou, Kaisariani,
Vyronas, Dafni, Moschato, Tavros, Kallithea, Palaio Faliro, Alimos, Agios Dimitrios, Nea Erythraia, Ekali, Dionysos`),
  // ---- Switzerland, Austria, Nordics, Poland, Czechia, Slovakia
  ...list(`Young Boys, Bern, Berne, FC Basel, Basel, FC Zurich, Zurich, Grasshoppers, Grasshopper, FC Luzern, Luzern, Lucerne, St Gallen, Servette, Geneva, Geneve, Lausanne, Lausanne-Sport, Sion, FC Sion, Lugano, Thun, Winterthur, FC Winterthur,
Aarau, Schaffhausen, Wil, Vaduz, FC Vaduz, Chiasso, Xamax, Neuchatel, Neuchatel Xamax, La Chaux-de-Fonds, Chaux-de-Fonds, Yverdon, Yverdon-Sport, Stade Lausanne Ouchy, Ouchy, Etoile Carouge, Carouge, Biel, Bienne, Delemont,
Solothurn, Baden, Wohlen, Kriens, Zug, Schwyz, Chur, Wettingen, Locarno, Bellinzona, Lugano, Rapperswil, Rapperswil-Jona, Uster, Dubendorf, Wadenswil, Horgen, Thalwil, Kloten, Bulach, Opfikon, Wallisellen,
Rapid Wien, Rapid Vienna, Vienna, Wien, Austria Wien, Austria Vienna, Red Bull Salzburg, Salzburg, Sturm Graz, Graz, GAK, Grazer AK, LASK, Linz, Wolfsberger AC, Wolfsberg, Hartberg, TSV Hartberg, Altach, Austria Lustenau,
Lustenau, Admira Wacker, Admira, Mödling, Modling, Wiener Neustadt, Ried, SV Ried, Pasching, Kapfenberg, Austria Klagenfurt, Klagenfurt, Wattens, Innsbruck, Tirol, WSG Tirol, FC Wacker Innsbruck, Wacker Innsbruck, Bregenz,
Dornbirn, Feldkirch, Bludenz, Kufstein, Kitzbuhel, Schwaz, Lienz, Villach, Spittal, St Polten, SKN St Polten, Krems, Amstetten, Waidhofen, Steyr, Wels, Vocklabruck, Gmunden, Bad Ischl, Hallein, Zell am See, Eisenstadt, Mattersburg,
Neusiedl, Oberwart, Weiz, Leoben, Bruck, Knittelfeld, Judenburg, Murau, Liezen, Schladming, Trofaiach, Lannach, Gleisdorf, Fürstenfeld, Furstenfeld, Hartberg, Bad Radkersburg, Leibnitz, Wolfsberg, Voitsberg,
Bodo Glimt, Bodo, Rosenborg, Trondheim, Molde, Brann, Bergen, Viking, Stavanger, Valerenga, Lillestrom, Odd, Skien, Stromsgodset, Drammen, Sarpsborg 08, Sarpsborg, Haugesund, Tromso, Kristiansund, Aalesund, Sandefjord, Ham-Kam,
Hamar, Fredrikstad, Mjondalen, Start, Kristiansand, Sogndal, Stabaek, Bryne, Jerv, Grimstad, Raufoss, Kongsvinger, Lyn, Moss, Ranheim, Asane, Fana, Lofoten, Harstad, Narvik, Alta, Hammerfest, Vardo, Kirkenes, Honefoss,
Skeid, Strommen, Kjelsas, Frigg, Ullensaker, Kolbotn, Asker, Drammen, Kongsberg, Notodden, Porsgrunn, Fram Larvik, Larvik, Tonsberg, Horten, Sandnes Ulf, Sandnes, Egersund, Flekkefjord, Mandal, Arendal, Tvedestrand,
FC Copenhagen, Copenhagen, Kobenhavn, Brondby, Midtjylland, Herning, Nordsjaelland, Farum, AGF, Aarhus, Aalborg, AaB, Odense, OB, Randers, Silkeborg, Viborg, Vejle, Horsens, Sonderjyske, Haderslev, Esbjerg, Lyngby, Hvidovre,
Hobro, Fremad Amager, Amager, B93, Naestved, Roskilde, Kolding, Fredericia, Skive, Thisted, Hjorring, Frederikshavn, Holstebro, Ringkobing, Varde, Ribe, Vejen, Svendborg, Faaborg, Nyborg, Middelfart, Assens, Svaneke, Nakskov, Holbaek,
Slagelse, Korsor, Ringsted, Koge, Hillerod, Helsingor, Elsinore, Frederiksberg, Gentofte, Ballerup, Glostrup, Taastrup, Greve, Solrod,
Malmo FF, Malmo, AIK, Solna, Djurgarden, Hammarby, IFK Goteborg, Goteborg, Gothenburg, Orgryte, BK Hacken, Hacken, IFK Norrkoping, Norrkoping, IF Elfsborg, Elfsborg, Boras, Kalmar, Kalmar FF, Mjallby, Hasselholm, Helsingborg,
Helsingborgs IF, Halmstad, Halmstads BK, Varnamo, Sirius, Uppsala, Degerfors, Orebro, Brommapojkarna, Vasteras, Vasteras SK, Gefle, Gavle, Sundsvall, GIF Sundsvall, Ostersund, Ostersunds FK, Umea, Lulea, Skelleftea, Trelleborg,
Trelleborgs FF, Landskrona, Landskrona BoIS, Ängelholm, Angelholm, Falkenberg, Falkenbergs FF, Varberg, Kungsbacka, Molndal, Partille, Lerum, Alingsas, Trollhattan, Vanersborg, Uddevalla, Lidkoping, Skovde, Falkoping, Jonkoping,
Norrby, Eskilstuna, Nykoping, Katrineholm, Linkoping, Motala, Vadstena, Karlstad, Arvika, Kristinehamn, Orebro, Karlskoga, Hallsberg, Lindesberg, Nora, Falun, Borlange, Mora, Leksand, Rattvik, Hudiksvall, Soderhamn, Bollnas,
Ljusdal, Harnosand, Ornskoldsvik, Kramfors, Solleftea, Lycksele, Pitea, Kiruna, Gallivare, Haparanda, Visby, Gotland,
HJK, Helsinki, HIFK, KuPS, Kuopio, FC Inter Turku, Inter Turku, Turku, TPS, Åbo, Abo, Ilves, Tampere, TPV, FC Lahti, Lahti, VPS, Vaasa, Seinajoki, SJK, Mariehamn, IFK Mariehamn, Oulu, AC Oulu, Rovaniemi, RoPS, Kemi,
Jaro, Jakobstad, Pietarsaari, Kokkola, GBK, Honka, Espoo, Vantaa, PK-35, Kotka, KTP, Kouvola, KuFu, Lappeenranta, Imatra, Joensuu, Mikkeli, MIPK, Savonlinna, Jyvaskyla, JJK, Pori, Rauma, Kuusankoski, Hameenlinna, Salo,
FH Hafnarfjordur, Hafnarfjordur, Valur, Reykjavik, KR, Breidablik, Kopavogur, Stjarnan, Gardabaer, Fylkir, Fram, Thor Akureyri, Akureyri, KA, Keflavik, ÍBV, IBV, Vestmannaeyjar, Grindavik, Selfoss, Haukar, Grotta, Afturelding,
Mosfellsbaer, Vikingur, Fjolnir, HK, Leiknir, Throttur, Njardvik, Akranes, ÍA, IA, Isafjordur, Egilsstadir, Husavik, Siglufjordur,
Legia Warsaw, Legia Warszawa, Warsaw, Warszawa, Lech Poznan, Poznan, Wisla Krakow, Krakow, Cracovia, Gornik Zabrze, Zabrze, Slask Wroclaw, Wroclaw, Lechia Gdansk, Gdansk, Pogon Szczecin, Szczecin, Jagiellonia Bialystok,
Bialystok, Piast Gliwice, Gliwice, Zaglebie Lubin, Lubin, Zaglebie Sosnowiec, Sosnowiec, Cracovia, Korona Kielce, Kielce, Radomiak Radom, Radom, Widzew Lodz, Lodz, LKS Lodz, ŁKS, Rakow Czestochowa, Czestochowa, Stal Mielec,
Mielec, Stal Rzeszow, Rzeszow, Resovia, Wisla Plock, Plock, Arka Gdynia, Gdynia, GKS Katowice, Katowice, GKS Tychy, Tychy, Ruch Chorzow, Chorzow, Bytom, Polonia Bytom, Polonia Warszawa, Odra Opole, Opole, Miedz Legnica,
Legnica, Chojniczanka, Chojnice, Bruk-Bet Termalica, Nieciecza, Termalica, Podbeskidzie, Bielsko-Biala, Bielsko, Sandecja, Nowy Sacz, Garbarnia, Hutnik, Hutnik Krakow, Puszcza Niepolomice, Niepolomice, Motor Lublin, Lublin,
Gornik Leczna, Leczna, Pogon Siedlce, Siedlce, Olimpia Elblag, Elblag, Warta Poznan, Warta, Kolejarz, Zawisza Bydgoszcz, Bydgoszcz, Pomorzanin, Torun, Elana Torun, Wloclawek, Zawisza, Radomsko, Zawiercie, Dabrowa, Jaworzno, Mikolow,
Rybnik, Raciborz, Kedzierzyn, Nysa, Prudnik, Brzeg, Oleśnica, Olesnica, Swidnica, Walbrzych, Jelenia Gora, Boleslawiec, Zgorzelec, Lubin, Glogow, Zielona Gora, Gorzow, Slupsk, Koszalin, Kolobrzeg, Stargard, Swinoujscie,
Slavia Prague, Slavia Praha, Prague, Praha, Sparta Prague, Sparta Praha, Viktoria Plzen, Plzen, Pilsen, Banik Ostrava, Ostrava, Slovan Liberec, Liberec, Sigma Olomouc, Olomouc, Mlada Boleslav, Jablonec, Teplice, Dukla Prague,
Dukla Praha, Bohemians 1905, Bohemians Prague, Zbrojovka Brno, Brno, Slovacko, Uherske Hradiste, Zlin, Fastav Zlin, Hradec Kralove, Pardubice, Ceske Budejovice, Budejovice, Karvina, Opava, Vysocina Jihlava, Jihlava, Dynamo Ceske Budejovice,
Zizkov, Viktoria Zizkov, Chrudim, Varnsdorf, Usti nad Labem, Ustí, Most, Chomutov, Karlovy Vary, Cheb, Sokolov, Domazlice, Pribram, Kladno, Kolin, Pelhrimov, Tabor, Pisek, Prachatice, Znojmo, Prostejov, Prerov, Vyskov, Kromeriz,
Hodonin, Breclav, Vsetin, Frydek-Mistek, Frydek, Havirov, Orlova, Trinec, Bohumin, Novy Jicin, Kopřivnice, Koprivnice, Trebic, Zdar nad Sazavou, Havlickuv Brod, Chocen, Litomysl, Svitavy, Trutnov, Nachod, Jaromer, Dvur Kralove,
Slovan Bratislava, Bratislava, Spartak Trnava, Trnava, MSK Zilina, Zilina, DAC Dunajska Streda, Dunajska Streda, Ruzomberok, MFK Ruzomberok, Dukla Banska Bystrica, Banska Bystrica, Zemplin Michalovce, Michalovce, Podbrezova,
Slovan, Senica, Nitra, FC Nitra, Trencin, AS Trencin, Kosice, FC Kosice, Presov, Lokomotiva Kosice, Komarno, KFC Komarno, Skalica, Povazska Bystrica, Poprad, Liptovsky Mikulas, Zvolen, Lucenec, Rimavska Sobota, Humenne, Vranov,
Bardejov, Stara Lubovna, Levice, Topolcany, Piestany, Galanta, Sala, Samorin, Pezinok, Malacky, Senec, Puchov, Dubnica, Prievidza, Handlova, Partizanske, Martin, Dolny Kubin, Namestovo`),
  // ---- Hungary, Romania, Balkans, Ukraine, Russia, Baltics
  ...list(`Ferencvaros, Ferencvarosi TC, Budapest, Ujpest, Ujpest FC, MTK Budapest, MTK, Honved, Budapest Honved, Debrecen, DVSC, Videoton, Fehervar, Szekesfehervar, Mezokovesd, Paks, Paksi FC, Kisvarda, Zalaegerszeg, ZTE, Puskas Akademia,
Felcsut, Diosgyor, Diosgyori VTK, Miskolc, Gyor, Gyori ETO, Szombathely, Haladas, Szeged, Szolnok, Nyiregyhaza, Nyiregyhaza Spartacus, Kecskemet, Kecskemeti TE, Pecs, Pecsi MFC, Kaposvar, Kaposvari Rakoczi, Siofok, Balatonfured,
Veszprem, Tatabanya, Dunaujvaros, Dunaferr, Esztergom, Vac, Vasas, Soroksar, BKV Elore, Csepel, Kispest, Zuglo, Rakospalota, Budafok, Budaors, Gyirmot, Mosonmagyarovar, Sopron, Kapuvar, Csorna, Sarvar, Celldomolk, Keszthely,
Nagykanizsa, Zalaegerszeg, Lenti, Szentgotthard, Oroshaza, Bekescsaba, Bekescsabai Elore, Gyula, Gyomaendrod, Hodmezovasarhely, Makó, Mako, Kiskunfelegyhaza, Kiskunhalas, Baja, Szekszard, Dombovar, Mohacs, Komlo, Siklos,
Eger, Egri FC, Gyongyos, Hatvan, Salgotarjan, Balassagyarmat, Retsag, Szentendre, Dunakeszi, Godollo, Cegled, Nagykoros, Monor, Dabas, Szigetszentmiklos, Erd, Biatorbagy, Torokbalint, Tata, Komarom, Kisber, Pápa, Papa, Ajka,
Tapolca, Zirc, Mor, Bicske, Oroszlany, Varpalota, Sarbogard, Mezofalva, Adony, Kalocsa, Paks, Tolna, Bonyhad, Ferencváros, Újpest, Ujvaros, Terezvaros, Jozsefvaros, Erzsebetvaros, Obuda, Obudai, Angyalfold,
Steaua Bucharest, Steaua, FCSB, Bucharest, Bucuresti, Dinamo Bucharest, Dinamo Bucuresti, Rapid Bucharest, Rapid Bucuresti, CFR Cluj, Cluj, Cluj-Napoca, Universitatea Craiova, Craiova, Universitatea Cluj, U Cluj, Farul Constanta,
Constanta, Viitorul, Petrolul Ploiesti, Ploiesti, Sepsi, Sfantu Gheorghe, UTA Arad, Arad, Politehnica Timisoara, Timisoara, ACS Poli, Otelul Galati, Galati, FC Botosani, Botosani, Voluntari, Hermannstadt, Sibiu, Gaz Metan Medias,
Medias, Astra Giurgiu, Giurgiu, Concordia Chiajna, Chiajna, Dunarea Calarasi, Calarasi, Mioveni, Targu Mures, ASA Targu Mures, Csikszereda, Miercurea Ciuc, FC Brasov, Brasov, Corvinul Hunedoara, Hunedoara, Pandurii Targu Jiu,
Targu Jiu, Ceahlaul Piatra Neamt, Piatra Neamt, Foresta Suceava, Suceava, Politehnica Iasi, Iasi, CSM Iasi, Oțelul, Otelul, Unirea Slobozia, Slobozia, Oţelul, Buzau, Gloria Buzau, Focsani, Bacau, FCM Bacau, Vaslui, FC Vaslui,
Pitesti, FC Arges, Arges, Râmnicu Valcea, Ramnicu Valcea, Valcea, Drobeta-Turnu Severin, Turnu Severin, Resita, CSM Resita, Oradea, FC Bihor, Satu Mare, Baia Mare, Minaur, Zalau, Bistrita, Gloria Bistrita, Sighisoara, Alba Iulia,
Deva, Petrosani, Jiul Petrosani, Lugoj, Caransebes, Oravita, Drobeta, Slatina, Alexandria, Turnu Magurele, Roșiori, Rosiori, Zimnicea, Giurgiu, Oltenita, Calarasi, Fetesti, Medgidia, Mangalia, Tulcea, Braila, Chimia Braila,
Dacia Chisinau, Sheriff Tiraspol, Tiraspol, Chisinau, Zimbru Chisinau, Zimbru, Petrocub, Milsami Orhei, Orhei, Balti, Zaria Balti, Bender, Tighina, Dinamo-Auto, Speranta Nisporeni, Nisporeni, Florești, Floresti,
Red Star Belgrade, Crvena Zvezda, Belgrade, Beograd, Partizan, Partizan Belgrade, Vojvodina, Novi Sad, Cukaricki, Radnicki Nis, Nis, Radnicki Kragujevac, Kragujevac, Spartak Subotica, Subotica, Napredak Krusevac, Krusevac,
TSC Backa Topola, Backa Topola, Mladost Lucani, Lucani, Javor Ivanjica, Ivanjica, Vozdovac, Rad, OFK Beograd, Zeleznik, Radnik Surdulica, Surdulica, Macva Sabac, Sabac, Proleter Novi Sad, Novi Pazar, Kolubara Lazarevac, Lazarevac,
Borac Cacak, Cacak, Smederevo, Metalac Gornji Milanovac, Gornji Milanovac, Zlatibor Cajetina, Cajetina, Jagodina, Jagodina Pobeda, Sloboda Uzice, Uzice, Zemun, Sinđelić, Sindjelic, Hajduk Kula, Kula, Becej, Zrenjanin, Pancevo,
Vrsac, Kikinda, Sombor, Apatin, Sremska Mitrovica, Ruma, Sid, Indjija, Stara Pazova, Obrenovac, Mladenovac, Smederevska Palanka, Pozarevac, Bor, Zajecar, Negotin, Prokuplje, Leskovac, Vranje, Pirot, Kraljevo, Krusevac, Cuprija,
Dinamo Zagreb, Zagreb, Hajduk Split, Split, Rijeka, HNK Rijeka, Osijek, NK Osijek, Lokomotiva, Lokomotiva Zagreb, Istra 1961, Pula, Varazdin, NK Varazdin, Gorica, Velika Gorica, Slaven Belupo, Koprivnica, Sibenik, Zadar, NK Zadar,
Cibalia, Vinkovci, Slavonski Brod, Marsonia, Dubrovnik, Cakovec, Medimurje, Karlovac, Sisak, Bjelovar, Virovitica, Pozega, Zapresic, Inter Zapresic, Rudes, Solin, Kastela, Trogir, Makarska, Imotski, Sinj, Metkovic, Vukovar,
Zrinski, Zrinjski, Zrinjski Mostar, Mostar, Velez Mostar, Velez, Sarajevo, FK Sarajevo, Zeljeznicar, Zeljeznicar Sarajevo, Tuzla, Sloboda Tuzla, Borac Banja Luka, Banja Luka, Zvijezda 09, Zvijezda, Siroki Brijeg, Posusje, Radnik Bijeljina,
Bijeljina, Leotar, Trebinje, Tuzla City, Travnik, Celik Zenica, Zenica, Rudar Prijedor, Prijedor, Igman Konjic, Konjic, Gorazde, Bihac, Cazin, Livno, Orasje, Brcko, Doboj, Zvornik, Visoko, Zavidovici, Kakanj, Breza,
Olimpija Ljubljana, Ljubljana, Maribor, NK Maribor, Celje, NK Celje, Koper, Domzale, Mura, Murska Sobota, Bravo, Gorica, Nova Gorica, Triglav Kranj, Kranj, Radomlje, Aluminij, Kidricevo, Krsko, Brezice, Novo Mesto, Rudar Velenje,
Velenje, Ptuj, Drava Ptuj, Lendava, Ormoz, Slovenj Gradec, Ravne, Jesenice, Bled, Skofja Loka, Kamnik, Trbovlje, Zagorje, Postojna, Sezana, Izola, Piran, Portoroz,
Shakhtar Donetsk, Shakhtar, Donetsk, Dynamo Kyiv, Kyiv, Kiev, Dnipro, Dnipro-1, Dnipropetrovsk, Zorya Luhansk, Luhansk, Vorskla Poltava, Poltava, Metalist Kharkiv, Metalist, Kharkiv, Karpaty Lviv, Karpaty, Lviv, Chornomorets Odesa,
Odesa, Odessa, Oleksandriya, Kolos Kovalivka, Kovalivka, Rukh Lviv, Rukh Vynnyky, Vynnyky, Veres Rivne, Rivne, Mariupol, Mariupil, Metalurh Zaporizhya, Metalurh, Zaporizhya, Zaporizhia, Zirka Kropyvnytskyi, Kropyvnytskyi,
Kirovohrad, Obolon Kyiv, Obolon, Polissya Zhytomyr, Zhytomyr, LNZ Cherkasy, Cherkasy, Minaj, Inhulets Petrove, Inhulets, Desna Chernihiv, Chernihiv, Volyn Lutsk, Lutsk, Prykarpattia Ivano-Frankivsk, Ivano-Frankivsk,
Ternopil, Nyva Ternopil, Bukovyna Chernivtsi, Chernivtsi, Uzhhorod, Hoverla Uzhhorod, Mynai, Kryvbas Kryvyi Rih, Kryvyi Rih, Kryvbas, Kremin Kremenchuk, Kremenchuk, Sumy, Yavir Sumy, Skala Stryi, Stryi, Kherson, Mykolaiv, Nikopol,
Zenit, Zenit Saint Petersburg, Saint Petersburg, St Petersburg, Petersburg, Spartak Moscow, Spartak, Moscow, Moskva, CSKA Moscow, CSKA, Lokomotiv Moscow, Lokomotiv, Dynamo Moscow, Torpedo Moscow, Torpedo, Krasnodar, FC Krasnodar,
Rostov, FC Rostov, Rubin Kazan, Rubin, Kazan, Akhmat Grozny, Akhmat, Grozny, Terek Grozny, Terek, Krylia Sovetov, Samara, Ural Yekaterinburg, Ural, Yekaterinburg, Sochi, PFC Sochi, Nizhny Novgorod, Orenburg, Fakel Voronezh, Fakel,
Voronezh, Baltika Kaliningrad, Baltika, Kaliningrad, Khimki, Arsenal Tula, Tula, Anzhi Makhachkala, Anzhi, Makhachkala, Amkar Perm, Amkar, Perm, Tom Tomsk, Tomsk, Luch Vladivostok, Luch, Vladivostok, SKA Khabarovsk, Khabarovsk,
Volga Nizhny Novgorod, Volga, Alania Vladikavkaz, Alania, Vladikavkaz, Kuban Krasnodar, Kuban, Shinnik Yaroslavl, Shinnik, Yaroslavl, Dynamo Saint Petersburg, Chernomorets Novorossiysk, Novorossiysk, Salyut Belgorod, Belgorod,
Metallurg Lipetsk, Lipetsk, Sibir Novosibirsk, Sibir, Novosibirsk, Spartak Nalchik, Nalchik, Krasnoyarsk, Yenisey Krasnoyarsk, Yenisey, Chita, Irkutsk, Omsk, Tyumen, Chelyabinsk, Ufa, FC Ufa, Saratov, Sokol Saratov, Volgograd,
Rotor Volgograd, Rotor, Astrakhan, Orel, Orlovets, Kursk, Bryansk, Smolensk, Tver, Yaroslavl, Vladimir, Ryazan, Tambov, Penza, Ulyanovsk, Tolyatti, Lada Togliatti, Togliatti, Naberezhnye Chelny, KAMAZ, Nizhnekamsk, Neftekhimik,
Izhevsk, Syktyvkar, Arkhangelsk, Murmansk, Petrozavodsk, Pskov, Novgorod, Veliky Novgorod, Vologda, Kostroma, Ivanovo, Kaluga, Tula, Elista, Stavropol, Armavir, Maykop, Pyatigorsk, Kislovodsk, Cherkessk, Nazran, Magas, Derbent,
Zalgiris Vilnius, Zalgiris, Vilnius, Kaunas, Suduva, Marijampole, Panevezys, Ekranas, Siauliai, Banga Gargzdai, Gargzdai, Klaipeda, Atlantas, Utenis, Utena, Riteriai, Dainava, Alytus, Jonava, Kauno Zalgiris, Trakai, FK Trakai,
Riga, Riga FC, Skonto Riga, Skonto, RFS, Rigas FS, Liepaja, Ventspils, Daugavpils, Jelgava, Valmiera, Spartaks Jurmala, Jurmala, Metta, Gulbene, Tukums, Auda, Ogre, Salaspils, Olaine, Sigulda, Cesis, Rezekne, Jekabpils, Ludza,
Flora Tallinn, Flora, Tallinn, Levadia Tallinn, Levadia, Nomme Kalju, Kalju, Nomme, Paide Linnameeskond, Paide, Tammeka Tartu, Tammeka, Tartu, Kuressaare, Viljandi, Parnu, Pärnu, Narva, Narva Trans, Trans Narva, Sillamae, Kohtla-Jarve,
Tulevik, Maardu, Rakvere, Haapsalu, Valga, Voru, Jogeva, Johvi, Kiviõli, Kivioli,
Minsk, Dinamo Minsk, BATE Borisov, BATE, Borisov, Shakhtyor Soligorsk, Soligorsk, Dinamo Brest, Brest, Gomel, Vitebsk, Mogilev, Grodno, Neman Grodno, Slutsk, Isloch, Isloch Minsk Raion, Torpedo-BelAZ Zhodino, Zhodino, Slavia Mozyr,
Mozyr, Bobruisk, Naftan Novopolotsk, Novopolotsk, Orsha, Baranovichi, Pinsk, Lida, Molodechno, Smorgon, Osipovichi, Luninets, Rechitsa, Zhlobin, Svetlogorsk,
Tbilisi, Dinamo Tbilisi, Dila Gori, Gori, Torpedo Kutaisi, Kutaisi, Saburtalo, Locomotive Tbilisi, Sioni Bolnisi, Bolnisi, Batumi, Dinamo Batumi, Zugdidi, Samtredia, Telavi, Rustavi, Poti, Gagra, Kobuleti, Lanchkhuti, Chiatura,
Yerevan, Pyunik, Ararat Yerevan, Ararat, Ararat-Armenia, Alashkert, Noah, Shirak, Gyumri, Urartu, Van Urartu, Banants, Kotayk, Abovyan, Vanadzor, Lori, Ijevan, Gandzasar, Kapan, Sevan, Artsakh, Stepanakert,
Baku, Qarabag, Karabakh, Agdam, Neftchi, Neftchi Baku, Sumqayit, Gabala, Qabala, Zira, Sabail, Sabah, Keshla, Kapaz, Ganja, Shamakhi, Turan Tovuz, Tovuz, Mingachevir, Lankaran, Khazar Lankaran, Inter Baku, Shuvalan, Zaqatala,
Astana, FC Astana, Kairat, Kairat Almaty, Almaty, Tobol, Kostanay, Aktobe, Ordabasy, Shymkent, Taraz, Zhetysu, Taldykorgan, Atyrau, Aktau, Kyzylzhar, Petropavlovsk, Okzhetpes, Kokshetau, Shakhter Karagandy, Karagandy, Karaganda,
Elimai, Semey, Semipalatinsk, Ekibastuz, Pavlodar, Irtysh Pavlodar, Irtysh, Oral, Uralsk, Kyzylorda, Zhezkazgan, Turkistan, Kentau, Arys, Saryagash, Temirtau,
Skopje, Vardar, Vardar Skopje, Rabotnicki, Shkendija, Tetovo, Struga, Makedonija, Makedonija GP, Pelister, Bitola, Akademija Pandev, Pandev, Sileks, Kratovo, Belasica, Strumica, Renova, Brera Strumica, Ohrid, Gostivar, Kumanovo,
Prilep, Veles, Shtip, Kavadarci, Gevgelija, Kicevo, Debar, Tirana, KF Tirana, Partizani Tirana, Partizani, Dinamo Tirana, Vllaznia Shkoder, Vllaznia, Shkoder, Skenderbeu Korce, Skenderbeu, Korce, Kukesi, Kukes, Teuta Durres, Teuta,
Durres, Laci, Lac, Flamurtari Vlore, Flamurtari, Vlore, Apolonia Fier, Apolonia, Fier, Elbasani, Elbasan, Bylis Ballsh, Bylis, Ballsh, Luftetari Gjirokaster, Luftetari, Gjirokaster, Egnatia Rrogozhine, Egnatia, Rrogozhine,
Tomori Berat, Tomori, Berat, Besa Kavaje, Besa, Kavaje, Pogradeci, Erzeni, Shijak, Burreli, Bulqize, Lushnje, Lezhe, Pristina, Prishtina, Drita, Gjilan, Ballkani, Suhareka, Llapi, Podujeva, Malisheva, Feronikeli, Drenas, Gjakova,
Trepca, Mitrovica, Peja, Prizren, Ferizaj, Vushtrri, Fushe Kosove, Kosovo Polje, Podgorica, Buducnost Podgorica, Buducnost, Sutjeska Niksic, Sutjeska, Niksic, Zeta, Golubovci, Rudar Pljevlja, Pljevlja, Mogren, Budva, Mornar, Bar,
Decic, Tuzi, Petrovac, Kotor, Herceg Novi, Bijelo Polje, Berane, Ulcinj, Cetinje, Lovcen, Iskra Danilovgrad, Danilovgrad, Jedinstvo Bijelo Polje, Jezero Plav, Plav, Grbalj, Radanovici, Ibar Rozaje, Rozaje, Kom, Bokelj,
Nicosia, Omonia, Omonia Nicosia, APOEL, APOEL Nicosia, Apollon Limassol, Limassol, AEL Limassol, Anorthosis, Anorthosis Famagusta, Famagusta, Larnaca, AEK Larnaca, Pafos, Paphos, Paphos FC, Aris Limassol, Nea Salamis, Salamina,
Ethnikos Achna, Achna, Doxa Katokopias, Katokopia, Olympiakos Nicosia, Enosis Neon Paralimni, Paralimni, Karmiotissa, Pano Polemidia, Polemidia, Digenis Morphou, Morphou, Akritas Chlorakas, Chlorakas, Ermis Aradippou, Aradippou,
Valletta, Hibernians, Paola, Floriana, Sliema Wanderers, Sliema, Birkirkara, Hamrun Spartans, Hamrun, Balzan, Mosta, Gzira United, Gzira, Marsaxlokk, Tarxien Rainbows, Tarxien, St Andrews, Pembroke Athleta, Pembroke, Naxxar
Lions, Naxxar, Zebbug Rangers, Zebbug, Qormi, Senglea Athletic, Senglea, Vittoriosa Stars, Vittoriosa, Lija Athletic, Lija, Mgarr United, Mgarr, Xghajra, Msida Saint-Joseph, Msida, Kalkara, Zurrieq, Siggiewi, Gudja United, Gudja,
Dingli Swallows, Dingli, Rabat Ajax, Rabat, Mdina, Victoria Hotspurs, Victoria, Xewkija Tigers, Xewkija, Nadur Youngsters, Nadur, Munxar, Gharb Rangers, Gharb, Kercem Ajax, Kercem, Sannat Lions, Sannat, Fontana, Xaghra United,
Xaghra, Ghajnsielem, Gozo, Malta, Luxembourg, Fola Esch, Esch, F91 Dudelange, Dudelange, Differdange 03, Differdange, Swift Hesperange, Hesperange, Racing Union, Progres Niederkorn, Niederkorn, Jeunesse Esch, Jeunesse,
Etzella Ettelbruck, Ettelbruck, Hamm, Mondercange, Kayl, Rodange, Wiltz, Grevenmacher, Mamer, Strassen, Bertrange, Bascharage, Lorentzweiler, Petange, Rumelange, Bettembourg, Mondorf, Remich, Echternach, Diekirch, Vianden,
Gibraltar, Lincoln Red Imps, Europa FC, St Joseph's, Lynx, Mons Calpe, Glacis United, Bruno's Magpies, Manchester 62, Lions Gibraltar, Boca Gibraltar, Faroe Islands, Torshavn, HB Torshavn, B36 Torshavn, KI Klaksvik, Klaksvik, NSI
Runavik, Runavik, EB Streymur, Streymur, Vikingur Gota, Gota, Skala, Argir, Tvoroyri, Vagur, Vestmanna, Sandavagur, Fuglafjordur, Nolsoy, Eidi, Andorra la Vella, Sant Julia, Santa Coloma, Encamp, Escaldes, Engordany, La Massana,
Ordino, Canillo, Inter Club d'Escaldes, San Marino, Tre Fiori, Tre Penne, La Fiorita, Folgore, Folgore Falciano, Falciano, Domagnano, Faetano, Cosmos, Libertas, Pennarossa, Murata, Virtus, Juvenes, Dogana, Serravalle, Borgo Maggiore,
Montegiardino, Acquaviva, Chiesanuova, Fiorentino, Vaduz, Triesen, Balzers, Eschen, Ruggell, Schaan, Triesenberg, Mauren, Gamprin, Planken`),
  // ---- South Korea, Japan, China, rest of Asia
  ...list(`Jeonbuk Hyundai Motors, Jeonbuk, Jeonju, Ulsan Hyundai, Ulsan, Ulsan HD, Pohang Steelers, Pohang, Suwon Samsung Bluewings, Suwon Bluewings, Suwon, Suwon FC, FC Seoul, Seoul, Seoul E-Land, Incheon United, Incheon,
Daegu FC, Daegu, Gangwon FC, Gangwon, Chuncheon, Gangneung, Wonju, Sokcho, Donghae, Taebaek, Samcheok, Jeju United, Jeju, Seogwipo, Gwangju FC, Gwangju, Daejeon Hana Citizen, Daejeon Citizen, Daejeon, Gimcheon Sangmu, Gimcheon,
Sangju, Sangju Sangmu, Seongnam FC, Seongnam, Seongnam Ilhwa, Bucheon FC 1995, Bucheon, Bucheon SK, Busan IPark, Busan, Pusan, Gyeongnam FC, Gyeongnam, Changwon, Jinju, Tongyeong, Sacheon, Gimhae, Miryang, Yangsan, Geoje, Gumi,
Gyeongju, Andong, Yeongju, Mungyeong, Pohang, Yeongcheon, Gyeongsan, Chilgok, Anyang, FC Anyang, Anyang LG Cheetahs, Ansan, Ansan Greeners, Ansan Police, Asan, Asan Mugunghwa, Cheonan, Cheonan City, Cheongju, Cheongju FC,
Chungju, Chungju Hummel, Jecheon, Eumseong, Danyang, Hwaseong, Hwaseong FC, Pyeongtaek, Osan, Yongin, Yongin FC, Icheon, Icheon Sangmu, Gwangmyeong, Siheung, Gimpo, Gimpo FC, Goyang, Goyang Zaicro, Goyang Hi FC, Paju, Paju Citizen,
Yangju, Uijeongbu, Pocheon, Dongducheon, Gapyeong, Namyangju, Hanam, Gwacheon, Uiwang, Gunpo, Ansan, Mokpo, Mokpo City, Mokpo Citizen, Yeosu, Suncheon, Gwangyang, Naju, Haenam, Wando, Jindo, Jeongeup, Gunsan, Iksan, Namwon, Gimje,
Kimje, Gongju, Buyeo, Nonsan, Boryeong, Seosan, Dangjin, Hongseong, Taean, Yesan, Chungju, Jeonju, Gyeongju, Okcheon, Yeongdong, Boeun, Goesan, Jincheon, Daejeon Korail, Daejeon Korail FC, Ulsan Citizen, Ulsan Hyundai Mipo,
Hyundai Mipo Dockyard, Yongin City, Gimhae City, Gyeongju KHNP, Gyeongju Citizen, Chuncheon Citizen, Cheonan FC, Jeju Sogipo, Changwon City, Gangneung City, Pocheon Citizen, Seoul Nowon, Nowon, Gangnam, Songpa, Gangseo, Mapo,
Dobong, Eunpyeong, Yangcheon, Guro, Geumcheon, Dongjak, Seocho, Yongsan, Jung-gu, Jongno, Seongbuk, Dongdaemun, Gwangjin, Seongdong, Yeongdeungpo, Gwanak,
Urawa Red Diamonds, Urawa, Kashima Antlers, Kashima, Gamba Osaka, Cerezo Osaka, Osaka, Vissel Kobe, Kobe, Nagoya Grampus, Nagoya, Sanfrecce Hiroshima, Hiroshima, Kawasaki Frontale, Kawasaki, Yokohama F Marinos, Yokohama FC,
Yokohama, FC Tokyo, Tokyo, Tokyo Verdy, Verdy, Machida Zelvia, Machida, Kashiwa Reysol, Kashiwa, JEF United Chiba, Chiba, Ichihara, Shonan Bellmare, Shonan, Hiratsuka, Kyoto Sanga, Kyoto, Avispa Fukuoka, Fukuoka, Sagan Tosu,
Tosu, Albirex Niigata, Niigata, Shimizu S-Pulse, Shimizu, Jubilo Iwata, Iwata, Montedio Yamagata, Yamagata, Vegalta Sendai, Sendai, Consadole Sapporo, Hokkaido Consadole Sapporo, Sapporo, Oita Trinita, Oita, Kumamoto, Roasso Kumamoto,
Kagoshima United, Kagoshima, Nagasaki, V-Varen Nagasaki, Tokushima Vortis, Tokushima, Ehime FC, Ehime, Matsuyama, Kochi, Kamatamare Sanuki, Sanuki, Takamatsu, Fagiano Okayama, Okayama, Renofa Yamaguchi, Yamaguchi, Gainare Tottori,
Tottori, Matsue, Kataller Toyama, Toyama, Zweigen Kanazawa, Kanazawa, Ventforet Kofu, Kofu, Matsumoto Yamaga, Matsumoto, Nagano Parceiro, Nagano, AC Nagano Parceiro, Thespa Kusatsu, Thespakusatsu Gunma, Kusatsu, Gunma, Maebashi,
Mito HollyHock, Mito, Tochigi SC, Tochigi, Utsunomiya, Blaublitz Akita, Akita, Iwaki FC, Iwaki, Fukushima United, Fukushima, Iwate Grulla Morioka, Morioka, Iwate, Aomori, Hachinohe, Vanraure Hachinohe, Tegevajaro Miyazaki,
Miyazaki, Giravanz Kitakyushu, Kitakyushu, Mitsubishi Motors, Mizuho, Yokkaichi, Mie, Tsu, Gifu, FC Gifu, Shizuoka, Hamamatsu, Fujieda, Fujieda MYFC, Azul Claro Numazu, Numazu, Atletico Suzuka, Suzuka, Nara Club, Nara, Reilac Shiga,
Shiga, Otsu, Kyoto Purple Sanga, Sakai, Himeji, Tokorozawa, Saitama, Omiya Ardija, Omiya, Kawagoe, Tokyo Musashino City, Musashino, Chofu, Fuchu, Tachikawa, Tama, Hachioji, Sagamihara, SC Sagamihara, Odawara, Yokosuka, Zama, Kamakura,
Kamakura Vivaldi, Fujisawa, Chigasaki, Atsugi, Hadano, Ebina, Ashigara, Matsudo, Funabashi, Narashino, Kisarazu, Tateyama, Choshi, Narita, Sakura, Abiko, Kashima, Kamisu, Tsukuba, Tsuchiura, Hitachi, Takasaki, Ota, Kiryu, Isesaki,
Beijing Guoan, Beijing, Shanghai Port, Shanghai SIPG, Shanghai Shenhua, Shanghai, Shandong Taishan, Shandong, Jinan, Qingdao, Qingdao Hainiu, Qingdao Jonoon, Guangzhou Evergrande, Guangzhou FC, Guangzhou, Guangzhou City, Shenzhen,
Shenzhen FC, Tianjin Jinmen Tiger, Tianjin Teda, Tianjin, Changchun Yatai, Changchun, Dalian Pro, Dalian Yifang, Dalian, Hangzhou Greentown, Hangzhou, Zhejiang FC, Zhejiang, Ningbo, Henan Songshan Longmen, Henan Jianye, Henan,
Zhengzhou, Wuhan Three Towns, Wuhan Zall, Wuhan, Chongqing Liangjiang Athletic, Chongqing, Chengdu Rongcheng, Chengdu, Meizhou Hakka, Meizhou, Nantong Zhiyun, Nantong, Cangzhou Mighty Lions, Cangzhou, Shijiazhuang,
Shijiazhuang Kungfu, Hebei, Hebei China Fortune, Jiangsu Suning, Jiangsu, Nanjing, Nanjing City, Nanjing Fengfan, Suzhou, Wuxi, Wuxi Wugou, Xi'an, Xian, Shaanxi, Shaanxi Chang'an Athletic, Kunshan, Heilongjiang, Harbin,
Yanbian, Yanbian Funde, Yanji, Liaoning, Shenyang, Shenyang Urban, Dalian Aerbin, Guizhou Hengfeng, Guiyang, Guizhou, Kunming, Yunnan, Yunnan Yukun, Lanzhou, Xining, Yinchuan, Urumqi, Xinjiang, Lhasa, Nanchang, Nanchang Hengyuan,
Hefei, Anhui, Fuzhou, Xiamen, Xiamen Lujiang, Fujian, Haikou, Hainan, Nanning, Guangxi, Guilin, Liuzhou, Zhuhai, Zhuhai Qin'ao, Dongguan, Foshan, Huizhou, Zhongshan, Hong Kong, Kitchee, South China, Eastern, Eastern Sports Club, Rangers HK,
Tai Po, Lee Man, Yuen Long, Southern, Happy Valley, Macau, Taipei, Taichung Futuro, Tainan, Kaohsiung, Hsinchu, Taoyuan, Tatung, Hang Yuen, Ulaanbaatar, Erchim, Khangarid, Pyongyang, April 25, Rimyongsu, Hanoi FC, Hanoi, Hanoi T&T,
Ho Chi Minh City, Saigon, Saigon FC, Hoang Anh Gia Lai, Pleiku, Binh Duong, Becamex Binh Duong, Thanh Hoa, Song Lam Nghe An, Nghe An, Vinh, Hai Phong, Haiphong, Da Nang, SHB Da Nang, Nam Dinh, Hong Linh Ha Tinh, Ha Tinh, Quang Nam,
Tam Ky, Dong Thap, Cao Lanh, Can Tho, Long An, Tan An, Khanh Hoa, Nha Trang, Binh Dinh, Quy Nhon, Quang Ninh, Ha Long, Viettel, Bangkok, Bangkok United, Buriram United, Buriram, Muangthong United, Muangthong, Port FC, Chiangrai United,
Chiang Rai, Chiang Mai, Chonburi, Chon Buri, BG Pathum United, Pathum Thani, Nakhon Ratchasima, Korat, Ratchaburi, Suphanburi, Samut Prakan, Samut Prakan City, Nongbua Pitchaya, Nongbua, Lamphun Warriors, Lamphun, Khon Kaen United,
Khon Kaen, Nakhon Si Thammarat, Songkhla, Phuket, Trat, Sukhothai, Uthai Thani, Prachuap, Rayong, Pattaya, Singapore, Lion City Sailors, Tampines Rovers, Tampines, Geylang International, Geylang, Albirex Niigata Singapore,
Hougang United, Hougang, Balestier Khalsa, Balestier, Tanjong Pagar United, Tanjong Pagar, Young Lions, Kuala Lumpur, Kuala Lumpur City, Selangor, Johor Darul Ta'zim, Johor Darul Takzim, Johor, Johor Bahru, Terengganu, Kuala Terengganu,
Kedah Darul Aman, Kedah, Alor Setar, Perak, Ipoh, Pahang, Kuantan, Kelantan, Kota Bharu, Penang, George Town, Negeri Sembilan, Seremban, Sabah, Kota Kinabalu, Sarawak, Kuching, Melaka, Malacca, PDRM, Sri Pahang, Persija Jakarta,
Persija, Jakarta, Persib Bandung, Persib, Bandung, Persebaya Surabaya, Persebaya, Surabaya, Arema, Arema Malang, Malang, PSM Makassar, PSM, Makassar, Bali United, Bali, Borneo FC, Borneo, Samarinda, Madura United, Madura, Persik Kediri,
Kediri, Persis Solo, Solo, Surakarta, PSIS Semarang, Semarang, Persita Tangerang, Tangerang, Persikabo, Bogor, Dewa United, Bhayangkara, Barito Putera, Banjarmasin, RANS Nusantara, Persebaya, PSS Sleman, Sleman, Yogyakarta, Persipura
Jayapura, Persipura, Jayapura, Sriwijaya, Palembang, Semen Padang, Padang, PSMS Medan, Medan, Persela Lamongan, Lamongan, Gresik, Persegres, Mitra Kukar, Tenggarong, Persiba Balikpapan, Balikpapan, Pelita Jaya, Manila, Kaya, Kaya Iloilo,
Iloilo, Ceres, Ceres Negros, Bacolod, United City, Azkals, Loyola, Stallion Laguna, Laguna, Dynamic Herb Cebu, Cebu, Davao Aguilas, Davao, Yangon United, Yangon, Shan United, Shan, Magwe, Ayeyawady United, Ayeyawady, Hanthawaddy,
Phnom Penh Crown, Phnom Penh, Visakha, Boeung Ket, Angkor Tiger, Siem Reap, Preah Khan Reach, Nagaworld, Svay Rieng, Vientiane, Lao Toyota, Young Elephant, Master 7, Dhaka Abahani, Abahani, Dhaka, Mohammedan, Bashundhara Kings,
Sheikh Jamal, Chittagong Abahani, Chittagong, Sylhet, Rajshahi, Khulna, Bangalore FC, Bengaluru FC, Bengaluru, Bangalore, Mumbai City, Mumbai, Mohun Bagan, Kolkata, East Bengal, Kerala Blasters, Kochi, Kerala, Chennaiyin, Chennai,
Hyderabad FC, Hyderabad, Odisha FC, Odisha, Bhubaneswar, Jamshedpur, FC Goa, Goa, Panaji, Margao, Churchill Brothers, Sporting Clube de Goa, Dempo, Salgaocar, NorthEast United, Guwahati, Punjab FC, Ludhiana, Minerva Punjab, Gokulam
Kerala, Kozhikode, Calicut, Real Kashmir, Srinagar, Aizawl, Shillong Lajong, Shillong, Rajasthan United, Jaipur, Sudeva Delhi, Delhi, Colombo, Colombo FC, Kandy, Galle, Jaffna, Kathmandu, Pokhara, Manang Marshyangdi, Machhindra,
Three Star Club, Thimphu, Paro, Druk Pol, Druk United, Transport United, Male, Maldives, Kabul, Kandahar, Herat, Karachi, Lahore, Islamabad, K-Electric, WAPDA, Khan Research Laboratories, Pakistan Army, Tashkent, Pakhtakor,
Pakhtakor Tashkent, Bunyodkor, Nasaf, Nasaf Qarshi, Qarshi, Lokomotiv Tashkent, Neftchi Fergana, Fergana, Navbahor, Namangan, Andijan, Andijon, Sogdiana, Jizzakh, Samarkand, Buxoro, Bukhara, Surkhon, Termez, AGMK, Olmaliq, Almalyk,
Dushanbe, Istiklol, Istiklol Dushanbe, Khujand, Regar-TadAZ, Tursunzoda, Bishkek, Dordoi, Dordoi Bishkek, Alay, Alay Osh, Osh, Abdysh-Ata, Kant, Ashgabat, Altyn Asyr, Ahal, Nebitchi, Merw, Mary, Turkmenabat, Dashoguz`),
  // ---- Middle East
  ...list(`Al Ahly, Al-Ahly, Ahly, Zamalek, Cairo, Pyramids, Pyramids FC, Al Masry, Masry, Port Said, Ismaily, Ismailia, Enppi, Smouha, Alexandria, Al Ittihad Alexandria, Ittihad Alexandria, Tala'ea El Gaish, Gaish, El Gouna, Gouna,
Hurghada, Ceramica Cleopatra, Cleopatra, Future FC, Pharco, Pharco FC, National Bank of Egypt, Bank, Modern Future, Ghazl El Mahalla, Mahalla, Mahalla al-Kubra, El Mokawloon, Mokawloon, Arab Contractors, Haras El Hodoud, Haras,
Aswan, Aswan SC, Luxor, Asyut, Assiut, Minya, Tanta, Mansoura, Zagazig, Damietta, Dumyat, Beni Suef, Fayoum, Suez, Suez Canal, Sharm El Sheikh, Sinai, Arish, El Entag El Harby, Entag, Petrojet, Telecom Egypt, Wadi Degla, Wadi,
Wydad Casablanca, Wydad, Casablanca, Raja Casablanca, Raja, Raja Club Athletic, FAR Rabat, AS FAR, Rabat, Maghreb de Fes, MAS Fes, Fes, Fez, Hassania Agadir, Agadir, Ittihad Tanger, IR Tanger, Tangier, Tanger, RS Berkane,
Berkane, Renaissance de Berkane, Oujda, Mouloudia Oujda, Moghreb Tetouan, Tetouan, Olympique Khouribga, Khouribga, Olympic Safi, Safi, Difaa El Jadidi, El Jadida, Kenitra, KAC Kenitra, Meknes, CODM Meknes, Youssoufia Berrechid,
Berrechid, Chabab Mohammedia, Mohammedia, Rapide Oued Zem, Oued Zem, Jeunesse Sportive Soualem, Soualem, Marrakech, Kawkab Marrakech, Taroudant, Ouarzazate, Laayoune, Dakhla, Nador, Hoceima, Al Hoceima, Larache, Ksar El Kebir,
Esperance, Esperance de Tunis, Tunis, Club Africain, Etoile du Sahel, Sousse, Etoile Sportive du Sahel, CS Sfaxien, Sfax, Stade Tunisien, US Monastirienne, Monastir, Union Sportive Ben Guerdane, Ben Guerdane, Gabes, AS Gabes,
Gafsa, Kairouan, Bizerte, CA Bizertin, Bizerte, Beja, Jendouba, Le Kef, Kef, Tozeur, Medenine, Zarzis, Djerba, US Tataouine, Tataouine, Nabeul, Hammamet, Ezzahra, La Marsa, Carthage, Ariana, Ben Arous, Manouba, Mahdia, Metlaoui,
Algiers, JS Kabylie, Kabylie, Tizi Ouzou, MC Alger, MC Algiers, USM Alger, USM Algiers, CR Belouizdad, Belouizdad, Belcourt, Paradou AC, Paradou, NA Hussein Dey, Hussein Dey, ES Setif, Setif, CS Constantine, Constantine, MC Oran,
Oran, ASO Chlef, Chlef, JS Saoura, Saoura, Bechar, USM Bel Abbes, Sidi Bel Abbes, Bel Abbes, MC El Eulma, Eulma, ES Tadjenanet, Tadjenanet, Olympique Medea, Medea, Tlemcen, WA Tlemcen, Mostaganem, Relizane, Mascara, Saida, Tiaret,
Ghardaia, Ouargla, Biskra, Batna, Annaba, USM Annaba, Skikda, Bejaia, JSM Bejaia, Mila, Jijel, Guelma, Souk Ahras, Tebessa, Khenchela, Oum El Bouaghi, Laghouat, Djelfa, Msila, Bordj Bou Arreridj, Boumerdes, Blida, Tipaza, Ain Defla,
Kaizer Chiefs, Orlando Pirates, Mamelodi Sundowns, Sundowns, Mamelodi, Pretoria, Soweto, Johannesburg, Cape Town City, Cape Town, Stellenbosch, Stellenbosch FC, SuperSport United, SuperSport, Supersport, Royal AM, Durban, Golden Arrows,
Lamontville Golden Arrows, Lamontville, AmaZulu, Richards Bay, Chippa United, Port Elizabeth, Gqeberha, Sekhukhune United, Sekhukhune, Polokwane City, Polokwane, TS Galaxy, Galaxy, Marumo Gallants, Gallants, Cape Umoya United,
Moroka Swallows, Swallows, Bloemfontein Celtic, Bloemfontein, Platinum Stars, Rustenburg, Free State Stars, Black Leopards, Thohoyandou, Maritzburg United, Pietermaritzburg, Ajax Cape Town, Bidvest Wits, Wits, Wits University, Santos Cape
Town, Jomo Cosmos, University of Pretoria, Tuks, Mpumalanga Black Aces, Nelspruit, Mbombela, Kimberley, Welkom, East London, Mthatha, Umtata, Bhisho, Potchefstroom, Klerksdorp, Polokwane, Louis Trichardt, Makhado, Tzaneen, Pietersburg,
Enyimba, Aba, Kano Pillars, Kano, Rangers International, Enugu Rangers, Enugu, Shooting Stars, Ibadan, 3SC, Heartland, Owerri, Plateau United, Jos, Rivers United, Port Harcourt, Remo Stars, Ikenne, Akwa United, Uyo, Lobi Stars, Makurdi,
Sunshine Stars, Akure, Abia Warriors, Umuahia, Nasarawa United, Lafia, Wikki Tourists, Bauchi, Katsina United, Katsina, Kwara United, Ilorin, Niger Tornadoes, Minna, Gombe United, Gombe, Bendel Insurance, Benin City, Warri Wolves, Warri,
Delta Force, Asaba, MFM, Lagos, Abuja, Kaduna, Ogun, Abeokuta, Sokoto, Maiduguri, Yola, Calabar, Ado Ekiti, Ekiti, Osogbo, Ondo, Awka, Abakaliki, Ebonyi, Lokoja, Yenagoa, Bayelsa, Bayelsa United, Dolphins, Dolphin FC,
Asante Kotoko, Kotoko, Kumasi, Hearts of Oak, Accra Hearts of Oak, Accra, Medeama, Tarkwa, Aduana Stars, Dormaa, Dormaa Ahenkro, Berekum Chelsea, Berekum, Legon Cities, Legon, Karela United, Karela, Bechem United, Bechem, Great Olympics,
Olympics, Dreams FC, Dreams, Dawu, Nsoatreman, King Faisal, Samartex, Tamale City, Tamale, Real Tamale United, Real Tamale, Hasaacas, Takoradi, Sekondi, Sekondi Eleven Wise, Eleven Wise, Cape Coast, Cape Coast Ebusua Dwarfs, Ebusua Dwarfs,
Ho, Koforidua, Techiman, Sunyani, Wa, Bolgatanga, Obuasi, Ashanti Gold, Tema, Tema Youth, Inter Allies, Accra Lions, Wa All Stars, Tema Youth, Okwahu United, Nkawkaw,
ASEC Mimosas, ASEC, Abidjan, Africa Sports, Stella Club, Stade d'Abidjan, SO Armee, San Pedro, SC Gagnoa, Gagnoa, Sewe Sport, Bouake, Sporting Gagnoa, Racing Club d'Abidjan, Yamoussoukro, Daloa, Korhogo, Man, Odienne, Divo, Bondoukou,
AS Tanda, Tanda, Williamsville, Williamsville AC, Bassam, Grand-Bassam, Tiassale, Agboville, Adzope, Abengourou, Aboisso, Duekoue, Issia, Sinfra, Bangolo, Toumodi, Dimbokro, Seguela, Ferkessedougou, Boundiali, Touba, Danane,
Diambars, Generation Foot, Teungueth, Teungueth FC, Dakar, Dakar Sacre-Coeur, Jaraaf, Casa Sports, Ziguinchor, Linguere, Linguère, ASC Linguere, Niary Tally, Guediawaye, Pikine, Mbour, Thies, Saint-Louis, Kaolack, Touba, Tambacounda,
Kolda, Louga, Diourbel, Fatick, Kedougou, Sedhiou, Matam, Podor, Richard-Toll, Rufisque, Bargny, Mbao, Mbao FC, Oslo, Douala, Yaounde, Canon Yaounde, Canon, Tonnerre Yaounde, Tonnerre, Union Douala, Coton Sport, Coton Sport Garoua,
Garoua, Cotonsport, Fovu Club, Fovu Baham, Baham, Bamenda, Bamenda Stars, Bafoussam, Bafang, Dschang, Limbe, Kribi, Ebolowa, Bertoua, Maroua, Ngaoundere, Buea, Kumba, Mbouda, Foumban, Nkongsamba, Eding Sport, Eding, Racing
Bafoussam, Stade Renard, Stade Renard de Melong, Melong, Panthere du Ndé, Ndé, Avion, Avion Academy, UMS de Loum, Loum, Apejes, Apejes Academy, AS Fortuna, Fortuna Mfou, Mfou, PWD Bamenda, PWD, Yong Sports Academy,
Stade Malien, Bamako, Djoliba, Djoliba AC, AS Real Bamako, Real Bamako, Cercle Olympique de Bamako, Cercle Olympique, AS Onze Createurs, Onze Createurs, USFAS Bamako, USFAS, AS Black Stars, Black Stars, Centre Salif Keita, Salif Keita,
Mopti, Sikasso, Segou, Kayes, Koulikoro, Gao, Tombouctou, Timbuktu, Kidal, Kati, Koutiala, San, Niono, Bougouni, Kita, Nara, Yanfolila, Kadiolo, Fana, Dioila, Banamba, Kolokani, Kangaba, Koro, Bandiagara, Douentza, Bafoulabe,
Etoile Filante, Etoile Filante Ouagadougou, Ouagadougou, Ouaga, ASFA Yennenga, Yennenga, Rail Club du Kadiogo, Rail Club, Kadiogo, Salitas, Salitas FC, Bobo Dioulasso, Bobo, Racing Club de Bobo, Santos Ouagadougou, Santos,
Koudougou, Ouahigouya, Banfora, Dedougou, Fada N'Gourma, Kaya, Tenkodogo, Dori, Gaoua, Po, Ziniare, Reo, Leo, Tougan, Orodara, Houndé, Hounde, Djibo, Manga, Koupela, Pouytenga, Bittou, Garango, Zabre, Zorgho, Boulsa,
Horoya, Conakry, Hafia, Hafia FC, Kaloum, Kaloum Star, Milo, Milo FC, Kankan, Kindia, Labe, Mamou, Boke, Faranah, Siguiri, Nzerekore, Kissidougou, Gueckedou, Coyah, Dubreka, Fria, Telimele, Mali, Pita, Dalaba, Tougue, Koubia,
Lelouma, Gaoual, Koundara, Boffa, Forecariah, Kamsar, Kolaboui, Macenta, Yomou, Lola, Beyla, Kerouane, Mandiana, Dinguiraye, Dabola, Kouroussa, Kerouane, Banfele, Kankan Mandiana, Mandiana Kankan
Al Hilal, Al-Hilal, Hilal, Riyadh, Al Nassr, Al-Nassr, Nassr, Al Ittihad, Al-Ittihad, Ittihad, Jeddah, Al Ahli, Al-Ahli, Ahli Jeddah, Al Shabab, Al-Shabab, Shabab, Al Taawoun, Taawoun, Buraidah, Al Fateh, Fateh, Al Hofuf, Hofuf,
Al Fayha, Fayha, Majmaah, Al Raed, Raed, Al Wehda, Wehda, Mecca, Makkah, Al Ettifaq, Ettifaq, Dammam, Al Khaleej, Khaleej, Saihat, Damac, Abha, Khamis Mushait, Al Okhdood, Okhdood, Najran, Al Tai, Tai, Hail, Al Qadsiah,
Qadsiah, Khobar, Al Kholood, Kholood, Ar Rass, Al Orobah, Orobah, Sakaka, Al Zulfi, Zulfi, Al Jabalain, Jabalain, Medina, Madinah, Al Ansar, Ansar, Al Hazem, Hazem, Al Riyadh, Al Adalah, Adalah, Al Batin, Batin, Hafar Al-Batin,
Al Diriyah, Diriyah, Jazan, Jizan, Tabuk, Al Safa, Safa, Al Nahda, Nahda, Al Qaisumah, Qaisumah, Unaizah, Al Bukayriyah, Bukayriyah, Al Kharj, Kharj, Al Hamadah, Hamadah, Al Anwar, Anwar, Al Arabi, Arabi, Al Faisaly Harmah, Harmah,
Al Duhail, Duhail, Doha, Al Sadd, Sadd, Al Rayyan, Rayyan, Al Gharafa, Gharafa, Al Arabi Doha, Qatar SC, Umm Salal, Umm Salal SC, Al Wakrah, Wakrah, Al Khor, Khor, Al Shamal, Shamal, Al Sailiya, Sailiya, Muaither, Al Ahli Doha,
Al Markhiya, Markhiya, Al Shahania, Shahania, Al Kharaitiyat, Kharaitiyat, Lusail, Al Ain, Ain, Al Wahda, Wahda, Abu Dhabi, Al Jazira, Jazira, Shabab Al Ahli, Dubai, Al Wasl, Wasl, Al Nasr Dubai, Al Sharjah, Sharjah, Al Shabab Dubai,
Baniyas, Ajman, Al Ajman, Al Dhafra, Dhafra, Khor Fakkan, Khorfakkan, Fujairah, Al Fujairah, Al Urooba, Urooba, Ras Al Khaimah, Al Hamriyah, Hamriyah, Al Bataeh, Bataeh, Emirates Club, Dibba, Dibba Al Fujairah, Al Orouba,
Kuwait SC, Kuwait, Al Arabi Kuwait, Al Qadsia, Qadsia, Al Kuwait, Al Salmiya, Salmiya, Kazma, Al Jahra, Jahra, Al Yarmouk, Yarmouk, Al Sahel, Sahel, Al Tadamon, Tadamon, Al Naser, Naser, Burgan, Al Shabab Kuwait, Khaitan, Al Fahaheel,
Fahaheel, Al Salibikhaet, Salibikhaet, Sulaibikhat, Bahrain, Manama, Al Muharraq, Muharraq, Riffa, Al Riffa, Al Ahli Bahrain, Al Khaldiya, Khaldiya, Al Hidd, Hidd, East Riffa, Sitra, Al Najma, Najma, Busaiteen, Malkiya, Al Shabab Bahrain,
Muscat, Oman, Al Seeb, Seeb, Dhofar, Salalah, Al Nahda Oman, Sur, Al Suwaiq, Suwaiq, Fanja, Al Oruba, Sohar, Saham, Al Rustaq, Rustaq, Nizwa, Al Mussanah, Mussanah, Bahla, Ibri, Ibra, Khasab, Bidbid, Samail, Barka, Sohar Sports,
Amman, Al Wihdat, Wihdat, Al Faisaly, Faisaly, Al Jazeera Amman, Al Ramtha, Ramtha, Irbid, Al Hussein Irbid, Al Hussein, Sahab, Al Salt, Salt, Zarqa, Al Baqaa, Baqaa, Shabab Al Ordon, Ordon, Aqaba, Al Jalil, Jalil, Mansheyat Bani Hasan,
Maan, Al Aqaba, Kfarsoum, Kufrsoum, Jerash, Ajloun, Mafraq, Karak, Tafilah, Madaba, Beirut, Al Ahed, Ahed, Nejmeh, Safa Beirut, Ansar Beirut, Racing Beirut, Salam Zgharta, Zgharta, Tripoli, Tadamon Sour, Sour, Tyre, Sidon, Saida,
Akhaa Ahli Aley, Aley, Bourj, Shabab Sahel, Shabab Arabi, Damascus, Al Jaish, Jaish, Al Wahda Damascus, Al Karamah, Karamah, Homs, Al Ittihad Aleppo, Aleppo, Hama, Latakia, Tishreen, Al Wathba, Wathba, Al Shorta, Shorta, Al Hurriya,
Hurriya, Al Fotuwa, Fotuwa, Deir ez-Zor, Raqqa, Idlib, Daraa, Baghdad, Al Shorta Baghdad, Al Zawraa, Zawraa, Al Quwa Al Jawiya, Air Force Club, Quwa, Al Talaba, Talaba, Erbil, Duhok, Zakho, Sulaymaniyah, Najaf, Al Najaf, Basra,
Naft Al Wasat, Naft Maysan, Maysan, Amarah, Karbala, Kirkuk, Mosul, Nineveh, Samawa, Diwaniyah, Hillah, Babil, Kut, Nasiriyah, Ramadi, Fallujah, Tikrit, Samarra, Baqubah, Khanaqin, Halabja, Sinjar, Zakho FC, Peshmerga,
Tehran, Persepolis, Esteghlal, Esteghlal Tehran, Sepahan, Isfahan, Esfahan, Tractor, Tractor Sazi, Tabriz, Foolad, Foolad Khuzestan, Ahvaz, Ahwaz, Zob Ahan, Zob Ahan Isfahan, Gol Gohar, Sirjan, Malavan, Bandar Anzali, Anzali, Nassaji
Mazandaran, Nassaji, Qaemshahr, Sari, Mazandaran, Aluminium Arak, Arak, Saipa, Saipa Tehran, Paykan, Paykan Tehran, Naft Tehran, Naft Masjed Soleyman, Masjed Soleyman, Mes Rafsanjan, Rafsanjan, Mes Kerman, Kerman, Shahr Khodro,
Mashhad, Havadar, Fajr Sepasi, Shiraz, Fajr, Gostaresh Foolad, Machine Sazi, Machine Sazi Tabriz, Pas Hamedan, Hamedan, Sanat Naft, Abadan, Khorramabad, Rah Ahan, Shahrdari Tabriz, Shahin Bushehr, Bushehr, Zagros Yasuj, Yasuj, Gahar Zagros,
Esteghlal Khuzestan, Karaj, Nirooye Zamini, Damash, Damash Gilan, Rasht, Giti Pasand, Chooka, Bandar Abbas, Sepidrood, Sepidrood Rasht, Kish, Qeshm, Chabahar, Zahedan, Birjand, Bojnord, Gorgan, Ardabil, Urmia, Orumiyeh, Sanandaj, Ilam,
Kermanshah, Qom, Yazd, Semnan, Zanjan, Qazvin, Khorramshahr, Dezful, Behbahan`),
  // ---- South America
  ...list(`Boca Juniors, Boca, River Plate, River, Racing Club, Racing Avellaneda, Avellaneda, Independiente, San Lorenzo, San Lorenzo de Almagro, Velez Sarsfield, Velez, Estudiantes, Estudiantes de La Plata, La Plata, Gimnasia La Plata,
Gimnasia y Esgrima, Lanus, Banfield, Argentinos Juniors, Huracan, Newell's Old Boys, Newells Old Boys, Newells, Rosario, Rosario Central, Talleres, Talleres de Cordoba, Cordoba, Belgrano, Belgrano de Cordoba, Instituto, Instituto de
Cordoba, Godoy Cruz, Mendoza, Atletico Tucuman, Tucuman, San Martin de Tucuman, San Martin de San Juan, San Juan, Colon, Colon de Santa Fe, Santa Fe, Union de Santa Fe, Union, Defensa y Justicia, Florencio Varela, Tigre, Platense,
Sarmiento, Sarmiento de Junin, Junin, Central Cordoba, Santiago del Estero, Central Cordoba de Santiago, Patronato, Parana, Barracas Central, Barracas, Riestra, Deportivo Riestra, Aldosivi, Mar del Plata, Arsenal de Sarandi, Sarandi,
Quilmes, Chacarita Juniors, Chacarita, Nueva Chicago, Ferro Carril Oeste, Ferro, All Boys, Atlanta, Temperley, Almirante Brown, Almagro, Tristan Suarez, Deportivo Moron, Moron, Estudiantes de Rio Cuarto, Rio Cuarto, Gimnasia de Jujuy,
Jujuy, Gimnasia y Tiro, Salta, Juventud Unida, San Telmo, Los Andes, Lomas de Zamora, Brown de Adrogue, Adrogue, Colegiales, Excursionistas, Dock Sud, Sacachispas, Defensores de Belgrano, Ituzaingo, Merlo, Estudiantes de Buenos Aires,
Flandria, Villa Dalmine, Campana, Zarate, San Miguel, Muñiz, Muniz, Deportivo Armenio, Armenio, Lujan, Mercedes, Chivilcoy, Pergamino, San Nicolas, Rosario, Sunchales, Rafaela, Atletico de Rafaela, Ceres, Olimpo, Bahia Blanca,
Villa Mitre, Liniers, Santamarina, Tandil, Olavarria, Racing de Olavarria, Necochea, Mar del Plata, Neuquen, Cipolletti, Cutral Co, Bariloche, Comodoro Rivadavia, Ushuaia, Rio Gallegos, Ushuaia, Posadas, Crucero del Norte, Resistencia,
Chaco For Ever, Corrientes, Boca Unidos, Formosa, Clorinda, Santa Rosa, La Pampa, Rio Negro, Chubut, Trelew, Madryn, Puerto Madryn,
Flamengo, Rio de Janeiro, Palmeiras, Corinthians, Santos, Sao Paulo, Sao Paulo FC, Gremio, Porto Alegre, Internacional, Fluminense, Vasco da Gama, Vasco, Botafogo, Cruzeiro, Belo Horizonte, Atletico Mineiro, Galo, Atletico-MG,
Bahia, Salvador, Vitoria, Sport Recife, Recife, Santa Cruz, Nautico, Ceara, Fortaleza, Fortaleza EC, Coritiba, Curitiba, Athletico Paranaense, Athletico-PR, Paranaense, Parana Clube, Londrina, Cascavel, Maringa, Foz do Iguacu,
Goias, Goiania, Atletico Goianiense, Vila Nova, Anapolis, Brasilia, Gama, Brasiliense, Cuiaba, Mato Grosso, Campo Grande, Operario, Operario Ferroviario, Ponta Grossa, Avai, Florianopolis, Figueirense, Chapecoense, Chapeco, Criciuma,
Joinville, Brusque, Blumenau, Juventude, Caxias, Caxias do Sul, Pelotas, Novo Hamburgo, Santa Maria, Ypiranga, Bragantino, Red Bull Bragantino, Braganca Paulista, Ponte Preta, Campinas, Guarani, Mirassol, Novorizontino, Novo Horizonte,
Botafogo-SP, Ribeirao Preto, Sao Bernardo, Santo Andre, Sao Caetano, Portuguesa, Juventus, Ituano, Itu, Sorocaba, Sao Jose, Sao Jose dos Campos, Taubate, Bauru, Marilia, Presidente Prudente, Votuporanga, America Mineiro, America-MG,
Uberlandia, Uberaba, Tombense, Tombos, Villa Nova, Nova Lima, Ipatinga, Boa Esporte, Varginha, Poços de Caldas, Pocos de Caldas, Juiz de Fora, Tupi, Volta Redonda, Madureira, Bangu, Nova Iguacu, Cabofriense, Cabo Frio, Resende, Macae,
Campos, Americano, Duque de Caxias, Portuguesa-RJ, America-RJ, Olaria, Boavista, Sampaio Correa, Sao Luis, Maranhao, Moto Club, Imperatriz, Piaui, Teresina, River-PI, Parnahyba, Ceara SC, Ferroviario, Icasa, Juazeiro, Crato, Sobral,
Treze, Campina Grande, Botafogo-PB, Joao Pessoa, Campinense, Sousa, America-RN, ABC, Natal, Potiguar, CRB, Maceio, CSA, ASA, Arapiraca, Sergipe, Aracaju, Confianca, Lagarto, Itabaiana, Jacuipense, Feira de Santana, Fluminense de Feira,
Vitoria da Conquista, Ilheus, Itabuna, Juazeirense, Paysandu, Belem, Remo, Clube do Remo, Tuna Luso, Sao Raimundo, Manaus, Nacional-AM, Manaus FC, Rio Branco, Acre, Rio Branco-AC, Macapa, Amapa, Boa Vista, Roraima, Porto Velho,
Rondonia, Palmas, Tocantins, Aguia de Maraba, Maraba, Santarem, Castanhal,
Penarol, Montevideo, Nacional, Nacional Montevideo, Defensor Sporting, Danubio, Wanderers, Montevideo Wanderers, River Plate Montevideo, Liverpool Montevideo, Cerro, Cerro Largo, Melo, Rampla Juniors, Rampla, Racing Montevideo, Fenix,
Progreso, Boston River, Plaza Colonia, Colonia, Torque, Montevideo City Torque, Cerro Largo, Juventud, Las Piedras, Miramar Misiones, Misiones, Deportivo Maldonado, Maldonado, Atenas, San Carlos, Salto, Paysandu, Rivera, Tacuarembo,
Artigas, Florida, Durazno, Mercedes, Rocha, Treinta y Tres, Minas, Lavalleja, Canelones, Pando, Rio Branco Uruguay, Oriental, Albion, Central Espanol, Bella Vista, Huracan Buceo, Villa Teresa, Villa Espanola,
Olimpia, Asuncion, Cerro Porteno, Libertad, Guarani Paraguay, Nacional Asuncion, Sol de America, Tacuary, 12 de Octubre, Sportivo Luqueno, Luque, Sportivo Ameliano, Ameliano, General Caballero, Resistencia SC, Guairena, Villarrica,
River Plate Paraguay, Rubio Nu, Fernando de la Mora, Capiata, Trinidense, 3 de Febrero, Ciudad del Este, Encarnacion, Pedro Juan Caballero, Concepcion, Coronel Oviedo, Caacupe, Carapegua, Pilar, San Lorenzo Paraguay, Lambare,
Barcelona SC, Guayaquil, Emelec, LDU Quito, Liga de Quito, Quito, Independiente del Valle, Sangolqui, El Nacional, Deportivo Quito, Aucas, Universidad Catolica, Macara, Ambato, Delfin, Manta, Orense, Machala, Mushuc Runa, Guayaquil City,
Cuenca, Deportivo Cuenca, Olmedo, Riobamba, Tecnico Universitario, Imbabura, Ibarra, Cumbaya, Libertad Loja, Loja, Gualaceo, Macara Ambato, Santo Domingo, Esmeraldas, Portoviejo, Manabi, Quevedo, Babahoyo, Milagro, Duran, Daule,
Alianza Lima, Lima, Universitario, Universitario de Deportes, Sporting Cristal, Cristal, Rimac, Melgar, FBC Melgar, Arequipa, Cusco, Cienciano, Cusco FC, Binacional, Juliaca, Sport Huancayo, Huancayo, Cesar Vallejo, Trujillo, Sport Boys,
Callao, Ayacucho, Ayacucho FC, Garcilaso, Deportivo Municipal, Municipal, Alianza Atletico, Sullana, Carlos Mannucci, Mannucci, Union Comercio, Moyobamba, Comerciantes Unidos, Cutervo, Juan Aurich, Chiclayo, Pirata, Los Chankas, Andahuaylas,
Alianza Universidad, Huanuco, Deportivo Garcilaso, Piura, Tacna, Puno, Ica, Chincha, Pisco, Huaraz, Cajamarca, Tarapoto, Pucallpa, Iquitos, Cerro de Pasco, Tarma, Jauja, Chimbote, Huacho, Cañete, Canete, Barranca,
Colo-Colo, Santiago, Universidad de Chile, Universidad Catolica, Union Espanola, Palestino, Everton de Vina del Mar, Vina del Mar, Santiago Wanderers, Valparaiso, Cobreloa, Calama, Cobresal, El Salvador, Huachipato, Talcahuano,
Concepcion, Deportes Concepcion, Universidad de Concepcion, O'Higgins, Rancagua, Audax Italiano, Curico Unido, Curico, Union La Calera, La Calera, Coquimbo Unido, Coquimbo, Deportes Iquique, Iquique, Deportes Antofagasta, Antofagasta,
Deportes La Serena, La Serena, Deportes Temuco, Temuco, Deportes Copiapo, Copiapo, Deportes Valdivia, Valdivia, Deportes Puerto Montt, Puerto Montt, Deportes Melipilla, Melipilla, Deportes Recoleta, Recoleta, Magallanes, San Luis de
Quillota, San Luis, Quillota, Rangers de Talca, Talca, Deportes Linares, Linares, Lota Schwager, Lota, Naval, Ñublense, Nublense, Chillan, Union San Felipe, San Felipe, Trasandino, Los Andes, Provincial Osorno, Osorno, Fernandez Vial,
Santiago Morning, Barnechea, Deportes Santa Cruz, Santa Cruz, Independiente de Cauquenes, Cauquenes, Deportes Arica, Arica, Deportes Ovalle, Ovalle, Deportes Vallenar, Vallenar,
Atletico Nacional, Medellin, Independiente Medellin, Deportivo Independiente Medellin, Millonarios, Bogota, Santa Fe, Independiente Santa Fe, America de Cali, Cali, Deportivo Cali, Junior, Junior de Barranquilla, Barranquilla,
Atletico Junior, Once Caldas, Manizales, Deportes Tolima, Tolima, Ibague, Atletico Bucaramanga, Bucaramanga, Deportivo Pasto, Pasto, Envigado, Aguilas Doradas, Rionegro, Alianza Petrolera, Barrancabermeja, Jaguares de Cordoba,
Jaguares, Monteria, La Equidad, Equidad, Patriotas, Tunja, Boyaca Chico, Cucuta Deportivo, Cucuta, Deportes Quindio, Armenia, Quindio, Deportivo Pereira, Pereira, Cortulua, Tulua, Union Magdalena, Santa Marta, Real Cartagena, Cartagena,
Fortaleza CEIF, Llaneros, Villavicencio, Orsomarso, Palmira, Atletico Huila, Neiva, Huila, Leones, Itagui, Itagüi, Bogota FC, Tigres, Valledupar, Sincelejo, Real Santander, Floridablanca, Girardot, Barranquilla FC, Dimayor,
Caracas, Caracas FC, Deportivo Tachira, San Cristobal, Tachira, Zamora FC, Barinas, Carabobo, Valencia Venezuela, Mineros de Guayana, Puerto Ordaz, Guayana, Deportivo La Guaira, La Guaira, Metropolitanos, Estudiantes de Merida, Merida,
Monagas, Maturin, Academia Puerto Cabello, Puerto Cabello, Portuguesa FC, Acarigua, Aragua, Maracay, Lara, Barquisimeto, Deportivo Lara, Trujillanos, Trujillo, Hermanos Colmenarez, Rayo Zuliano, Zulia, Maracaibo, Llaneros de Guanare,
Guanare, Angostura, Ciudad Bolivar, Ureña, Urena, Zamora, Atletico Venezuela, Estudiantes de Caracas, Mineros, Petare, Atletico El Vigia, El Vigia,
Bolivar, La Paz, The Strongest, Oriente Petrolero, Santa Cruz, Blooming, Jorge Wilstermann, Wilstermann, Cochabamba, Aurora, Always Ready, El Alto, Nacional Potosi, Potosi, Real Potosi, Royal Pari, San Jose, Oruro, Universitario Sucre,
Sucre, Independiente Petrolero, Guabira, Montero, Palmaflor, Vinto, Blooming Santa Cruz, Real Santa Cruz, Tarija, Real Tomayapo, Universitario de Vinto, Fancesa, Municipal Real Mamore, Trinidad, Beni, Cobija, Pando, Villazon,
Yacuiba, Bermejo, Camiri, Uyuni, Tupiza, Llallagua, Uncia, Huanuni, Potosi, Colquechaca, Sacaba, Quillacollo, Tiquipaya, Vinto, Sipe Sipe, Punata, Cliza, Tarata`),
  // ---- North and Central America, Caribbean
  ...list(`Club America, America, Chivas, Guadalajara, Chivas de Guadalajara, Cruz Azul, Pumas, Pumas UNAM, UNAM, Tigres, Tigres UANL, Monterrey, Rayados, Rayados de Monterrey, Santos Laguna, Torreon, Leon, Club Leon, Pachuca, Toluca,
Atlas, Necaxa, Aguascalientes, Puebla, Queretaro, Gallos Blancos, Mazatlan, Mazatlan FC, Juarez, FC Juarez, Ciudad Juarez, Tijuana, Xolos, Club Tijuana, San Luis, Atletico San Luis, Veracruz, Tiburones Rojos, Morelia, Monarcas Morelia,
Estudiantes Tecos, Tecos, Dorados, Dorados de Sinaloa, Culiacan, Lobos BUAP, Lobos, Celaya, Cimarrones de Sonora, Hermosillo, Correcaminos, Ciudad Victoria, Tampico Madero, Tampico, Madero, Atletico Zacatepec, Zacatepec, Cafetaleros,
Tapachula, Tlaxcala, Coras, Tepic, Alebrijes de Oaxaca, Oaxaca, Venados, Merida, Venados FC, Cancun, Cancun FC, Mineros de Zacatecas, Zacatecas, Leones Negros, Leones Negros UdeG, Tepatitlan, Tepatitlan de Morelos, Irapuato, Durango, Saltillo,
Chihuahua, Coahuila, Torreon, Monclova, Reynosa, Matamoros, Nuevo Laredo, Acapulco, Chilpancingo, Cuernavaca, Pachuca, Tulancingo, Tlalnepantla, Toluca, Metepec, Puebla, Cholula, Tehuacan, Orizaba, Cordoba, Xalapa, Poza Rica, Minatitlan,
Villahermosa, Tabasco, Campeche, Chetumal, Colima, Manzanillo, Morelia, Uruapan, Zamora, Guanajuato, Salamanca, Silao, Celaya, San Miguel, Queretaro, San Juan del Rio, Aguascalientes, San Luis Potosi, Ciudad Valles, Mexico City,
Ciudad de Mexico, Naucalpan, Ecatepec, Neza, Nezahualcoyotl, Texcoco, Chalco, Ixtapaluca, Tlahuac, Iztapalapa, Coyoacan, Xochimilco, Tlalpan, Azcapotzalco, Atizapan, Cuautitlan, Tultitlan, Tecamac, Zumpango,
LA Galaxy, Los Angeles, Los Angeles FC, LAFC, Inter Miami, Miami, Atlanta United, Atlanta, Seattle Sounders, Seattle, Portland Timbers, Portland, Vancouver Whitecaps, Vancouver, Toronto FC, Toronto, CF Montreal, Montreal, Impact de Montreal,
New York Red Bulls, Red Bulls, New York City FC, New York, NYCFC, New England Revolution, Boston, Revolution, Philadelphia Union, Philadelphia, DC United, Washington, Orlando City, Orlando, Charlotte FC, Charlotte, Nashville SC, Nashville,
Columbus Crew, Columbus, FC Cincinnati, Cincinnati, Chicago Fire, Chicago, Minnesota United, Minneapolis, St Paul, Sporting Kansas City, Kansas City, Houston Dynamo, Houston, FC Dallas, Dallas, Austin FC, Austin, Colorado Rapids, Denver,
Real Salt Lake, Salt Lake, Utah, San Jose Earthquakes, San Jose, Earthquakes, San Diego FC, San Diego, St Louis City, St Louis, Saint Louis, Sacramento Republic, Sacramento, Tampa Bay Rowdies, Tampa, Rowdies, Louisville City, Louisville,
Indy Eleven, Indianapolis, Detroit City, Detroit, Pittsburgh Riverhounds, Pittsburgh, Riverhounds, Hartford Athletic, Hartford, Rhode Island FC, Providence, Charleston Battery, Charleston, Birmingham Legion, Memphis 901, Memphis,
El Paso Locomotive, El Paso, Phoenix Rising, Phoenix, Las Vegas Lights, Las Vegas, Oakland Roots, Oakland, Orange County SC, Orange County, Monterey Bay, Loudoun United, Loudoun, Miami FC, Atlanta, Oklahoma City, Tulsa, FC Tulsa,
New Mexico United, Albuquerque, Lexington SC, Lexington, Greenville Triumph, Greenville, Chattanooga Red Wolves, Chattanooga, Tormenta, Spokane, Sporting Club Jacksonville, Jacksonville, Fort Lauderdale, Lauderdale, Cosmos, New York Cosmos,
Minnesota, Milwaukee, Cleveland, Buffalo, Rochester, Syracuse, Albany, Richmond Kickers, Richmond, Norfolk, Raleigh, North Carolina FC, Carolina Railhawks, Wilmington, Durham, Atlanta Silverbacks, Savannah, Orlando Pride, Portland Thorns,
Seattle Reign, Houston Dash, Utah Royals, Kansas City Current, Racing Louisville, Angel City, Bay FC, Chicago Red Stars, Gotham, Gotham FC, North Carolina Courage, Washington Spirit, San Diego Wave, NJ/NY Gotham FC, Cavalry FC, Calgary,
Forge FC, Hamilton, HFX Wanderers, Halifax, Pacific FC, Victoria, Atletico Ottawa, Ottawa, Ottawa Fury, York United, York9, Valour FC, Winnipeg, FC Edmonton, Edmonton, Saskatchewan, Saskatoon, Regina, Quebec, Laval, Sherbrooke, Oshawa,
Brampton, Mississauga, Burnaby, Surrey, Langley, Abbotsford, Kelowna, Kamloops, London, Kitchener, Waterloo, Guelph, Windsor, Sudbury, Thunder Bay, St John's, Moncton, Fredericton, Saint John, Charlottetown,
Saprissa, Deportivo Saprissa, San Jose Costa Rica, Alajuelense, Liga Deportiva Alajuelense, Alajuela, Herediano, Heredia, Cartagines, Cartago, Perez Zeledon, San Isidro, Guanacasteca, Guanacaste, Liberia, Santos de Guapiles, Guapiles,
Limon, Puntarenas, Sporting FC Costa Rica, Jicaral, Municipal Grecia, Grecia, Pococi, Belen, Uruguay de Coronado, Coronado, San Carlos Costa Rica, Ciudad Quesada, Quepos, Golfito, Ciudad Neily, Turrialba, Siquirres, Nicoya, Santa Cruz,
Olimpia Honduras, Tegucigalpa, Motagua, Real Espana, San Pedro Sula, Marathon, Vida, La Ceiba, Honduras Progreso, El Progreso, Platense Honduras, Puerto Cortes, Real Sociedad Honduras, Tocoa, Lobos UPNFM, Juticalpa, Olancho, Choloma,
Choluteca, Comayagua, Siguatepeque, Danli, Santa Rosa de Copan, Copan, Roatan, Tela, Olimpia, Real Madriz, Municipal Guatemala, Guatemala City, Comunicaciones, Antigua GFC, Antigua, Xelaju, Quetzaltenango, Xela, Cobán Imperial, Coban,
Mixco, Guastatoya, Malacateco, Malacatan, Suchitepequez, Mazatenango, Santa Lucia Cotzumalguapa, Marquense, San Marcos, Achuapa, Iztapa, Sanarate, Zacapa, Chiquimula, Jalapa, Jutiapa, Puerto Barrios, Escuintla, Retalhuleu, Totonicapan,
Solola, Chimaltenango, Sacatepequez, Flores, Peten, Huehuetenango, Alianza San Salvador, San Salvador, FAS, Santa Ana, Aguila, San Miguel, Isidro Metapan, Metapan, Luis Angel Firpo, Usulutan, Sonsonate, Jocoro, Chalatenango, Cojutepeque,
Santa Tecla, Municipal Limeno, La Union, Ahuachapan, Zacatecoluca, La Libertad, Sensuntepeque, Panama City, Tauro, Tauro FC, Plaza Amador, Sporting San Miguelito, San Miguelito, Arabe Unido, Colon Panama, Deportivo Independiente, La Chorrera,
Chorrillo, Chorrillo FC, Costa del Este, Veraguas, Santiago de Veraguas, Herrera, Chitre, Chiriqui, David, Cai Horizontes, Atletico Nacional Panama, Universitario Panama, Alianza Panama, Managua, Real Esteli, Esteli, Diriangen, Jinotepe,
Walter Ferretti, Ferretti, Juventus Managua, UNAN Managua, Real Madriz, Somoto, Matagalpa, Chinandega, Leon Nicaragua, Granada Nicaragua, Masaya, Rivas, Belize City, Belmopan, Verdes, Belize, Police United, Placencia, Dangriga,
Port of Spain, Defence Force, San Juan Jabloteh, San Juan, W Connection, Point Fortin Civic, Point Fortin, Central FC, Couva, Police FC, Santa Rosa, Morvant Caledonia, Morvant, Ma Pau, North East Stars, Tobago, Scarborough, Arima, Chaguanas,
Kingston, Portmore United, Portmore, Waterhouse, Mount Pleasant, Montego Bay, Montego Bay United, Harbour View, Arnett Gardens, Tivoli Gardens, Cavalier, Humble Lions, Spanish Town, Clarendon, May Pen, Santos Jamaica, Boys Town,
Dunbeholden, Reno, Reno FC, Molynes United, Molynes, Vere United, Vere, St Catherine, Hanover, Savanna-la-Mar, Ocho Rios, Mandeville, Port Antonio, Falmouth, Negril,
Violette AC, Violette, Port-au-Prince, Racing Club Haitien, Cap-Haitien, Don Bosco, Don Bosco FC, Baltimore SC, Baltimore, Aigle Noir, Arcahaie, Cavaly, Cavaly AS, Leogane, Les Cayes, Jacmel, Gonaives, Petionville, Carrefour, Delmas,
Cibao FC, Santiago de los Caballeros, Santo Domingo, Atletico Pantoja, Pantoja, Moca FC, Moca, Delfines del Este, La Romana, Barcelona Atletico, San Cristobal, Jarabacoa, Bavaro, Punta Cana, Higuey, San Pedro de Macoris, Puerto Plata,
Havana, La Habana, Pinar del Rio, Cienfuegos, Santiago de Cuba, Camaguey, Holguin, Villa Clara, Santa Clara, Matanzas, Sancti Spiritus, Granma, Bayamo, Guantanamo, Las Tunas, Ciego de Avila, Artemisa, Mayabeque, Isla de la Juventud`),
  // ---- Oceania and generic famous brand words that must never be produced as a bare name
  ...list(`Sydney FC, Sydney, Melbourne Victory, Melbourne City, Melbourne, Western Sydney Wanderers, Western Sydney, Parramatta, Brisbane Roar, Brisbane, Perth Glory, Perth, Adelaide United, Adelaide, Newcastle Jets, Central Coast Mariners,
Gosford, Wellington Phoenix, Wellington, Macarthur FC, Macarthur, Campbelltown, Western United, Geelong, Canberra United, Canberra, Auckland FC, Auckland, Auckland City, Team Wellington, Waitakere United, Waitakere, Hawke's Bay United,
Napier, Hastings, Wellington Olympic, Canterbury United, Christchurch, Otago United, Dunedin, Waikato, Hamilton Wanderers, Tauranga, Wanderers, South Melbourne, Heidelberg United, Heidelberg, Green Gully, Avondale, Oakleigh Cannons, Oakleigh,
Bentleigh Greens, Bentleigh, Dandenong, Dandenong Thunder, Altona Magic, Altona, Hume City, Hume, Northcote City, Northcote, Port Melbourne, Sunshine George Cross, Sunshine, Marconi, Marconi Stallions, Blacktown, Blacktown City, Sutherland
Sharks, Sutherland, St George, Wollongong Wolves, Wollongong, Rockdale Ilinden, Rockdale, APIA Leichhardt, APIA, Leichhardt, Manly United, Manly, Sydney United, Sydney United 58, Bonnyrigg White Eagles, Bonnyrigg, Mounties Wanderers,
Mounties, Wollongong Olympic, Edgeworth Eagles, Edgeworth, Broadmeadow Magic, Broadmeadow, Lambton Jaffas, Lambton, Maitland, Weston, Cessnock, Gold Coast, Gold Coast United, Gold Coast Knights, Brisbane Strikers, Strikers, Moreton Bay
United, Moreton Bay, Olympic FC, Sunshine Coast, Sunshine Coast Wanderers, Redlands United, Redlands, Lions FC, Magpies, Rochedale Rovers, Rochedale, Eastern Suburbs, Palm Beach, Southport, Tweed, Perth SC, Perth Soccer Club, Floreat
Athena, Floreat, Stirling Macedonia, Stirling, Cockburn City, Cockburn, Sorrento, Armadale, Balcatta, Bayswater City, Bayswater, ECU Joondalup, Joondalup, Inglewood United, Inglewood, Western Knights, Subiaco, Fremantle, Mandurah,
Bunbury, Adelaide City, Adelaide Olympic, Adelaide Comets, Adelaide Blue Eagles, Adelaide Cobras, Campbelltown City, Cumberland United, Cumberland, Croydon Kings, Croydon, West Torrens Birkalla, West Torrens, North Eastern MetroStars,
MetroStars, Playford City, Playford, Salisbury, Elizabeth, Para Hills, Hobart, Olympia Warriors, Devonport, Launceston, Kingborough Lions, Kingborough, Glenorchy Knights, Glenorchy, Darwin, Darwin Hearts, Palmerston, Alice Springs,
Cairns, Townsville, Mackay, Rockhampton, Gladstone, Bundaberg, Maryborough, Gympie, Toowoomba, Ipswich, Logan, Logan Lightning, Caboolture, Redcliffe, Wynnum, Brisbane City, Mitchelton, Kedron, Ashgrove, Albany Creek, Pine Hills,
Fiji, Suva, Lautoka, Ba, Nadi, Rewa, Labasa, Nadroga, Navua, Tailevu, Tavua, Rakiraki, Savusavu, Port Vila, Vanuatu, Tafea, Erakor Golden Star, Erakor, Ifira Black Bird, Ifira, Amicale, Galaxy, Honiara, Solomon Warriors, Koloale,
Kossa, Henderson Eels, Henderson, Marist, Noumea, Hienghene Sport, Hienghene, Magenta, Gaitcha, Tiga Sport, Tiga, Papeete, Tefana, Pirae, Dragon, Central Sport, Manu-Ura, Apia, Samoa, Vaivase-Tai, Vaivase, Lupe o le Soaga, Nuku'alofa,
Tonga, Lotoha'apai, Navutoka, Kolofo'ou, Marist Tonga, Ha'amoa, Port Moresby, Hekari United, Hekari, Lae City Dwellers, Lae, Madang, Toti City, Toti, Morobe Wawens, Morobe, Rabaul, Kokopo, Mount Hagen, Goroka, Kimbe, Alotau,
Real Madrid CF, FC Barcelona, Bayern Munchen, Manchester Utd, Man City, Man United, Spurs, Inter Milan, Internazionale Milano, AC Milan, Juve, Atleti, Paris SG, PSG, Dortmund BVB, BVB, Lyon OL, OM, OL, ASM, OGC, LOSC, FCSB, CSKA Sofia, Levski Sofia,
Ludogorets, Ludogorets Razgrad, Razgrad, Botev Plovdiv, Plovdiv, Lokomotiv Plovdiv, Cherno More, Varna, Beroe, Stara Zagora, Slavia Sofia, Sofia, Burgas, Neftochimic Burgas, Neftochimik, Etar, Veliko Tarnovo, Arda Kardzhali, Arda,
Kardzhali, Montana, Pirin Blagoevgrad, Pirin, Blagoevgrad, Septemvri Sofia, Hebar, Pazardzhik, Spartak Varna, Dobrudzha, Dobrich, Lokomotiv Sofia, Minyor Pernik, Pernik, Vitosha Bistritsa, Bistritsa, Marek Dupnitsa, Dupnitsa, Sliven,
Yambol, Haskovo, Dimitrovgrad, Kyustendil, Vidin, Vratsa, Botev Vratsa, Pleven, Spartak Pleven, Lovech, Litex Lovech, Litex, Gabrovo, Yantra Gabrovo, Yantra, Svishtov, Ruse, Dunav Ruse, Dunav, Silistra, Shumen, Kaspichan, Targovishte,
Razgrad, Popovo, Omurtag, Aytos, Nesebar, Pomorie, Sozopol, Primorsko, Tsarevo, Sunny Beach, Varna Cherno More, Dobrich Dobrudzha`),
  // ---- second pass: towns and clubs found missing by tools/check-names.js (same knowledge as tools/real-clubs-test.json)
  ...list(`Arsenal, Chelsea, Liverpool, Everton, Tottenham, Manchester United, Manchester City, Newcastle United, West Ham United, Aston Villa, Leeds United, Leicester City,
Wolverhampton, Brighton, Crystal Palace, Fulham, Brentford, Southampton, Nottingham Forest, Burnley, Sheffield United, Norwich City, Watford, Bournemouth,
Ipswich Town, Derby County, Stoke City, West Bromwich Albion, Sunderland, Middlesbrough, Blackburn Rovers, Bolton Wanderers, Cardiff City, Swansea City, Birmingham City, Coventry City,
Portsmouth, Reading, Charlton Athletic, Huddersfield Town, Luton Town, Wigan Athletic, Hull City, Barnsley, Blackpool, Bristol City, Millwall, Preston North End,
Rotherham United, Oxford United, Oxford City, Peterborough United, Plymouth Argyle, Wycombe Wanderers, Cambridge United, Cheltenham Town, Exeter City, Fleetwood Town, Lincoln City, Port Vale,
Burton Albion, Accrington Stanley, Shrewsbury Town, Northampton Town, Gillingham, Doncaster Rovers, Crewe Alexandra, Mansfield Town, Walsall, Wrexham, Salford City, Stockport County,
Sutton United, Swindon Town, Tranmere Rovers, Harrogate Town, Colchester United, Crawley Town, Grimsby Town, Newport County, Forest Green Rovers, Bradford City, Carlisle United, Barrow,
Rochdale, Oldham Athletic, Bury, Scunthorpe United, Southend United, Leyton Orient, Stevenage, Hartlepool United, Gateshead, York City, Altrincham, Aldershot Town,
Dagenham, Woking, Bromley, Maidenhead United, Solihull Moors, Eastleigh, Boreham Wood, Wealdstone, Halifax Town, Chesterfield, Torquay United, Yeovil Town,
Dover Athletic, Ebbsfleet United, Maidstone United, Braintree Town, Chelmsford City, Welling United, Hereford, Kidderminster Harriers, Macclesfield Town, Telford United, Stalybridge Celtic, Nuneaton Borough,
Rushden, Kettering Town, Grantham Town, Boston United, Gainsborough Trinity, Scarborough, Whitby Town, Guiseley, Bishop Auckland, Blyth Spartans, Spennymoor Town, Darlington,
Workington, Southport, Chorley, Kendal Town, Lancaster City, Ashton United, Ashford Town, Ashford United, Droylsden, Mossley, Hyde United, Witton Albion,
Northwich Victoria, Runcorn, Warrington Town, Widnes, Skelmersdale United, Burscough, Leek Town, Buxton, Matlock Town, Alfreton Town, Ilkeston, Belper Town,
Stafford Rangers, Rugby Town, Redditch United, Bromsgrove Sporting, Worcester City, Gloucester City, Cirencester Town, Folkestone Invicta, Margate, Ramsgate, Sittingbourne, Faversham Town,
Whitstable, Herne Bay, Tonbridge Angels, Dartford, Gravesend, Carshalton Athletic, Kingstonian, Tooting and Mitcham, Dulwich Hamlet, Hampton and Richmond, Staines Town, Slough Town,
Windsor, Hayes and Yeading, Uxbridge, Harrow Borough, Enfield Town, Barnet, Hendon, Hitchin Town, Hemel Hempstead Town, St Albans City, Dunstable Town, Bedford Town,
Biggleswade Town, Cambridge City, Histon, Ely City, King's Lynn Town, Dereham Town, Gorleston, Lowestoft Town, Great Yarmouth Town, Bury Town, Sudbury, Haverhill Rovers,
Newmarket Town, Thetford Town, Brightlingsea, Harlow Town, Chesham United, Aylesbury United, Banbury United, Brackley Town, Corby Town, Stamford, Spalding United, Louth Town,
Cleethorpes Town, Bridlington Town, Selby Town, Goole, Worksop Town, Retford United, Newark, Loughborough Dynamo, Hinckley, Coalville Town, Shepshed Dynamo, Melton Town,
Oakham United, Market Harborough, Stratford Town, Leamington, Kenilworth, Bedworth United, Atherton Collieries, Tamworth, Lichfield City, Cannock Chase, Rugeley Town, Stone Dominoes,
Newcastle Town, Nantwich Town, Congleton Town, Winsford United, Sandbach United, Middlewich, Ellesmere Port, Chester, Penrith, Keswick, Whitehaven, Penzance,
Truro City, Bodmin Town, Newquay, Falmouth Town, St Austell, Saltash United, Tavistock, Barnstaple Town, Bideford, Taunton Town, Bridgwater Town, Weston-super-Mare,
Clevedon Town, Paulton Rovers, Bath City, Frome Town, Salisbury, Weymouth, Dorchester Town, Poole Town, Wimborne Town, Christchurch, Havant and Waterlooville, Gosport Borough,
Fareham Town, Basingstoke Town, Farnborough, Farnham Town, Guildford City, Walton Casuals, Epsom and Ewell, Leatherhead, Dorking Wanderers, Horsham, Burgess Hill Town, Lewes,
Eastbourne Borough, Hastings United, Bognor Regis Town, Worthing, Littlehampton Town, Chichester City, Whitehawk, Shoreham, Newhaven, Peacehaven, Bexhill United, Hythe Town,
Deal Town, Canterbury City, Cheshunt, Hertford Town, Ware, Hoddesdon Town, Potters Bar Town, Billericay Town, Basildon United, Canvey Island, Concord Rangers, Maldon and Tiptree,
Heybridge Swifts, Witham Town, Clacton, Harwich and Parkeston, Felixstowe and Walton, Leiston, Needham Market, Stowmarket Town, Whitley Bay, Morpeth Town, Ashington, Alnwick Town,
Berwick Rangers, Consett, Durham City, Jarrow, South Shields, Hebburn Town, North Shields, Redcar Athletic, Guisborough Town, Billingham Synthonia, Thornaby, Bedlington Terriers,
Cramlington, Seaham Red Star, Peterlee, Tow Law Town, Shildon, Newton Aycliffe, Ossett Town, Wakefield, Pontefract Collieries, Castleford Town, Featherstone Rovers, Stocksbridge Park Steels,
Brighouse Town, Farsley Celtic, Pudsey, Bingley Town, Keighley Town, Skipton, Ilkley Town, Otley Town, Wetherby, Knaresborough Town, Ripon, Thirsk,
Northallerton, Pickering Town, Malton and Norton, Driffield, Nelson, Colne, Clitheroe, Darwen, Rossendale United, Padiham, Prestwich Heys, Trafford,
Stretford, Sale United, Cheadle Town, Hazel Grove, Glossop North End, New Mills, Brigg Town, Barton Town, Holbeach United, Wisbech Town, March Town United, Huntingdon Town,
St Neots Town, St Ives Town, Stotfold, Arlesey Town, Letchworth, Baldock Town, Royston Town, Bishop's Stortford, Saffron Walden Town, Halstead Town, Coggeshall Town, Tiptree United,
Burnham Ramblers, Wivenhoe Town, Romford, Hornchurch, Aveley, Tilbury, Grays Athletic, East Thurrock United, Walthamstow, Haringey Borough, Edgware Town, Hanwell Town,
Southall, Hillingdon Borough, Northwood, Ruislip, Bedfont, Feltham, Chertsey Town, Egham Town, Camberley Town, Alton Town, Petersfield Town, Andover Town,
Romsey Town, Totton, Lymington, Ryde, Cowes Sports, Kirkby, Prescot Cables, Marine, Formby, Bootle, Crosby, Maghull,
St Helens Town, Ashton Athletic, Atherton Laburnum Rovers, Maine Road, Wythenshawe Town, Cammell Laird, Pilkington, Daisy Hill, Wigan Robin Park, Tadcaster Albion, Pickering, Heanor Town,
Long Eaton United, Basford United, Carlton Town, Eastwood Town, Arnold Town, Gedling, Rainworth, Clipstone, Blidworth, Shirebrook Town, Staveley, Dronfield Town,
Eckington, Clay Cross, Sheffield FC, Hallam, Handsworth, Parkgate, Maltby Main, Armthorpe Welfare, Rossington Main, Bentley, Bawtry, Tickhill,
Harworth Colliery, Dinnington, Wombwell, Hoyland, Penistone Church, Dodworth, Kexborough, Liversedge, Cleckheaton, Mirfield, Heckmondwike, Dewsbury,
Batley, Ossett Albion, Emley, Denby Dale, Kirkburton, Meltham, Holmfirth, Honley, Slaithwaite, Marsden, Saddleworth, Delph,
Uppermill, Diggle, Lees, Royton, Shaw, Crompton, Failsworth, Blackley, Middleton, Heywood, Ramsbottom, Tottington,
Radcliffe Borough, Whitworth, Littleborough, Todmorden, Hebden Bridge, Sowerby Bridge, Elland, Greetland, Stainland, Ripponden, Barkisland, Rishworth,
Celtic, Rangers, Heart of Midlothian, Hibernian, Aberdeen, Dundee United, Dundee, Motherwell, Kilmarnock, St Mirren, St Johnstone, Ross County,
Livingston, Partick Thistle, Greenock Morton, Hamilton Academical, Inverness Caledonian Thistle, Falkirk, Dunfermline Athletic, Raith Rovers, Queen of the South, Ayr United, Arbroath, Montrose,
Forfar Athletic, Brechin City, Cove Rangers, Peterhead, Elgin City, Buckie Thistle, Keith, Huntly, Fraserburgh, Formartine United, Turriff United, Brora Rangers,
Clachnacuddin, Nairn County, Wick Academy, Stenhousemuir, Alloa Athletic, Stirling Albion, Clyde, Airdrieonians, Cowdenbeath, East Fife, Annan Athletic, Stranraer,
Albion Rovers, Queens Park, Dumbarton, East Stirlingshire, Edinburgh City, Hawick Royal Albert, Gala Fairydean, Selkirk, Kelso United, Spartans, Bonnyrigg Rose, Tranent,
Musselburgh Athletic, Dalkeith Thistle, Broxburn Athletic, Bathgate Thistle, Whitburn, Linlithgow Rose, Bo'ness United, Kelty Hearts, Lochgelly Albert, Burntisland Shipyard, Glenrothes, Dundonald Bluebell,
Auchinleck Talbot, Irvine Meadow, Kilwinning Rangers, Troon, Glenafton Athletic, Largs Thistle, Beith Juniors, Kilbirnie Ladeside, Pollok, Rutherglen Glencairn, Cambuslang Rangers, Clydebank,
Johnstone Burgh, Petershill, Maryhill, Benburb, Shettleston, Cumbernauld United, Kirkintilloch Rob Roy, Bellshill Athletic, Carluke Rovers, Lanark United, Larkhall Thistle, Merthyr Town,
The New Saints, Bangor City, Rhyl, Prestatyn Town, Colwyn Bay, Llandudno, Caernarfon Town, Bala Town, Connah's Quay Nomads, Airbus UK, Flint Town United, Holywell Town,
Mold Alexandra, Newtown, Aberystwyth Town, Barry Town United, Penybont, Bridgend Town, Pontypridd Town, Llanelli Town, Carmarthen Town, Haverfordwest County, Cwmbran Town, Taff's Well,
Caerau Ely, Cefn Druids, Porthmadog, Pwllheli, Llangefni Town, Holyhead Hotspur, Shamrock Rovers, Bohemians, Shelbourne, St Patrick's Athletic, Dundalk, Derry City,
Cork City, Sligo Rovers, Galway United, Waterford, Limerick, Finn Harps, Bray Wanderers, Drogheda United, Athlone Town, Longford Town, Kilkenny City, Wexford,
Cobh Ramblers, Treaty United, Tolka Rovers, Home Farm, Belvedere, Linfield, Glentoran, Cliftonville, Crusaders, Coleraine, Larne, Glenavon,
Portadown, Ballymena United, Carrick Rangers, Dungannon Swifts, Newry City, Warrenpoint Town, Loughgall, Ards, Bangor, Lisburn Distillery, Lurgan Celtic, Armagh City,
Omagh Town, Limavady United, Ballyclare Comrades, Ballymoney United, Banbridge Town, Annagh United, Institute, Knockbreda, Dergview, Tobermore United, Real Madrid, Barcelona,
Atletico Madrid, Sevilla, Real Betis, Valencia, Villarreal, Athletic Bilbao, Real Sociedad, Celta Vigo, Getafe, Espanyol, Osasuna, Mallorca,
Girona, Rayo Vallecano, Alaves, Granada, Levante, Cadiz, Elche, Almeria, Real Valladolid, Deportivo La Coruna, Malaga, Sporting Gijon,
Real Zaragoza, Las Palmas, Tenerife, Racing Santander, Real Oviedo, Eibar, Leganes, Real Murcia, Albacete, Numancia, Huesca, Mirandes,
Cartagena, Lugo, Ponferradina, Fuenlabrada, Alcorcon, Rayo Majadahonda, Sabadell, Terrassa, Badalona, Cornella, Hospitalet, Lleida,
Gimnastic de Tarragona, Reus, Figueres, Olot, Llagostera, Andorra, Ibiza, Atletico Baleares, Poblense, Constancia, Alcoyano, Elda,
Orihuela, Hercules, Benidorm, Villajoyosa, Torrevieja, Castellon, Onda, Burriana, Saguntino, Gandia, Alzira, Ontinyent,
Lorca, Yeclano, Jumilla, Caravaca, Aguilas, Linares Deportivo, Jaen, Martos, Antequera, Ronda, Marbella, Estepona,
Fuengirola, Torremolinos, Velez, Motril, Almunecar, Guadix, Baza, Roquetas, El Ejido, Cordoba, Lucena, Puente Genil,
Cabra, Pozoblanco, Ecija, Utrera, Dos Hermanas, Alcala, Mairena, Coria, Sanlucar, Xerez, Puerto Real, Chiclana,
Algeciras, La Linea, San Roque, Ceuta, Melilla, Recreativo de Huelva, Lepe, Ayamonte, Isla Cristina, Badajoz, Merida, Don Benito,
Villanovense, Caceres, Plasencia, Talavera, Toledo, Ciudad Real, Puertollano, Manzanares, Valdepenas, Alcazar, Tomelloso, Cuenca,
Guadalajara, Azuqueca, Hellin, Almansa, Villarrobledo, Segovia, Avila, Salamanca, Zamora, Cultural Leonesa, Astorga, Burgos,
Aranda, Palencia, Arandina, Bembibre, Logrono, Calahorra, Haro, Tudela, Tafalla, Barbastro, Ejea, Teruel,
Calamocha, Alcaniz, Fraga, Monzon, Binefar, Balaguer, Tremp, Manresa, Igualada, Mataro, Granollers, Sant Andreu,
Sant Cugat, Rubi, Martorell, Vilafranca, Vilanova, Sitges, Valls, Tortosa, Amposta, Vinaros, Benicarlo, Pontevedra,
Ourense, Compostela, Ferrol, Betanzos, Arosa, Durango, Barakaldo, Portugalete, Sestao River, Getxo, Leioa, Basconia,
Bermeo, Amorebieta, Llodio, Tolosa, Real Union, Hondarribia, Zarautz, Beasain, Lemona, Gernika, Santurtzi, Laredo,
Castro, Gimnastica de Torrelavega, Escobedo, Llanes, Langreo, Mieres, Real Aviles, Lealtad, Siero, Tuilla, Covadonga, Caudal,
Cangas, Colunga, Lanzarote, Fuerteventura, Maspalomas, Telde, Marino, Arucas, Vecindario, Mensajero, La Palma, Gomera,
Granadilla, Laguna, Orotava, Villaverde, Villanueva, Villareal, Villamayor, Villaviciosa, Villalba, Villaescusa, Monteverde, Montemayor,
Montealegre, Montijo, Montoro, Montilla, Montesa, Castelnuevo, Castellar, Castrillo, Castejon, Puerto Lumbreras, Valle de Mena, Valleseco,
Vallehermoso, Riofrio, Riopar, Riosa, Sierra Elvira, Pena Rubia, Penaflor, Penarroya, Penalba, Cerro Muriano, Fuentes de Andalucia, Fuenteovejuna,
Fuente Alamo, Fuente Palmera, Torre Pacheco, Torrelodones, Torrejon, Torrent, Campo de Criptana, Campillos, Campanario, Altea, Alto Campoo, Bellavista,
Bellpuig, Bellvis, Solsona, Marmolejo, Pinoso, Pinos Puente, Robledo, Valdemoro, Valdelacalzada, Sotomayor, Real Sotomayor, Juventus,
Torino, Inter, Milan, Napoli, Roma, Lazio, Atalanta, Fiorentina, Bologna, Genoa, Sampdoria, Udinese,
Sassuolo, Verona, Chievo, Cagliari, Lecce, Empoli, Parma, Monza, Spezia, Salernitana, Cremonese, Brescia,
Palermo, Bari, Venezia, Frosinone, Como, Pisa, Cesena, Catania, Reggina, Reggiana, Modena, Carpi,
Mantova, Padova, Vicenza, Treviso, Triestina, Pordenone, Cittadella, Ascoli, Ancona, Perugia, Ternana, Pescara,
Foggia, Taranto, Avellino, Benevento, Casertana, Juve Stabia, Nocerina, Cosenza, Catanzaro, Crotone, Messina, Siracusa,
Trapani, Akragas, Sassari Torres, Olbia, Arezzo, Siena, Livorno, Lucchese, Pistoiese, Prato, Carrarese, Viareggio,
Pontedera, Grosseto, Pianese, Montevarchi, Gubbio, Foligno, Spoleto, Viterbese, Latina, Rieti, Fondi, Cassino,
Sora, Potenza, Matera, Melfi, Bisceglie, Andria, Barletta, Monopoli, Altamura, Brindisi, Francavilla, Gallipoli,
Nardo, Martina Franca, Molfetta, Ravenna, Rimini, Forli, Imolese, Faenza, SPAL, Piacenza, Sambenedettese, Fano,
Fermana, Jesina, Matelica, Maceratese, Civitanovese, Teramo, Chieti, L'Aquila, Avezzano, Giulianova, Lanciano, Vasto,
Campobasso, Isernia, Termoli, Cuneo, Alessandria, Novara, Pro Vercelli, Biellese, Casale, Asti, Savona, Imperia,
Sanremese, Albenga, Entella, Lavagnese, Rapallo, Varese, Lecco, Legnano, Pro Patria, Gallarate, Saronno, Crema,
Pergolettese, Lodigiani, Pavia, Vigevano, Voghera, Albinoleffe, Alzano, Seriate, Lumezzane, Salo, Feralpisalo, Desenzano,
Portogruaro, Belluno, Bassano, Schio, Legnago, Chioggia, Mestre, Rovigo, Adriese, Bolzano, Merano, Bressanone,
Trento, Rovereto, Aosta, Chivasso, Ivrea, Pinerolo, Saluzzo, Alba, Bra, Fossano, Mondovi, Savigliano,
Nichelino, Moncalieri, Rivoli, Orbassano, Castelvetro, Castelfranco, Castelnuovo, Castellammare, Castrovillari, Castelsangro, Castel San Pietro, Montecatini,
Montepulciano, Montalcino, Montefalco, Montegranaro, Montebelluna, Monteroni, Montesilvano, Montichiari, Monte Urano, Portoferraio, Porto Torres, Porto Empedocle,
Portici, Porto San Giorgio, Porto Viro, Porto Recanati, Villafranca, Villarosa, Villabate, Villacidro, Villasanta, Villa d'Almè, Villaricca, Borgosesia,
Borgomanero, Borgo San Lorenzo, Borgo Virgilio, Roccella, Roccastrada, Rocca di Papa, Roccapiemonte, Torre del Greco, Torre Annunziata, Torremaggiore, Torrenova, Torrita,
Ponte San Pietro, Pontelongo, Pontecagnano, Pontassieve, Valle d'Aosta, Valdagno, Valmontone, Vallo della Lucania, Valenzano, Campobello, Campi Bisenzio, Camposampiero,
Campodarsego, Lagonegro, Laurentina, Lariano, Lanusei, Collegno, Colleferro, Collefiorito, Collecchio, Colle Val d'Elsa, Colorno, Pian di Sco,
Sasso Marconi, Sassoferrato, Cala Gonone, Calamandrana, Fontanafredda, Fontanelle, Fonte Nuova, Marinella, Marina di Carrara, Marina di Pisa, Marina di Ragusa, Santa Maria Capua Vetere,
San Giovanni, San Marino, San Severo, San Giuseppe Vesuviano, San Donato Milanese, San Cesareo, San Vito, San Felice, Sant'Angelo, Sant'Antimo, Santa Croce, Santa Marinella,
Santa Margherita, Bayern Munchen, Borussia Dortmund, Bayer Leverkusen, RB Leipzig, Eintracht Frankfurt, VfL Wolfsburg, Borussia Monchengladbach, VfB Stuttgart, Werder Bremen, SC Freiburg, FC Koln,
Hertha BSC, Union Berlin, Mainz 05, FC Augsburg, TSG Hoffenheim, Schalke 04, Hamburger SV, Hannover 96, Fortuna Dusseldorf, FC St Pauli, Holstein Kiel, Hansa Rostock,
Dynamo Dresden, Nurnberg, Karlsruher SC, Darmstadt 98, Arminia Bielefeld, VfL Bochum, Greuther Furth, Heidenheim, Paderborn, 1860 Munchen, Kaiserslautern, Braunschweig,
Magdeburg, Hallescher FC, Erzgebirge Aue, Chemnitzer FC, Zwickau, Plauen, Carl Zeiss Jena, Rot-Weiss Erfurt, Energie Cottbus, Babelsberg, Viktoria Berlin, Tennis Borussia,
Wacker Nordhausen, Meuselwitz, Greifswald, Neubrandenburg, Schwerin, Lubeck, Flensburg, Norderstedt, Oldenburg, Osnabruck, Emden, Meppen,
Lotte, Rheine, Preussen Munster, Wiedenbruck, Rot-Weiss Essen, Oberhausen, MSV Duisburg, Wuppertaler SV, Ahlen, Hamm, Lippstadt, Verl,
Bocholt, Velbert, Uerdingen, Alemannia Aachen, Duren, Bonner SC, Siegen, Siegburg, Troisdorf, Eintracht Trier, TuS Koblenz, Wormatia Worms,
Waldhof Mannheim, Sandhausen, Walldorf, Pforzheim, Offenburg, Villingen, Balingen, Reutlingen, Tubingen, SSV Ulm, Aalen, Grossaspach,
Stuttgarter Kickers, Kickers Offenbach, Hanau, Aschaffenburg, Wurzburger Kickers, Schweinfurt, Bamberg, Bayreuth, Hof, Jahn Regensburg, Straubing, Passau,
Wacker Burghausen, Rosenheim, Unterhaching, Ingolstadt, Memmingen, Kempten, Buchbach, Garching, Saarbrucken, Homburg, Elversberg, Neunkirchen,
Saarlouis, Pirmasens, Ludwigshafen, Frankenthal, Speyer, Kassel, Baunatal, Gottingen, Goslar, Wolfenbuttel, Celle, Luneburg,
Verden, Rotenburg, Stade, Buxtehude, Altona, Eimsbutteler, Barmbek, Teutonia, Bergedorf, Wilhelmshaven, Jever, Leer,
Aurich, Norden, Cuxhaven, Bremerhaven, Delmenhorst, Vechta, Cloppenburg, Lohne, Papenburg, Nordhorn, Lingen, Bad Kreuznach,
Weiden, Amberg, Schwandorf, Cham, Deggendorf, Landshut, Dingolfing, Vilshofen, Altotting, Traunstein, Miesbach, Kaufbeuren,
Fussen, Landsberg, Dachau, Erding, Freising, Ismaning, Starnberg, Weilheim, Penzberg, Geretsried, Rothenburg, Rothenfels,
Rottenburg, Waldenburg, Waldkirch, Waldbrol, Waldshut, Sonnenberg, Sonneberg, Sonnewalde, Lindenberg, Lindau, Lindow, Eichstatt,
Eichenau, Buchenau, Buchholz, Falkensee, Falkenberg, Falkenstein, Hohenstein, Hohenlimburg, Hohenems, Rheinau, Rheinfelden, Rheinberg,
Bergen, Bergisch Gladbach, Bergkamen, Steinau, Steinfurt, Steinheim, Bergheim, Neustadt, Neuwied, Neuruppin, Neumunster, Altenburg,
Altenkirchen, Altenberg, Oberursel, Oberkirch, Niederkirchen, Niederau, Nieder-Olm, Kleinmachnow, Kleve, Grossenhain, Grossbeeren, Birkenau,
Birkenwerder, Rosenfeld, Rosendahl, Fichtelberg, Tannenberg, Hagen, Hagenow, Hagenburg, Waldstadt, Tiefenort, Seehausen, Seelze,
Seesen, Zeulenroda, Weidenbach, Auerbach, Aue, Auenstein, Barntrup, Ilmenau, Ilsede, Jungingen, Kornwestheim, Laubach,
Laubenheim, Mühlheim, Muhlheim, Nussloch, Ottersberg, Rubenach, Salzgitter, Salzwedel, Salzkotten, Steinbach, Erlenbach, TSV Steinbach Haiger,
FC Erlenbach, Paris Saint-Germain, Marseille, Lyon, Monaco, Lille, Nice, Rennes, Lens, Reims, Nantes, Montpellier,
Strasbourg, Toulouse, Metz, Bordeaux, Saint-Etienne, Angers, Brest, Clermont, Lorient, Auxerre, Troyes, Ajaccio,
Bastia, Le Havre, Caen, Guingamp, Dijon, Nancy, Sochaux, Amiens, Valenciennes, Nimes, Orleans, Chateauroux,
Le Mans, Laval, Quevilly, Rouen, Red Star, Versailles, Pau, Niort, Bourg-en-Bresse, Grenoble, Annecy, Chambery,
Thonon, Evian, Martigues, Istres, Aubagne, Frejus, Cannes, Antibes, Grasse, Hyeres, Toulon, Avignon,
Arles, Carcassonne, Beziers, Sete, Perpignan, Narbonne, Tarbes, Lourdes, Bayonne, Biarritz, Anglet, Bergerac,
Perigueux, Agen, Montauban, Castres, Albi, Rodez, Millau, Cahors, Brive, Limoges, Poitiers, La Rochelle,
Angouleme, Cognac, Saintes, Rochefort, La Roche-sur-Yon, Cholet, Saumur, Tours, Blois, Vierzon, Bourges, Nevers,
Moulins, Montlucon, Vichy, Aurillac, Le Puy, Saint-Chamond, Saint-Priest, Villefranche, Roanne, Annonay, Valence, Romans,
Vienne, Bourgoin-Jallieu, Albertville, Aix-les-Bains, Aix-en-Provence, Gap, Digne, Manosque, Salon, Marignane, Vitrolles, Miramas,
Beauvais, Creil, Compiegne, Senlis, Chantilly, Noisy-le-Sec, Bobigny, Drancy, Bondy, Montreuil, Vincennes, Saint-Maur,
Creteil, Vitry, Ivry, Orly, Evry, Corbeil, Massy, Palaiseau, Rambouillet, Mantes, Poissy, Conflans,
Cergy, Pontoise, Argenteuil, Sarcelles, Aulnay, Meaux, Melun, Fontainebleau, Provins, Sens, Joigny, Chaumont,
Langres, Epinal, Toul, Verdun, Bar-le-Duc, Sedan, Charleville, Epernay, Chalons, Mulhouse, Colmar, Haguenau,
Schiltigheim, Sarreguemines, Forbach, Thionville, Longwy, Besancon, Belfort, Montbeliard, Vesoul, Pontarlier, Dole, Lons-le-Saunier,
Macon, Chalon-sur-Saone, Le Creusot, Montceau, Autun, Beaune, Lisieux, Evreux, Vernon, Dieppe, Fecamp, Bolbec,
Elbeuf, Louviers, Granville, Avranches, Cherbourg, Saint-Lo, Flers, Alencon, Argentan, Lannion, Saint-Brieuc, Dinan,
Dinard, Saint-Malo, Vitre, Fougeres, Vannes, Pontivy, Ploermel, Concarneau, Quimper, Quimperle, Douarnenez, Landerneau,
Morlaix, Dunkerque, Calais, Boulogne, Arras, Bethune, Lievin, Henin-Beaumont, Douai, Cambrai, Maubeuge, Roubaix,
Tourcoing, Wasquehal, Villeneuve-d'Ascq, Seclin, Lambersart, Marcq, Armentieres, Hazebrouck, Saint-Omer, Abbeville, Saint-Quentin, Soissons,
Laon, Chauny, Noyon, Beaumont, Beaurepaire, Beauvoir, Belleville, Bellerive, Bellegarde, Clairac, Clairvaux, Fontenay,
Fontvieille, Pontault, Pontchateau, Rivesaltes, Rive-de-Gier, Rochechouart, Rochefort-en-Terre, Montaigu, Montargis, Montbrison, Montelimar, Montmorillon,
Montrichard, Monthey, Valbonne, Valdahon, Valognes, Vallauris, Vauvert, Vaulx-en-Velin, Valmy, Valmeinier, Lacroix, Lacanau,
Lamballe, Lannemezan, Source, Sources, Sourdeval, Mareuil, Mareil, Marennes, Villeneuve, Villers, Villiers, Boisseuil,
Bois-Colombes, Boissy, Courbevoie, Courseulles, Courcouronnes, Cormeilles, Plancoet, Plan-de-Cuques, Planoise, Pre-Saint-Gervais, Preuilly, Presles,
Hautmont, Hautot, Haute-Goulaine, Vieux-Conde, Vieux-Boucau, Vieille-Eglise, Terre-de-Haut, Terrasson, Valmont, Escarbotin, US Escarbotin, Benfica,
Porto, Sporting, Braga, Vitoria Guimaraes, Vitoria Setubal, Boavista, Belenenses, Maritimo, Nacional, Pacos de Ferreira, Gil Vicente, Rio Ave,
Famalicao, Moreirense, Santa Clara, Estoril, Arouca, Casa Pia, Farense, Portimonense, Olhanense, Louletano, Tondela, Academica,
Aveiro, Feirense, Penafiel, Chaves, Vizela, Varzim, Leixoes, Salgueiros, Espinho, Trofa, Fafe, Felgueiras,
Lourosa, Oliveirense, Covilha, Guarda, Viseu, Mirandela, Braganca, Vila Real, Gondomar, Ermesinde, Maia, Lusitania,
Torreense, Caldas, Leiria, Pombal, Marinhense, Ourem, Tomar, Torres Novas, Santarem, Alverca, Amadora, Oriental,
Odivelas, Loures, Mafra, Sintra, Barreirense, Almada, Sesimbra, Palmela, Beja, Evora, Portalegre, Elvas,
Estremoz, Sines, Odemira, Castelo Branco, Fundao, Anadia, Mealhada, Agueda, Albergaria, Vila Nova de Gaia, Vilaverde, Vila Franca,
Vila Nova, Vilar, Vila Pouca, Vilamoura, Portimao, Porto Santo, Porto Moniz, Portel, Montemor, Montemor-o-Novo, Monte Real, Montalegre,
Alto Alentejo, Serra da Estrela, Ponte de Lima, Ponte de Sor, Pontevel, Rio Maior, Rio Tinto, Rio Mau, Praia da Vitoria, Praia de Mira, Praia do Ribatejo, Terra Nova,
Campo Maior, Campo de Ourique, Lagoa, Lago, Cabo Verde, Cabo Frio, Mar Azul, Pedras Salgadas, Val de Cambra, Val do Rio, Flamengo, Palmeiras,
Corinthians, Santos, Sao Paulo, Gremio, Internacional, Fluminense, Vasco da Gama, Botafogo, Cruzeiro, Atletico Mineiro, Bahia, Vitoria,
Sport Recife, Santa Cruz, Nautico, Ceara, Fortaleza, Coritiba, Athletico Paranaense, Parana, Londrina, Cascavel, Maringa, Goias,
Atletico Goianiense, Anapolis, Gama, Brasiliense, Cuiaba, Operario, Ponta Grossa, Avai, Figueirense, Chapecoense, Criciuma, Joinville,
Brusque, Blumenau, Juventude, Caxias, Pelotas, Novo Hamburgo, Santa Maria, Ypiranga, Bragantino, Ponte Preta, Guarani, Mirassol,
Novorizontino, Ribeirao Preto, Sao Bernardo, Santo Andre, Sao Caetano, Portuguesa, Ituano, Sorocaba, Sao Jose, Taubate, Bauru, Marilia,
America Mineiro, Uberlandia, Tombense, Nova Lima, Ipatinga, Boa Esporte, Varginha, Tupi, Volta Redonda, Madureira, Bangu, Nova Iguacu,
Cabofriense, Resende, Macae, Americano, Duque de Caxias, Olaria, Sampaio Correa, Moto Club, Imperatriz, Teresina, Parnahyba, Ferroviario,
Icasa, Juazeiro, Treze, Campinense, Sousa, ABC, Potiguar, CRB, CSA, ASA, Sergipe, Confianca,
Lagarto, Itabaiana, Jacuipense, Feira de Santana, Ilheus, Itabuna, Paysandu, Remo, Tuna Luso, Sao Raimundo, Manaus, Rio Branco,
Macapa, Boa Vista, Aguia de Maraba, Castanhal, Santa Fe, Santa Rita, Santa Luzia, Santa Helena, Santa Barbara, Santa Cruz do Sul, Bela Vista, Bela Cruz,
Belo Horizonte, Belo Monte, Monte Carmelo, Monte Alegre, Monte Verde, Monte Santo, Monte Azul, Alto Paraiso, Alto Alegre, Terra Roxa, Campo Mourao, Campo Largo,
Campo Grande, Campo Bom, Serra Negra, Serra Talhada, Serra Azul, Pedra Branca, Pedra Azul, Rio Verde, Rio Claro, Rio Negro, Rio Grande, Rio Preto,
Ponte Nova, Ponte Alta, Porto Alegre, Porto Velho, Porto Seguro, Porto Feliz, Porto Franco, Praia Grande, Lago Verde, Mar de Espanha, Boca Juniors, River Plate,
Racing, Independiente, San Lorenzo, Velez Sarsfield, Estudiantes, Gimnasia, Lanus, Banfield, Argentinos Juniors, Huracan, Newells, Rosario Central,
Talleres, Belgrano, Instituto, Godoy Cruz, Atletico Tucuman, San Martin, Colon, Union, Defensa y Justicia, Tigre, Platense, Sarmiento,
Central Cordoba, Patronato, Barracas Central, Riestra, Aldosivi, Quilmes, Chacarita, Nueva Chicago, Ferro, All Boys, Atlanta, Temperley,
Almirante Brown, Almagro, Tristan Suarez, Moron, Rio Cuarto, Jujuy, Gimnasia y Tiro, Juventud Unida, San Telmo, Los Andes, Brown, Colegiales,
Excursionistas, Dock Sud, Sacachispas, Ituzaingo, Merlo, Flandria, Villa Dalmine, Campana, Zarate, San Miguel, Deportivo Armenio, Lujan,
Mercedes, Chivilcoy, Pergamino, San Nicolas, Rafaela, Ceres, Olimpo, Villa Mitre, Liniers, Santamarina, Tandil, Olavarria,
Necochea, Cipolletti, Comodoro, Crucero del Norte, Chaco For Ever, Boca Unidos, Olimpia, Cerro Porteno, Libertad, Sol de America, Tacuary, Sportivo Luqueno,
Sportivo Ameliano, General Caballero, Resistencia, Capiata, Trinidense, Penarol, Defensor Sporting, Danubio, Wanderers, Cerro, Cerro Largo, Rampla Juniors,
Fenix, Progreso, Boston River, Plaza Colonia, Torque, Juventud, Miramar Misiones, Deportivo Maldonado, Atenas, Barcelona SC, Emelec, LDU,
Independiente del Valle, El Nacional, Deportivo Quito, Aucas, Macara, Delfin, Orense, Mushuc Runa, Deportivo Cuenca, Olmedo, Tecnico Universitario, Imbabura,
Libertad Loja, Gualaceo, Alianza Lima, Universitario, Sporting Cristal, Melgar, Cienciano, Binacional, Sport Huancayo, Cesar Vallejo, Sport Boys, Ayacucho,
Garcilaso, Municipal, Alianza Atletico, Carlos Mannucci, Union Comercio, Comerciantes Unidos, Juan Aurich, Colo-Colo, Universidad de Chile, Universidad Catolica, Union Espanola, Palestino,
Santiago Wanderers, Cobreloa, Cobresal, Huachipato, Concepcion, O'Higgins, Audax Italiano, Curico Unido, Union La Calera, Coquimbo Unido, Iquique, Antofagasta,
La Serena, Temuco, Copiapo, Valdivia, Puerto Montt, Melipilla, Recoleta, Magallanes, San Luis, Rangers de Talca, Linares, Lota Schwager,
Naval, Nublense, San Felipe, Trasandino, Osorno, Fernandez Vial, Santiago Morning, Barnechea, Arica, Ovalle, Atletico Nacional, Independiente Medellin,
Millonarios, America de Cali, Deportivo Cali, Junior, Once Caldas, Tolima, Bucaramanga, Pasto, Envigado, Aguilas Doradas, Alianza Petrolera, Jaguares,
La Equidad, Patriotas, Cucuta, Quindio, Pereira, Cortulua, Union Magdalena, Real Cartagena, Llaneros, Orsomarso, Atletico Huila, Leones,
Caracas, Tachira, Carabobo, Mineros de Guayana, La Guaira, Metropolitanos, Estudiantes de Merida, Monagas, Academia Puerto Cabello, Aragua, Deportivo Lara, Trujillanos,
Hermanos Colmenarez, Rayo Zuliano, Angostura, Bolivar, The Strongest, Oriente Petrolero, Blooming, Wilstermann, Aurora, Always Ready, Nacional Potosi, Real Potosi,
Royal Pari, San Jose, Universitario Sucre, Independiente Petrolero, Guabira, Palmaflor, Vinto, Club America, Chivas, Cruz Azul, Pumas, Tigres,
Monterrey, Santos Laguna, Leon, Pachuca, Toluca, Atlas, Necaxa, Puebla, Queretaro, Mazatlan, Juarez, Tijuana,
Veracruz, Morelia, Tecos, Dorados, Lobos, Celaya, Correcaminos, Tampico Madero, Zacatepec, Cafetaleros, Tlaxcala, Alebrijes,
Venados, Cancun, Mineros de Zacatecas, Leones Negros, Tepatitlan, Irapuato, Saprissa, Alajuelense, Herediano, Cartagines, Perez Zeledon, Guanacasteca,
Santos de Guapiles, Limon, Puntarenas, Jicaral, Municipal Grecia, Pococi, Belen, Uruguay de Coronado, San Carlos, Motagua, Real Espana, Marathon,
Vida, Honduras Progreso, Lobos UPNFM, Juticalpa, Comunicaciones, Antigua, Xelaju, Coban Imperial, Mixco, Guastatoya, Malacateco, Suchitepequez,
Marquense, Iztapa, Sanarate, Zacapa, Alianza, FAS, Aguila, Isidro Metapan, Luis Angel Firpo, Sonsonate, Jocoro, Chalatenango,
Cojutepeque, Santa Tecla, Tauro, Plaza Amador, San Miguelito, Arabe Unido, La Chorrera, Chorrillo, Costa del Este, Veraguas, Herrera, Chiriqui,
Real Esteli, Diriangen, Walter Ferretti, Juventus Managua, Villa Real, Villa Alegre, Villa Dolores, Villa Carlos Paz, Villa Maria, Villa Mercedes, Villa Gesell, Villa Ballester,
Villa Luro, Villa Crespo, Villa Urquiza, Villa Devoto, Villa Lugano, Villa Soldati, Villa Elisa, Villa Gobernador Galvez, Villa Constitucion, Villa Angela, Villa Regina, Villa La Angostura,
Monte Grande, Monte Caseros, Monte Hermoso, Monte Quemado, Monte Patria, Monte Aguila, Castelar, Castillo, Castellanos, Rio Tercero, Rio Segundo, Rio Gallegos,
Rio Colorado, Rio Blanco, Rio Hondo, Rio Seco, Puerto Madryn, Puerto Deseado, Puerto Varas, Puerto Plata, Puerto Cabello, Puerto Ordaz, Puerto Ayacucho, Puerto Maldonado,
Puerto Limon, Puerto Barrios, Puerto Cortes, Puerto Rico, Valle Hermoso, Valle Grande, Valle de la Pascua, Valledupar, Valparaiso, Vallenar, Peña Blanca, Penalolen,
Cerro Navia, Cerro Azul, Cerro Alto, Cerro de Pasco, Torre Blanca, Torreon, Campo Alegre, Campo Verde, Alto Hospicio, Alto Rio Senguer, Alto Parana, Alto Verde,
Bella Vista, Bella Union, Bello, Sol de Mayo, Mar del Plata, Mar Chiquita, Pinamar, Pinar del Rio, Roble, Robles, Santa Marina, Santa Rosa,
Santa Ana, Santa Lucia, Santa Teresa, Santa Marta, San Marcos, San Pedro, San Juan, San Rafael, San Isidro, San Fernando, San Vicente, San Antonio,
San Cristobal, San Salvador, San Pablo, San Francisco, Ajax, PSV, Feyenoord, AZ, Twente, Utrecht, Vitesse, Heerenveen,
Groningen, Sparta, NEC, Go Ahead Eagles, Heracles, PEC Zwolle, Fortuna Sittard, RKC Waalwijk, Willem II, NAC Breda, ADO Den Haag, Excelsior,
Cambuur, Emmen, Roda JC, VVV-Venlo, MVV, De Graafschap, Volendam, Telstar, Dordrecht, Den Bosch, Helmond Sport, TOP Oss,
Almere City, Haarlem, Hilversum, Amstelveen, Hoofddorp, Zaandam, Purmerend, Hoorn, Den Helder, Alphen, Leiden, Katwijk,
Noordwijk, Lisse, Delft, Schiedam, Vlaardingen, Capelle, Spijkenisse, Barendrecht, Ridderkerk, Gouda, Zoetermeer, Rijswijk,
Gorinchem, Tiel, Culemborg, Veenendaal, Wageningen, Ede, Apeldoorn, Harderwijk, Kampen, Meppel, Hoogeveen, Assen,
Veendam, Winschoten, Delfzijl, Drachten, Sneek, Harlingen, Franeker, Heerlen, Sittard, Geleen, Weert, Roermond,
Venray, Horst, Boxmeer, Cuijk, Uden, Veghel, Oirschot, Best, Veldhoven, Valkenswaard, Bergen op Zoom, Roosendaal,
Etten-Leur, Oosterhout, Zevenbergen, Terneuzen, Goes, Middelburg, Vlissingen, Hoogezand, Hoogland, Hoogvliet, Nieuwegein, Nieuwkoop,
Nieuwerkerk, Nieuwpoort, Nieuwveen, Oudewater, Oudenbosch, Oudorp, Kerkrade, Kerkdriel, Kerkwijk, Molenhoek, Molenaarsgraaf, Zeeland,
Zeewolde, Zeist, Veenhuizen, Veenoord, Heide, Heiloo, Heino, Bosschenhoofd, Stadskanaal, Waterland, Waterlandkerkje, Maasdam,
Maassluis, Maastricht, Maasbracht, Maasland, Maaseik, Anderlecht, Club Brugge, Standard Liege, Genk, Gent, Antwerp, Beerschot,
Mechelen, Charleroi, Cercle Brugge, Union Saint-Gilloise, Kortrijk, Zulte Waregem, Oostende, Eupen, Leuven, Westerlo, Sint-Truiden, Lokeren,
Lierse, Waasland-Beveren, Roeselare, Mouscron, Tubize, Seraing, Molenbeek, Dessel, Lommel, Patro Eisden, Maasmechelen, Hasselt,
Tongeren, Herentals, Turnhout, Geel, Mol, Aalst, Dender, Ninove, Ronse, Oudenaarde, Zottegem, Dendermonde,
Sint-Niklaas, Temse, Hamme, Eeklo, Deinze, Harelbeke, Menen, Ieper, Poperinge, Diksmuide, Torhout, Tielt,
Izegem, Avelgem, Tournai, Mons, Binche, La Louviere, Braine, Nivelles, Wavre, Waterloo, Ottignies, Namur,
Dinant, Dison, Verviers, Vise, Herve, Spa, Stavelot, Arlon, Virton, Bastogne, Marche, Libramont,
Galatasaray, Fenerbahce, Besiktas, Trabzonspor, Basaksehir, Sivasspor, Konyaspor, Alanyaspor, Antalyaspor, Kasimpasa, Gaziantep, Hatayspor,
Kayserispor, Rizespor, Giresunspor, Adana Demirspor, Adanaspor, Ankaragucu, Genclerbirligi, Erzurumspor, Samsunspor, Bursaspor, Eskisehirspor, Denizlispor,
Goztepe, Karsiyaka, Altay, Bucaspor, Menemen, Manisaspor, Akhisarspor, Akhisar Belediyespor, Balikesirspor, Bandirmaspor, Kocaelispor, Sakaryaspor,
Duzcespor, Boluspor, Zonguldakspor, Karabukspor, Bartinspor, Kastamonuspor, Sinopspor, Corumspor, Amasyaspor, Tokatspor, Yozgatspor, Kirikkale,
Kirsehir, Nevsehir, Nigde, Aksaray, Karamanspor, Mersin Idmanyurdu, Tarsus Idman Yurdu, Osmaniyespor, Kahramanmarasspor, Adiyamanspor, Malatyaspor, Elazigspor,
Diyarbakirspor, Sanliurfaspor, Mardin, Batman, Siirt, Vanspor, Bitlis, Mus, Karsspor, Ardahan, Artvin, Hopa,
Orduspor, Fatsa, Unye, Bafra, Carsamba, Terme, Tirebolu, Gumushane, Bayburt, Erzincanspor, Tunceli, Bingolspor,
Hakkari, Sirnak, Cizre, Silopi, Midyat, Kiziltepe, Viransehir, Siverek, Bismil, Corluspor, Tekirdagspor, Edirnespor,
Kirklareli, Luleburgaz, Canakkalespor, Gelibolu, Bigaspor, Yalovaspor, Gebzespor, Darica, Pendikspor, Kartalspor, Maltepespor, Umraniyespor,
Tuzla, Eyupspor, Sultanbeyli, Sile, Beykoz, Karagumruk, Bakirkoy, Bayrampasa, Zeytinburnu, Gaziosmanpasa, Sariyer, Sisli,
Kagithane, Uskudar, Kadikoy, Atasehir, Bagcilar, Esenler, Esenyurtspor, Avcilar, Beylikduzu, Buyukcekmece, Silivri, Catalca,
Tuzlaspor, Altinordu, Aydinspor, Nazillispor, Soke, Kusadasi, Mugla, Bodrumspor, Fethiye, Marmaris, Dalaman, Burdur,
Isparta, Afyonspor, Usakspor, Kutahyaspor, Bilecik, Inegolspor, Mudanya, Gemlikspor, Orhangazi, Bozuyuk, Cankiri, Beypazari,
Polatli, Golbasi, Keciorengucu, Etimesgutspor, Mamak, Yenimahalle, Sincan, Cubuk, Kizilcahamam, Eregli Belediyespor, Alapli, Devrek,
Caycuma, Safranbolu, Bulancak, Gorele, Akcaabat, Arsin, Yomra, Surmene, Macka, Arhavi, Findikli, Pazar,
Ardesen, Cayeli, Guneysu, Kemalpasa, Torbali, Odemis, Tire, Bergama, Aliaga, Foca, Cesme, Urla,
Bornova, Buca, Cigli, Bayrakli, Gaziemir, Narlidere, Balcova, Konak, Alsancak, Karakoy, Karaman, Karakaya,
Karacabey, Karasu, Karatas, Karabaglar, Kara Mursel, Akcakoca, Akcakale, Akhisar, Aksehir, Akyazi, Akdeniz, Akbuk,
Yeni Mahalle, Yenisehir, Yenikoy, Yenice, Yenifoca, Eski Mahalle, Eskipazar, Eskil, Kizilay, Kizilirmak, Sarikamis, Sarigol,
Sarayonu, Golcuk, Golyaka, Golhisar, Dagkizilca, Denizli, Denizciler, Taskopru, Tasova, Demirci, Demirkoy, Demirtas,
Yesilyurt, Yesilova, Yesilhisar, Yesilkoy, Camlica, Camlibel, Camliyayla, Suhut, Sugoz, Kale, Kalecik, Kalkan,
Ovacik, Ovakent, Bozkir, Bozkurt, Bozova, Goksun, Gokcebey, Gokova, Altinova, Altinoluk, Olympiacos, Panathinaikos,
AEK, PAOK, Aris, Xanthi, Volos, Lamia, Atromitos, Peristeri, Asteras Tripolis, OFI, Chania, Rethymno,
Panionios, Panserraikos, Veria, Kallithea, Egaleo, Panachaiki, Ionikos, Levadiakos, Platanias, Apollon Smyrnis, Ergotelis, Kerkyra,
Panetolikos, Doxa Drama, Kavala, Apollon Pontou, Pierikos, Larissa, Trikala, Karditsa, Kozani, Edessa, Giannina, Preveza,
Arta, Chalkida, Thiva, Livadia, Atalanti, Karpenisi, Amfissa, Nafplio, Argos, Kalamata, Messini, Sparti,
Pyrgos, Zakynthos, Kefalonia, Lefkada, Mytilene, Chios, Samos, Rhodes, Kos, Kalymnos, Naxos, Paros,
Syros, Santorini, Mykonos, Tinos, Andros, Skiathos, Alexandroupoli, Komotini, Didymoteicho, Nea Salamina, Nea Ionia, Marousi,
Chaidari, Ilioupoli, Glyfada, Voula, Elefsina, Megara, Salamina, Aspropyrgos, Acharnes, Lavrio, Rafina, Kifisia,
Penteli, Zografou, Kaisariani, Vyronas, Moschato, Tavros, Alimos, Dionysos, Kalopsida, Kalochori, Kalamaria, Kalyvia,
Kalavryta, Kalambaka, Neochori, Neapoli, Neos Marmaras, Neo Psychiko, Neo Irakleio, Palaio Faliro, Palaiochori, Palaiopyrgos, Megalopoli, Megalochori,
Mikrolimano, Mikra, Pyrgoi, Lefkimmi, Lefkonas, Mavrovouni, Pefki, Pefkochori, Elatochori, Kastro, Kastoria, Kastellorizo,
Limenaria, Limenas, Xylokastro, Xylopoli, Petralona, Petroupoli, Aspra Spitia, Asprovalta, Koklia, Platanos, Platanitsa, Amygdaleza,
Agrinio, Agios Nikolaos, Agios Dimitrios, Agios Stefanos, Agia Paraskevi, Agia Marina, Agia Galini, Slavia Prague, Sparta Prague, Viktoria Plzen, Banik Ostrava, Slovan Liberec,
Sigma Olomouc, Mlada Boleslav, Jablonec, Teplice, Dukla Prague, Zbrojovka Brno, Slovacko, Zlin, Hradec Kralove, Pardubice, Ceske Budejovice, Karvina,
Opava, Jihlava, Zizkov, Chrudim, Varnsdorf, Usti nad Labem, Most, Chomutov, Karlovy Vary, Cheb, Sokolov, Domazlice,
Pribram, Kladno, Kolin, Pelhrimov, Tabor, Pisek, Prachatice, Znojmo, Prostejov, Prerov, Vyskov, Kromeriz,
Hodonin, Breclav, Vsetin, Frydek-Mistek, Havirov, Orlova, Trinec, Bohumin, Novy Jicin, Koprivnice, Trebic, Zdar nad Sazavou,
Havlickuv Brod, Chocen, Litomysl, Svitavy, Trutnov, Nachod, Jaromer, Slovan Bratislava, Spartak Trnava, Zilina, Dunajska Streda, Ruzomberok,
Banska Bystrica, Michalovce, Podbrezova, Senica, Nitra, Trencin, Kosice, Presov, Komarno, Skalica, Poprad, Liptovsky Mikulas,
Zvolen, Lucenec, Rimavska Sobota, Humenne, Vranov, Bardejov, Stara Lubovna, Levice, Topolcany, Piestany, Galanta, Sala,
Samorin, Pezinok, Malacky, Senec, Puchov, Dubnica, Prievidza, Handlova, Partizanske, Martin, Namestovo, Legia Warsaw,
Lech Poznan, Wisla Krakow, Cracovia, Gornik Zabrze, Slask Wroclaw, Lechia Gdansk, Pogon Szczecin, Jagiellonia Bialystok, Piast Gliwice, Zaglebie Lubin, Zaglebie Sosnowiec, Korona Kielce,
Radomiak Radom, Widzew Lodz, Rakow Czestochowa, Stal Mielec, Stal Rzeszow, Wisla Plock, Arka Gdynia, GKS Katowice, GKS Tychy, Ruch Chorzow, Polonia Bytom, Odra Opole,
Miedz Legnica, Chojniczanka Chojnice, Termalica Nieciecza, Podbeskidzie, Sandecja, Garbarnia, Hutnik, Puszcza Niepolomice, Motor Lublin, Gornik Leczna, Pogon Siedlce, Olimpia Elblag,
Warta Poznan, Zawisza Bydgoszcz, Pomorzanin Torun, Elana Torun, Wloclawek, Radomsko, Zawiercie, Dabrowa, Jaworzno, Mikolow, Rybnik, Raciborz,
Kedzierzyn, Nysa, Prudnik, Brzeg, Olesnica, Swidnica, Walbrzych, Jelenia Gora, Boleslawiec, Zgorzelec, Glogow, Zielona Gora,
Gorzow, Slupsk, Koszalin, Kolobrzeg, Stargard, Swinoujscie, Nowogard, Nowogrod, Starogard, Starachowice, Bielawa, Bielsko,
Czarna, Czarnkow, Wielun, Wieliczka, Malbork, Malkinia, Zielonka, Dobre Miasto, Dobrzyn, Dobczyce, Krasnik, Krasnystaw,
Krasnobrod, Brzeziny, Brzesko, Sokolow, Gorlice, Gorzyce, Dolsk, Podgorze, Zawidow, Wola, Wolsztyn, Wolbrom,
Radom, Radzymin, Radlin, Leszno, Leszczyny, Kamienna Gora, Kamien Pomorski, Jaroslaw, Jaroszowice, Young Boys, Basel, Zurich,
Grasshoppers, Luzern, St Gallen, Servette, Lausanne, Sion, Lugano, Thun, Winterthur, Aarau, Schaffhausen, Wil,
Vaduz, Chiasso, Xamax, La Chaux-de-Fonds, Yverdon, Carouge, Biel, Delemont, Solothurn, Baden, Wohlen, Kriens,
Zug, Chur, Wettingen, Locarno, Bellinzona, Rapperswil, Uster, Dubendorf, Wadenswil, Horgen, Thalwil, Kloten,
Bulach, Rapid Wien, Austria Wien, Salzburg, Sturm Graz, GAK, LASK, Wolfsberger AC, Hartberg, Altach, Austria Lustenau, Admira,
Modling, Wiener Neustadt, Ried, Pasching, Kapfenberg, Austria Klagenfurt, Wattens, Innsbruck, Bregenz, Dornbirn, Feldkirch, Bludenz,
Kufstein, Kitzbuhel, Schwaz, Lienz, Villach, Spittal, St Polten, Krems, Amstetten, Waidhofen, Steyr, Wels,
Vocklabruck, Gmunden, Bad Ischl, Hallein, Zell am See, Eisenstadt, Mattersburg, Neusiedl, Oberwart, Weiz, Leoben, Bruck,
Knittelfeld, Judenburg, Murau, Liezen, Schladming, Trofaiach, Lannach, Gleisdorf, Furstenfeld, Bad Radkersburg, Leibnitz, Voitsberg,
Bodo Glimt, Rosenborg, Molde, Brann, Viking, Valerenga, Lillestrom, Odd, Stromsgodset, Sarpsborg, Haugesund, Tromso,
Kristiansund, Aalesund, Sandefjord, Ham-Kam, Fredrikstad, Mjondalen, Start, Sogndal, Stabaek, Bryne, Jerv, Raufoss,
Kongsvinger, Lyn, Moss, Ranheim, Asane, Fana, Honefoss, Skeid, Strommen, Kjelsas, Frigg, Ullensaker,
Kolbotn, Asker, Kongsberg, Notodden, Porsgrunn, Fram Larvik, Larvik, Tonsberg, Horten, Sandnes Ulf, Egersund, Flekkefjord,
Mandal, Arendal, Storvik, Vestby, Gamlebyen, Lillehammer, Copenhagen, Brondby, Midtjylland, Nordsjaelland, AGF, AaB,
Odense, Randers, Silkeborg, Viborg, Vejle, Horsens, Sonderjyske, Esbjerg, Lyngby, Hvidovre, Hobro, Fremad Amager,
B93, Naestved, Roskilde, Kolding, Fredericia, Skive, Thisted, Hjorring, Frederikshavn, Holstebro, Ringkobing, Varde,
Ribe, Vejen, Svendborg, Faaborg, Nyborg, Middelfart, Assens, Nakskov, Holbaek, Slagelse, Korsor, Ringsted,
Koge, Hillerod, Helsingor, Frederiksberg, Gentofte, Ballerup, Glostrup, Taastrup, Malmo, AIK, Djurgarden, Hammarby,
Goteborg, Orgryte, Hacken, Norrkoping, Elfsborg, Kalmar, Mjallby, Helsingborg, Halmstad, Varnamo, Sirius, Degerfors,
Orebro, Brommapojkarna, Vasteras, Gefle, Sundsvall, Ostersund, Umea, Trelleborg, Landskrona, Angelholm, Varberg, Kungsbacka,
Molndal, Partille, Lerum, Alingsas, Trollhattan, Vanersborg, Uddevalla, Lidkoping, Skovde, Falkoping, Jonkoping, Eskilstuna,
Nykoping, Katrineholm, Linkoping, Motala, Karlstad, Arvika, Kristinehamn, Karlskoga, Falun, Borlange, Mora, Leksand,
Hudiksvall, Soderhamn, Bollnas, Harnosand, Ornskoldsvik, Kramfors, Sollefteå, Lycksele, Pitea, Kiruna, HJK, HIFK,
KuPS, Inter Turku, TPS, Ilves, TPV, Lahti, VPS, SJK, Mariehamn, Oulu, Rovaniemi, RoPS,
Kemi, Jaro, Honka, KTP, Kuusankoski, Lappeenranta, Imatra, Joensuu, Mikkeli, Savonlinna, Jyvaskyla, JJK,
Pori, Rauma, Hameenlinna, FH Hafnarfjordur, Valur, Breidablik, Stjarnan, Fylkir, Thor Akureyri, Keflavik, Grindavik, Selfoss,
Haukar, Grotta, Afturelding, Vikingur, Fjolnir, Leiknir, Throttur, Njardvik, Akranes, Ferencvaros, Ujpest, MTK Budapest,
Honved, Debrecen, Videoton, Fehervar, Szekesfehervar, Fehervar FC, Mezokovesd, Paks, Kisvarda, Zalaegerszeg, Puskas Akademia, Diosgyor,
Miskolc, Gyor, Szombathely, Haladas, Szeged, Szolnok, Nyiregyhaza, Kecskemet, Pecs, Kaposvar, Siofok, Balatonfured,
Veszprem, Tatabanya, Dunaujvaros, Esztergom, Vac, Vasas, Soroksar, Csepel, Kispest, Zuglo, Rakospalota, Budafok,
Budaors, Gyirmot, Mosonmagyarovar, Sopron, Kapuvar, Csorna, Sarvar, Celldomolk, Keszthely, Nagykanizsa, Lenti, Szentgotthard,
Oroshaza, Bekescsaba, Gyula, Hodmezovasarhely, Mako, Kiskunfelegyhaza, Kiskunhalas, Baja, Szekszard, Dombovar, Mohacs, Komlo,
Siklos, Eger, Gyongyos, Hatvan, Salgotarjan, Balassagyarmat, Szentendre, Dunakeszi, Godollo, Cegled, Nagykoros, Monor,
Dabas, Szigetszentmiklos, Erd, Biatorbagy, Torokbalint, Tata, Komarom, Kisber, Papa, Ajka, Tapolca, Zirc,
Mor, Bicske, Oroszlany, Varpalota, Sarbogard, Adony, Kalocsa, Tolna, Bonyhad, Koszeg, Steaua Bucharest, FCSB,
Dinamo Bucharest, Rapid Bucharest, CFR Cluj, Universitatea Craiova, Universitatea Cluj, Farul Constanta, Viitorul, Petrolul Ploiesti, Sepsi, UTA Arad, Politehnica Timisoara, Otelul Galati,
FC Botosani, Voluntari, Hermannstadt, Gaz Metan Medias, Astra Giurgiu, Concordia Chiajna, Dunarea Calarasi, Mioveni, Targu Mures, Csikszereda, FC Brasov, Corvinul Hunedoara,
Pandurii Targu Jiu, Ceahlaul Piatra Neamt, Foresta Suceava, Politehnica Iasi, CSM Iasi, Unirea Slobozia, Buzau, Focsani, Bacau, Vaslui, Pitesti, Arges,
Ramnicu Valcea, Drobeta-Turnu Severin, Resita, Oradea, Satu Mare, Baia Mare, Zalau, Bistrita, Sighisoara, Alba Iulia, Deva, Petrosani,
Lugoj, Caransebes, Oravita, Slatina, Alexandria, Turnu Magurele, Rosiori, Zimnicea, Giurgiu, Oltenita, Calarasi, Fetesti,
Medgidia, Mangalia, Tulcea, Braila, Campia Turzii, Podu Iloaiei, Piatra Neamt, Brad, Salcia, Livada, Lunca, Cetateni,
Radauti, Zarnesti, Dacia Chisinau, Sheriff Tiraspol, Zimbru Chisinau, Petrocub, Milsami Orhei, Zaria Balti, Speranta Nisporeni, Red Star Belgrade, Partizan, Vojvodina,
Novi Sad, Cukaricki, Radnicki Nis, Radnicki Kragujevac, Spartak Subotica, Napredak Krusevac, Backa Topola, Mladost Lucani, Javor Ivanjica, Vozdovac, Rad, OFK Beograd,
Zeleznik, Radnik Surdulica, Macva Sabac, Proleter Novi Sad, Novi Pazar, Kolubara, Borac Cacak, Smederevo, Metalac, Zlatibor, Jagodina, Sloboda Uzice,
Zemun, Sindjelic, Hajduk Kula, Becej, Zrenjanin, Pancevo, Vrsac, Kikinda, Sombor, Apatin, Sremska Mitrovica, Ruma,
Sid, Indjija, Stara Pazova, Obrenovac, Mladenovac, Smederevska Palanka, Pozarevac, Bor, Zajecar, Negotin, Prokuplje, Leskovac,
Vranje, Pirot, Kraljevo, Cuprija, Dinamo Zagreb, Hajduk Split, Rijeka, Osijek, Lokomotiva, Istra 1961, Varazdin, Gorica,
Slaven Belupo, Sibenik, Zadar, Cibalia, Vinkovci, Slavonski Brod, Dubrovnik, Cakovec, Karlovac, Sisak, Bjelovar, Virovitica,
Pozega, Zapresic, Rudes, Solin, Kastela, Trogir, Makarska, Imotski, Sinj, Metkovic, Vukovar, Zrinjski,
Velez Mostar, Sarajevo, Zeljeznicar, Sloboda Tuzla, Borac Banja Luka, Zvijezda 09, Siroki Brijeg, Posusje, Radnik Bijeljina, Leotar, Tuzla City, Travnik,
Celik Zenica, Rudar Prijedor, Igman Konjic, Gorazde, Bihac, Cazin, Livno, Orasje, Brcko, Doboj, Zvornik, Visoko,
Zavidovici, Kakanj, Breza, Olimpija Ljubljana, Maribor, Celje, Koper, Domzale, Mura, Bravo, Nova Gorica, Triglav Kranj,
Radomlje, Aluminij, Krsko, Brezice, Novo Mesto, Rudar Velenje, Ptuj, Lendava, Ormoz, Slovenj Gradec, Ravne, Jesenice,
Bled, Skofja Loka, Kamnik, Trbovlje, Zagorje, Postojna, Sezana, Izola, Piran, Podgorica, Buducnost, Sutjeska,
Zeta, Rudar Pljevlja, Mogren, Budva, Mornar, Bar, Decic, Petrovac, Kotor, Herceg Novi, Bijelo Polje, Berane,
Ulcinj, Cetinje, Lovcen, Skopje, Vardar, Rabotnicki, Shkendija, Struga, Makedonija, Pelister, Sileks, Belasica,
Renova, Ohrid, Gostivar, Kumanovo, Prilep, Veles, Shtip, Kavadarci, Gevgelija, Kicevo, Tirana, Partizani,
Vllaznia, Skenderbeu, Kukesi, Teuta, Laci, Flamurtari, Apolonia, Elbasani, Bylis, Luftetari, Egnatia, Tomori,
Besa, Pogradeci, Erzeni, Burreli, Lushnje, Lezhe, Prishtina, Drita, Gjilani, Ballkani, Llapi, Feronikeli,
Trepca, Peja, Prizren, Ferizaj, Vushtrria, Novi Grad, Stari Grad, Belo Polje, Zlatograd, Dobropolje, Mali Zvornik, Veliki Gaj,
Kamenovac, Podgorje, Lipovac, Brdovac, Krasnica, Krasno, Bijelo Brdo, Vlora, Shkodra, Kruja, Peshkopi, Gjirokastra,
Pogradec, Durres, Berat, Fier, Lezha, Burrel, Kukes, Korca, Elbasan, Lushnja, Kavaja, Sarande,
Gramsh, Librazhd, Tepelena, Permet, Delvina, Bulqiza, Mat, Mirdita, Puka, Tropoja, Has, Vau i Dejes,
Malesia e Madhe, Dibra, Kolonje, Skrapar, Devoll, Mallakastra, Kurbin, Kamez, Vore, Rrogozhine, Cerrik, Belsh,
Maliq, Bilisht, Libohove, Memaliaj, Ballsh, Patos, Roskovec, Divjake, Fushe-Kruje, Kashar, Kavaje, Fushe Arrez,
Ura Vajgurore, Shakhtar Donetsk, Dynamo Kyiv, Dnipro, Zorya Luhansk, Vorskla Poltava, Metalist Kharkiv, Karpaty Lviv, Chornomorets Odesa, Oleksandriya, Kolos Kovalivka, Rukh Lviv,
Veres Rivne, Mariupol, Metalurh Zaporizhya, Zirka Kropyvnytskyi, Obolon Kyiv, Polissya Zhytomyr, LNZ Cherkasy, Inhulets Petrove, Desna Chernihiv, Volyn Lutsk, Prykarpattia Ivano-Frankivsk, Ternopil,
Bukovyna Chernivtsi, Uzhhorod, Mynai, Kryvbas Kryvyi Rih, Kremin Kremenchuk, Sumy, Skala Stryi, Kherson, Mykolaiv, Nikopol, Zenit, Spartak Moscow,
CSKA Moscow, Lokomotiv Moscow, Dynamo Moscow, Torpedo Moscow, Krasnodar, Rostov, Rubin Kazan, Akhmat Grozny, Terek Grozny, Krylia Sovetov, Ural Yekaterinburg, Sochi,
Nizhny Novgorod, Orenburg, Fakel Voronezh, Baltika Kaliningrad, Khimki, Arsenal Tula, Anzhi Makhachkala, Amkar Perm, Tom Tomsk, Luch Vladivostok, SKA Khabarovsk, Volga Nizhny Novgorod,
Alania Vladikavkaz, Kuban Krasnodar, Shinnik Yaroslavl, Chernomorets Novorossiysk, Salyut Belgorod, Metallurg Lipetsk, Sibir Novosibirsk, Spartak Nalchik, Yenisey Krasnoyarsk, Chita, Irkutsk, Omsk,
Tyumen, Chelyabinsk, Ufa, Saratov, Sokol Saratov, Volgograd, Rotor Volgograd, Astrakhan, Orel, Kursk, Bryansk, Smolensk,
Tver, Yaroslavl, Vladimir, Ryazan, Tambov, Penza, Ulyanovsk, Tolyatti, Lada Togliatti, Naberezhnye Chelny, KAMAZ, Nizhnekamsk,
Izhevsk, Syktyvkar, Arkhangelsk, Murmansk, Petrozavodsk, Pskov, Novgorod, Vologda, Kostroma, Ivanovo, Kaluga, Tula,
Elista, Stavropol, Armavir, Maykop, Pyatigorsk, Kislovodsk, Cherkessk, Nazran, Derbent, Krasnograd, Zelenograd, Bolshevo,
Lipetsk, Dubrovka, Solnechnogorsk, Kamenka, Kamensk, Lesnoy, Novgorod-Seversky, Belaya Tserkov, Cherno-More, Kamianske, Zhytomyr, Zaporizhia,
Bila Tserkva, Brovary, Boryspil, Irpin, Bucha, Vyshneve, Fastiv, Obukhiv, Uman, Vinnytsia, Nemyriv, Berdychiv,
Korosten, Novohrad-Volynskyi, Sarny, Kovel, Lutsk, Rivne, Dubno, Kremenets, Chervonohrad, Drohobych, Stryi, Truskavets,
Kolomyia, Kalush, Nadvirna, Mukachevo, Berehove, Khust, Zalishchyky, Kamianets-Podilskyi, Khmelnytskyi, Shepetivka, Starokostiantyniv, Zolochiv,
Brody, Staryi Oskol, Belgorod, Zalgiris Vilnius, Vilnius, Kaunas, Suduva, Panevezys, Ekranas, Siauliai, Banga Gargzdai, Klaipeda,
Atlantas, Utenis, Riteriai, Dainava, Alytus, Jonava, Trakai, Riga FC, Skonto Riga, RFS, Liepaja, Ventspils,
Daugavpils, Jelgava, Valmiera, Jurmala, Metta, Gulbene, Tukums, Auda, Ogre, Salaspils, Olaine, Sigulda,
Cesis, Rezekne, Jekabpils, Ludza, Flora Tallinn, Levadia Tallinn, Nomme Kalju, Paide, Tammeka Tartu, Kuressaare, Viljandi, Parnu,
Narva Trans, Sillamae, Kohtla-Jarve, Tulevik, Maardu, Rakvere, Haapsalu, Valga, Voru, Jogeva, Johvi, Minsk,
BATE Borisov, Shakhtyor Soligorsk, Dinamo Brest, Gomel, Vitebsk, Mogilev, Grodno, Neman Grodno, Slutsk, Isloch, Zhodino, Slavia Mozyr,
Bobruisk, Naftan Novopolotsk, Orsha, Baranovichi, Pinsk, Lida, Molodechno, Smorgon, Tbilisi, Dila Gori, Torpedo Kutaisi, Saburtalo,
Sioni Bolnisi, Batumi, Zugdidi, Samtredia, Telavi, Rustavi, Poti, Gagra, Kobuleti, Yerevan, Pyunik, Ararat,
Alashkert, Noah, Shirak, Gyumri, Urartu, Banants, Kotayk, Vanadzor, Lori, Ijevan, Gandzasar, Kapan,
Sevan, Baku, Qarabag, Neftchi, Sumqayit, Gabala, Zira, Sabail, Sabah, Kapaz, Ganja, Shamakhi,
Turan Tovuz, Mingachevir, Lankaran, Inter Baku, Zaqatala, Astana, Kairat, Tobol, Aktobe, Ordabasy, Shymkent, Taraz,
Zhetysu, Atyrau, Aktau, Kyzylzhar, Petropavlovsk, Okzhetpes, Kokshetau, Shakhter Karagandy, Elimai, Semey, Ekibastuz, Pavlodar,
Irtysh, Oral, Kyzylorda, Zhezkazgan, Turkistan, Kentau, Temirtau, Jeonbuk Hyundai Motors, Ulsan Hyundai, Pohang Steelers, Suwon Samsung Bluewings, Suwon FC,
FC Seoul, Seoul E-Land, Incheon United, Daegu FC, Gangwon FC, Jeju United, Gwangju FC, Daejeon Hana Citizen, Gimcheon Sangmu, Sangju Sangmu, Seongnam FC, Bucheon FC 1995,
Busan IPark, Gyeongnam FC, Anyang, Ansan Greeners, Asan Mugunghwa, Cheonan City, Cheongju FC, Chungju Hummel, Hwaseong FC, Pyeongtaek, Osan, Yongin FC,
Icheon Sangmu, Gwangmyeong, Siheung, Gimpo FC, Goyang Zaicro, Paju Citizen, Yangju, Uijeongbu, Pocheon, Dongducheon, Namyangju, Hanam,
Mokpo City, Yeosu, Suncheon, Gwangyang, Naju, Haenam, Wando, Jindo, Jeongeup, Gunsan, Iksan, Namwon,
Gimje, Gongju, Buyeo, Nonsan, Boryeong, Seosan, Dangjin, Hongseong, Taean, Yesan, Chungju, Jeonju,
Gyeongju, Okcheon, Jincheon, Daejeon Korail, Ulsan Citizen, Ulsan Hyundai Mipo, Gimhae City, Gyeongju KHNP, Chuncheon Citizen, Changwon City, Gangneung City, Chuncheon,
Gangneung, Wonju, Sokcho, Donghae, Taebaek, Samcheok, Seogwipo, Jinju, Tongyeong, Sacheon, Gimhae, Miryang,
Yangsan, Geoje, Gumi, Andong, Yeongju, Mungyeong, Yeongcheon, Gyeongsan, Chilgok, Yeoncheon, Hwacheon, Yanggu,
Inje, Goseong, Yangyang, Hongcheon, Pyeongchang, Jeongseon, Yeongwol, Hoengseong, Cheorwon, Gapyeong, Hwaseong, Bupyeong,
Namdong, Buk-gu, Seo-gu, Nam-gu, Dong-gu, Urawa Red Diamonds, Kashima Antlers, Gamba Osaka, Cerezo Osaka, Vissel Kobe, Nagoya Grampus, Sanfrecce Hiroshima,
Kawasaki Frontale, Yokohama F Marinos, Yokohama FC, FC Tokyo, Tokyo Verdy, Machida Zelvia, Kashiwa Reysol, JEF United Chiba, Shonan Bellmare, Kyoto Sanga, Avispa Fukuoka, Sagan Tosu,
Albirex Niigata, Shimizu S-Pulse, Jubilo Iwata, Montedio Yamagata, Vegalta Sendai, Consadole Sapporo, Oita Trinita, Roasso Kumamoto, Kagoshima United, V-Varen Nagasaki, Tokushima Vortis, Ehime FC,
Kamatamare Sanuki, Fagiano Okayama, Renofa Yamaguchi, Gainare Tottori, Kataller Toyama, Zweigen Kanazawa, Ventforet Kofu, Matsumoto Yamaga, Nagano Parceiro, Thespa Kusatsu, Mito HollyHock, Tochigi SC,
Blaublitz Akita, Iwaki FC, Fukushima United, Iwate Grulla Morioka, Vanraure Hachinohe, Tegevajaro Miyazaki, Giravanz Kitakyushu, Azul Claro Numazu, Fujieda MYFC, Atletico Suzuka, Nara Club, Reilac Shiga,
Omiya Ardija, SC Sagamihara, Kamakura, Beijing Guoan, Shanghai Port, Shanghai Shenhua, Shandong Taishan, Qingdao, Guangzhou Evergrande, Guangzhou City, Shenzhen, Tianjin Jinmen Tiger,
Changchun Yatai, Dalian Pro, Hangzhou Greentown, Zhejiang, Ningbo, Henan Songshan Longmen, Zhengzhou, Wuhan Three Towns, Chongqing, Chengdu Rongcheng, Meizhou Hakka, Nantong Zhiyun,
Cangzhou Mighty Lions, Shijiazhuang, Hebei, Jiangsu, Nanjing City, Suzhou, Wuxi, Xian, Shaanxi, Kunshan, Heilongjiang, Harbin,
Yanbian Funde, Yanji, Liaoning, Shenyang, Guizhou, Guiyang, Kunming, Yunnan, Lanzhou, Xining, Yinchuan, Urumqi,
Xinjiang, Lhasa, Nanchang, Hefei, Anhui, Fuzhou, Xiamen, Fujian, Haikou, Hainan, Nanning, Guangxi,
Guilin, Liuzhou, Zhuhai, Dongguan, Foshan, Huizhou, Zhongshan, Beijing, Tianjin, Dalian, Wuhan, Hangzhou,
Nanjing, Beihai, Al Ahly, Zamalek, Pyramids, Al Masry, Ismaily, Enppi, Smouha, Al Ittihad Alexandria, Tala'ea El Gaish, El Gouna,
Ceramica Cleopatra, Future FC, Pharco, National Bank of Egypt, Ghazl El Mahalla, El Mokawloon, Haras El Hodoud, Aswan, Wadi Degla, Petrojet, Wydad Casablanca, Raja Casablanca,
FAR Rabat, Maghreb de Fes, Hassania Agadir, Ittihad Tanger, RS Berkane, Mouloudia Oujda, Moghreb Tetouan, Olympique Khouribga, Olympic Safi, Difaa El Jadidi, KAC Kenitra, CODM Meknes,
Youssoufia Berrechid, Chabab Mohammedia, Rapide Oued Zem, Kawkab Marrakech, Esperance de Tunis, Club Africain, Etoile du Sahel, CS Sfaxien, Stade Tunisien, US Monastirienne, Ben Guerdane, AS Gabes,
CA Bizertin, JS Kabylie, MC Alger, USM Alger, CR Belouizdad, Paradou AC, NA Hussein Dey, ES Setif, CS Constantine, MC Oran, ASO Chlef, JS Saoura,
USM Bel Abbes, MC El Eulma, ES Tadjenanet, Olympique Medea, WA Tlemcen, JSM Bejaia, USM Annaba, Kaizer Chiefs, Orlando Pirates, Mamelodi Sundowns, Cape Town City, Stellenbosch,
SuperSport United, Royal AM, Golden Arrows, AmaZulu, Richards Bay, Chippa United, Sekhukhune United, Polokwane City, TS Galaxy, Marumo Gallants, Moroka Swallows, Bloemfontein Celtic,
Platinum Stars, Free State Stars, Black Leopards, Maritzburg United, Ajax Cape Town, Bidvest Wits, Jomo Cosmos, Mpumalanga Black Aces, Enyimba, Kano Pillars, Rangers International, Shooting Stars,
Heartland, Plateau United, Rivers United, Remo Stars, Akwa United, Lobi Stars, Sunshine Stars, Abia Warriors, Nasarawa United, Wikki Tourists, Katsina United, Kwara United,
Niger Tornadoes, Gombe United, Bendel Insurance, Warri Wolves, Delta Force, MFM, Bayelsa United, Dolphins, Asante Kotoko, Hearts of Oak, Medeama, Aduana Stars,
Berekum Chelsea, Legon Cities, Karela United, Bechem United, Great Olympics, Dreams FC, Nsoatreman, King Faisal, Samartex, Tamale City, Real Tamale United, Hasaacas,
Sekondi Eleven Wise, Ebusua Dwarfs, Ashanti Gold, Tema Youth, Inter Allies, ASEC Mimosas, Africa Sports, Stella Club, SO Armee, Gagnoa, Sewe Sport, Williamsville,
Diambars, Generation Foot, Teungueth, Jaraaf, Casa Sports, Niary Tally, Guediawaye, Pikine, Mbour, Thies, Canon Yaounde, Tonnerre Yaounde,
Union Douala, Coton Sport, Fovu Club, Stade Renard, Eding Sport, Racing Bafoussam, Stade Malien, Djoliba, Real Bamako, Cercle Olympique, Onze Createurs, USFAS,
Black Stars, Etoile Filante, ASFA Yennenga, Rail Club du Kadiogo, Salitas, Horoya, Hafia, Kaloum Star, Milo, Al Hilal, Al Nassr, Al Ittihad,
Al Ahli, Al Shabab, Al Taawoun, Al Fateh, Al Fayha, Al Raed, Al Wehda, Al Ettifaq, Al Khaleej, Damac, Abha, Al Okhdood,
Al Tai, Al Qadsiah, Al Kholood, Al Orobah, Al Zulfi, Al Jabalain, Al Ansar, Al Hazem, Al Riyadh, Al Adalah, Al Batin, Al Diriyah,
Jazan, Al Safa, Al Nahda, Al Duhail, Al Sadd, Al Rayyan, Al Gharafa, Al Arabi, Qatar SC, Umm Salal, Al Wakrah, Al Khor,
Al Shamal, Al Sailiya, Muaither, Al Markhiya, Al Kharaitiyat, Lusail, Al Ain, Al Wahda, Al Jazira, Shabab Al Ahli, Al Wasl, Al Nasr,
Al Sharjah, Baniyas, Ajman, Al Dhafra, Khor Fakkan, Fujairah, Al Urooba, Ras Al Khaimah, Al Hamriyah, Al Bataeh, Kuwait SC, Al Qadsia,
Al Kuwait, Al Salmiya, Kazma, Al Jahra, Al Yarmouk, Al Sahel, Al Tadamon, Al Naser, Burgan, Khaitan, Al Muharraq, Riffa,
Al Khaldiya, Al Hidd, Al Najma, Busaiteen, Malkiya, Al Seeb, Dhofar, Sur, Al Suwaiq, Fanja, Al Oruba, Sohar,
Saham, Al Rustaq, Nizwa, Al Mussanah, Bahla, Ibri, Al Wihdat, Al Faisaly, Al Jazeera, Al Ramtha, Al Hussein, Sahab,
Al Salt, Al Baqaa, Shabab Al Ordon, Aqaba, Al Jalil, Maan, Al Ahed, Nejmeh, Safa, Ansar, Racing Beirut, Salam Zgharta,
Tadamon Sour, Akhaa Ahli Aley, Al Jaish, Al Karamah, Al Ittihad Aleppo, Tishreen, Al Wathba, Al Shorta, Al Zawraa, Al Quwa Al Jawiya, Al Talaba, Erbil,
Duhok, Zakho, Naft Al Wasat, Persepolis, Esteghlal, Sepahan, Tractor, Foolad, Zob Ahan, Gol Gohar, Malavan, Nassaji Mazandaran,
Aluminium Arak, Saipa, Paykan, Naft Tehran, Naft Masjed Soleyman, Mes Rafsanjan, Mes Kerman, Shahr Khodro, Havadar, Fajr Sepasi, Gostaresh Foolad, Machine Sazi,
Pas Hamedan, Sanat Naft, Rah Ahan, Shahin Bushehr, Zagros Yasuj, Esteghlal Khuzestan, Nirooye Zamini, Damash Gilan, Giti Pasand, Chooka, Sepidrood, Ashford,
Ashton, Ashby, Ashbourne, Ashburton, Ashtead, Brookfield, Cliffe, Clifton, Elmbridge, Fenwick, Fenton, Fenny Stratford,
Halford, Halifax, Halton, Holmfield, Holmwood, Kingsbury, Kingston, Kingswood, Kingsley, Langford, Langham, Langton,
Langley, Millbrook, Millom, Millington, Pendle, Penkridge, Redbridge, Redcar, Redditch, Redhill, Stanford, Stanmore,
Stanley, Stanton, Stansted, Thornbury, Thornton, Thornhill, Wickford, Wickham, Wickwar, Whitby, Whitchurch, Whitefield,
Whitley, Whitton, Brampton, Bramley, Bramhall, Bramford, Coldham, Coldwell, Coldstream, Dunstable, Dunmow, Dunham,
Dunwich, Marlborough, Marlow, Sandford, Sandbach, Sandwich, Sandhurst, Sandown, Stowmarket, Stowford, Stowell, Woodford,
Woodbridge, Woodstock, Woodham, Woodbury, Woodley, Oakham, Oakengates, Oakley, Oakwood, Heathfield, Heathrow, Heathcote,
Oxford, Oxted, Oxhill, Oxton, Fulbourn, Fulford, Fulwood, Springfield, Springville, Riverside, Riverview, Riverton,
Lakeside, Lakeview, Lakeland, Lakewood, Oakville, Oakfield, Oakland, Oakton, Pineville, Pinehurst, Cedarville, Cedarburg,
Maplewood, Mapleton, Redfield, Redwood, Rockford, Rockville, Rockport, Rockland, Silverton, Silverdale, Silverstone, Ironton,
Ironwood, Fortville, Fortuna, Portland, Portville, Stonefield, Stoneville, Greenfield, Greenville, Greenwood, Greenburg, Sunnyside,
Bayfield, Bayville, Bayside, Bluefield, Bluffton, Northfield, Northville, Northport, Westfield, Westville, Westport, Westwood,
Capetown, Cape Coast, Gladstone, Goldfield, Gracefield, Hopetown, Hopewell, Kingstown, Lakeville, Newport, Newbury, Royalton,
Savannah, Valleyfield, Unionville, Abidjan, Bouake, Daloa, Korhogo, Yamoussoukro, Bamako, Kayes, Sikasso, Dakar,
Ziguinchor, Banjul, Kumasi, Accra, Tamale, Takoradi, Lagos, Abuja, Kaduna, Lome, Cotonou, Porto-Novo,
Niamey, Ouagadougou, Conakry, Freetown, Monrovia, Bissau, Bobo-Dioulasso, Bokoro, Kinkala, Kisangani, Lubumbashi, Mbandaka,
Goma, Bukavu, Kananga, Mbuji-Mayi, Likasi, Kolwezi, Kikwit, Tshikapa, Matadi, Boma, Bandundu, Kindu,
Butembo, Beni, Uvira, Kalemie, Bayern Munich, Steaua, Schalke, Sporting CP, Sporting Lisbon, Shakhtar, Celtic Glasgow, Hearts,
Athletic Club`),
]);

/** Hashes of normalised "first last" strings of well-known real professional players (see header). */
export const REAL_PLAYER_HASHES = `
  0001626d 0003f1df 001461d9 0015aa20 001b849e 0027ab4a 0030bc4a 003971fd
  0047c07d 004afdf7 00504925 0064c698 00655724 007a5539 0082ed28 008bce67
  00ce37aa 00d34a00 00d55686 00dae432 00e1a74f 00e1eeab 00e79316 00e9ffb0
  00f7f1bf 011aae12 01547635 015d8ec3 0164c740 0166cc47 0176cd0c 017a4849
  017f73ea 0189b774 01918935 0193cad8 01a8d145 01b50d11 01c7d557 01f2a7e2
  01ffbd71 020ee5a9 02138384 0226eb62 02292206 0245f6b2 024b5883 027c74b0
  027d015e 027df69d 029789cd 029efd88 02aa9e9c 02b95b56 02bc54c3 02bdf1b9
  02c46a5e 02c586c0 02ef63d1 030291f0 03042e8f 030bcbad 03256464 033e1a2a
  03417fbf 0344dcf3 03537e6f 03581ae3 035b95a7 0369c800 037061fc 03708450
  03752e3d 0378620f 0380332a 03898de7 038cd8f1 03990c66 03c0d3e6 03e80e5c
  03ed0155 03f137b5 03f43c46 03f5f80d 0408960c 0417bfe9 0420c70a 0429fba3
  042b6154 042c7079 042f3847 043517af 044cbb0d 044dae45 045c105d 04638d4f
  046644f2 0467050e 0470afb5 047fab90 04a36c98 04b1ce3f 04b2145e 04b43224
  04bbfe6b 04de81c3 04f5e98a 050214a7 0508d2f7 0510b478 051aab8c 053414a6
  05427f67 0553a020 0558b6ae 056eb702 0575e913 05807104 058fcc75 0595e520
  059e64a6 05aaf37e 05c6d6df 05d8b406 05e45a9d 05ebccbd 06169f8a 06223d76
  063f4e44 064e6951 06652e93 066ac374 066d7a8f 06e974fe 06f80097 0710a030
  0713e87d 071514b5 072522fb 072da200 0733bcdc 07458e7b 0749e3bb 075d0d90
  077952b7 078354ae 07a75e3a 07ab4f73 07c96a51 07e195ab 07f60baa 08114e25
  08152706 081f4a69 08211b3a 0826e785 082a55f2 088163c5 089654cc 089c861c
  08ba528d 08c8822f 08d7dfc4 08e807eb 08f0a9a1 0901557a 0908ae79 090d654a
  0910b82b 092101e1 092b7261 095076ec 096b4fda 0984d6c8 09a0b8ff 09b42c87
  0a0c6c83 0a1b6ecb 0a386d58 0a488a34 0a5444e7 0a55b9fa 0a57c2b4 0a69c7bb
  0a8c9aa8 0a953f39 0a9c90ab 0a9cefca 0aab4d86 0aaea1b5 0aaf3755 0ab43670
  0ab6a85d 0ac9c5f5 0acd774c 0afcf102 0afd2d3e 0b28988c 0b30b199 0b3dd606
  0b44690c 0b4f3825 0b5692a5 0b5a7bb8 0b650285 0b66e8e9 0b7131dc 0b71b5ee
  0ba9ceb9 0bafab4d 0bb5c6e9 0bbc0bea 0bbc870a 0bbd4208 0bdc78b8 0be308f7
  0beec9bc 0bf04391 0bf28a0f 0bfa23c9 0c2866d6 0c3f8f86 0c447512 0c58b305
  0c65d724 0c7452dc 0c77f62f 0c83f6d8 0c8fd186 0c9a177a 0ca05e40 0cbdc27a
  0cec563e 0cf326db 0d034b7a 0d2924c8 0d3851b0 0d4526ac 0d46f7d2 0d556bdd
  0d5c9583 0da6136d 0db5be79 0dc06963 0dc71215 0de2e11d 0dec7209 0def5bab
  0df2489b 0e14bd08 0e184941 0e29d84e 0e411bda 0e413ddd 0e45b8ac 0e488c34
  0e4d1f0c 0e520f03 0e530457 0e7540f1 0e778ac7 0e7c25ae 0e7faa57 0e886f82
  0e9124bf 0e9490c2 0e9cb892 0ea9e22b 0eb6c2ab 0ed40ef3 0edf80f0 0eee6d6d
  0ef244a1 0efc1fae 0f317156 0f3aeddc 0f449c38 0f5c5306 0f671ef7 0f7e3112
  0f9625bc 0fb7a7bb 0fbbdd39 0fc4c1c9 0fca0c6f 0fd9af11 0fdc889e 0fdde888
  0fe1fa11 0ff3322c 1001b2c5 100ef0a6 1024d18d 10280d5a 1029bc4f 1039b517
  1044da3c 104bd179 105f351f 106c4f29 1074cbe9 10a278f3 10a579c5 10a9c619
  10c14b0b 10dfcb60 10e542e4 10f08c8b 10fbc65e 10ff1463 112e6f30 1138e901
  11754bca 118d5c9e 11ac3cee 11b13eeb 11b466fd 11c48dfb 11e35b76 11f008e4
  11f31df6 120a5cd0 120d32f0 12221333 122cae41 123e014d 12430f97 124574ed
  125bc87b 1273bc17 12949c23 129d113c 12a0f8b5 12abb0ed 130162d0 1306e55c
  13116b87 1314ce21 131d5614 1321198e 13235fb8 1326e7ce 1327e2a4 1330f218
  13314f3b 1355f234 13591ef3 13707f6a 137b1406 137b2880 138ad284 13ad26f9
  13b07b42 13b192f1 13bc1126 13c2fb59 13cb3566 13e0f25d 13e4cd31 13f21d60
  13f69344 13fe2938 13ffa34c 1403389c 140c85c7 14128789 141c3470 141f4bc4
  1422264c 143342e4 14394052 143d8278 14427c00 147ed112 148b11a8 1491c4c3
  149a8d95 149ef47f 14a4d591 14a9f375 14af2949 14af48ae 14bff286 14c9ddba
  14cc5990 14efbcca 14f2d3cc 14f4688b 14f54f38 14fe9891 150ea085 1512fdd1
  15260ca2 152a6e3f 152fb893 15340821 153f4f78 154f4825 1568c858 1583362d
  158c8d2b 15a9dc2c 15aa9732 15bed87e 15ced5b5 15dc78d0 15e105f3 15f2be2b
  15f3c924 15f64791 15f89ac4 15fd0076 15fff6ad 1611d6d1 16158047 1615dd99
  1624891d 164838b6 166d2ee2 166e0290 1670426c 1674e9c1 1676e17a 16774c26
  167b1e61 1692e081 16a67a25 16aee870 16b3ab8f 16b8e507 16bcb3ab 16beeff6
  16cdc268 16cfdb3f 16f3a3b3 16f6a8c5 16fb959e 170fa083 1716ae9b 17189a08
  171c0abd 1720e002 17259665 1725c86f 172d502e 172f0f5e 17307fd0 17387e81
  17558510 175a72a1 175da559 17642d5c 176cd202 1795c844 179fcbd7 17b59552
  17c5cc1b 17d13152 17da1c83 17e3fd02 17eafb7c 17f0f525 17fc2f62 17fc9832
  18009b96 1809e5ab 18208366 1836fa92 183c957e 1844608f 1857b557 1863247f
  187540f7 18766969 1886effa 18896270 188c724c 188f4ebf 189d16bd 189d16f9
  18b01314 18b3b620 18c4e75c 18c8a551 18c9723c 18d24be4 18d43693 18e2b7c4
  1905c812 19100778 1928e8ac 192c0b5a 194203a5 19421c07 1947574a 195c789a
  19697c02 197070c7 198f96d3 1993b2f1 1999cf70 19aa32be 19b5accc 19c18655
  19de02ce 19dee3bb 19e1eb1e 19efef10 19f548a7 1a112ea6 1a1c7a12 1a2541e4
  1a2a89fc 1a30fdae 1a39c60f 1a4c43a5 1a4cdc92 1a57510a 1a773403 1a7787f9
  1a7a9c48 1a81404d 1a8dab2f 1aa74982 1ab487d7 1ad72624 1ad9b982 1adf1cdb
  1ae17041 1b0bc4b7 1b1c02ad 1b28bc03 1b346ac8 1b5b11c0 1b5b3158 1b5b39e3
  1b6ef264 1b71f037 1b78054f 1b7f6c6f 1b8be1b3 1b9fc17f 1bbc0aff 1bbee485
  1bc2b6c0 1bdbfd22 1be0c4da 1bf56de6 1c118547 1c1b1670 1c23f9db 1c396997
  1c3dbc7b 1c4407a5 1c48655b 1c4e4059 1c566d40 1c70a5cc 1c960022 1c9edd24
  1ca283a7 1ca85e1a 1cb28f1d 1cbbffb2 1cbca7bd 1cc13e84 1cc6c317 1cc8c5b7
  1ce5439d 1cebfd91 1cfb99b9 1d0b428e 1d0e5217 1d1a5afb 1d1fab9c 1d216a75
  1d5bf68d 1d6d8434 1d704800 1d907432 1d99c732 1d9a2af3 1d9ef6e2 1dafb4fe
  1de9d1bf 1dff9190 1e0261f6 1e075c10 1e0beacd 1e1a6278 1e32fd8d 1e3793b1
  1e46390e 1e4703ce 1e4914f7 1e4dbc34 1e58ea01 1e687f35 1e81173e 1ea1a625
  1ea67d10 1ea8f4d3 1eae01c0 1ec25991 1ecb8939 1ece6e4c 1ed4947f 1edfc6b7
  1efcc190 1f0ba84c 1f0f5e4d 1f18a168 1f23bf8e 1f47ead0 1f5900f7 1f5e06ec
  1f5ef8b6 1f5fd344 1f602bee 1f61e3f6 1f7ebed6 1f8c402d 1fb407dd 1fe2afd6
  1fea2342 1ff23739 200869e0 200cf6b8 2019c400 20260900 20386bd7 20397bc3
  203e5e6c 203f6e2a 20566e0e 205c5505 2060144a 206247f6 20701e2c 207350f6
  208784b5 2091248b 20997664 20afdc3d 20b3a38b 20b86805 20bb95a2 20bf394e
  20d4e828 20d6d69a 20d6ed7d 20da6a18 20fff0c8 2122b2a7 21343d73 21344469
  21431fb4 2158927b 21603693 21694f3e 2169bb9b 2170ab07 217387be 217a1d21
  217a8e0d 217cb901 217e3865 218233f4 218950de 21993443 21b297bc 21b3ba88
  21b6c570 21be5661 21c1adb5 21d3bb82 21e8edff 22079be8 220ce908 22137824
  2213ff0c 22288204 222d59e9 2232cd00 22415801 2254b309 2258dccb 2282c53f
  2283f52f 22902872 229da965 22a0aee0 22a3d28d 22aa17a8 22acb224 22b98085
  22caa0b2 22cd33e7 22d1e252 22dba8ac 22deaef1 22f1b63b 22f24212 23068f07
  23147aab 2320bc47 2337dcbc 2337eebc 233f3140 2375324a 2378b5a5 23881f57
  238828ad 239c0df1 239fc2d2 23a46a1c 23c053a8 23c913c5 23d139ca 23eab057
  23ecab87 23eecc7c 23efe93b 240217cc 2412c8fd 24199599 241b1b92 2422d48f
  24371e2b 2451528f 246fe789 24a0c9c4 24a5741c 24ba5a4b 24bc7fe6 24bf11bd
  24c72485 24c75647 24c8b828 24cb8d75 24dd576f 24e2ab8b 24f2bd90 24f80207
  250ea97b 2516b943 252709a5 252f093e 253eca68 2569df99 256e541b 256ea752
  257109be 2572751c 257d70ad 2591d2c6 2595112b 25ae3e3d 25bb05b1 25bef47d
  25d52f01 25d8f99a 25ec7520 25f68042 261eeb20 2629e0b6 262ae551 26367ab0
  2639ba95 263d448d 2642cf1d 264edc91 2654f60c 265dd7e0 265ecd46 266d1cc6
  26741ccd 267847c5 26959a43 26983396 269e1418 26c41502 26cede70 26d2e4a4
  26e4de43 26f03d44 26f2b20a 270a40d4 271ec547 271f5b85 271fcef4 2722015e
  272d3427 274523f7 27486912 275c744e 276e3c4e 2777c43a 277f78c8 2780190b
  2785c49b 27ae6a1b 27db9ae5 27ed9981 27eeb6fa 280d321a 280f6c9e 2817b9e4
  283b09ae 284a8523 284e2fd6 284f7d9c 287f46ff 28857d03 2888bbf8 288a5537
  28974a7a 28b0ce1e 28cccac6 28e809d1 28e87a98 28f50d98 2908767f 29132591
  29171285 29255a9c 29292a2c 292d0bc4 2932051a 29408ccb 2953ddaf 295702f8
  295a006d 295af688 2979b870 297aeb48 297ed522 2982c6fa 2992aec2 299bf8bf
  29a66039 29b382cc 29d6843a 29e0b563 29e28256 29e351e3 29e86551 29f446ca
  29f6bff8 29ffcb97 2a107da1 2a11345b 2a2929f9 2a342e08 2a5f79c4 2a5faff1
  2a6cf475 2a6d0daa 2a8e79f6 2abdcd87 2ac8370b 2ad87dfc 2ae664c1 2ae7684e
  2aee783c 2aeee52c 2b013fc5 2b093081 2b1b5f7f 2b1f50a4 2b293835 2b584273
  2b6455a8 2b650b3c 2b78852a 2b82e79c 2b99baaf 2ba082db 2ba708c7 2bbfdca4
  2bdbd3e6 2be35c04 2be48a52 2be62c6a 2bef5fd7 2bf2399a 2bf7098b 2c07164b
  2c07915e 2c1cb5c8 2c220098 2c2d5e7b 2c36455a 2c3ee558 2c69130e 2c7c3b70
  2c8454c8 2c846384 2c84b516 2cc1bb22 2ccc920e 2cd2132f 2cda96fd 2ce01c17
  2ce3ae6d 2ced88e2 2d00918c 2d05d8e4 2d11b79c 2d1d9e3c 2d27092c 2d2ecc64
  2d5a840a 2d5dc78d 2d71fd80 2d812214 2d8f175f 2d92ae63 2da4f096 2da53a1a
  2da62e19 2daaeb72 2dbe9a23 2dcc1068 2ddcf700 2de2015f 2df9d18e 2e073417
  2e089aa9 2e12f88e 2e149a3d 2e244456 2e2e7ac9 2e360b79 2e3efec9 2e54a66c
  2e6df3e2 2e81e39b 2e846041 2e889a51 2e89ec54 2e8aa9cf 2e8ca2be 2ea7cead
  2eb29d30 2eb87ae9 2eba047c 2ec0d077 2ec46ab0 2ed4c3a9 2ed77985 2ef51e82
  2ef7a090 2f03f9db 2f07ae7e 2f0a63eb 2f1227d9 2f1f35e2 2f2abf68 2f301fd9
  2f3656cf 2f41109e 2f4a123a 2f73fb7b 2f7a2e85 2f7adaab 2f84ab58 2f878145
  2fa493e0 2fa4d307 2fb761e3 2fbe9a3d 2fc1ff47 2fc3bf68 2fea8f89 2ff0c6a1
  2ff9a073 2ffee730 302ae33e 303e5161 30481e0f 30508d77 306560ce 306f247b
  30803f36 30923945 30b800d1 30b9e2bd 30ce71ac 30d2d179 30ddabba 30eb838a
  30f2d0f9 30fef348 30ff918a 311734af 311c7da6 3126d732 312f591c 3135c940
  31395a53 316334c0 3166adee 317c1b20 3182ed03 318bf2d1 31b23692 31b9b537
  31baa9ff 31e20c41 31e31330 31e3b0b6 31e50c58 31e6eefc 31f459b1 31fe7ee8
  31ff0e8f 320bcfc6 321bf870 322998f5 323a9d24 3257e2de 325f37de 325f7668
  325fc22e 3260c42b 3269e352 328b88f2 329096cb 329f8d7a 32a1e185 32acd12a
  32ae1141 32ba48d2 32ceea33 32de96a1 32edc382 32f3d7d1 32fff8c5 3303caed
  3303e9f2 33162e31 3316c966 331a2f38 332ed824 3341d475 33458ecb 3360d1ca
  337955a8 3379c4ba 337dfcda 338a8e42 338b3c8f 338e0823 33a3fba0 33b4834d
  33ba2eb4 33bd6e2a 33c1a9b0 33c406f3 33cddf75 33d541bb 33e2d1f4 33e5aa1e
  33f2d4ae 33f2e2e2 3407bb27 340d9919 34125bc1 341e309c 3446eaa6 34494a08
  345ca49a 345f4b6a 346efd91 3472c560 3472d1eb 34757d87 34a0e9c4 34a1935a
  34a849b1 34b6adc1 34bdcc20 34cc0c51 34cf3cf9 34e2db21 34f2a412 34f849e2
  34fd87c4 350b35b2 3514dfda 35248095 35308fac 3535f65f 3564ea23 3581afc0
  358ef14d 35925675 35a16af2 35a2b2b6 35aa4ca8 35b4f006 35c7bf48 35f3488d
  36030979 3603d8cf 36081a4a 36168f87 3618df5d 361a3812 361fd54e 36286484
  36348671 36350071 3638288a 363e3669 36487bce 364c04ec 364cb120 36528276
  36528d57 365c3ed3 36781b56 367e9665 36903aaa 36943020 3694c85c 36b87571
  36c9a3cf 370b4b6e 3714b484 371e5d50 372b3b42 372ec482 37313718 37329fdc
  37412e0b 3749dcc6 3749eb58 375eac57 37ae8cc1 37be4728 37ca04d4 37ca7a44
  37ce48ef 37d3b6cf 37dd16f5 37efe292 37f4869f 37fc908f 3813c364 3829d7fe
  383c9fbf 3842f83d 38494140 3854b977 385d46d7 385f786c 3860a46f 387d49be
  38869bea 388a6cda 38968748 38c79f96 38ce64ef 38d2f047 38d3dfce 38dd2dbc
  38e471d9 38ea33f4 38f9ed56 391b95ce 3922502c 39428534 3955fe37 395ffcd2
  39600c07 39647386 39737a8e 39752a8e 398334f4 39961c0c 39a68490 39a8e5a0
  39ae98f4 39b048d0 39c5626f 39ca7b02 39d89f24 39fe6854 3a079229 3a098031
  3a1bdf11 3a1f7dbc 3a2447c2 3a34074a 3a3fc444 3a42e025 3a52e5c6 3a580466
  3a5b5248 3a601b6e 3a6ce380 3a89b21e 3a8d557e 3aaae092 3aab5bc8 3abbc5d6
  3ad1fda3 3ad6a6c0 3ae3f58b 3ae9f18a 3aee9ef2 3b0b96ec 3b2cac37 3b3a5ba4
  3b508769 3b7513bc 3b76f99c 3b83c6c0 3b85c5a3 3b8e65b7 3bb5c26a 3bb759f9
  3bc4accf 3bcf6de0 3bda08cf 3bdce178 3be9a820 3bf862ff 3c12f371 3c1533cb
  3c18d6e3 3c24142d 3c261273 3c3ec7e8 3c68f83b 3c79a153 3c808908 3c954fd4
  3ca36723 3ca6a43e 3cbab364 3cbd9211 3cbec7c3 3cbf9b78 3cc0476f 3cca2f03
  3ccfec9b 3ce37319 3ceac95a 3cf6fcec 3cfe6d2b 3d1a03b6 3d1e9956 3d249585
  3d29f1a4 3d2b9547 3d31e935 3d3204b6 3d3730af 3d4c9a2b 3d5f1ad9 3d5fde13
  3d6b6dab 3d7f1c07 3d882bf4 3d983e11 3da06007 3da0b199 3da4ceb5 3db8d68b
  3dcb18ae 3ddef080 3de9c5ec 3df85dbc 3e091361 3e09b46e 3e0cddad 3e323933
  3e36c660 3e44253d 3e4454b0 3e8878c6 3e8cd8de 3e8e2e2a 3e94d92d 3e994185
  3e9f1e43 3eabec7f 3eb535bd 3ebdd124 3ed32341 3edb0a8b 3edb45ab 3ee0581e
  3ee5b0ca 3ef3df41 3efd774e 3f0659ad 3f0f2c44 3f15c935 3f294fd7 3f2d1b53
  3f3beb1c 3f4a9e13 3f54eb11 3f6deb68 3f79fd40 3f7bfa0d 3f82f2a3 3f89350e
  3f8b09b1 3f8f9f5e 3fa620a6 3faa5fd6 3fb90d29 3fc191d4 3fc4cb14 3fd15149
  3fd5811c 3fdd4318 3fe7296a 3fee0385 4002700e 4017d8dd 4022cd40 40343417
  403bea38 403d9c92 4046907a 404f2158 4059dcfc 4060df4f 406320a7 4070d810
  40798c0e 4085a46f 4097356f 40b024ad 40b26761 40bd6bb3 40d2da2a 40d8c23d
  40dd1699 40e4c879 40e6165a 40f65c13 40f75cc4 4105a89b 41206676 41238db2
  41359d52 414d946c 415b9fff 415ea205 41700675 41777f57 4196fd8f 419a8c4c
  41b8d73e 41c74c71 41ce62bc 41d6d5bf 41dcbc5e 41f66b3a 4203ecc1 42096c7c
  42108f20 423eb078 423f4c3a 42550b4c 42645270 427be03d 42826145 42942db4
  42a12d03 42a150ae 42afdaf4 42c1e3f4 42d5fb37 42ff1611 4327acff 43307548
  4341fa3c 434da29a 4370e1e8 437faca2 438c06ea 43a3feb9 43adcf9d 43aebb9d
  43b482b0 43b723f4 43c9cc07 43d6267a 43f30889 44029c47 440c899e 44168abc
  44258993 442cfdc9 4431756f 444573ab 444716db 445d0f53 447c2ce3 447ebce3
  44875220 448b02d3 4491edeb 44a78211 44d21e2d 44f98fe8 44fcff21 450d8dea
  4511a8f2 4517f8a9 4553ba66 457882a6 4584dd70 4589c041 458acded 4593777f
  45ba7722 45bab8e2 45cd4f35 45d961f7 45f4bd63 45f80e60 45fe382c 46172742
  46172ddb 461c63c2 46267538 46318822 463273e1 463405de 4636435d 4660e8e6
  46663054 466ff409 46756012 46841163 468f4c41 4699472b 46a1c8e4 46b143b6
  46b20dc2 46bbd511 46be7e40 46bea115 46c5f9fe 46c73004 46c7e042 46c85c4e
  46e03671 46e274dd 46e57efc 46e58116 46f89ce3 46fb2d30 46fc4990 46fcaee6
  470814fa 472fb75f 47361a61 473d5b7d 47562126 4774d0d8 4776a8a6 47841140
  478a021a 4792bf63 47c62585 47f099b8 47f6efdf 4802e955 4802f18c 4845fb66
  484bd4de 48739790 489163bd 489cf5cd 48a5cb33 48a7fa88 48b4b101 48bb1154
  48d7b4a2 48dd981a 48e73a85 48edd44a 48f24c0c 48f68f5e 48fdcf6b 48fea767
  48ffb515 4900a4c2 491b256a 491eebe7 49201598 4942bf42 49449c73 4955867c
  495fd80a 49600381 4990ad1b 4998e2a6 49a9ed34 49c1309a 49d42ea1 49e3772e
  49f1c7f1 4a0152e2 4a06d11f 4a091bdb 4a0dbf1d 4a140658 4a224ec1 4a2fab13
  4a457ef7 4a48b50a 4a4f94dd 4a527076 4a6e0611 4a77f819 4a981297 4ab36133
  4ac0a971 4ac89dbb 4ad272a1 4ad62b6f 4ad7dec4 4af00ed3 4afca4e5 4b03b023
  4b100798 4b12926b 4b13e217 4b1fbd41 4b25477d 4b2c425f 4b2d2f48 4b327e09
  4b3e4bc4 4b40c975 4b40d0f1 4b683cbb 4b7258f1 4b80f08c 4b9d3f79 4bac2989
  4bf5d654 4c0311db 4c0dd38b 4c141ed8 4c1de6a3 4c2204ec 4c28ee8c 4c2ac631
  4c313caf 4c37dd74 4c39ba6b 4c46e167 4c6f5ee9 4c7580ba 4c83b7f3 4ca0cb54
  4cae2440 4cb4fa80 4cbb2f60 4cbde71f 4cc86d32 4cc9b9b3 4ccefe23 4cd21d40
  4ce5d51b 4cedfe01 4ceeb938 4cefa5f2 4cf58e08 4d1047b3 4d10a905 4d17c5b3
  4d18c65c 4d285f6b 4d4c776f 4d580765 4d5f76ba 4d70accb 4d738323 4d76eed6
  4d9102a5 4d9d915b 4da09cb0 4da41faf 4daa3d33 4dbff876 4dc70881 4dc81f0f
  4dd61dc5 4ddb5d5a 4dded44f 4ddf6fcc 4df30bab 4df4c23b 4df842f8 4e027106
  4e06a51d 4e0fa420 4e19c442 4e223cb8 4e254339 4e45be1c 4e4db706 4e5e7262
  4e74a528 4e7c8b18 4ea1d85b 4eb0ffde 4eb586c1 4eca997a 4ed4dbb3 4ed6950f
  4ee995be 4efd5454 4f19fd94 4f26e2e6 4f5d82c7 4f5ff63c 4f6178aa 4f61de87
  4f68a6a6 4f6bb6ca 4f7035c9 4f828164 4f8ee9c9 4f9f019f 4fa1d27c 4fb39e88
  4fc8729e 4fed5a33 4ffb5106 5005ac91 500697df 5008db1c 50147c66 5032ea34
  5038473c 503fef39 5042acf6 5055417c 505cabb4 505d99d4 507c2693 5084fad3
  509e6ea6 50a3f269 50a40dc8 50ad89ea 50b99594 50bdadf4 50c7d482 50cfe1ae
  50d3c791 50d3eab6 50edf288 510d2b43 51239723 5124ab79 512d7874 5139a947
  5143a1ac 51526a36 515cccc4 5177b072 5179280f 51808fc7 518343d9 5192aedb
  5193bce4 5199039a 51ca1901 51d1e4bf 51f3fa05 5201a8b2 521d147c 5227331b
  52454eb3 525b84a5 525c9fb4 525ea249 525fbdec 5267cc89 526d4250 527e670c
  5287113f 5294d920 52ba6c0c 52bbbfd3 52c1f691 52c28e37 52ce5d74 52da1b2a
  52f5d1da 52fcaec6 531d9b8d 532179fe 5327a64c 532b1030 533fcc9e 5361f88e
  5366e0f8 53801720 538f69ba 53940185 5396161d 539a2944 53a9f457 53adf6e0
  53ba3bae 53c878ea 53c91a11 53ce1130 53e90662 53faae07 5404970a 54072ecc
  54090e95 541edbc9 5427111b 54354174 543c8a39 54438271 54621634 54736b51
  5473f933 54745ec5 54747cf2 547b0891 5483297a 548cb078 548d9ee7 54b57fd4
  54c317e8 54c7f871 54caecf3 54ccda66 54cd35ed 54cd3af5 54d686a6 54ee7645
  54fec0ea 55094b50 550c342a 55104452 5514a6fd 551680d2 55195201 551c3693
  554a06f1 555803bd 555b1e14 555f34c9 55647bea 5582a7b6 55877c16 55929d4f
  5595a3e1 5599714c 559dcabd 55bb38d1 55c778cd 55ccaeb6 55ccc3ea 55da5420
  55dbd446 55fb3ff6 5605d45e 5607d40b 560c1c2a 560e3d87 561c951a 5624a8aa
  56441240 56572e30 565898d0 566418e2 566dfebe 56802f71 56823ac4 56846d26
  569f301e 56a5f828 56abce6e 56be2f3f 56dfcb38 56ed3e1b 5709662b 570fc0c7
  5721a6ad 57252c54 5729e688 572be4e0 572e92b1 573ed56a 574be564 57574a73
  575a07fc 575c7b6c 576da194 579322c6 57c3e049 57c659b8 57cf1bf6 57e0b651
  57e4c0c1 57e9e1fc 57ef4f6b 57f17aeb 57f47146 57f542f7 57fc9794 581f2431
  5823509d 5825ab9b 58265629 5826d2da 582a4996 582abfb6 5840a28d 584748ff
  584c60b2 585b5952 5876f56b 58777809 587d1959 589a9dc9 589d95f9 58a4d06d
  58ad8dbe 58b03722 58b58708 58bb65ad 58bc8890 58bf25a3 58c06043 58fe1cef
  5903f571 59170f9b 592631f2 5926e1f3 592a5caa 592d547a 592f4e7c 593d6792
  59491455 595037e1 59752ec0 597a36bd 5981193d 598ac535 5997906c 59c89640
  59f37275 59f4d8e9 59f556b4 59f63f9e 59f8f135 5a032546 5a089830 5a10ef8f
  5a28a0ea 5a3422a1 5a4020e3 5a4fb950 5a63a322 5a6830bc 5a783b17 5a7a9aea
  5a7efc3e 5a8d508a 5a9cc66a 5aa460f1 5aa5c2df 5aad5579 5aaddc1c 5aaf055a
  5ac8886e 5ac9ee19 5ad133a5 5ad628b3 5afa25d3 5b043dad 5b18495b 5b190971
  5b3272a3 5b340ffc 5b39fbf5 5b414fb3 5b43599b 5b4368ac 5b6dfaf0 5b7be63c
  5b825c48 5b893281 5b89d052 5b8fbff1 5b94718f 5baac8ab 5bbc3268 5bc86a37
  5bf57212 5bfdd9d4 5c1e31dc 5c28b0a9 5c35821c 5c3b0a27 5c546ac7 5c5537e1
  5c58aee7 5c58fd18 5c5e8dd2 5c6cf1b6 5c7cf7e7 5c7e1712 5c80fd0a 5c8c4368
  5c8f87ae 5c8f8977 5c8fc710 5c96460c 5c98e1d5 5c99c2f3 5cc00284 5cd085ea
  5cdc10e0 5ce0c39f 5ce2162c 5cec0913 5cf6d018 5cf9bdb7 5cfd685c 5d048cdb
  5d0e59da 5d2758cd 5d27824b 5d299d42 5d65b1dc 5d766443 5d773282 5d7b16c0
  5d7bd65d 5d7e32e9 5d8b44cd 5d8f103c 5da139c7 5da9faed 5db2f241 5dc20403
  5dcd801b 5dd1b527 5dda63d3 5ddbbc76 5df407e8 5e108423 5e145755 5e177e60
  5e211f7c 5e22e3c5 5e2bff9c 5e2c1112 5e3c8654 5e3d2524 5e4c9f3e 5e62249c
  5e83a9dd 5ea055a8 5ea15499 5ecfec50 5ed50010 5edf610e 5ee20a95 5ee946a1
  5ef1aeb7 5ef320a1 5f0716bb 5f30a6fc 5f51ca03 5f561493 5f5c8622 5f68c927
  5f74f93d 5fa138c1 5fa1d4c8 5fa50abe 5fab0cd2 5fb08eb5 5fe292fa 5ffdb023
  60014c54 600781b2 6019f9b7 6026b7ad 6050102c 60630923 60761746 60826b10
  6093a4b3 60973623 609c6b9b 60a400cf 60ab2b58 60b8a049 60d1e88e 60d9640e
  60e399d0 610c966c 6117705d 6124f66f 61258036 612a6f5f 613b91b0 61595c42
  617580fe 618e6c58 61ad2bce 61af9c6b 61b02a32 61b303e7 61b5990e 61b8165a
  61bdf0dd 61cfae7f 61e059a3 61e17ebc 6203a945 620a5e54 621026e4 6215fb93
  621da24a 62207c32 623a2de4 623fda3c 6253fb0e 6256cc96 6258d23a 6285cd15
  6296dc60 62bb9026 62c3956b 62c460b3 62cdfb9b 62d03e1e 62e5db79 62e97ae1
  62e9a687 62eaa3a2 62f31d32 62f42d82 62f65396 62fa49f1 63022c72 63059513
  6314d8f6 631bb65d 632060c8 632c56ca 63326f71 63435ea4 635099e7 63551681
  635b398e 636b053a 63a7697d 63ae4f76 63aec070 63c87fd7 63cfeec7 63f67f51
  64137d17 641d91c8 642986ab 64337210 643c23b4 644d0682 644f9ece 645152e3
  64529a9a 645ff47c 64613a36 64671f7c 646b4dc5 64729410 6479e6c5 648864e3
  64974e32 64a4b04d 64a8349f 64aadbe3 64ad4e56 64b1f8a9 64bb0e43 64d073bb
  64db5453 64df80f3 64efb425 6512b4f4 6521984a 6554c082 655597b1 65561352
  6568e158 65778498 658634f2 658ec5cf 65915d05 65b53082 65c4899f 65d502ec
  65d57328 65d6af73 65ec3f3c 65ed2223 65f6e587 65f731a4 661b39ea 661e10e7
  662b8767 663a8b02 663c1141 664b5b68 664beccf 665ce34e 66650d18 666aa5be
  666d87ca 6676332e 66854064 668eb647 66909fe0 66a30407 66cc497d 66cf5f32
  66d4574c 66e02771 66ed6f3a 66f2cf3a 66f7a3d7 66fd64ba 670181bd 670b849d
  67195325 673fcb87 674b32ff 674f29ba 676470fc 67696a57 6779f945 677fd856
  679d596f 67ae8d61 67d4a4ad 67d9dc9c 67db4184 67df7b2e 67eac6d4 67f185b9
  67f27cf4 67f49889 67f99e78 67f9b6dc 68011d26 6807434c 6813f0e1 6817054f
  6823b3a1 6825cda5 682a466d 683900e6 683e6e37 684e502e 6865fb3c 686c6766
  686f3c5e 6875beb9 6877099c 6897e0ff 689cbaed 689e2786 68a1f798 68a69d46
  68a96b95 68a9c675 68aeb341 68b7f91f 68c3e891 68e1366f 68edb6bc 68f0e974
  68f38468 690eafa1 691503c2 69167da4 691e8ed0 693049ea 6932b83f 6969e13f
  6970edcc 69724a6f 697785e0 6999761b 699e0c9c 69b582dd 69c3d3ed 69da0f4c
  69da1dbf 6a0f8869 6a1e8547 6a2b6b29 6a2f2e2a 6a3c483d 6a4fb61e 6a5532fe
  6a908add 6a925d0a 6a9a486a 6ab479f4 6ab7af70 6ab989e7 6ae092f2 6aecf5a6
  6b01b6c0 6b13d114 6b1b1505 6b2a944d 6b3908c1 6b535bf5 6b56204c 6b65c631
  6b7bf74d 6b7f1ed9 6b85355b 6b9ba94d 6b9d690f 6bb77900 6bc635a6 6bcb7a46
  6bd39529 6bdac00b 6bf21a4b 6bf762ba 6bff8d9e 6c131bfd 6c4d64f0 6c59c0eb
  6c790140 6c83ff7b 6c98d246 6ca6f1a0 6cb81651 6cb9b097 6cbab1f4 6cc09215
  6cf3d099 6d0588f7 6d0c63f1 6d2ce8b1 6d39ce24 6d3a486d 6d3c0ef6 6d4af17e
  6d4e0028 6d6b44b4 6d72ab26 6d84b477 6d8f41d5 6da8f891 6db219f5 6dcf0e39
  6dd97aa0 6ddfefc1 6df15abe 6df25c87 6df96123 6e14c1e8 6e1dff17 6e44214f
  6e4b5bf1 6e5192d3 6e551a24 6e65d885 6e6d06be 6e7f0eb2 6e85d385 6e870aaa
  6e8b4f35 6e956991 6ea62c2e 6ed576a4 6ed6caa6 6ee69254 6efa2e49 6efa70c8
  6f0a22c3 6f14f880 6f2a275e 6f2a5f5c 6f2fe690 6f45d6b5 6f49d8af 6f4b7e66
  6f533993 6f5877f5 6f5ddf9b 6f6f7881 6f7d5a31 6f9830df 6f996ab5 6fcdb266
  6fe0c5a4 6fe2979f 6fe4f87f 6fe7a75b 6ffdd2a1 7024b29e 7033930d 7034a855
  705814cd 7077a168 70857982 70865717 70872dff 708c082d 7097377f 709cf281
  70bcb3a3 70be8c31 70e6ebbd 70ef1ccd 71019f8f 7114b373 71299621 7140944b
  714b1d34 715066f1 715236bd 715d5e6e 715f56b2 719d9e7d 719f0f6e 71a18491
  71b5faa9 71d7ca2d 71d93246 71e73ad3 71ec8973 71f205e3 71f254e7 721b1669
  721df6de 722f5df3 7232d329 723d5c8b 724e6530 72598807 7275117d 72862e89
  72942945 72985d29 72a22a41 72a4a3d7 72adc908 72b9ab41 72be7ac0 72c23d87
  72c8fb84 72cd66a8 72e47ae9 73005e8c 730415cb 730a59c2 7319b7e3 733a77b9
  7343a8d3 7352b34e 735c1d74 7360f9c8 7362731d 736c99f2 73814a18 7385b727
  7386d024 73870355 739c8881 73b9fa6e 73cfb3a3 73de7a58 73e44c38 73e9ca7f
  73f555f1 73f5aa90 73fc6706 7400a1b4 740bd06f 7416853f 74323198 744425f4
  747974ea 74a61f08 74a94d4a 74aab25d 74ab995f 74ae4e0f 74afb652 74babb62
  74bd379f 74ca0372 74d3cfec 74fdbb72 7503cd86 75048f12 75059bb2 75219caf
  75268e85 75295835 752ef72b 7530c2d5 75381782 7545e34a 75513c78 7559db63
  75608795 75691297 7569dd74 756a301c 757c0c61 757eea4f 75803c95 7582d577
  75835c97 75877c21 75993ea4 75a114ab 75a7d4ef 75bfcdd8 75c34520 75e34334
  75e36e3b 75e64480 75f402f8 75fbbeea 76038ffa 7618f492 7632246a 76505c9f
  7665f6e0 7666d668 76686ea4 766d623c 76841a17 768d619a 769a4efa 769cb621
  76a4759e 76da9640 76e58688 76f97de3 76fef150 7706e75f 77092010 771351b8
  773ae0fc 7743f048 774c4e5b 774d8359 7758b633 775aba34 776aeff6 7770a4cc
  777d6d0a 77841685 778ce6cb 7790f09a 77a1ceba 77abc485 77b762bb 77c28354
  77d2a233 77d3f1df 77e55554 77e71192 77f5ace0 78005fa2 780b006e 780f4c9b
  780fc8cb 783facac 7851f655 785b7e56 785c52ca 785f90f3 78602c7d 786261a7
  786ff354 7871435b 78833c56 7883b6e8 789a3a56 78c31798 78c32588 78dd08b4
  78f9ff6f 78feecfc 790eb40e 7919acca 792a649b 792dfc43 7936d622 793a0e40
  794204a0 7948c711 794c5270 79525d56 7954a89b 7959eefb 796ec478 799efa98
  799fafa6 79ae1b2b 79bbe710 79db501b 79eb16fa 7a0009a4 7a026ba3 7a0cd34e
  7a0e7e1f 7a1c0b96 7a2585a7 7a2607ba 7a275764 7a2ac739 7a2f5331 7a3388eb
  7a34a29f 7a3d8a31 7a42f08f 7a46fd9e 7a57f874 7a5ee49d 7a68f9e5 7a700095
  7a7098c0 7a70f663 7a780a90 7a7b424c 7aaf0081 7abaa03b 7abf6a48 7ac7d56e
  7ada3506 7adcb2d1 7add8aa9 7af67e5d 7b003f98 7b221281 7b2539ba 7b31fb42
  7b3b0052 7b5b8200 7b654c94 7b8e1d21 7ba6d3f3 7baa1032 7bc07d5e 7bc9402f
  7bd2f628 7bd83878 7be5bd87 7c02733d 7c07fd43 7c23f952 7c25a064 7c345b51
  7c3cf493 7c5248ad 7c5b54f7 7c68ce98 7c820c6e 7c8ef218 7c92f4ed 7cbb2a2c
  7ccba07d 7ccc3846 7cde3788 7ce79055 7ce850c6 7cf27df4 7cf35371 7d12c4ca
  7d1f0f08 7d276374 7d2cdcc6 7d49aa4a 7d4dea2b 7d5390dc 7d60f25f 7d62f546
  7d6eddb6 7d760a6f 7d76a38a 7d78078a 7d8157a0 7d91e5d6 7d96441b 7d9dbf29
  7d9f3c60 7da1b086 7daa0d74 7db58b7a 7dbf56a7 7dc171d6 7dd58ec3 7de67be6
  7df24e9f 7df43671 7df5d7c3 7df7a32c 7dfadfb8 7e1f28fd 7e3e1307 7e3f8493
  7e564832 7e5f63b5 7e7abac6 7e8bc65b 7eaa2520 7ebe5e8d 7ec2a503 7ec94903
  7edfebb5 7ef10840 7ef412e3 7ef6b4ab 7efd3711 7f00fa42 7f0e19e6 7f126274
  7f1ee771 7f228741 7f306767 7f3d557c 7f3dbd29 7f40930c 7f5673ac 7f604484
  7f6918c1 7f78ce3e 7f792611 7f8aeff6 7fa05b56 7fa0f960 7fa56532 7fb1d200
  7fcf3e87 7fdca7b7 7fea7f52 800d4829 80176c54 801a3fe1 802b14ee 80468b5e
  8048ec2a 8050a707 806fc664 807bbc71 807c3327 8081db62 80839b61 808ae1a9
  8097e041 80ad5b23 80bb0a07 80c6b6a7 80cabd1f 80ce40bb 80d4d536 80d6e270
  80ee0d35 80f6a63e 80fd2de1 8107d941 810a0e5a 810d013f 811200f5 8122eefc
  81294389 813eb629 814b2305 814eef85 8158f6d7 816218cd 8196325e 819c918a
  81a9cd2a 81bc3d9c 81c8afa8 81daf050 81e055f8 82058dba 820cb152 821288bb
  823ca97f 8248c468 8251e94a 8256b2ce 825ad7b4 825e9598 82694cbc 82925991
  829851a4 82a2eae4 82a3be15 82a9abe8 82b930bd 82beaab5 82c135f9 82c5c915
  82d444a2 82d5e04b 82db3bb3 82faaab5 82fc5e2d 83134020 8315a6a2 831afbd3
  8336855d 8348b848 835842df 835a9bb1 836c223d 836e4590 83722cf1 83785c4e
  8386e2c5 838d9a4f 8390ff88 83925bbe 83955638 83985faf 839c2568 83a1b29e
  83b50fcc 83cc43ba 83e15115 83e2870a 83f8a550 840027fc 8420c304 84215085
  8421c41f 843649da 843a9d32 843ad3b5 843d2a60 844048c7 844699bb 845460a4
  84710a09 84784763 84a153dc 84c63fbb 84f66937 84f803db 8503729d 8516e93e
  8529d834 853cbf09 853ee613 855fce15 8562683d 8571dd87 85757861 859039cf
  859a3319 85a20dc1 85a5a8de 85b67e98 85bdcef8 85ca5375 85da7e46 85dd9818
  85e33740 85e89a0f 86041af5 86087227 86111008 861ce249 86206828 862b167d
  862ca26a 862e6de5 8636f935 8645997c 865f9b7e 866405f0 86673d5a 867606de
  8678098e 868d1cd5 8692e8a3 86a175ed 86aaaec9 86b6e51f 86b8c3e5 86bdafef
  86d4f728 86dea9f6 86ea1683 86ee7b42 86f29b12 86f9dcb9 871be8ab 871ea35e
  873f1491 874d9d0e 87632612 876a8d36 876c7c7a 876df581 87b01405 87b5e6c6
  87be405a 87c8538e 87caccd1 87d24f87 87d7a9c4 87dc30af 87df3ea1 87e38791
  87edc41e 880fb81e 88163fbf 8818cd4f 881c5214 88234b5f 882da927 883dbcb0
  884516d6 884a5ac5 8853a489 8859f4eb 8866ac0b 886ea88d 88804d36 88829b50
  8884b466 889b52f4 88a7e559 88aaed32 88ab3748 88ba01ea 88c1e052 88c8424f
  88cd273b 88ce08f0 88d0c2a2 88da8990 88e8e910 88f16d13 88f5daec 8911a829
  89223fbc 892c6165 892e4405 892f506c 8933dd58 895e5a2d 89741c67 897d1b21
  897ff3d1 8984a737 898c48a8 898f831f 89920cbc 8992b35a 8998190f 89b3d255
  89c8c1d7 89ca4e81 89d51ccc 89e5fd7b 89e7b6ad 89f660e3 8a067558 8a118028
  8a261aee 8a30096b 8a3aa9d2 8a72b5b7 8a81cd96 8a8c3b6b 8a9f29c7 8ac55c3a
  8acbf931 8ad09f87 8ad138bd 8adaf516 8adcfed1 8b12fbae 8b20b316 8b28c6ba
  8b33df6e 8b34d211 8b3aa089 8b451021 8b6e6fd3 8b71ae76 8b76e37e 8b78c74f
  8bb02082 8bd8c629 8bd9934b 8bdde430 8be575bd 8bee5917 8bffbc3e 8c08bbc6
  8c09e1d0 8c12163c 8c16d91f 8c1d092a 8c342342 8c4a4417 8c4aaf15 8c726f02
  8c8a1bf9 8c932862 8cc2d5ec 8ccbc0a9 8ccf3047 8cd81ac0 8cde2be6 8ce314dc
  8cecb507 8d049481 8d063b3c 8d118fcc 8d1240e9 8d2298c4 8d27ccc3 8d2991b7
  8d3edf8b 8d5652d5 8d617a56 8d772313 8d84138c 8d8755b4 8d97b182 8d987f3d
  8daabe15 8daf8a92 8dba18a5 8dba425b 8dc3e0c8 8dcd1e56 8de23335 8dfd5379
  8e047b58 8e04ff04 8e050e5b 8e05d088 8e12e007 8e1a5830 8e28edb7 8e310ba9
  8e327667 8e42629f 8e500e03 8e540be1 8e5413eb 8e601585 8e619f9e 8e645f4a
  8e6c94ef 8e7a35ed 8e8348f2 8e846a40 8e8e5cdd 8e9a9fdf 8ea2f2db 8eb40a3f
  8ebe8614 8ebfdf67 8ec47fde 8eef95aa 8ef09176 8efda623 8f00a8ca 8f09fb03
  8f122f82 8f1aa373 8f2f8eeb 8f45432e 8f5c9382 8f5dfd8f 8f6003ca 8f6c3bdb
  8f72ea2d 8f769bd4 8f811c26 8f8a6df6 8f8f96ba 8f908507 8f92e361 8f949cf9
  8f94c4d6 8f9b76d5 8fa26b78 8fbb7982 8fd6e018 8fd893fa 8fe9c351 8feb1b28
  8ff30453 90046d2c 900b8e1b 9019729e 901a739e 9026b6c6 90309cec 903a5928
  903ead95 90497c1b 9068c41d 906cc385 906ee4c4 90715923 9073b75e 9088d945
  908a8e69 9096e726 90c17410 90d3a4cb 90e49872 910b2417 9113ef50 911a75bc
  91550ee0 9159934e 9164231c 9167eb61 916b51bf 91786861 9183225a 91a84d1e
  91caad5a 91ddd73e 91e1cd8d 91f439c7 921013a3 9211e9c0 921e6e74 9225e4b7
  922af90f 92488abf 924b9de2 92501f0e 9250f805 92511252 9269b406 92849e8c
  929d26c3 92b2b21a 92d4b91e 93098661 930a4195 930c6671 9316e058 931fca49
  9336db15 933c0558 9356dbbb 935ae69a 93841d62 93902323 939f2a21 93ad3bcb
  93b06a37 93b2d162 93bb8d7f 93d01a03 93d3e65a 93e319ab 93fac745 93fb0d57
  9405c180 941b8b8a 942a3b5f 9441a3af 9445859e 9460a7cd 94611b51 94645fa5
  946f611c 94745d52 948bbc0a 948fbe6d 94978df0 949a324f 949ad9e1 94a00941
  94a6184e 94b68442 94c2a71f 94d136fc 94ea05e7 94f14a19 951b23af 953aca59
  9542bd46 95459827 956b9e4e 95788c11 95859cf0 95b52821 95ba10e9 95ba60ab
  95bac8bf 95ca3ce1 95e326ab 95e56eb1 95e9bd9f 95ea3cf4 95ec1b52 96139154
  962b3965 963986ba 9649ff87 9654eb21 965d39c7 965ff6ab 9667cbba 966fde43
  96766cfb 968370d7 9692aef9 9696b736 96a5555f 96d7ebad 96e851ba 96efe4b5
  96f73672 970ab378 97299b03 972bcd1b 9734ce41 9748b767 97525387 97559818
  9755f0c8 97662adf 97750172 9786a42e 979a06ae 97acb667 97af3ee3 97b237c4
  97b5411b 97b77707 97bf5bc2 97c23eca 97c45933 97ce3abd 97fa3846 98090b5f
  980d4756 980f309d 9817a708 981beb55 981d3b58 98217aef 9822b745 98371332
  98419122 986baf55 986f1a45 987f657b 988857c2 989020f7 9895ed16 98966a68
  989816c0 989ed9eb 98a11df2 98afc2d0 98bc7c12 98bf6a39 98d1337f 98d8de45
  98f669f5 99043e76 9912f34f 9920cd1d 9921289b 9927cbd6 9945ef8e 994a453b
  994f0bff 9960bb0e 9981c5a6 99824abd 9998ea12 999f7f62 99c96ae8 99eb1fdb
  99f2efa7 9a124086 9a4c37a2 9a843b72 9abc477c 9ad442c0 9ae32063 9af0fba5
  9af3c0da 9b034ca5 9b0f5d21 9b2f3f70 9b3743c3 9b43206e 9b60c6b9 9b7f2d03
  9b8fe158 9b9a4094 9bbe3912 9bd9e7a6 9bfc2194 9bfccbde 9bfed9df 9c025cd2
  9c0bac9f 9c218b8a 9c33377b 9c341319 9c39894e 9c49d1f7 9c5adf5c 9c5d10f2
  9c5f9af4 9c609633 9c6b2bc7 9c6be02f 9c899037 9c8ffd4b 9c97e35f 9ca7901e
  9caa2b50 9ccd6a91 9cd0898c 9ce366a3 9ce5fbd2 9d1a1913 9d1a5874 9d2334da
  9d38e4b7 9d3d4111 9d42e54f 9d445c8c 9d4a1275 9d4f6fd3 9d4fe9b1 9d6b24e9
  9d716bd2 9d78c3c0 9db2c554 9dcf542a 9de93c67 9e17a925 9e2137f4 9e2bcb61
  9e34ace2 9e37cf71 9e3bfa79 9e3e573c 9e422010 9e442bc1 9e48b050 9e536c4a
  9e6b195d 9e6c414a 9e717cb3 9e8bfb2c 9e9c3008 9e9cab06 9ea5c10a 9ecdd3ba
  9ed010bf 9ed06120 9ed7dae5 9ed9f8f5 9ee656a4 9eebedbb 9f00572f 9f022f6c
  9f0bf8ea 9f0da81b 9f19c1b4 9f214824 9f2b20d5 9f37e1b0 9f404ee1 9f5cf1a1
  9f6779c4 9f6d67c6 9f77a4c3 9f77feec 9f79f79d 9f7c3755 9f7ce565 9f82fa82
  9f95bc3a 9f9e6802 9fb3e4a4 9fb5e59c 9fbc7d06 9fc7bf3a 9fcdddd8 9fcf12f7
  9fd4eaad 9fdb8b3f 9fe2838a 9ffc799b a0081a05 a00ef59b a01e493b a04f331e
  a060a453 a0655673 a0783bb0 a083e928 a0891717 a08a9c72 a08add56 a0a224cf
  a0b52fe5 a0b8b4e1 a0c2faf5 a0ca3f28 a0cf12e1 a0d9596f a0da001e a0ef31b5
  a0f5125d a0fffd67 a1049201 a1071b31 a1119a90 a1518c97 a170132f a1825292
  a1a6812c a1be66b0 a1c3dc8c a1d34323 a1db4ec2 a1edc518 a1f84400 a20e5b8d
  a2104b15 a218bae6 a219d90c a21ae8f5 a224354c a22ad7f9 a23cc63d a2408d10
  a24713ca a24a61d5 a2526564 a256b4f0 a26fe254 a280a893 a28669d1 a2a19679
  a2ad5501 a2b41a6f a2cd4312 a2d7d9e2 a2e319e1 a2f01082 a2f420b6 a3104466
  a31249d4 a3133544 a3194b97 a321367c a36dc2fb a36ff08a a3713344 a3856807
  a390d190 a3ada28f a3ae8d2b a3b27849 a3b68450 a3b7ceba a3c537a5 a3dda37a
  a4064ee3 a40dc84d a41317ca a41d9026 a43240b1 a4398cb8 a43edcb9 a444b318
  a45fda89 a47fd5f0 a48288fa a486ea9f a4a7cb0c a4ae806a a4c47016 a4db464d
  a4e02fa6 a4e8f4e7 a4f7b4bb a4fea8ce a5116ddd a52012df a52c94ff a53eca61
  a551a2a5 a55ac2e2 a5692252 a56ec486 a59b0886 a59d67e8 a5b781a1 a5b85d55
  a5d2244b a5d83c57 a5e463c9 a5ea4b5e a5ec7315 a6055e66 a605b562 a60d5194
  a619adee a62dbaae a63e5d73 a65a3f9d a65dafab a65ee9ce a6610664 a66a3a1a
  a66dabec a671412b a68544f6 a68e948c a6936d4b a6bd4eed a6dff3b5 a70526a1
  a713020d a7192488 a7285622 a728decd a72cd28d a745f4f2 a748b264 a75fc750
  a7761ccd a77bac87 a79ce39a a7a2b1a1 a7a5a556 a7a8f5c7 a7b9d7e9 a7bf3dfa
  a7bfc768 a7c0a71f a7d307da a7df01a1 a7e819a9 a7ed9dd3 a7f37490 a813c5a0
  a81bbc7d a81e7757 a81f5302 a83b2759 a8464f3d a85026be a86185e5 a865564f
  a87449ad a87c1d87 a8835774 a88abb9d a892ffdb a8abfeb3 a8afcf43 a8b3e861
  a8be24a1 a8d1299a a8d44cf9 a8ed4e08 a8f4cef9 a90fb04c a910c5ae a9132a3e
  a913dc86 a91ebef4 a92719ea a92ffd7b a93b215f a948f606 a95c02a2 a960c437
  a97481a2 a97ab0cf a97d0abe a980e24e a98e6238 a9971170 a99bc6a9 a9ad5e80
  a9b921e9 a9c8b1f6 a9debb23 a9e1b622 aa04a9da aa05eba3 aa0ff6e7 aa1f709b
  aa23e380 aa36f8a0 aa4cdf85 aa4f5d62 aa596305 aa60c623 aa7ecd37 aa80624a
  aa934d93 aa9b72da aad1152d aad73a2c aae2eeef aae76232 aaef1b97 aaf28021
  aaff27d6 ab02b7fe ab04773c ab060e0d ab0a500b ab16abb4 ab18c4b0 ab38d4fe
  ab3b29d5 ab4771f5 ab497217 ab6596e6 ab660359 ab7da145 ab7ed94f ab8fccc5
  ab9407b1 ab994e09 ab9b08e0 aba87039 abac6344 abe23d85 abec3044 abf1f61a
  ac004327 ac02fea8 ac13652e ac205c4a ac2d6ba5 ac2d9e49 ac35b265 ac54b2b3
  ac60014f ac7440b0 ac9e1c9a accee7a1 acdd0aef acdfb2cc acf3ac15 acff5b79
  ad055f0f ad196717 ad1fe7ed ad2c1e6e ad46d1a5 ad590a54 ad6257c5 ad642e63
  ad65ad94 ad66dd9e ad6a74ab ad6da7f7 ad7ec26d ad8023fc ad89e206 ad97a693
  ada2118c add5ce01 ade42ef1 adf8cc3b adf92be3 ae0418aa ae082f60 ae0d97dd
  ae3744f0 ae481589 ae488561 ae52d47d ae56d891 ae67b71c ae681f29 ae778f58
  ae8f5b78 ae928e7c ae95e8ae aea440f7 aea4c05b aea502eb aeac1496 aeacca3f
  aeb42173 aebaf5c6 aee0dae6 aee91a75 aef2f814 aef9dde9 aefde5b6 af332f0e
  af4f54c9 af5e0dad af601696 af705732 af70bbcb af7cd1f0 af8763ee af8f01dd
  af9f6dde af9f9e81 afb61d09 afb9b515 afbd7df9 afc17fc6 afcaa047 afccea48
  afceff5d afdc05d0 afdcc19a afe8b1c0 aff150ca b0138447 b01e80d8 b021cb53
  b02c474e b032438b b058d4e6 b05f182c b0752631 b078e56e b082e434 b08bf6b9
  b093b7e0 b0992243 b0a9b96e b0ad6c62 b0aee0fd b0cb0587 b0cb69a8 b0d6fbc6
  b0de5c1e b0de9d27 b0f16949 b103c3de b106fb2e b109ca22 b11b0922 b125eab1
  b12a05c5 b13ec2cb b14105c5 b1422f13 b1451dbc b1534fb6 b15e1459 b169a986
  b1740733 b174eeb3 b1895217 b197ebb9 b1b1da86 b1cc9152 b1d3658d b1e45f46
  b1ed9bb0 b1f02026 b1f1596f b1f60b77 b1fd11b0 b20f9a41 b23abe77 b243e02c
  b24fdc78 b2648f17 b278c44c b2941b28 b2c0061a b2d1c134 b2d39dcc b2d4afe9
  b2dbf420 b2f22429 b2f780d2 b2fa69af b30af216 b31df80a b3223a28 b34814fc
  b3576b6a b3666a37 b379bc4f b37f8356 b385a7c3 b388f032 b38dc6a9 b39fba21
  b3a8dcb3 b3ad7a08 b3b155b6 b3b211e6 b3b4c088 b3b600e1 b3cb9b07 b3d07e64
  b3d8efbc b403d9cf b4265afb b426bde8 b4335ce2 b443f98d b44a26e2 b44fdebc
  b4526e91 b45602ed b463a028 b46748c2 b46bc91c b47ae35e b47d7882 b47dec04
  b481a6f2 b48ddf51 b49bc7e1 b4a4b8d1 b4b20338 b4b488e0 b4b4e894 b4b9c30b
  b4c59991 b4d3e993 b4d41a23 b507321a b50b1dff b50bd7ee b50eb408 b512c0d0
  b51d429f b52c8066 b52ecafa b52fd234 b538a846 b547e87d b5595f92 b56a4cdc
  b5a2c2cc b5abd76a b5ad45ba b5c990a7 b5d83acc b5dbd70e b5e2aa00 b5f0e989
  b5f9bfd1 b6216f06 b62c1eec b638a4a5 b63a7882 b63fd198 b64a9071 b64db29e
  b683652c b6984020 b6a4a975 b6a5a067 b6a94414 b6ad96ce b6bb8239 b6bc7c08
  b6cf05df b6dcfa1e b6efc403 b6f574f4 b71dd295 b72ae654 b72d1115 b72e8825
  b738b3f3 b74c1b8a b7646fd9 b76bfdff b784ea56 b78f13ec b79207cf b7979b78
  b79e21be b7a77c7d b7d90101 b7d93480 b7e3483f b7e694a6 b8212222 b82352a0
  b8268402 b82c455f b839e73e b867e992 b86cf0a8 b877d79b b8843f10 b8a0a56b
  b8b96722 b8bc5c2e b8c7bfe3 b8cf671d b8d35254 b8de863e b8f24efd b8f85370
  b90f1777 b911ce78 b91bb8ed b9250797 b927e8b8 b93b361a b948590d b94deb80
  b94e5cdb b94ede24 b951b842 b954c205 b955e87a b957dd43 b9622d56 b962ddb8
  b96dc28e b96f04c0 b96f9fc2 b982c1fa b9b6931a b9bfc8da b9d26d94 b9d39344
  b9dc27cf b9fab486 ba0660dd ba15c1f6 ba2b98ea ba47a4fb ba5d568f ba5f2a22
  ba6907da ba6a3e1f ba6ed49c ba771225 ba7bca21 ba807b7a ba925ed6 ba9ba2fa
  baad5c11 bab144a8 bab79101 babfe995 bac464c2 badb5e37 baee4fd0 baf19115
  baf467ea baf7f6fe bb0144af bb0dafa6 bb0e63fe bb27126a bb31d24c bb41003c
  bb57548c bb57fbb6 bb7ae696 bb8c3ccc bb8c68e6 bb8f1acc bba13569 bba284f0
  bbc4a2b8 bbdb501c bbddcbfe bbe6a17e bc036b01 bc1244c0 bc29c21f bc2f1b9c
  bc445365 bc4dff35 bc58bc65 bc6849b9 bc7ab6ee bc8012bd bcafb59a bcb39483
  bcd28c32 bcd866be bcede99e bd08e02b bd26640b bd2a7bda bd31bff0 bd37772c
  bd3edf27 bd5ee230 bd69908f bd716218 bd77fb1d bd7c886e bd83cc3d bdac6b61
  bdac7799 bdbe2c97 bdc5c88c bdf54711 be091920 be11a073 be13690f be1b97e6
  be1bf4d3 be2083f1 be2b0b2f be2ba8c8 be2c7988 be384b78 be5b6205 be627215
  be714583 be74130b be79c4f6 be8debd9 bedd48ed befb8d59 bf137fa9 bf333e46
  bf3427b6 bf42b50e bf43c0a1 bf5f0a24 bf643975 bf647d7e bf64a463 bf70d1fc
  bf721d67 bf7eeaac bf854a58 bf9706bf bf9e55cb bface17c bfb7bc21 bfbb5d3e
  bfcc5567 bfce6a28 bfd027c1 bfd21808 bfdf941c bff6b8ea bffdf9f5 c00caf87
  c00d2ed7 c00eed25 c011b224 c01d5ecb c0200773 c020c159 c02ed0b3 c0417867
  c048b486 c04af415 c05fe5ff c0661a20 c06cc118 c06e28b1 c06e90b9 c0726ff5
  c07a76f1 c0981318 c09aadac c0acb525 c0b2d532 c0b3cc58 c0c4b9c4 c0c762f9
  c0cdd73a c0dca5ab c0ee792b c0f8acc0 c0fd7186 c1051a9a c12df0e7 c15ac0e6
  c15fce8d c163873d c16e48cf c17e5541 c194619b c1948eda c1987d0d c1ad1017
  c1b45f88 c1b4fc30 c1b83bc9 c1cf8e72 c1d28d00 c2071fe4 c20a648f c216198d
  c22276e2 c223f4c2 c22766bf c227c4ff c22d815e c238b722 c23a4f17 c23b0bfb
  c23f8c44 c24c482c c2512028 c2522923 c25a18db c262a954 c26ca9c6 c273f13b
  c27cb403 c29a9123 c29eb32e c2c0fb8a c2c805c5 c2e03688 c2e120c7 c2f48699
  c2fb5f5c c2fcac5d c30b81f8 c315d885 c31e2928 c328bfea c32903c1 c32f6e8f
  c3469d91 c36cbc31 c377ede6 c3928498 c394b05d c3b56102 c3edbfcd c3f4e8ec
  c4005c3e c40ffc85 c42373ff c4281c6f c4302f7d c4414718 c4525d5a c464d9b4
  c472b4ef c48c5a7f c499c17a c49e5efa c4a0b41c c4ac4e67 c4ad027f c4afc28d
  c4dcca8a c4e486d7 c4e9903d c5059bf0 c508706f c50bd318 c50ce81f c50ed901
  c5101c92 c511ab23 c51a26a4 c51f5075 c52088ab c52a2037 c52ab8ad c53b5e82
  c53d4e80 c53ea5df c540b914 c5684318 c5692ea6 c5709a5a c576f401 c57c640e
  c59b4bee c5a27379 c5a81095 c5aacf3d c5b170f6 c5b30c72 c5b9781d c5c59d8f
  c5eba519 c5f5d435 c5faaf32 c60a19a2 c60a7bd0 c615b0b2 c62421da c62555f0
  c625b1ac c62e5584 c634510f c6439f64 c647c736 c65278b3 c6659f49 c66ce64c
  c680c0dc c68a2ad6 c6af6c97 c6aff5c6 c6b1d36b c6c11005 c6c4254e c6c47c2f
  c6c4dcd8 c6ce476c c6e6685b c6ea9b9d c6fabcbf c72a6729 c73c2d65 c73e9a53
  c7403ed9 c741a630 c7493b58 c765be53 c76e293a c7914bd0 c793d3c0 c7964346
  c7abcf15 c7b1a0e3 c7b6d651 c7b8d6f4 c7c1fbdc c7cc5d45 c7d5f96d c7d68084
  c7f3aa9c c7f9af0b c818d318 c83536f5 c83558cb c83adcda c8459d82 c84829d5
  c858023f c86274d4 c86ca027 c86eb716 c8715539 c871b75e c88d9133 c8920d8d
  c8b46b69 c8b79fff c8c7f6d0 c8dfaec8 c8e0411e c8f77927 c8ff02f4 c908ceb3
  c90b3ef3 c90d716c c926d2f1 c92cff2e c9453f4b c945ed01 c9536b33 c959b68a
  c969dcfa c9755825 c994bbd0 c997eb3c c99b78ce c9a3be60 c9c043b5 c9cf179f
  c9ea9362 ca0a8765 ca18b9e1 ca3b362e ca3cdd17 ca41fdc5 ca451291 ca4b61bc
  ca536d78 ca5ed176 ca676f3e ca79d9e2 ca8277e5 caa427af cab395c3 cab71b91
  cabf74e1 cac18a63 cac558b8 caca80b6 cace6160 caea4f18 caf22797 caf9ede3
  cb0a3888 cb128586 cb2184d9 cb3106a1 cb39a0d2 cb5ba6a7 cb62ba15 cb6b35d2
  cb735d98 cb74acd0 cb799047 cb8667d8 cb910373 cbab1409 cbbd379c cbcefa8e
  cbdac4b9 cbe314b4 cbff1a3e cc085e53 cc0865cb cc099de8 cc245db0 cc25dc91
  cc32a8f4 cc35c136 cc570d9e cc72b44d cc7f3aa9 cc8b1817 cc9f4417 ccb38da0
  ccb7c7aa ccc6de3b ccd64355 cce3cf8a ccea7c3b ccf98290 ccfbbef2 cd03364d
  cd063790 cd077085 cd182682 cd1d38d6 cd1ff0e2 cd29b74b cd2a278b cd3b3093
  cd3e59e5 cd43952a cd5b7d42 cd5d5c93 cd667597 cd7dcec9 cd81be06 cd878a06
  cd8fe289 cda1538c cdaafbb9 cdbe3b27 cdcbdeb9 cdd5ddf2 cdd81b43 cde3b6d4
  cdf4b3e9 cdf923a7 ce07a6b8 ce0fe44f ce379240 ce4fee72 ce5a2bcd ce62a942
  ce6d7e5d cea1bbd6 ceb4c2bf ceb82f74 ceb96020 cec12336 cec5514f cec5c164
  cedc7cdb cef34fc8 cf005de8 cf0698e9 cf16bb4a cf1abf66 cf25b539 cf293e24
  cf342f2a cf4445fe cf4bd3b4 cf539ff6 cf53a0a5 cf5abaca cf603375 cf68e00a
  cf773aa3 cf7a5bf6 cf9bd0a5 cf9d44a5 cfab52c8 cfaea198 cfc48414 cfcadb6f
  cfceff0e cfcf5587 cfd45e36 cfded430 d00767b6 d0194541 d01acf17 d03202ee
  d04284b2 d04cc641 d05a3467 d06f00d9 d0720b78 d0822f1d d0890931 d08c5237
  d0938a7e d0a41fef d0a785ed d0b7b90e d0c18331 d0c9ea1c d0cacc0d d0ccb5ba
  d0cf53cc d0cfcdc4 d0d80212 d0dd25d9 d0e5de3e d0e67275 d0ec052e d10819e1
  d114e295 d120374d d132e154 d13f49ae d17557ba d1781f99 d179f3d0 d1876375
  d1a00435 d1b61e33 d1d6eb9e d2083476 d20a803f d20b9508 d20e533a d21b3993
  d22518f9 d2518f49 d25e560b d263f6c4 d270c6f2 d280d2e4 d284ca8a d2869d57
  d28c3a4b d2a881b7 d2b51085 d2b8d524 d2bc7320 d2c487d7 d2c6e61d d2d33c3a
  d2db8a54 d2e66477 d31169bc d3136203 d32627f0 d32b3652 d335f908 d33e9e28
  d359a5be d35a4bb1 d375bdc2 d37d13d8 d381b1ab d3880ae7 d3b5f126 d3baad35
  d3bdfe6c d3e2e899 d3e35d3f d3f262c8 d3fa7dda d4130ea1 d4145d0d d41d6c12
  d435b776 d43aa6a7 d43c9d4b d450dcc2 d4596b16 d4842a6f d48f5b2c d4907a57
  d493043c d4a83b11 d4ad2588 d4b8fb4f d4ccf26b d4e36db3 d4e58c9d d4e76200
  d4ff1a33 d5016c73 d5154c6d d516e991 d5180ce6 d51ecc9f d55017de d566013b
  d56caf93 d584e1fd d587d44b d590c0a8 d59fc281 d5d1438e d5d2e827 d5d3370f
  d5d339e5 d5e979ca d5f5c7c1 d5f88c43 d5f8a3cc d6138f9e d613ad56 d6195034
  d62eed10 d633020c d63a7ca7 d6688596 d672056c d685a9fa d6883532 d68b78a2
  d69088a8 d6aa2283 d6b4526e d6b5e40d d6b92636 d6ba4d05 d6bc0c21 d6ca7bd9
  d6d576f8 d6d837d1 d6de93bf d6e09afa d6e61eea d6f472e6 d6fe36e2 d7138f86
  d71b004b d7229181 d736bc29 d7440555 d7501d3a d75478b8 d75643ff d7703086
  d77a7fad d7857213 d78b142b d78efd92 d7938c66 d7cfb9c2 d7e7bbcf d818b91b
  d81a3337 d82310b8 d831a2b0 d8396ac0 d84806fc d8498e9f d856465a d860c9e8
  d86ead0a d8715af7 d873b56b d8836079 d88428f5 d88de386 d8967743 d89bfb3d
  d8cbc541 d8db8e17 d8dea06d d8edf11d d8f8e628 d930661c d936d738 d9396787
  d9457532 d94f0f21 d964aead d96a980e d97847ca d97c164d d9a5b89e d9a718ca
  d9adae12 d9d876df d9daf0d6 d9df1188 d9f2be70 da041f4d da088f58 da2610df
  da2ebb3a da358295 da460a3a da47a5be da5ef60e da617e4e da89dbd8 da92374c
  da941390 da9d0e77 daa9a466 dab11944 dab53f74 dac4e402 dac815a5 daca2233
  dacc69f9 dad0a432 dad19ec9 dad6ef27 dadb0e3c daf24815 daf97357 db280717
  db438900 db5f4210 db77b146 db7f63de db827449 db8cb6bc db9131e3 db9a45fb
  db9b2121 dbafa6b4 dbb5fa26 dbb79338 dbb8a394 dbbb058a dbcd9e18 dbecd6d8
  dc0ce971 dc0d474a dc0e8662 dc116fac dc12184c dc1598c5 dc333488 dc38e7c6
  dc466a3f dc4b3738 dc648c9e dc6c317e dc7aeafc dcd152e3 dcd18522 dcd9dc8f
  dcdb78ce dce33d15 dcfc007e dd01492e dd1e09cc dd25e0c1 dd39ddb4 dd3a7a27
  dd4019ec dd43406a dd47eafa dd5ec891 dd6bbca7 dd6f77b5 dd767111 dd76a140
  dd7784e0 dd8f271d dd8faf11 dd97148c ddab2ade ddc23b96 ddd1cff4 dded858d
  ddf43ce4 ddff76ed de02ffea de083e37 de24f8be de26c5ae de342e1a de4e8dca
  de54c16b de5a1934 de61f220 de67f640 de7c7909 de81bc23 de849552 de92342f
  de93431a dea06eba dea62e5d dea6a552 deac0e5f deace4fe dec69e71 dec90eef
  deccbae7 dee5d0d3 df11b369 df28ff6e df3312f0 df359cff df3f39c9 df4e3015
  df52fd6f df55978b df5639db df6b24ec df7c75b9 df7ff085 df833041 df8aece3
  df8b55ef dfb8c109 dfd1b58a dfddc574 dfe86f48 dfec5228 e00f4747 e011a3dc
  e01bc50b e0202df3 e027eb0a e02c16fb e0346061 e034ef09 e04a93c9 e04df726
  e059e6f4 e05b6744 e05d9f2e e06b4405 e073d3d7 e075cf97 e0774092 e097efe5
  e0a98d41 e0aa1201 e0c7bfdb e0ce063f e0cf4cf6 e0d32a97 e0d80f09 e0da30df
  e0e002e2 e0efa8c7 e1001171 e100f975 e101a384 e1035ab5 e10571d2 e10cbefc
  e119120f e124e406 e1493cce e15b12f2 e17614ee e178472b e178e98b e187fac2
  e19ac16d e1a30885 e1e08ca5 e1e7177b e1e890a1 e1fe2ffb e216a8b9 e218302b
  e224d850 e22a712f e2322a65 e232f1f8 e24471b4 e24da56e e24fad5f e2551671
  e2673a16 e2710125 e2829a6b e2935301 e29e764c e29e9708 e2a763fa e2b921f7
  e2d3ab01 e2d787cf e2f26e75 e2f51f08 e3792875 e37b5df6 e389e960 e3910d75
  e391fa69 e3b83de6 e3b8f86a e3c2bb57 e3c90c52 e3cb46c7 e3f60b0e e3f69aee
  e400b868 e409d48f e416026a e41f8cd8 e42c923b e438f2fd e44163ea e442c522
  e449afca e4657012 e467996a e47bc499 e47c78d6 e47dcdf0 e483ef19 e4b4c18a
  e4ba6d6e e4be75b6 e4c3161f e4c6b4ba e4ec20f7 e4f09221 e50b122f e5338209
  e576b394 e58a36ed e5ae1e5e e5de09ba e5f29721 e63c67b1 e64663e1 e647ed45
  e65082f2 e656c473 e65da404 e66f2bc2 e6770711 e68a79db e69a661b e6addc7b
  e6c3dc4f e6c41888 e6c7cf40 e6ca8602 e6cb6824 e6d1cf88 e6d3d353 e6d9fd19
  e6fe4a78 e711f961 e71dd3e1 e72f2405 e76d21be e7701015 e77822b0 e77adc2e
  e77b55bd e7803e1c e7b705c4 e7b79d1e e7b947af e7dd5c45 e7e53bd2 e7e64722
  e7ebf1e8 e7fd3ae6 e8037615 e80b4271 e8336c6e e849a1c3 e8666f8e e87c5a50
  e891818e e89572ad e8960b58 e8982e77 e898e984 e8a8c5ed e8a90512 e8ac18ee
  e8c1b88d e8d0f9df e8e51139 e8e9c6f5 e8f20e5d e9322d62 e9399b18 e944bcf0
  e95b8721 e95bb088 e96ed540 e971dca3 e989e625 e99b47ab e99c5b6e e99e41ed
  e9a8224d e9a8670b e9b099a9 e9baea25 e9bb579e e9c40f96 e9d1e205 e9de237f
  e9e0a7fe e9e9997a e9ee9739 e9efbee5 e9effffe ea03aa50 ea08ebbd ea0ebf57
  ea26c25d ea2ba605 ea2e097a ea5301a8 ea537aa0 ea5f7c75 ea660992 ea6a93ec
  ea7281f4 ea7ab010 ea7ea644 ea80cd55 ea95ed70 ea971e58 ead0be62 ead9b628
  eaf04a3c eaf8336b eafc4b95 eb0af0a4 eb300463 eb35877c eb3f88b3 eb428cdb
  eb4ea644 eb592f6a eb5a5edb eb6d3e25 eb7dc0ca eb841a36 eb8f167f eb946736
  ebb11176 ebb1cd07 ebb266d6 ebc8f479 ebd00380 ebe9a39f ebec31f8 ec0c8f2a
  ec151bf8 ec1f5b2d ec1f61da ec20021e ec230e0e ec24f739 ec2bc9bb ec434840
  ec5e94da ec64f1be ec82f72c ec935d76 eca35afa ecab4767 ecb5b3aa ecc4acf8
  eccbc970 eccf2bbc ecd9d046 ecf45bb8 ed0fba6c ed2b4199 ed2ce861 ed38c2fd
  ed473788 ed496836 ed4bd26b ed59e885 ed5d16e2 ed5eeb1c ed7bdaa1 ed82ce86
  ed8aa1dd ed8c2cd0 ed8c6612 ed95f26f ed9de445 edc3633b edc513a7 edc7024e
  edd3794d ede05be1 ee05e9d6 ee3a496e ee3d0818 ee404d16 ee4c67fe ee57f615
  ee60c602 ee65fad7 ee6c40b3 ee9e2138 eea07054 eea4bcb8 eeafbaed eeb036cf
  eec6bf93 eec8090b eecb1fc8 eed79d9b eedceb46 eeefbf94 ef00d7fe ef18577d
  ef25cafb ef30d2b4 ef4842f0 ef541953 ef598681 ef5bcb17 ef5fd83f ef622f05
  ef81f942 ef97bb3a efa84256 efb17548 efd633e6 efd7f45b efd9c364 efdc45a7
  f010f3e1 f01872c0 f01925cc f01b78ec f04f9a9c f050b2db f053068f f069abb4
  f06bd910 f076528c f086c578 f095dcb9 f0a62b7f f0bc21b6 f0c90ba2 f0ca76fb
  f0dc9d87 f0df8df6 f0e36cfc f0e989a1 f0f2ef31 f0fb8413 f0fe51d9 f101433d
  f10450b7 f105b97e f10de39c f11a7e11 f12571c7 f12b7ba3 f12f69ca f13ad734
  f151e441 f177aa17 f18bd486 f1932146 f19d8fb8 f1a31729 f1ae462c f1c107f5
  f1cb11e6 f1cd72f4 f1da91d9 f1db7bcf f213324f f2221eb4 f22a7c56 f22d16d2
  f2349071 f23888a8 f23f8a5c f240885a f252a2eb f2550b17 f265b9fc f268500c
  f26b012f f2927af3 f2962185 f2c6081e f2cc115f f2d44aeb f2d76ffc f2e43eb1
  f2e4ad16 f2ee56ee f30819fc f3327fff f3345853 f33df14e f3606dd5 f371d9c6
  f383dd39 f387f9c1 f3939a8e f394a3d6 f39ffc3c f3a952c5 f3c68ef4 f3cb54f1
  f3e7785e f3ef7ff3 f3f43a41 f3fef7f4 f4122124 f41522f7 f419d74e f4281e22
  f429568f f4506c85 f459aea0 f4640a73 f467841b f467bd07 f49d3462 f4a541db
  f4ad3abc f4b68f84 f4c70330 f4d205a9 f4d61528 f4d7b701 f4d86b8d f4ddac46
  f4e4548d f4f0034a f4f4d820 f50970b4 f5197d30 f53522b8 f53c1701 f5457171
  f5488f89 f551878b f558804a f5655c17 f568b4fa f577e56f f58c3584 f58e58ae
  f5b88cb5 f5bfe806 f5c80bca f5e420cc f6203060 f6308683 f630b5ac f634cf26
  f6497661 f64c6229 f661f546 f66ff5a4 f6751910 f68cf9f3 f692f910 f69d5ef0
  f69f58d1 f6afbddd f6b1e4f2 f6b23125 f6c0629f f6da03d8 f6e92d3b f6f8a52b
  f7030366 f70be09a f71383cd f73c17ee f745c56e f746b222 f74c04d1 f74ca19f
  f754b106 f767d9db f7739d67 f774621c f774824e f787ae73 f791b3c7 f7b07b6f
  f7b1bed8 f7b54b78 f7b96789 f7dd43da f7dea5e0 f7e0d5c3 f7e30067 f7e77a01
  f80012d2 f8006a6c f8136bd3 f8360ed3 f838ba70 f83c8c2e f8485959 f84860d2
  f84b88c4 f84f7b37 f85ae08f f85ddc42 f8789f31 f8887d89 f889017d f8a92324
  f8ae94fa f8b382c4 f8b48d4b f8c5679c f8d18c2a f9130d13 f9157ddd f917d5af
  f91c2330 f91d1448 f927d1b5 f92c9fc7 f933a83d f933b478 f93bf8b3 f9467793
  f95b1fde f95ebefb f967191f f9705039 f9739335 f975e952 f977fda7 f9808a27
  f98395c6 f996f590 f99c6835 f9a396f3 f9a8bcc3 f9db578e f9e41a5d f9e65b5a
  f9ec86f4 f9eff90c f9fa11cf f9fb5040 fa1b036e fa1e4b19 fa244572 fa398968
  fa5b389e fa70e370 fa7334fa fa88d5c5 fa8ad13d fa8d587c fa90291d fa98cf0e
  faa52f58 fad24804 fad3a593 fad4d6d7 fadb6aff fae0bcda fae4561d fae7b79c
  faefa345 faf8a433 fb0be505 fb0dba19 fb28ad22 fb3ecbca fb5eb9a1 fb65f63c
  fb72128c fb72d015 fb78df38 fb867344 fb90cd8a fb91ba8c fba354f6 fba734ca
  fbaaf8ed fbb2231e fbb270b8 fbb53bcb fbbf328b fbc59d51 fbc983ae fbd4ea9a
  fbdcea0e fbdfb632 fbec9379 fbf04226 fbfc463e fc102902 fc223b4b fc2b7be7
  fc39d2c6 fc68279e fc6b7f18 fca598f8 fcb57ebb fcba3cd3 fcc12800 fcd081e0
  fce6d3d2 fcf5ab06 fd0130e5 fd0e300f fd1f7990 fd359e98 fd394e10 fd419c17
  fd4a1d87 fd4bdd8b fd58354c fd6ab6ed fd8c5b6a fd9c19b6 fd9fd64e fda095b2
  fda40cd3 fdc09e8f fdd333d1 fde1eb9d fde81037 fe187a1a fe228e3f fe28d24b
  fe2c9b2a fe3a04bc fe479802 fe4cb429 fe68e061 fe6c197d fe9f885f fea24d01
  fea4a87e feaf4573 febda5fe febfd5a2 fed7593f fedd5044 fee00f78 feee9a80
  fef1f5ee ff01f352 ff03d5de ff061210 ff16bfce ff209add ff2cc03c ff37e9af
  ff3cd0cb ff3ebe7c ff4ad1ec ff586eed ff5b9212 ff5f70e1 ff83d3be ff9ba4e6
  ffa62e0f ffb711e7 ffc6e0da ffd65f6e ffea2bb4 fffa4b48
`;

/** Number of real-player hashes (diagnostics). */
export const REAL_PLAYER_HASH_COUNT = 5334;
