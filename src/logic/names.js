// Name cultures and club name generators for the game world.
// All people names and club names are generated; nothing here names a real player or a real club
// (the club blocklist below exists only so the generator can refuse a collision).
//
// STABILITY RULE: the first/last arrays of every culture are APPEND-ONLY. Name indices are stored in
// saves (Uint16, per culture). Never reorder, never delete, never insert in the middle. Duplicates are
// dropped on load (first occurrence wins), so appending a duplicate is harmless.
// Pure module: no DOM, no clock, no unseeded randomness. Randomness only through the rng argument.

import { NATION_BY_CODE } from './nations.js';
import { REAL_CLUB_GAZETTEER, REAL_PLAYER_HASHES, hashKey } from './realNames.js';

const RAW = [];
const def = (id, first, last) => RAW.push({ id, first, last });


// ---- english
def('english',
`James, Oliver, Jack, Harry, George, Charlie, Thomas, William, Henry, Joshua, Daniel, Samuel, Benjamin, Joseph, Alexander, Edward, Lewis, Matthew, Luke,
Ryan, Callum, Connor, Jordan, Liam, Declan, Mason, Reece, Kyle, Dominic, Nathan, Aaron, Adam, Andrew, Anthony, Ashley, Barry, Ben, Billy, Blake,
Bradley, Brandon, Brian, Cameron, Carl, Chris, Christian, Clive, Colin, Conor, Craig, Curtis, Dale, Damian, Darren, David, Dean, Dennis, Derek, Dylan,
Eddie, Elliot, Eric, Ethan, Evan, Fraser, Gareth, Gary, Gavin, Glenn, Gordon, Graham, Greg, Harvey, Hayden, Isaac, Jacob, Jake, Jamie, Jason, Jay,
Jeremy, Jesse, Joel, John, Jonathan, Josh, Kai, Keith, Kevin, Kieran, Lee, Leon, Leo, Logan, Louis, Mark, Martin, Marcus, Max, Michael, Mitchell,
Nicholas, Noah, Oscar, Owen, Patrick, Paul, Peter, Phil, Reuben, Rhys, Richard, Riley, Robert, Robbie, Rory, Ross, Rupert, Russell, Sam, Scott, Sean,
Sebastian, Seth, Shane, Simon, Stephen, Stuart, Taylor, Terry, Tim, Toby, Tom, Tony, Trevor, Tyler, Vincent, Wayne, Zach, Alfie, Archie, Freddie, Theo,
Arthur, Albert, Frank, Harrison, Stanley, Ronnie, Roman, Ollie, Danny, Nigel, Neil, Malcolm, Lloyd, Kristian, Josef, Jarrod, Ian, Hugo, Gabriel, Felix,
Jensen, Elijah, Sidney, Tristan, Warren, Kenneth, Roy, Nelson, Gilbert`,
`Smith, Jones, Taylor, Brown, Williams, Wilson, Johnson, Davies, Robinson, Wright, Thompson, Evans, Walker, White, Roberts, Green, Hall, Wood, Jackson,
Clarke, Turner, Hughes, Edwards, Hill, Moore, Clark, Harrison, Scott, Young, Morgan, Allen, Mitchell, James, Anderson, Phillips, Lewis, Lee, Baker,
King, Cooper, Harris, Ward, Watson, Morris, Parker, Bennett, Carter, Collins, Bailey, Bell, Cook, Cox, Marshall, Gray, Richardson, Shaw, Webb, Fox,
Hunt, Palmer, Mills, Stone, Hudson, Barnes, Fisher, Knight, Elliott, Chapman, Ford, Gibson, Hart, Holmes, Jenkins, Lawrence, Mason, Newman, Owen,
Payne, Pearce, Price, Reynolds, Rogers, Russell, Simpson, Spencer, Stevens, Sutton, Tucker, Wallace, Warren, Watts, West, Williamson, Wells, Armstrong,
Atkinson, Austin, Barker, Barrett, Barton, Bates, Baxter, Bishop, Booth, Bradley, Bradshaw, Brooks, Burton, Butler, Carr, Chambers, Chandler, Cole,
Coleman, Cross, Crawford, Dawson, Day, Dean, Dixon, Duncan, Dunn, Ellis, Farrell, Fletcher, Foster, Fuller, Gardner, Gill, Goddard, Gordon, Graham,
Grant, Gregory, Griffiths, Hamilton, Hancock, Hardy, Harper, Harvey, Hawkins, Hayes, Henderson, Hewitt, Hodgson, Holland, Holt, Hopkins, Horton,
Howard, Howell, Hunter, Hussain, Ingram, Jarvis, Jordan, Kemp, Kerr, Lambert, Lane, Lloyd, Long, Lowe, Lucas, Marsh, Martin, Matthews, May, Miller,
Moss, Norman, Nicholson, Norton, Oliver, Osborne, Page, Parsons, Peters, Pickering, Porter, Powell, Pratt, Preston, Quinn, Randall, Rice, Riley, Ross,
Rowe, Sanders, Saunders, Sharp, Shepherd, Slater, Stephens, Sullivan, Thornton, Todd, Tyler, Vaughan, Walsh, Walton, Watkins, Weaver, Whitehead,
Wilkinson, Willis, Woods, Yates, Abbott, Ainsworth, Ashworth, Barlow, Bamford, Birch, Bolton, Briggs, Burgess, Cartwright, Clegg, Cliff, Crabtree,
Dobson, Entwistle, Fairclough, Greenwood, Haigh, Holroyd, Hargreaves, Heaton, Kershaw, Lees, Lord, Metcalfe, Naylor, Ogden, Pickles, Rawlinson,
Redfern, Sykes, Tattersall, Whitaker, Ashdown, Beckett, Cheney, Dyer, Fenn, Gosling, Hollis, Patel, Khan, Ali, Shah, Ahmed, Malik, Sharma, Singh,
Campbell, Henry, Francis, Blake, Charles, Douglas, Daniels, Bryan, Clarkson, Pennington, Aldridge, Ashby, Bamber, Banks, Beaumont, Bellamy, Bevan,
Blackburn, Bowen, Brewer, Buckley, Carey, Carpenter, Chadwick, Clayton, Cooke, Copeland, Crowther, Dalton, Denton, Dobbs, Ellison, Emery, Fairbank,
Garrett, Goodwin, Gough, Haywood, Hesketh, Holloway, Hurst, Jagger, Kendall, Lacey, Langley, Maddox, Marlow, Maxwell, Nash, Pemberton, Radcliffe,
Seddon, Thorpe, Acton, Ainley, Allsop, Appleby, Ashton, Atherton, Bagshaw, Bartlett, Bentley, Blackwell, Boyce, Bramley, Brookes, Bryant, Burrows,
Cadman, Calvert, Cleaver, Coates, Cobb, Colley, Cope, Cresswell, Croft, Cullen, Danby, Dent, Dodd, Drake, Dyson, Eastwood, Fenwick, Finch, Flynn,
Garner, Gleave, Haworth, Hobbs, Ibbotson, Kay, Latham, Lomax, Mellor, Netherwood`);

// ---- celtic
def('celtic',
`Callum, Fraser, Angus, Hamish, Rory, Euan, Alasdair, Iain, Craig, Stuart, Gordon, Duncan, Murray, Lachlan, Ross, Ewan, Kieran, Cameron, Connor, Declan,
Cian, Oisin, Darragh, Eoin, Padraig, Seamus, Colm, Niall, Ronan, Fionn, Cathal, Diarmuid, Donal, Eamon, Fergal, Brendan, Brian, Cormac, Conor, Dara,
Dermot, Emmet, Finn, Gerard, Kevin, Liam, Lorcan, Mairtin, Michael, Neil, Noel, Odhran, Paddy, Rian, Sean, Shane, Tadhg, Aidan, Bryn, Rhys, Owain,
Gethin, Dafydd, Huw, Iwan, Gwilym, Emrys, Idris, Gareth, Aled, Ieuan, Cai, Morgan, Rhodri, Llyr, Tomos, Ifan, Dylan, Evan, Arwel, Carwyn, Cerys, Dewi,
Elis, Emyr, Garan, Glyn, Gruffydd, Hywel, Ianto, Jac, Kyle, Lewis, Macsen, Meirion, Osian, Rhydian, Steffan, Trefor, Wyn, Alistair, Andrew, Archie,
Blair, Brodie, Calum, Cormack, Dougal, Fergus, Findlay, Gregor, Hugh, Innes, Jamie, Keir, Logan, Magnus, Malcolm, Robbie, Struan, Tavish, Allan, Barry,
Colin, Dominic, Eddie, Gavin, Graeme, Jack, Jason, Lee, Mark, Paul, Ryan, Scott, Stephen, Thomas, Tom, Aaron, Adam, Alan, Bobby, Cillian, Ciaran,
Conall, Denis, Donnacha, Enda, Feargal, Jim, Johnny, Kian, Lochlan, Marty, Nathan, Owen, Peadar, Ruairi, Lennon, Gerry, Alec, Kenny, Davie, Ruaridh,
Fearghal, Ultan`,
`Murphy, Kelly, O'Brien, Ryan, Walsh, O'Connor, McCarthy, Gallagher, Doherty, Kennedy, Lynch, Murray, Quinn, Moore, McLoughlin, O'Carroll, Connolly,
Daly, Byrne, O'Neill, O'Reilly, Doyle, McGrath, Whelan, Brennan, Burke, Collins, Healy, Fitzgerald, Hayes, Hogan, Keane, Maguire, Nolan, O'Donnell,
O'Sullivan, Power, Reilly, Sheehan, Stapleton, Brady, Buckley, Cassidy, Clancy, Cullen, Devlin, Dolan, Dunne, Farrell, Flanagan, Fox, Furlong,
Gilligan, Griffin, Higgins, Hickey, Holohan, Kavanagh, Keogh, Lawlor, MacDonald, Campbell, Stewart, Robertson, Thomson, Anderson, Scott, Reid, Ross,
Henderson, Duncan, McKenzie, Fraser, Cameron, Gordon, Hamilton, Sinclair, Grant, Murdoch, McGregor, McLeod, MacLean, MacKay, Munro, Kerr, Boyd,
Buchanan, Crichton, Cunningham, Dalziel, Drummond, Forbes, Gillespie, Graham, Guthrie, Haddow, Imrie, Kinnear, Lamont, Leitch, Lindsay, Logan, Lyon,
Macleod, McAllister, McBride, McCall, McCulloch, McDougall, McEwan, McFadden, McGowan, McIntyre, McKinnon, McLaren, McNeill, McPhail, Menzies, Moffat,
Morrison, Napier, Ogilvie, Paterson, Rennie, Rutherford, Shearer, Stirling, Strachan, Sutherland, Urquhart, Wallace, Wishart, Davies, Jones, Evans,
Thomas, Roberts, Hughes, Lewis, Morgan, Griffiths, Edwards, Owen, Price, Powell, Rees, Pritchard, Bevan, Prosser, Probert, Meredith, Llewellyn, Gwynne,
Vaughan, Parry, Pugh, Bowen, Howells, Cadwallader, Ellis, Lloyd, Harries, Beynon, Cadogan, Dafydd, Gethin, Hopkin, Jenkins, Maddocks, Mathias,
Mordecai, Nicholas, Pendry, Phelps, Protheroe, Rowlands, Sims, Tudor, Trevor, Watkin, Wynne, O'Hara, McCann, McClean, McGuinness, McKee, Bradley,
Hegarty, Kearney, Mallon, McAteer, McDaid, McElroy, McKenna, McMahon, McNally, Magee, Montgomery, Moran, Mulholland, Neeson, Boyle, Brogan, Carlin,
Clarke, Corrigan, Crossan, Cumming, Donnelly, Duffy, Fitzpatrick, Gormley, Haughey, Hynes, Irwin, Kane, Loughrey, McCoy, McCrory, McVeigh, Mulgrew,
Nugent, O'Hagan, O'Kane, Rafferty, Rooney, Shields, Toner, Tierney, Treacy, Whyte, Gavin, Carroll, Egan, Foley, Hurley, Joyce, Lenihan, Malone, Mooney,
Noonan, Plunkett, Rice, Slattery, Teague, Waters, Barrett, Bolger, Casey, Coughlan, Cronin, Deasy, Delaney, Dwyer, Fahy, Glynn, Heffernan, Hennessy,
Horgan, Kinsella, Mulcahy, Aitken, Ainsley, Baird, Barclay, Beattie, Black, Blackwood, Bruce, Burns, Cairns, Calder, Carmichael, Chalmers, Clark,
Crawford, Dewar, Dickson, Donaldson, Douglas, Dunlop, Elliot, Erskine, Ferguson, Finlay, Galbraith, Geddes, Gibb, Gilchrist, Hay, Hendry, Hogg, Howie,
Hutton, Inglis, Jamieson, Keith, Kidd, Laird, Lauder, Learmonth, Lennox, Liddell, MacArthur, MacGillivray, Mackie, Maclean, Mair, Mathieson, Maxwell,
Mearns, Melville, Milne, Mitchell, Nairn, Ness, Nisbet, Pirie, Rankin, Ritchie, Rowan, Skinner, Spence, Tait, Tulloch, Wylie, Younger, Brannigan,
Crotty, Dillon, Dineen, Fenlon, Gleeson, Halpin, Harte, Kinnaird, Lochhead, Menteith, Pollock, Sellar`);

// ---- spanish-iberian
def('spanish-iberian',
`Alejandro, Pablo, Daniel, Adrián, Álvaro, David, Javier, Sergio, Carlos, Diego, Hugo, Mario, Iván, Rubén, Marcos, Jorge, Raúl, Óscar, Víctor, Miguel,
Manuel, Antonio, José, Juan, Francisco, Luis, Pedro, Ángel, Rafael, Fernando, Andrés, Gonzalo, Ignacio, Jaime, Joaquín, Lucas, Martín, Nicolás,
Rodrigo, Santiago, Alberto, Alfonso, Aitor, Asier, Borja, Cristian, Dani, Eduardo, Enrique, Ernesto, Gabriel, Guillermo, Gerard, Héctor, Ibai, Ion,
Iker, Imanol, Jon, Josu, Kevin, Laureano, Leandro, Lorenzo, Marc, Mateo, Mikel, Nacho, Néstor, Noé, Oriol, Pau, Pol, Quique, Ramón, Ricardo, Roberto,
Rodolfo, Salvador, Samuel, Saúl, Sebastián, Tomás, Unai, Xavier, Xabi, Yeray, Zacarías, Aarón, Abel, Adolfo, Agustín, Aleix, Alonso, Amadeo, Anselmo,
Arnau, Bartolomé, Beñat, Bruno, Cayetano, César, Cristóbal, Damián, Darío, Dídac, Domingo, Eder, Edu, Eloy, Emilio, Esteban, Eugenio, Ezequiel, Fabián,
Federico, Felipe, Félix, Fermín, Gaizka, Genís, Germán, Gustavo, Guifré, Hernán, Humberto, Isaac, Isidro, Jacobo, Jesús, Joan, Jordi, Julen, Julián,
Lander, Leo, Lluís, Mauro, Maxi, Moisés, Nahuel, Nil, Octavio, Orlando, Paco, Patxi, Pere, Rafa, Ramiro, Raimundo, Régulo, Sandro, Sergi, Tito, Toni,
Valentín, Vicente, Xavi, Yago, Zigor, Carles, Isidoro, Lisandro, Melchor, Narciso`,
`García, Fernández, González, Rodríguez, López, Martínez, Sánchez, Pérez, Gómez, Martín, Jiménez, Ruiz, Hernández, Díaz, Moreno, Muñoz, Álvarez, Romero,
Alonso, Gutiérrez, Navarro, Torres, Domínguez, Vázquez, Ramos, Gil, Ramírez, Serrano, Blanco, Molina, Morales, Suárez, Ortega, Delgado, Castro, Ortiz,
Rubio, Marín, Sanz, Núñez, Iglesias, Medina, Garrido, Cortés, Castillo, Santos, Lozano, Guerrero, Cano, Prieto, Méndez, Cruz, Calvo, Gallego, Vidal,
León, Márquez, Herrera, Peña, Flores, Cabrera, Campos, Vega, Fuentes, Carrasco, Díez, Caballero, Reyes, Nieto, Aguilar, Pascual, Santana, Herrero,
Montero, Lorenzo, Hidalgo, Giménez, Ibáñez, Ferrer, Duran, Santiago, Benítez, Mora, Vicente, Vargas, Arias, Carmona, Crespo, Román, Pastor, Soto, Sáez,
Velasco, Moya, Soler, Parra, Esteban, Bravo, Gallardo, Rojas, Pardo, Merino, Franco, Espinosa, Izquierdo, Lara, Rivas, Silva, Rivera, Casado, Arroyo,
Redondo, Camacho, Rey, Vera, Fernandes, Montes, Escudero, Luna, Palacios, Aguirre, Aranda, Aranguren, Arrieta, Arteaga, Astigarraga, Azpiazu, Barrena,
Basterretxea, Bengoetxea, Echeverría, Elorza, Etxeberria, Garmendia, Goikoetxea, Iturbe, Landa, Larrañaga, Lasa, Mendizábal, Olaizola, Otegi,
Sagarzazu, Ugarte, Urbieta, Urrutia, Uribe, Zabaleta, Zubizarreta, Zugasti, Abad, Abellán, Aguado, Alcaraz, Alcázar, Andreu, Antón, Aparicio, Arenas,
Arévalo, Ayala, Barrios, Bautista, Becerra, Beltrán, Bermúdez, Bernal, Bonilla, Briones, Bueno, Burgos, Cabello, Cáceres, Calderón, Camps, Canales,
Cantero, Carbonell, Casas, Cebrián, Chacón, Clemente, Collado, Contreras, Correa, Cuesta, Cuevas, Dávila, Del Río, De la Fuente, De la Torre,
Del Valle, Duarte, Escobar, Estévez, Expósito, Fajardo, Ferrándiz, Figueroa, Fonseca, Galán, Gálvez, Garcés, Godoy, Guillén, Guzmán, Heredia, Huertas,
Ibarra, Illescas, Jaén, Juárez, Lago, Lillo, Linares, Llorente, Lucena, Macías, Maldonado, Marcos, Mateu, Mejía, Meléndez, Mesa, Miralles, Miranda,
Monreal, Mosquera, Muriel, Naranjo, Noguera, Olmedo, Orozco, Osorio, Padilla, Paniagua, Pineda, Plaza, Porras, Puig, Quintana, Quiroga, Rebollo, Ribas,
Robles, Roca, Roig, Rosales, Salas, Salazar, Salinas, Sandoval, Segura, Sevilla, Tapia, Toledo, Trujillo, Valverde, Varela, Villanueva, Aguilera,
Alarcón, Albiol, Alcántara, Aldana, Alegre, Almagro, Amador, Andrade, Anglada, Araújo, Arce, Argüelles, Arjona, Armas, Arnal, Asensio, Avilés, Baeza,
Ballester, Bañuls, Barba, Barroso, Bastida, Belmonte, Benavente, Berenguer, Blázquez, Boada, Borja, Brotons, Cabanillas, Cadenas, Calleja, Camino,
Canet, Carballo, Cardona, Castaño, Cepeda, Cerdá, Climent, Corral, Cuenca, Dalmau, Del Pino, Donoso, Elías, Escrivá, Esparza, Estrada, Falcón, Feliu,
Flórez, Gago, Gibert, Granados, Granero, Haro, Jover, Lasheras, Ledesma, Lleó, Mangas, Marugán, Mínguez, Nadal, Ocaña, Pinilla`);

// ---- latin-american
def('latin-american',
`Santiago, Mateo, Matías, Sebastián, Nicolás, Benjamín, Joaquín, Lucas, Emiliano, Tomás, Thiago, Valentín, Agustín, Facundo, Lautaro, Maximiliano,
Franco, Gonzalo, Ignacio, Bruno, Federico, Ramiro, Rodrigo, Leandro, Cristian, Brayan, Kevin, Jhon, Yerson, Wilmar, Duván, Jefferson, Andrés, Camilo,
Juan Camilo, Johan, Felipe, Cristóbal, Claudio, Marcelo, Mauricio, Ángel, Axel, Bautista, Benicio, Cesar, Dario, Elías, Esteban, Exequiel, Fabricio,
Fernando, Gabriel, Germán, Gerardo, Gustavo, Hernán, Hugo, Iván, Jairo, Jeison, Jesús, Jonathan, Jorge, José, Josué, Julián, Kleber, Leonel, Luciano,
Luis, Manuel, Marcos, Mario, Martín, Miguel, Néstor, Óscar, Omar, Pablo, Patricio, Pedro, Ricardo, Roberto, Rolando, Rubén, Salvador, Sergio, Sixto,
Teófilo, Ulises, Víctor, Walter, Wilson, William, Yair, Yordy, Zamir, Adrián, Alan, Alexis, Alfredo, Alvaro, Anderson, Arturo, Bryan, Carlos, Damián,
Darwin, Dayro, Edgar, Edwin, Efraín, Eliseo, Enzo, Erick, Ezequiel, Fidel, Gael, Gilberto, Giovanni, Hector, Humberto, Iker, Isaías, Ismael, Jaime,
Javier, Joel, Leonardo, Lisandro, Lorenzo, Maicol, Nahuel, Octavio, Orlando, Pascual, Rafael, Raúl, Reinaldo, Renzo, Rómulo, Santino, Servando, Silvio,
Teo, Tobías, Ubaldo, Vicente, Wálter, Yamil, Yeferson, Yosimar, Zaid, Alejandro, Diego, Emanuel, Aldo, Basilio, Celestino, Dionisio, Eladio, Gervasio`,
`González, Rodríguez, Gómez, Fernández, López, Díaz, Martínez, Pérez, García, Sánchez, Romero, Sosa, Álvarez, Torres, Ruiz, Ramírez, Flores, Benítez,
Acosta, Medina, Herrera, Suárez, Aguirre, Giménez, Gutiérrez, Pereyra, Rojas, Molina, Castro, Ortiz, Silva, Núñez, Luna, Juárez, Cabrera, Ríos,
Morales, Godoy, Moreno, Ferreyra, Domínguez, Carrizo, Quiroga, Castillo, Ledesma, Muñoz, Peralta, Vega, Vera, Rivero, Mendoza, Correa, Cardozo,
Gallardo, Paz, Villalba, Bustos, Maldonado, Navarro, Cáceres, Arias, Escobar, Guerrero, Salazar, Valdez, Barrios, Delgado, Montenegro, Ibarra,
Figueroa, Contreras, Coronel, Páez, Montiel, Ojeda, Franco, Duarte, Bogado, Bareiro, Britez, Samudio, Insfrán, Báez, Ayala, Zárate, Alderete,
Centurión, Ortigoza, Riveros, Cuevas, Vallejos, Orué, Cantero, Fretes, Aquino, Martino, Pintos, Cubas, Penayo, Cortés, Mejía, Valencia, Mosquera,
Palacios, Hurtado, Quintero, Murillo, Ospina, Cuadrado, Zapata, Restrepo, Arango, Betancur, Bedoya, Londoño, Echeverri, Gaviria, Henao, Marín, Montoya,
Obando, Orozco, Posada, Rendón, Rincón, Sierra, Tapias, Tobón, Uribe, Vélez, Vásquez, Villegas, Yepes, Zuluaga, Cifuentes, Araya, Bravo, Carvajal,
Fuentes, Lagos, Leiva, Maturana, Orellana, Pizarro, Poblete, Reyes, Saavedra, Sepúlveda, Soto, Tapia, Toro, Valenzuela, Venegas, Vidal, Zamora, Burgos,
Candia, Cárdenas, Chávez, Cisneros, Collazo, Cubillas, Farfán, Guevara, Huamán, Inga, Lozano, Machado, Mamani, Quispe, Condori, Huanca, Ccori, Choque,
Apaza, Callisaya, Paredes, Pacheco, Yupanqui, Alarcón, Altamirano, Andrade, Angulo, Arboleda, Bolaños, Caicedo, Campaña, Castañeda, Cedeño, Cevallos,
Chala, Corozo, De la Cruz, Estupiñán, Gruezo, Intriago, Mina, Minda, Ordóñez, Plata, Preciado, Quiñónez, Reasco, Sornoza, Segura, Vite, Aráuz,
Barquero, Calvo, Campbell, Cordero, Elizondo, Guzmán, Jiménez, Lobo, Madrigal, Mora, Oviedo, Quesada, Salas, Solís, Umaña, Vargas, Villalobos, Zúñiga,
Aldama, Arévalo, Bermúdez, Cano, Del Castillo, Estrada, Gallegos, Gamboa, Hinojosa, Lira, Macías, Ochoa, Ontiveros, Palomino, Quezada, Rangel,
Rentería, Robledo, Saldaña, Tello, Treviño, Ugalde, Valdivia, Varela, Villarreal, Zavala, Alcántara, Arredondo, Ceballos, Domingo, Espinoza, Abarca,
Acevedo, Aguayo, Alcaraz, Almada, Amarilla, Arce, Arguello, Armoa, Avalos, Bazán, Benegas, Bobadilla, Brizuela, Cabral, Caballero, Cañete, Carballo,
Cazal, Céspedes, Corvalán, Duré, Escalante, Esquivel, Fariña, Frías, Galeano, Gamarra, Garay, Garrido, Insaurralde, Irala, Lescano, Lugo, Maidana,
Maciel, Mansilla, Marecos, Meza, Miranda, Morínigo, Noguera, Ocampos, Olmedo, Ovelar, Palacio, Pavón, Pedrozo, Quintana, Rolón, Rotela, Sanabria,
Segovia, Servín, Talavera, Torales, Trinidad, Vázquez, Velázquez, Villar, Zacarías, Almeyda, Balbuena, Carabajal, Dávalos, Escobedo, Farías, Gaitán,
Heredia, Jaime, Lencina, Mercado, Nieva, Olivera, Roldán, Sandoval, Toledo`);

// ---- portuguese-brazilian
def('portuguese-brazilian',
`João, Pedro, Lucas, Gabriel, Mateus, Matheus, Guilherme, Rafael, Felipe, Gustavo, Bruno, Diego, Thiago, Vinícius, Leonardo, Rodrigo, Eduardo, Henrique,
Caio, Murilo, Davi, Arthur, Enzo, Igor, Renan, Samuel, Wesley, Willian, Wellington, Everton, Fabrício, Fábio, Fernando, Flávio, Giovani, Hugo, Ítalo,
Jonas, Jorge, José, Júlio, Kauã, Leandro, Luan, Luiz, Marcelo, Márcio, Marcos, Mário, Maurício, Nelson, Otávio, Paulo, Ricardo, Roberto, Ronaldo,
Sandro, Sérgio, Tiago, Túlio, Valter, Victor, Wagner, Yuri, Adriano, Alan, Alex, Alexandre, Anderson, André, Antônio, Bernardo, Breno, Bryan, Carlos,
Cássio, César, Cláudio, Cristiano, Danilo, Douglas, Edson, Elias, Emerson, Fagner, Francisco, Gilberto, Gilmar, Heitor, Hélio, Ivan, Jair, Jean,
Joaquim, Josué, Kléber, Lázaro, Léo, Lourenço, Luciano, Manuel, Miguel, Nuno, Orlando, Pablo, Patrick, Raul, Renato, Rui, Silvio, Tomás, Vasco, Zé,
Abel, Afonso, Alberto, Aníbal, Artur, Baltazar, Benedito, Cauê, Cleiton, Dário, Dinis, Duarte, Edmilson, Elton, Emanuel, Ezequiel, Fausto, Fredy,
Garcia, Geraldo, Gonçalo, Hernani, Humberto, Ilídio, Isaque, Jaime, Jéferson, Joel, Kaique, Ladislau, Lino, Maicon, Moisés, Nilton, Oswaldo, Paco,
Quim, Raimundo, Rúben, Salvador, Teodoro, Ulisses, Vítor, Wilson, Xavier, Zeca, Aurélio, Cléber, Ederson, Gilson, Jocimar, Moacir, Olavo, Rogério,
Sidnei, Valdir`,
`Silva, Santos, Oliveira, Souza, Rodrigues, Ferreira, Alves, Pereira, Lima, Gomes, Costa, Ribeiro, Martins, Carvalho, Almeida, Lopes, Soares, Fernandes,
Vieira, Barbosa, Rocha, Dias, Nascimento, Andrade, Moreira, Nunes, Marques, Machado, Mendes, Freitas, Cardoso, Ramos, Gonçalves, Santana, Teixeira,
Cavalcanti, Araújo, Moura, Monteiro, Correia, Pinto, Batista, Campos, Cunha, Duarte, Melo, Miranda, Medeiros, Azevedo, Borges, Castro, Coelho, Cruz,
Farias, Fonseca, Guimarães, Leite, Macedo, Magalhães, Nogueira, Paiva, Peixoto, Pires, Reis, Siqueira, Tavares, Torres, Vasconcelos, Xavier, Abreu,
Amaral, Assis, Barros, Bastos, Bento, Brandão, Braga, Brito, Bueno, Caldeira, Camargo, Cabral, Cardim, Carneiro, Chaves, Cordeiro, Couto, Damasceno,
Esteves, Falcão, Figueiredo, Franco, Furtado, Gaspar, Godinho, Henriques, Jesus, Lacerda, Lobo, Loureiro, Maciel, Matos, Matias, Menezes, Morais,
Morgado, Neves, Neto, Novaes, Otávio, Pacheco, Paes, Pedrosa, Penha, Pimentel, Portela, Prado, Queiroz, Ramalho, Rangel, Rezende, Ribas, Rosa, Sampaio,
Sá, Salgado, Serrano, Simões, Tomé, Valente, Vaz, Veiga, Viana, Vidal, Viegas, Zanetti, Albuquerque, Alencar, Aragão, Arruda, Bezerra, Bittencourt,
Bragança, Calado, Canto, Capelo, Carrilho, Cerqueira, Coutinho, Delgado, Domingues, Escobar, Evangelista, Faria, Feitosa, Ferraz, Fialho, Frade,
Garrido, Gouveia, Guedes, Guerra, Lessa, Lins, Louzada, Luz, Mafra, Maia, Malta, Marinho, Mascarenhas, Meireles, Mota, Muniz, Novais, Nobre, Palma,
Passos, Pessoa, Quintela, Raposo, Resende, Rego, Rios, Rolim, Sacramento, Salles, Saraiva, Seixas, Sequeira, Sobral, Soeiro, Taveira, Tenório, Toledo,
Trindade, Uchoa, Valadares, Varela, Venâncio, Vilela, Abrantes, Afonso, Albano, Aleixo, Anjos, Aveiro, Baptista, Barata, Barreto, Belo, Bessa,
Bettencourt, Bonito, Cabrita, Caetano, Calheiros, Carmo, Casimiro, Cerdeira, Chagas, Conde, Cortez, Craveiro, Estrela, Faustino, Galvão, Garcia, Girão,
Honório, Horta, Inácio, Leal, Leandro, Lemos, Lourenço, Mourão, Neiva, Noronha, Ornelas, Almada, Alcântara, Aguiar, Amorim, Antunes, Arantes, Assunção,
Ataíde, Avelar, Azambuja, Bandeira, Bernardes, Bicalho, Boaventura, Borba, Branco, Brum, Cadete, Calçada, Canário, Capela, Cascais, Castanheira,
Cerejo, Cintra, Collares, Dantas, Elias, Fagundes, Falcato, Ferro, Fidalgo, Gadelha, Galego, Gama, Godói, Guerreiro, Hilário, Jorge, Lage, Lampreia,
Lapa, Leão, Limeira, Madeira, Mamede, Mangueira, Marta, Mourato, Moutinho, Nazaré, Oliva, Pais, Paixão, Parente, Pestana, Pimenta, Quental, Rebelo,
Roque, Sabino, Salvador, Santiago, Sarmento, Teles, Tojal, Ventura, Vilar, Brandi, Cavaco, Dourado, Espírito Santo, Frazão, Grilo, Loio, Mendonça,
Nobrega, Ourique`);

// ---- italian
def('italian',
`Marco, Luca, Andrea, Matteo, Alessandro, Lorenzo, Francesco, Davide, Simone, Federico, Gabriele, Riccardo, Stefano, Giuseppe, Antonio, Giovanni, Mario,
Paolo, Roberto, Fabio, Nicola, Daniele, Michele, Alberto, Enrico, Emanuele, Claudio, Cristian, Diego, Edoardo, Filippo, Gianluca, Giorgio, Leonardo,
Manuel, Massimo, Mattia, Maurizio, Mirko, Nicolò, Pietro, Salvatore, Samuele, Sergio, Tommaso, Valerio, Vincenzo, Vittorio, Alex, Angelo, Antonino,
Armando, Aurelio, Bruno, Carlo, Carmine, Cesare, Christian, Ciro, Corrado, Damiano, Dario, Domenico, Dino, Elia, Elio, Ennio, Ettore, Fausto, Fabrizio,
Flavio, Franco, Gaetano, Gennaro, Gerardo, Gianni, Gino, Giulio, Graziano, Guido, Ignazio, Italo, Jacopo, Lapo, Livio, Luciano, Luigi, Marcello,
Marino, Martino, Nando, Natale, Nello, Orazio, Oreste, Orlando, Osvaldo, Pasquale, Patrizio, Piero, Pino, Raffaele, Raimondo, Remo, Renato, Rino,
Rocco, Romeo, Rosario, Ruggero, Saverio, Sandro, Santo, Sebastiano, Silvio, Tiziano, Tullio, Ugo, Umberto, Valentino, Vito, Walter, Adriano, Achille,
Alfio, Amedeo, Aldo, Alvise, Amerigo, Ansel, Baldo, Beppe, Bernardo, Biagio, Calogero, Camillo, Costantino, Dante, Donato, Eros, Fiorenzo, Folco,
Furio, Gastone, Ivano, Lamberto, Leandro, Lino, Loris, Mauro, Nazario, Ottavio, Pierluigi, Rinaldo, Tancredi, Tito, Vasco, Venanzio, Zeno, Zaccaria,
Adelmo, Ambrogio, Bartolo, Cosimo, Eligio, Gianpiero, Ivo, Marzio, Nereo, Sante`,
`Rossi, Russo, Ferrari, Esposito, Bianchi, Romano, Colombo, Ricci, Marino, Greco, Bruno, Gallo, Conti, De Luca, Mancini, Costa, Giordano, Rizzo,
Lombardi, Moretti, Barbieri, Fontana, Santoro, Mariani, Rinaldi, Caruso, Ferrara, Galli, Martini, Leone, Longo, Gentile, Martinelli, Vitale, Lombardo,
Serra, Coppola, De Santis, D'Angelo, Marchetti, Parisi, Villa, Conte, Ferraro, Ferri, Fabbri, Bianco, Marini, Grasso, Valentini, Messina, Sala,
De Angelis, Gatti, Pellegrini, Palumbo, Sanna, Farina, Rizzi, Monti, Cattaneo, Morelli, Amato, Silvestri, Mazza, Testa, Grassi, Pellegrino, Carbone,
Giuliani, Benedetti, Barone, Rossetti, Caputo, Montanari, Guerra, Palmieri, Bernardi, Martino, Fiore, De Rosa, Ferretti, Bellini, Basile, Riva, Donati,
Piras, Vitali, Battaglia, Sartori, Neri, Costantini, Milani, Pagano, Ruggiero, Sorrentino, D'Amico, Orlando, Damico, Negri, Albanese, Alberti, Aloisi,
Altieri, Amadori, Angeli, Antonelli, Arcuri, Ardito, Armani, Baldi, Baldini, Bandini, Barbato, Baroni, Bartoli, Bassi, Bellucci, Belotti, Benvenuti,
Bertolini, Bettini, Biagi, Bianconi, Bonetti, Bonfanti, Borelli, Bosco, Bresciani, Brambilla, Bruni, Bucci, Cafaro, Calabrese, Cappelli, Capuano,
Carnevale, Casagrande, Cassano, Castelli, Cavalli, Cecchi, Cerruti, Chiesa, Ciani, Cipriani, Colella, Contini, Corsi, Cortese, Crespi, D'Alessandro,
D'Ambrosio, De Bernardi, De Marco, Del Conte, Delmastro, Di Lorenzo, Di Stefano, Dolci, Facchini, Fadda, Fanelli, Fazio, Fiorentini, Forte, Fratini,
Gabrielli, Gaggini, Galante, Gambino, Garibaldi, Gasparri, Gelli, Ghezzi, Giannini, Gioia, Giusti, Gori, Gualtieri, Iacono, Incerti, Innocenti, Landi,
Lanza, Laurenti, Lazzari, Leoni, Liguori, Lodi, Lorenzi, Lupo, Maggi, Magnani, Malatesta, Mancuso, Manfredi, Marchi, Marconi, Marotta, Mastroianni,
Mele, Melis, Mercuri, Micheli, Minardi, Miranda, Molinari, Mondini, Morandi, Moro, Nardi, Natale, Nobile, Occhipinti, Olivieri, Pace, Paolini, Papa,
Pasini, Pavan, Pelosi, Perrone, Pesce, Petrucci, Piazza, Piccolo, Pini, Pisani, Pozzi, Prati, Provenzano, Quaranta, Raimondi, Ranieri, Rapisarda, Re,
Recchia, Regina, Rocca, Roncaglia, Rubini, Ruffini, Salvi, Sanfilippo, Sarti, Scala, Scarpa, Serafini, Sgarbi, Soldati, Sparta, Stella, Tedesco, Terzi,
Tonelli, Trevisan, Turchi, Valli, Venturi, Verdi, Accardo, Agnelli, Aiello, Alessi, Ambrosini, Arena, Arrighi, Bagnoli, Balestra, Bernini, Bertoli,
Bonanno, Bonaccorsi, Borghi, Buonanno, Cacciatore, Calvi, Camilleri, Cantù, Capelli, Cardinali, Casali, Cerri, Ciampi, Corradi, Dal Pozzo, Da Ros,
Del Vecchio, Di Maio, Fabiani, Falcone, Fenu, Ferrante, Filippi, Fiorini, Foschi, Gargiulo, Gentili, Gerace, Giacomelli, Grimaldi, Guidi, Lanzetta,
Lorusso, Macchi, Mauri, Mazzoni, Mura, Nuzzo, Orsini, Pagani, Pastore, Pecoraro, Perini, Poli, Quattrocchi, Rota, Ruzzi, Sabatini, Tagliaferri, Tomasi,
Urso, Vannucci, Zanetti, Zanini, Zucchi`);

// ---- german
def('german',
`Lukas, Leon, Jonas, Felix, Maximilian, Paul, Elias, Tim, Niklas, Jan, Finn, Noah, Ben, Luca, Moritz, Julian, Tobias, Fabian, Philipp, David, Florian,
Marcel, Dominik, Kevin, Patrick, Sebastian, Simon, Stefan, Thomas, Michael, Andreas, Christian, Daniel, Alexander, Matthias, Markus, Martin, Mario,
Marvin, Nico, Oliver, Pascal, Robin, Sven, Timo, Tom, Torben, Uwe, Benedikt, Bastian, Bernd, Björn, Carsten, Clemens, Dennis, Dieter, Erik, Frank,
Fritz, Georg, Gerd, Gregor, Günther, Hannes, Hans, Heiko, Heinz, Helmut, Henning, Holger, Ingo, Jörg, Jürgen, Karl, Klaus, Konrad, Kurt, Lars, Lennart,
Linus, Lothar, Ludwig, Manfred, Marius, Max, Mike, Norbert, Olaf, Otto, Peter, Rainer, Ralf, Reinhard, René, Rolf, Rudolf, Sandro, Sascha, Stephan,
Steffen, Thorsten, Till, Torsten, Ulrich, Urs, Valentin, Volker, Walter, Werner, Wilhelm, Wolfgang, Yannick, Yannik, Adrian, Alois, Anton, Arne,
August, Axel, Benjamin, Cedric, Claus, Detlef, Dirk, Eberhard, Egon, Emil, Ernst, Eugen, Ferdinand, Franz, Friedrich, Gerhard, Gottfried, Gustav,
Hagen, Harald, Heiner, Hendrik, Hermann, Horst, Hubert, Jakob, Joachim, Johannes, Josef, Kai, Kilian, Leopold, Lutz, Mathis, Melvin, Merlin, Mirko,
Nils, Oskar, Rüdiger, Silas, Theo, Vincent, Willi, Xaver, Armin, Bodo, Dietmar, Elmar, Gisbert, Hartmut, Ingolf, Jochen, Kuno, Wendelin`,
`Müller, Schmidt, Schneider, Fischer, Weber, Meyer, Wagner, Becker, Schulz, Hoffmann, Schäfer, Koch, Bauer, Richter, Klein, Wolf, Schröder, Neumann,
Schwarz, Zimmermann, Braun, Krüger, Hofmann, Hartmann, Lange, Schmitt, Werner, Schmitz, Krause, Meier, Lehmann, Schmid, Schulze, Maier, Köhler,
Herrmann, König, Walter, Mayer, Huber, Kaiser, Fuchs, Peters, Lang, Scholz, Möller, Weiß, Jung, Hahn, Schubert, Vogel, Friedrich, Keller, Günther,
Frank, Berger, Winkler, Roth, Beck, Lorenz, Baumann, Franke, Albrecht, Schuster, Simon, Ludwig, Böhm, Winter, Kraus, Martin, Schumacher, Krämer, Vogt,
Stein, Jäger, Otto, Sommer, Groß, Seidel, Heinrich, Brandt, Haas, Schreiber, Graf, Schulte, Dietrich, Ziegler, Kuhn, Kühn, Pohl, Engel, Horn, Busch,
Bergmann, Thomas, Voigt, Sauer, Arnold, Wolff, Pfeiffer, Aigner, Amann, Anders, Auer, Bachmann, Baier, Barth, Bender, Bernhardt, Binder, Blum, Bock,
Brinkmann, Bruckner, Buchholz, Burger, Dahl, Decker, Diehl, Dörr, Eberhardt, Ebner, Eckert, Ehrlich, Eichhorn, Emmerich, Erdmann, Falk, Feldmann,
Fiedler, Fink, Förster, Freitag, Fröhlich, Gebhardt, Geiger, Gerber, Giese, Glaser, Gross, Gruber, Hagen, Hammer, Hanke, Hecht, Heide, Heine, Heller,
Hermann, Hess, Hirsch, Hock, Holz, Huth, Jahn, Jansen, Kamp, Kern, Kirchner, Klose, Knapp, Koller, Kramer, Kunz, Kurz, Lenz, Lindner, Lutz, Mack,
Maurer, Mertens, Metz, Moser, Naumann, Nowak, Oberhauser, Peter, Pfaff, Pieper, Rapp, Reimann, Reuter, Riedel, Ritter, Roder, Rose, Rothe, Sander,
Schaefer, Scheffler, Schiller, Schlegel, Schindler, Schmidtke, Schott, Schütz, Seifert, Siebert, Specht, Stadler, Steiner, Stoll, Strobel, Thiel,
Ullrich, Unger, Wegener, Weidner, Weiss, Wendt, Wenzel, Wieland, Winkelmann, Wirth, Witt, Wittmann, Wunderlich, Zander, Zeller, Zimmer, Zöller, Bohn,
Brenner, Dreher, Eder, Egger, Gasser, Hofer, Holzer, Kofler, Leitner, Mair, Moosbrugger, Pichler, Reiter, Steinbauer, Thaler, Wallner, Wimmer,
Zehetner, Baumgartner, Frei, Gerster, Achenbach, Adler, Ahrens, Albers, Altmann, Ammon, Appel, Bader, Behrens, Beyer, Bode, Bosch, Brandl, Breuer,
Brückner, Buck, Christ, Claasen, Damm, Dörner, Dreyer, Eggert, Engelhardt, Faber, Fendt, Fleischer, Frey, Gabler, Gaertner, Geißler, Grimm, Haag,
Hauser, Heck, Heinz, Henkel, Herzog, Hinz, Hoffmeister, Hübner, Jacobi, Jakob, Kästner, Kellner, Kluge, Knoll, Köhn, Krebs, Kröger, Lauer, Lemke,
Linke, Löffler, Marx, Mohr, Neubauer, Noll, Ott, Rieger, Rösch, Sauter, Seitz, Stahl, Tauber, Vollmer, Wendland, Zabel, Zeidler, Ackermann, Bäumer,
Conrad, Dörfler`);

// ---- french
def('french',
`Lucas, Hugo, Louis, Gabriel, Arthur, Jules, Nathan, Théo, Enzo, Léo, Mathis, Tom, Maxime, Thomas, Antoine, Alexandre, Quentin, Julien, Nicolas, Romain,
Clément, Florian, Kévin, Valentin, Baptiste, Adrien, Bastien, Benjamin, Corentin, Damien, Dylan, Étienne, Fabien, Flavien, Guillaume, Jérémy, Jordan,
Léon, Loïc, Mathieu, Matthieu, Mehdi, Morgan, Pierre, Rémi, Rémy, Sébastien, Simon, Steven, Sylvain, Tristan, Vincent, Yanis, Yohan, Alexis, Anthony,
Aurélien, Axel, Bruno, Cédric, Christophe, Damiano, David, Denis, Dorian, Éric, Fabrice, Franck, Gaël, Gaëtan, Gérard, Grégory, Hervé, Ibrahim, Jean,
Jérôme, Johan, Joël, Laurent, Ludovic, Marc, Marcel, Mickaël, Nabil, Olivier, Pascal, Patrice, Raphaël, Rayan, Stéphane, Teddy, Thibault, Timothée,
Xavier, Yann, Yvan, Amaury, Amine, Arnaud, Aymeric, Brice, Cyril, Didier, Dimitri, Edgar, Émile, Florent, Frédéric, Gilles, Hadrien, Henri, Jocelyn,
Karim, Killian, Lilian, Lionel, Lyes, Malik, Marius, Maël, Maurice, Mickael, Noé, Oscar, Philippe, Rodolphe, Samuel, Sofiane, Tanguy, Victor, Wilfried,
Yacine, Yoann, Zacharie, Anselme, Armand, Aubin, Basile, Bertrand, Casimir, Cyprien, Désiré, Eliott, Emeric, Eudes, Gonzague, Gustave, Honoré,
Hyppolite, Lazare, Lucien, Martial, Octave, Sacha, Séraphin, Ulysse, Valère, Yves, Gwenaël, Lancelot, Roméo, Alban, Anatole, Cosme, Fulbert`,
`Martin, Bernard, Dubois, Thomas, Robert, Richard, Petit, Durand, Leroy, Moreau, Simon, Laurent, Lefebvre, Michel, Garcia, David, Bertrand, Roux,
Vincent, Fournier, Morel, Girard, André, Lefèvre, Mercier, Dupont, Lambert, Bonnet, François, Martinez, Legrand, Garnier, Faure, Rousseau, Blanc,
Guerin, Muller, Henry, Roussel, Nicolas, Perrin, Morin, Mathieu, Clément, Gauthier, Dumont, Lopez, Fontaine, Chevalier, Robin, Masson, Sanchez, Gérard,
Nguyen, Boyer, Denis, Lemaire, Duval, Joly, Gautier, Roger, Roche, Roy, Noël, Meyer, Lucas, Meunier, Jean, Perez, Marchand, Dufour, Blanchard, Marie,
Barbier, Brun, Dumas, Brunet, Schmitt, Leroux, Colin, Fernandez, Pierre, Renard, Arnaud, Rolland, Caron, Aubert, Giraud, Leclerc, Vidal, Bourgeois,
Renaud, Lemoine, Picard, Gaillard, Philippe, Leclercq, Lacroix, Fabre, Dupuis, Olivier, Rodriguez, Da Silva, Hubert, Louis, Charles, Guillot, Rivière,
Le Gall, Guillaume, Adam, Rey, Moulin, Gonzalez, Berger, Lecomte, Menard, Fleury, Deschamps, Carpentier, Julien, Benoit, Paris, Maillard, Marchal,
Aubry, Vasseur, Le Roux, Renault, Jacquet, Collet, Prevost, Poirier, Charpentier, Royer, Huet, Baron, Dupuy, Pons, Lebrun, Alexandre, Baudouin, Bazin,
Beaumont, Bellanger, Bertin, Besnard, Bigot, Blondel, Boissier, Bouchard, Boucher, Bouvier, Brault, Briand, Cartier, Chabert, Chauvin, Chevallier,
Clair, Cochet, Corbin, Cordier, Cottin, Courtois, Delmas, Delorme, Descamps, Devaux, Dubreuil, Duchamp, Dufresne, Dugas, Dupré, Ferrand, Foucher,
Gagnon, Gilbert, Godard, Grégoire, Guérin, Hamon, Hardy, Hébert, Imbert, Jacob, Jourdan, Labbé, Lacombe, Lagarde, Lamy, Langlois, Lapierre, Launay,
Lebon, Leblanc, Lefort, Legendre, Lejeune, Lemonnier, Leveque, Liénard, Maury, Merle, Mercadier, Monnier, Navarro, Normand, Pasquier, Pelletier,
Perret, Pichon, Pineau, Poulain, Prévost, Rault, Reynaud, Ricard, Riviere, Roland, Rouget, Sabatier, Sauvage, Tessier, Thibault, Tixier, Vallée,
Vaillant, Verdier, Vernet, Weber, Aillaud, Boisseau, Brochard, Cazenave, Delattre, Etchegaray, Lavigne, Peyrot, Saunier, Aubin, Barre, Bastien,
Beaulieu, Berthelot, Bocquet, Bonhomme, Bordier, Bourdon, Brossard, Cassagne, Chauvet, Chevrier, Colas, Combes, Courant, Daumas, Delaunay, Desjardins,
Doucet, Dufay, Duhamel, Esnault, Fauré, Ferry, Fouquet, Gaudin, Gely, Germain, Gosselin, Grandin, Guyot, Hennequin, Jolivet, Klein, Lacaze, Lafont,
Lamarque, Larue, Lebreton, Legros, Lemaître, Macé, Mallet, Marty, Maupas, Mazet, Millet, Mouton, Nivet, Parmentier, Pellerin, Rabier, Rémy, Rouquier,
Salmon, Teyssier, Valette, Vigier, Barbe, Chastel, Dalmas, Ferrier, Guillemin, Lenoir, Maurin, Piquet, Aubriot, Bellamy, Cabanis, Delahaye, Escoffier,
Fabrègue, Gaultier, Hugon, Ledoux, Marcoux`);

// ---- dutch-flemish
def('dutch-flemish',
`Daan, Sem, Luuk, Bram, Milan, Thijs, Jesse, Tim, Lars, Ruben, Sven, Stijn, Niels, Mees, Finn, Levi, Noah, Jayden, Thomas, Max, Joris, Joost, Jelle,
Jeroen, Jasper, Jan, Gijs, Floris, Dennis, Davy, Dirk, Dries, Erik, Frank, Hans, Hendrik, Hugo, Ivo, Jurgen, Kasper, Koen, Kees, Marcel, Mark, Martijn,
Mathijs, Maurits, Michiel, Mitchell, Nick, Pepijn, Pieter, Quinten, Rick, Robin, Rob, Roel, Rutger, Sander, Sjoerd, Stefan, Teun, Tijs, Tom, Wesley,
Wout, Wouter, Xander, Youri, Bas, Berend, Boaz, Bob, Casper, Cas, Cor, Dave, Diederik, Dion, Dylan, Edwin, Evert, Freek, Geert, Gerrit, Gert, Guus,
Harm, Henk, Jaap, Jacco, Jord, Kevin, Kobe, Laurens, Lieuwe, Lodewijk, Luc, Maarten, Menno, Nathan, Niek, Olaf, Paul, Peter, Raf, Ramon, Remco, Rens,
Ruud, Siem, Simon, Sten, Thijmen, Vince, Wim, Willem, Yannick, Arnoud, Bart, Bastiaan, Bert, Cornelis, Daniël, Dimitri, Eelco, Elias, Fabian, Fedde,
Gerben, Gilles, Hidde, Iwan, Jens, Johan, Jorn, Kay, Lennart, Liam, Lukas, Matthias, Mike, Noud, Nout, Olivier, Rafael, Reinier, Sebastiaan, Senne,
Stan, Tobias, Victor, Warre, Yorick, Zeger, Arne, Brecht, Dieter, Aldert, Eelke, Gerlof, Hielke, Jurre, Sybren, Tjeerd, Wiebe, Anton`,
`de Jong, Jansen, de Vries, van den Berg, van Dijk, Bakker, Janssen, Visser, Smit, Meijer, de Boer, Mulder, de Groot, Bos, Vos, Peters, Hendriks,
van Leeuwen, Dekker, Brouwer, de Wit, Dijkstra, Smits, de Graaf, van der Meer, van der Linden, Kok, Jacobs, de Haan, Vermeulen, van den Heuvel,
van der Veen, van den Broek, de Bruijn, de Bruin, Schouten, van Beek, Willems, van Vliet, van de Ven, Hoekstra, Maas, Verhoeven, Koster, Prins, Blom,
Huisman, Peeters, Kuipers, Hermans, van Rijn, Pieters, Kramer, Martens, van der Heijden, Mertens, Claes, Wouters, Goossens, De Smet, Vandenberghe,
Lambrechts, Maes, Vanhoutte, Verbruggen, Desmet, Declercq, Van Damme, Van Acker, Van Hecke, Vandamme, Verstraeten, Vermaelen, Stevens, Cools, Coppens,
De Cock, De Coster, De Pauw, Dewaele, Dhondt, Everaerts, Heylen, Hoste, Lemmens, Michiels, Pauwels, Segers, Segaert, Thys, Van Aken, Van Dam,
Van Eycken, Van Gucht, Van Hoof, Vandevelde, Verheyen, Wuyts, Aarts, Albers, Bergman, Beukers, Boelens, Boer, Bouwman, Brand, Bruggeman, Buijs,
Claassen, Compeer, Cornelissen, Dam, Dirks, Doornbos, Driessen, Elzinga, Evers, Fransen, Gerritsen, Goedhart, Gommers, Haring, Hartman, Heijne,
Hoogland, Houtman, Hulshof, Ijzerman, Jonker, Kamphuis, Keizer, Klaassen, Knol, Koning, Kroon, Kuiper, Lammers, Lubbers, Mans, Meester, Molenaar,
Nijland, Oosterhuis, Ouwehand, Pol, Post, Rademaker, Roelofs, Rutten, Scholten, Sluis, Spaans, Stoel, Tromp, Valk, Veldhuis, Verbeek, Vermeer,
Visscher, Wolters, Zwart, Zijlstra, van Zanten, van Wijk, van Veen, van Rooij, van Oort, van Loon, van Hout, van Gils, van Eijk, van der Wal,
van der Pol, van der Sluis, van der Horst, van Gelder, van Dam, van Aalst, Aerts, Baert, Baeten, Bogaert, Bosmans, Cammaert, Callewaert, Christiaens,
Colpaert, Daems, De Backer, De Bock, De Clercq, De Ridder, De Rycke, De Wolf, Delbaere, Deprez, D'Hondt, Dumortier, Geerts, Heirbaut, Hellemans,
Hendrickx, Janssens, Lauwers, Leemans, Luyten, Mathijs, Meert, Nys, Op de Beeck, Pelgrims, Ryckaert, Slabbinck, Smeets, Staelens, Tielemans, Tuytens,
Van Looy, Van Rompuy, Vanderstraeten, Verbeeck, Vercammen, Verhaeghe, Verlinden, Vermeersch, Vervoort, Wauters, Wijns, Willaert, Yperman, Boonen,
Cuyvers, Dehaene, Geeraerts, Hanssens, Moens, Aalbers, Admiraal, Bakhuis, Bastiaans, Baas, Bijl, Bloem, Boom, Bosch, Brinkman, Bulthuis, Burger,
Colijn, Cremers, De Lange, De Rooij, De Vos, Dorrestijn, Elshout, Enthoven, Feenstra, Fokkema, Gielen, Grootveld, Haverkamp, Heerema, Hogeveen,
Huijbregts, Jaspers, Kleijn, Koopman, Kuijpers, Lagerwaard, Loman, Mastenbroek, Nieuwenhuis, Oostenbrink, Pothoven, Ramaker, Schipper, Snel, Teunissen,
Tuinman, Vink, Wassink, Zandbergen, Zeelenberg, Ter Horst, Hartog, Appelman, Bouma, Dikken, Eikelboom, Faber, Gerritse, Hofman, Ijsselmuiden,
Kamerling, Leenders, Mooij, Nagtegaal, Oudshoorn, Pijnenburg, Quist, Reijnders, Sturm, Tolhuizen, Uithol, Beerends, Bleeker, Dankers, Egberts, Gubbels,
Hoogeveen, Ketelaar, Lutke, Meulenbelt, Noordhoek, Oldenburg, Panhuis, Raaijmakers, Stienstra, Tiemens, Vaessen, Winters`);

// ---- scandinavian
def('scandinavian',
`Erik, Lars, Anders, Johan, Magnus, Nils, Olof, Per, Karl, Mikael, Fredrik, Henrik, Jonas, Mattias, Oskar, Viktor, William, Filip, Emil, Elias,
Alexander, Axel, Gustav, Hugo, Ludvig, Albin, Leo, Isak, Noah, Lucas, Sebastian, Simon, Jesper, Kasper, Mads, Mikkel, Rasmus, Søren, Thomas, Kristian,
Frederik, Morten, Martin, Nicolai, Christian, Jakob, Jens, Jonathan, Peter, Michael, Ole, Poul, Bjarne, Claus, Dennis, Flemming, Hans, Ib, Jørgen, Kim,
Knud, Niels, Palle, Steen, Torben, Anton, Aksel, Bendik, Bjørn, Eirik, Espen, Even, Geir, Halvor, Harald, Håkon, Ivar, Jan, Jørn, Kjetil, Knut, Lasse,
Leif, Magne, Ola, Ørjan, Ragnar, Rolf, Sander, Sigurd, Stian, Sverre, Terje, Trond, Tor, Trygve, Ulf, Vegard, Aleksander, Andreas, Birger, Bo,
Christer, Dag, Dan, Daniel, Edvin, Gunnar, Göran, Hampus, Jacob, Joakim, Kent, Kjell, Linus, Lennart, Marcus, Mats, Melker, Niklas, Patrik, Pontus,
Roger, Rickard, Robin, Sten, Stefan, Sune, Tobias, Tomas, Vidar, Wilhelm, Adam, Arvid, Björn, Carl, Casper, Ebbe, Eskil, Frej, Gabriel, Hjalmar, Hakon,
Isaac, Jarl, Kalle, Mathias, Nikolaj, Oliver, Rune, Sixten, Valdemar, Vilhelm, Yngve, Åke, Ørnulf, Gísli, Helgi, Sigurdur, Pelle, Torsten, Alvar,
Bertil, Egil, Gudmund, Halfdan, Torkel`,
`Andersson, Johansson, Karlsson, Nilsson, Eriksson, Larsson, Olsson, Persson, Svensson, Gustafsson, Pettersson, Jonsson, Jansson, Hansson, Bengtsson,
Jönsson, Lindberg, Jakobsson, Magnusson, Lindström, Olofsson, Lindqvist, Lindgren, Axelsson, Berg, Bergström, Lundberg, Lind, Lundgren, Mattsson,
Berglund, Fredriksson, Sandberg, Henriksson, Forsberg, Sjöberg, Wallin, Engström, Eklund, Danielsson, Hakansson, Lundin, Gunnarsson, Björk, Bergman,
Holm, Wikström, Isaksson, Fransson, Bergqvist, Nyström, Holmberg, Arvidsson, Löfgren, Söderberg, Nyberg, Blomqvist, Claesson, Nordström, Mårtensson,
Hansen, Jensen, Nielsen, Pedersen, Andersen, Christensen, Larsen, Sørensen, Rasmussen, Jørgensen, Petersen, Madsen, Kristensen, Olsen, Thomsen,
Christiansen, Poulsen, Johansen, Møller, Mortensen, Knudsen, Jakobsen, Jacobsen, Mikkelsen, Olesen, Frederiksen, Laursen, Henriksen, Lund, Schmidt,
Eriksen, Kristiansen, Simonsen, Clausen, Svendsen, Andreasen, Iversen, Jeppesen, Mogensen, Dahl, Jespersen, Vestergaard, Nygaard, Bech, Brandt,
Winther, Skov, Lauridsen, Friis, Nissen, Overgaard, Kjær, Toft, Bundgaard, Damgaard, Egelund, Hauge, Holst, Krogh, Haugen, Strand, Bakken, Moen,
Solberg, Kristoffersen, Halvorsen, Berge, Eide, Gundersen, Hagen, Lie, Nygård, Pettersen, Rønning, Sæther, Tangen, Thorsen, Aasen, Amundsen, Ellingsen,
Engen, Fjeld, Foss, Gran, Grønvold, Haraldsen, Helland, Heggem, Holen, Husby, Kolstad, Lorentzen, Myhre, Nilsen, Opsahl, Paulsen, Ruud, Skjelbred,
Sletten, Stene, Sundby, Tollefsen, Vik, Wold, Aaberg, Alm, Åkesson, Ahlberg, Bäck, Blom, Bergh, Brolin, Dahlberg, Ekström, Ek, Falk, Flink, Forss,
Granqvist, Hagström, Hedlund, Hellström, Hjort, Högberg, Jarl, Kvist, Landin, Lantz, Lidén, Lövgren, Malm, Norberg, Norén, Ohlsson, Palm, Roos, Rydén,
Sahlin, Sundström, Törnqvist, Ulfsson, Wahlberg, Wennerström, Westin, Ytterberg, Zetterberg, Östberg, Abrahamsson, Alfredsson, Brännström, Dalin,
Edlund, Enqvist, Folkesson, Hallgren, Hedman, Hägglund, Kjellberg, Leandersson, Lagerström, Melin, Nylund, Ohman, Rosén, Sjögren, Stenberg, Strömberg,
Tegnér, Wiklund, Wallgren, Gíslason, Jónsson, Sigurdsson, Gudmundsson, Magnússon, Helgason, Arnarson, Björnsson, Haraldsson, Ólafsson, Thorsteinsson,
Abrahamsen, Ahlgren, Alsing, Appelgren, Arnesen, Axelsen, Backman, Bergsten, Bjerke, Bladh, Bohlin, Brandvold, Carlsen, Dalgaard, Dyrberg, Eggen,
Ekeberg, Falkenberg, Fridh, Frost, Gjerde, Hallberg, Hammarström, Hedegaard, Hjelm, Holmgren, Husom, Isaksen, Jarlsson, Kallio, Karlstad, Kjeldsen,
Lagergren, Lehtonen, Lillevik, Mathisen, Midtgård, Moberg, Nordahl, Oddsson, Pihl, Qvist, Rosendahl, Rydh, Saether, Thorvaldsen, Wedin, Aronsson,
Bjurström, Dahlgren, Edvardsen, Fagerström, Gabrielsen, Hellqvist, Ivarsson, Jernberg, Kjellman, Lorentsson, Ahlqvist, Bergenholtz, Bjørnstad,
Dalsgaard, Edberg, Fjellstad, Hedén, Ingebrigtsen, Kaspersen, Lindahl, Mellgren, Nordlund, Odenhall, Rafn, Skaar, Tvedt, Vingaard, Winge, Yttergren,
Åberg, Østergaard, Bakke, Dybvik, Evensen, Fossum, Gulbrandsen`);

// ---- slavic-west
def('slavic-west',
`Jakub, Jan, Kacper, Filip, Szymon, Michał, Mateusz, Wojciech, Tomasz, Marcin, Paweł, Piotr, Krzysztof, Adam, Bartosz, Dawid, Kamil, Łukasz, Maciej,
Marek, Patryk, Przemysław, Rafał, Robert, Sebastian, Sylwester, Tadeusz, Wiktor, Zbigniew, Damian, Dominik, Grzegorz, Hubert, Igor, Jarosław, Konrad,
Leszek, Mariusz, Norbert, Oskar, Radosław, Stanisław, Stefan, Artur, Błażej, Cezary, Dariusz, Emil, Fabian, Gabriel, Henryk, Ireneusz, Janusz, Karol,
Lech, Leon, Mirosław, Olaf, Roman, Sławomir, Tymon, Waldemar, Witold, Zdzisław, Antoni, Bogdan, Czesław, Eryk, Franciszek, Gustaw, Ignacy, Jerzy,
Kazimierz, Lucjan, Maksymilian, Mikołaj, Nikodem, Oliwier, Remigiusz, Seweryn, Vojtěch, Tomáš, Ondřej, Martin, Lukáš, Matěj, David, Daniel, Jaroslav,
Jiří, Josef, Karel, Michal, Miroslav, Pavel, Petr, Radek, Stanislav, Šimon, Václav, Vladimír, Zdeněk, Aleš, Antonín, Bohumil, Břetislav, Ctibor, Denis,
Dušan, Eduard, František, Hynek, Ivo, Jindřich, Lubomír, Luděk, Marian, Milan, Milos, Ondra, Patrik, Radim, Richard, Rostislav, Svatopluk, Vít,
Vlastimil, Zbyněk, Peter, Juraj, Jozef, Ján, Štefan, Róbert, Ladislav, Samuel, Miloš, Rastislav, Branislav, Dávid, Erik, Ivan, Kristián, Matúš, Oliver,
Tibor, Viliam, Ludvík, Mojmír, Radomír, Ctirad, Dalibor, Bronisław, Julian, Kornel, Walenty, Ryszard`,
`Nowak, Kowalski, Wiśniewski, Wójcik, Kowalczyk, Kamiński, Zieliński, Szymański, Woźniak, Dąbrowski, Kozłowski, Jankowski, Mazur, Kwiatkowski,
Wojciechowski, Krawczyk, Kaczmarek, Piotrowski, Grabowski, Zając, Pawłowski, Michalski, Król, Wieczorek, Jabłoński, Wróbel, Nowakowski, Majewski,
Olszewski, Stępień, Malinowski, Jaworski, Adamczyk, Dudek, Nowicki, Pawlak, Górski, Witkowski, Walczak, Sikora, Baran, Rutkowski, Michalak, Szewczyk,
Ostrowski, Tomaszewski, Pietrzak, Zalewski, Wróblewski, Jasiński, Marciniak, Bąk, Zawadzki, Sadowski, Jakubowski, Wilk, Włodarczyk, Chmielewski,
Borkowski, Sokołowski, Szczepański, Sawicki, Kucharski, Lis, Maciejewski, Kubiak, Kalinowski, Mazurek, Wysocki, Kołodziej, Kaźmierczak, Czarnecki,
Konieczny, Urbański, Głowacki, Cieślak, Krupa, Gajewski, Novák, Svoboda, Novotný, Dvořák, Černý, Procházka, Kučera, Veselý, Horák, Němec, Pokorný,
Marek, Pospíšil, Hájek, Jelínek, Král, Růžička, Beneš, Fiala, Sedláček, Doležal, Zeman, Kolář, Navrátil, Čermák, Urban, Vaněk, Blažek, Kříž, Kovář,
Bartoš, Vlček, Polák, Musil, Šimek, Konečný, Malý, Holub, Štěpánek, Kadlec, Soukup, Mareš, Moravec, Havlíček, Tichý, Dostál, Šťastný, Bureš, Matoušek,
Ševčík, Vávra, Kopecký, Slavík, Hruška, Šindelář, Janda, Vondra, Čech, Zelenka, Vojtek, Horváth, Kováč, Varga, Tóth, Nagy, Baláž, Szabó, Molnár, Lukáč,
Kollár, Kráľ, Balog, Oravec, Mikula, Gajdoš, Hudák, Sloboda, Michalík, Blaho, Hrušovský, Adamski, Bielecki, Brzezinski, Budzyński, Chojnacki, Cichocki,
Czerwiński, Dziedzic, Fijałkowski, Gołębiowski, Grzelak, Jędrzejczyk, Kępa, Kopczyński, Krajewski, Kubacki, Lasota, Łukasiewicz, Mroczek, Musiał,
Orłowski, Pająk, Pasek, Rogalski, Różycki, Sobczak, Stachowiak, Staniszewski, Szulc, Tracz, Wasilewski, Wojtasik, Zakrzewski, Żurek, Bednář,
Bělohlávek, Bílek, Brabec, Doubek, Haas, Hrubý, Jirásek, Kalous, Klíma, Kubát, Lukeš, Macháček, Mládek, Pešek, Rybář, Šebesta, Štěpán, Trojan, Vacek,
Vrána, Zíka, Bobák, Fabián, Hlavatý, Kmeť, Lazar, Macko, Pavlík, Šimko, Tomko, Adamec, Andrle, Babiak, Bartosik, Bielak, Blahut, Bochenek, Bogacz,
Cygan, Czajka, Dobrowolski, Drozd, Dybowski, Filipek, Gawron, Gil, Gołąb, Hajduk, Hnilica, Holeček, Jagielski, Janiszewski, Jasek, Kaczor, Kania,
Kasprzak, Klimek, Kopeć, Kos, Kowalik, Kubicki, Kurek, Kwiecień, Lach, Lipka, Łuczak, Majchrzak, Mrozek, Nawrocki, Pachołek, Pietrzyk, Rybka, Siwek,
Sowa, Strzelecki, Śliwa, Tomczak, Wawrzyniak, Zdunek, Žák, Šmíd, Beran, Čapek, Dušek, Hruban, Jahoda, Kubíček, Mach, Němeček, Oplatek, Pech, Rejman,
Tůma, Votava, Zoubek, Bako, Dzurinda, Hanus, Hrnčiar, Ivanič, Jurík, Kuruc, Lacko, Pastor, Sivák, Bartoň, Cibulka, Dolejš, Fojtík, Gabriel, Horký,
Chládek, Janoušek, Brychta, Chmelař, Dlouhý, Fabiš, Havránek`);

// ---- slavic-south
def('slavic-south',
`Marko, Luka, Ivan, Josip, Ante, Mateo, Filip, Petar, Nikola, Stjepan, Tomislav, Dario, Domagoj, Dino, Duje, Dominik, Fran, Karlo, Leon, Lovro, Matija,
Mislav, Nino, Roko, Toni, Zvonimir, Andrej, Bruno, Davor, Goran, Hrvoje, Igor, Jakov, Krešimir, Mario, Mladen, Neven, Robert, Slaven, Vedran,
Aleksandar, Stefan, Nemanja, Miloš, Dušan, Vladimir, Uroš, Lazar, Đorđe, Nenad, Milan, Branko, Dragan, Zoran, Predrag, Bojan, Boris, Darko, Dejan,
Dragoljub, Ðuro, Ilija, Jovan, Kosta, Ljubomir, Mihajlo, Miodrag, Mirko, Nebojša, Novak, Obrad, Pavle, Radoslav, Rade, Sava, Slobodan, Srđan, Svetozar,
Veljko, Vuk, Zlatan, Žarko, Žiga, Matej, Jure, Tilen, Anže, Blaž, Domen, Gašper, Jaka, Jan, Klemen, Miha, Nejc, Rok, Tadej, Urban, Primož, Aljaž,
Damjan, Grega, Marjan, Peter, Simon, Tine, Vid, Georgi, Dimitar, Ivaylo, Hristo, Kiril, Stoyan, Todor, Plamen, Nikolay, Boyan, Krasimir, Martin, Petko,
Rumen, Svetoslav, Tihomir, Valentin, Veselin, Yordan, Zhivko, Anton, Asen, Atanas, Borislav, Emil, Evgeni, Galin, Iliya, Kalin, Lyubomir, Mitko, Orlin,
Preslav, Rosen, Stanimir, Tsvetan, Viktor, Yavor, Zdravko, Amar, Edin, Haris, Jasmin, Kenan, Mirza, Nermin, Sead, Antun, Ratko, Tvrtko, Velimir,
Branimir, Davorin, Ljubo, Miroslav`,
`Horvat, Kovačević, Babić, Marić, Novak, Jurić, Kovačić, Knežević, Vuković, Marković, Petrović, Matić, Tomić, Pavlović, Božić, Blažević, Grgić, Pavić,
Radić, Perić, Filipović, Šarić, Lovrić, Vidović, Perković, Popović, Bošnjak, Jukić, Barišić, Abramović, Marušić, Mikulić, Burić, Zorić, Matković,
Vrdoljak, Mandić, Pranjić, Šimunović, Bašić, Jovanović, Nikolić, Đorđević, Ilić, Stojanović, Simić, Stanković, Mitrović, Lazić, Milošević,
Dimitrijević, Živković, Savić, Kostić, Todorović, Milenković, Obradović, Stefanović, Vasić, Pešić, Jović, Radovanović, Ristić, Vujić, Lukić, Cvetković,
Janković, Nešić, Krstić, Jevtić, Maksimović, Tasić, Mijailović, Veselinović, Gajić, Spasić, Radulović, Mirković, Bogdanović, Stojković, Aleksić,
Ćirković, Dragović, Erceg, Franjić, Glavaš, Huljić, Ivanković, Jelić, Kordić, Kralj, Lasić, Leko, Majić, Mihaljević, Mrkonjić, Nuić, Orlović, Paponja,
Rakić, Rogić, Sertić, Skoko, Šunjić, Tadić, Tolić, Ugarković, Vukelić, Zebić, Žanetić, Zovko, Anić, Bakić, Bandić, Cindrić, Dujmović, Fabijanić,
Gudelj, Hrstić, Kos, Kovač, Zupan, Krajnc, Mlakar, Korošec, Hribar, Kotnik, Golob, Zajc, Bizjak, Potočnik, Kolar, Žagar, Vidmar, Oblak, Turk, Kavčič,
Hočevar, Rozman, Kastelic, Mihelič, Perko, Pirc, Škof, Tomšič, Vovk, Zupančič, Ažman, Čeh, Fabjan, Jerman, Lah, Majcen, Novšak, Podgornik, Rupnik,
Sever, Škrlj, Ivanov, Georgiev, Dimitrov, Petrov, Todorov, Nikolov, Stoyanov, Angelov, Hristov, Kolev, Popov, Iliev, Vasilev, Yordanov, Marinov, Tonev,
Zhelev, Bonev, Dobrev, Peev, Manev, Mihaylov, Radev, Rusev, Stefanov, Tsvetkov, Vladimirov, Yanev, Zlatev, Atanasov, Bachev, Genov, Hadzhiev,
Karadzhov, Lazarov, Mladenov, Panov, Rashkov, Simeonov, Tsonev, Alić, Bajrić, Čaušević, Delić, Džaferović, Hadžić, Halilović, Handžić, Hasanović,
Hodžić, Imamović, Kapetanović, Kurtović, Memić, Mujić, Omerović, Pašić, Selimović, Smajić, Softić, Šehić, Tahirović, Terzić, Vranješ, Zukić, Begić,
Cerić, Dedić, Đulić, Ferhatović, Gazibegović, Husić, Jusić, Kadić, Lokvančić, Mahmutović, Osmanović, Rizvanović, Sarajlić, Salihović, Akrap, Alerić,
Balić, Banović, Beganović, Bilić, Bogdanić, Brkić, Brajković, Cvitanović, Čolak, Ćosić, Dragičević, Dukić, Đukić, Erdelja, Gavrilović, Grubišić,
Hadžiabdić, Ivančević, Jakovljević, Jerković, Kasalo, Kolarić, Kuzmanović, Lončar, Majstorović, Mikić, Milić, Mlinarić, Novaković, Ostojić, Pandža,
Pejić, Petrić, Plavšić, Radosavljević, Ravlić, Salopek, Škoro, Tešić, Tomašević, Trifunović, Vlahović, Vojnović, Vukadinović, Zlatković, Žugić,
Bajčetić, Drobnjak, Gligorić, Jaćimović, Kecman, Lalić, Maletić, Nikodijević, Opačić, Popadić, Rašković, Subotić, Todosijević, Vranić, Antonić, Barać,
Cvijanović, Dragaš, Eterović, Ferenčak, Gojak, Hrnjić`);

// ---- balkan
def('balkan',
`Arben, Besnik, Blerim, Bujar, Dardan, Drilon, Endrit, Erion, Fatos, Flamur, Genc, Gentian, Gezim, Ilir, Ismail, Kastriot, Klodian, Kreshnik, Lirim,
Luan, Mentor, Mergim, Naim, Orges, Orion, Perparim, Qemal, Rexhep, Sokol, Taulant, Valon, Visar, Xhevat, Ylli, Zamir, Agim, Albert, Altin, Armando,
Artan, Astrit, Behar, Berat, Bekim, Burim, Daut, Dorian, Egzon, Elvis, Enis, Eraldo, Ermal, Fisnik, Florian, Granit, Hajdar, Hysen, Idriz, Jetmir,
Kushtrim, Labinot, Leart, Liridon, Muhamet, Nderim, Nikolla, Pellumb, Petrit, Plator, Rinor, Robert, Rrahman, Saimir, Sabri, Shkelzen, Skender, Stivi,
Tomor, Valdet, Veton, Vigan, Xhelil, Yll, Zef, Zenel, Ardit, Bardh, Besart, Bleron, Dukagjin, Edon, Elton, Endri, Fidan, Gazmend, Hekuran, Ibrahim,
Jahir, Kristian, Lorik, Mikel, Naser, Olsi, Rron, Shpend, Teuta, Vullnet, Arlind, Blendi, Dritan, Eduard, Fred, Gjergj, Hamdi, Igli, Julian, Klajdi,
Lorenc, Marsel, Nertil, Aleksandar, Darko, Goran, Zoran, Trajko, Vlatko, Blagoja, Boban, Dragan, Gjorgji, Igor, Kiril, Ljupco, Mile, Nikola, Pance,
Risto, Stojan, Toni, Vlade, Andrija, Balša, Danilo, Draško, Jovan, Luka, Mirko, Nikša, Stefan, Vuk, Zarko, Marko, Milos, Radomir, Savo, Slavoljub,
Uros, Vasilije, Vojin, Adem, Fadil, Haxhi, Isa, Jeton, Kujtim, Ledjan, Mark, Nexhat, Orhan`,
`Hoxha, Shehu, Prifti, Dervishi, Hysi, Kola, Leka, Marku, Gjoka, Basha, Berisha, Krasniqi, Gashi, Morina, Kelmendi, Shala, Bytyqi, Rama, Hasani, Ahmeti,
Sadiku, Rexhepi, Jashari, Murati, Mehmeti, Kastrati, Bajrami, Zeqiri, Tahiri, Haliti, Selimi, Aliu, Ismaili, Osmani, Dautaj, Dedja, Duka, Elezi,
Frasheri, Gjini, Hajdari, Halili, Isufi, Jahaj, Kalaja, Kodra, Koka, Lamaj, Lleshi, Malaj, Meta, Muka, Nika, Noka, Pashaj, Peci, Pjetri, Prenga, Qosja,
Rexha, Sala, Shkreli, Sinani, Spahiu, Tafa, Tola, Topalli, Vata, Veliaj, Xhaferi, Xhelili, Zela, Zogaj, Çela, Çani, Çollaku, Dajti, Deda, Doka, Gega,
Gjikondi, Hila, Kaçi, Kapllani, Kuka, Lika, Mazreku, Mema, Mucaj, Ndoj, Ndreu, Pema, Pllana, Preka, Ramadani, Rrapaj, Rugova, Salihu, Shabani,
Stojanovski, Trajkovski, Petrovski, Nikolovski, Ristevski, Dimitrievski, Jovanovski, Angelovski, Georgievski, Ilievski, Velkovski, Stefanovski,
Todorovski, Spasovski, Bogdanovski, Mitrevski, Naumovski, Pavlovski, Ristovski, Stojkovski, Arsovski, Aleksovski, Blazevski, Cvetkovski, Dojcinovski,
Gjorgjievski, Hristovski, Janevski, Kostovski, Lazarevski, Markovski, Micevski, Nastevski, Pejchinovski, Popovski, Samardziski, Temelkovski, Trpcevski,
Zafirovski, Zdravkovski, Vujović, Radonjić, Đurović, Perović, Bulatović, Vukčević, Jovićević, Šćepanović, Raičević, Lakićević, Martinović, Mugoša,
Nikčević, Pejović, Rakočević, Savićević, Tomašević, Ćetković, Ćulafić, Dašić, Drašković, Dubljević, Gazivoda, Ivanović, Janjušević, Lalatović,
Mijušković, Orlandić, Pavićević, Rađenović, Spahić, Stanišić, Vučinić, Zejak, Zindović, Žižić, Agolli, Alia, Balla, Bardhi, Bezhani, Bushati, Cani,
Cenaj, Delia, Dibra, Dushku, Fusha, Gjonaj, Gurra, Hoti, Jaupaj, Kaleshi, Kullolli, Lati, Lushaj, Metaj, Mullaj, Nushi, Pasha, Qyra, Rrota, Sulaj,
Tabaku, Ujka, Vorpsi, Xhafa, Zenelaj, Zeneli, Abazi, Behluli, Cakolli, Dreshaj, Dushi, Gjokaj, Hamiti, Abdyli, Aliji, Arifi, Avdiu, Bajra, Beqiri,
Bilali, Bojku, Brahimi, Bytyçi, Cakaj, Ceka, Daci, Dema, Dibrani, Doda, Dragusha, Fejzullahu, Fetahu, Gjonbalaj, Gjoni, Hadëri, Hajrullahu, Hamzaj,
Hazbiu, Hyseni, Isaku, Jakupi, Kadriu, Kallaba, Kida, Kolgjini, Kryeziu, Lleshaj, Loshi, Maloku, Muçaj, Mustafa, Nikaj, Palushi, Qerimi, Reçi,
Rrustemi, Selmani, Shehi, Sylejmani, Thaçi, Tërstena, Uka, Vokshi, Xhemajli, Zhubi, Zymberi, Aleksoski, Andonovski, Bojadziev, Cakarov, Dimov,
Gjuzelov, Janev, Kitanovski, Lazov, Nedelkovski, Stojanov, Tasevski, Vasilev, Zdravev, Brajović, Dedeić, Femić, Gojković, Hasanagić, Aliaj, Balliu,
Cuni, Dyrmishi, Elmazi, Gjikuria, Alimi, Bejtullahu, Cacaj, Dajlani, Elezaj, Frroku, Hoxhaj, Idrizi, Jonuzi, Kajtazi, Lajqi, Nrecaj, Pjetraj, Rexhaj,
Salihaj, Tahirsylaj, Veseli, Zeka, Zenuni, Ademi, Bardhoshi, Cenolli, Dobra, Ejupi`);

// ---- slavic-east
def('slavic-east',
`Alexander, Aleksei, Andrei, Anton, Artem, Boris, Daniil, Denis, Dmitri, Evgeni, Fyodor, Gleb, Igor, Ilya, Ivan, Kirill, Konstantin, Leonid, Maksim,
Mikhail, Nikita, Nikolai, Oleg, Pavel, Pyotr, Roman, Ruslan, Sergei, Stanislav, Timofei, Vadim, Valeri, Viktor, Vitali, Vladimir, Vladislav,
Vyacheslav, Yaroslav, Yuri, Zakhar, Arkady, Bogdan, Dmitry, Egor, Gennadi, Grigori, Kostya, Lev, Mark, Matvei, Miron, Nazar, Philipp, Rodion, Semyon,
Stepan, Taras, Trofim, Yan, Yegor, Oleksandr, Oleksiy, Andriy, Bohdan, Denys, Dmytro, Heorhiy, Hryhoriy, Ihor, Illia, Kyrylo, Maksym, Mykhailo, Mykola,
Oleh, Pavlo, Petro, Serhiy, Vasyl, Vitaliy, Volodymyr, Yevhen, Yuriy, Artur, Danylo, Eduard, Hennadiy, Kostiantyn, Marko, Mykyta, Nazariy, Orest,
Ostap, Svyatoslav, Vadym, Valentyn, Vladyslav, Zenon, Anatoly, Arseni, Afanasy, Alyosha, Dobrynya, Efim, Filipp, Foma, Gavriil, Ignat, Innokenty,
Kuzma, Lazar, Makar, Naum, Prokhor, Rostislav, Savely, Terenty, Ustin, Vsevolod, Yakov, Yefim, Yermolai, Zinovy, Aleksandr, Dima, Misha, Kolya, Sasha,
Vanya, Vlad, Zhenya, Sergey, Nikolay, Vasily, Yevgeny, Valery, Vitaly, Yury, Arseny, Lyubomyr, Mstyslav, Myroslav, Rostyslav, Afonya, Boleslav, Evgeny,
Feliks, Gordei, Ignaty, Kliment, Lavrenty, Mstislav, Rurik, Veniamin`,
`Ivanov, Smirnov, Kuznetsov, Popov, Vasiliev, Petrov, Sokolov, Mikhailov, Novikov, Fedorov, Morozov, Volkov, Alekseev, Lebedev, Semenov, Egorov, Pavlov,
Kozlov, Stepanov, Nikolaev, Orlov, Andreev, Makarov, Nikitin, Zakharov, Zaitsev, Soloviev, Borisov, Yakovlev, Grigoriev, Romanov, Vorobiev, Sergeev,
Kuzmin, Frolov, Alexandrov, Dmitriev, Korolev, Gusev, Kiselev, Ilyin, Maksimov, Polyakov, Sorokin, Vinogradov, Kovalev, Belov, Medvedev, Antonov,
Tarasov, Zhukov, Baranov, Filippov, Komarov, Davydov, Belyaev, Gerasimov, Bogdanov, Osipov, Sidorov, Matveev, Titov, Markov, Mironov, Krylov, Kulikov,
Karpov, Vlasov, Melnikov, Denisov, Gavrilov, Tikhonov, Kazakov, Afanasiev, Danilov, Savelyev, Timofeev, Fomin, Chernov, Abramov, Martynov, Efimov,
Fedotov, Shcherbakov, Nazarov, Kalinin, Isaev, Chernyshev, Bykov, Maslov, Rodionov, Konovalov, Lazarev, Voronin, Klimov, Filatov, Ponomarev, Golubev,
Kudryavtsev, Prokhorov, Melnyk, Shevchenko, Boyko, Kovalenko, Bondarenko, Tkachenko, Kovalchuk, Kravchenko, Oliynyk, Shevchuk, Koval, Polishchuk,
Bondar, Tkachuk, Moroz, Marchenko, Lysenko, Rudenko, Savchenko, Petrenko, Kravets, Kharchenko, Honchar, Klymenko, Pavlenko, Mazur, Zinchenko,
Havrylyuk, Sydorenko, Ponomarenko, Kuzmenko, Hrytsenko, Yaremenko, Savchuk, Vovk, Karpenko, Hnatiuk, Babenko, Lytvynenko, Chumak, Bilyk, Danylenko,
Dovzhenko, Fedorenko, Hryhorenko, Ivashchenko, Kalynychenko, Kolomiyets, Lazarenko, Makarenko, Mishchenko, Naumenko, Onishchenko, Panchenko, Rybak,
Semenenko, Stetsenko, Tymoshenko, Yatsenko, Zhuravel, Bezrukov, Chekhov, Dubrovin, Gorbunov, Ignatov, Kondratiev, Lukin, Muravyov, Nesterov, Panin,
Rogozin, Sazonov, Tretyakov, Ustinov, Vishnevsky, Yudin, Zubov, Zinoviev, Shapovalov, Skvortsov, Tsarev, Ushakov, Bobrov, Gromov, Dorofeev, Kondrashov,
Larin, Mamontov, Nechaev, Ovchinnikov, Pestov, Rybakov, Sukhanov, Troshin, Voinov, Yermakov, Zimin, Zhdanov, Kazlou, Sidarovich, Kavalenka, Ivaniuk,
Hrynkevich, Lukashevich, Piatrovich, Rymasheuski, Shymanski, Navumau, Kaminski, Kowal, Bakhmatov, Cherkasov, Dragunov, Eliseev, Kharitonov, Lobanov,
Mishin, Abakumov, Agafonov, Alferov, Anisimov, Arkhipov, Artemiev, Avdeev, Bakhtin, Belousov, Berezin, Bessonov, Biryukov, Blinov, Bobylev, Burlakov,
Chistyakov, Demidov, Dyachenko, Elizarov, Ermakov, Fadeev, Galkin, Glebov, Gryaznov, Ignatiev, Kabanov, Kapustin, Kirillov, Kolesnikov, Korneev, Kotov,
Kryukov, Kuzovlev, Lapin, Lukyanov, Morozkin, Mukhin, Nikiforov, Ostapenko, Panteleev, Parfenov, Pershin, Rakitin, Rusakov, Sadovnikov, Safonov,
Selivanov, Shilov, Shirokov, Sokolovsky, Tatarinov, Tikhomirov, Trubnikov, Voronov, Yurchenko, Zotov, Antonenko, Boiko, Bratchuk, Chernenko, Datsenko,
Fesenko, Havrysh, Horbunov, Hryshchenko, Kardash, Kulyk, Kushnir, Lutsenko, Marchuk, Nesterenko, Omelchenko, Pidhorny, Revenko, Romanenko, Shevtsov,
Tereshchenko, Vakulenko, Zelenko, Arbuzov, Balashov, Alekseenko, Barsukov, Dmitrenko, Eremeev, Fursov, Golovanov, Isakov, Kharlamov, Lazutin, Maltsev,
Naumov, Orekhov, Plotnikov, Rudakov, Savkin, Tarasenko, Ulyanov, Vdovin, Zubarev, Akimov, Burov`);

// ---- hungarian
def('hungarian',
`Bence, Máté, Levente, Dávid, Ádám, Dominik, Balázs, Zoltán, Gábor, Péter, László, István, József, János, Ferenc, Tamás, Attila, Csaba, Gergely,
Krisztián, András, Barnabás, Botond, Dániel, Gyula, Imre, Károly, Kornél, Márk, Miklós, Norbert, Olivér, Richárd, Roland, Sándor, Szabolcs, Tibor,
Viktor, Zsolt, Zalán, Ákos, Álmos, Árpád, Bálint, Benedek, Bendegúz, Csongor, Dénes, Előd, Endre, Erik, Géza, Gellért, Gusztáv, Henrik, Hunor, Huba,
Jenő, Kristóf, Lajos, Lóránt, Marcell, Máriusz, Mihály, Nándor, Patrik, Pál, Rajmund, Sebestyén, Simon, Soma, Tódor, Vajk, Vilmos, Vince, Zétény,
Zsombor, Ábel, Adorján, Aladár, Albert, Alex, Andor, Antal, Armand, Artúr, Bertalan, Béla, Csanád, Dezső, Dorián, Ede, Elemér, Emil, Ernő, Fábián,
Flórián, Gáspár, Gedeon, György, Győző, Iván, Izsák, Kálmán, Kelemen, Kende, Lehel, Leó, Loránd, Mátyás, Menyhért, Noel, Oszkár, Ottó, Pongrác, Ráfael,
Szilárd, Tihamér, Ulrik, Vencel, Vid, Zénó, Zsigmond, Barna, Benjámin, Domonkos, Gergő, Gyöngyös, Kadosa, Kolos, Konrád, Lázár, Márton, Noé, Alajos,
Bertold, Cirill, Dömötör, Elek, Emánuel, Ferdinánd, Gerzson, Hugó, Kázmér, Lukács, Medárd, Orbán, Rezső, Tivadar, Ervin, Jakab, Ágoston, Gyárfás,
Jónás, Mózes, Nimród`,
`Nagy, Kovács, Tóth, Szabó, Horváth, Varga, Kiss, Molnár, Németh, Farkas, Balogh, Papp, Takács, Juhász, Lakatos, Mészáros, Oláh, Simon, Rácz, Fekete,
Szilágyi, Török, Fehér, Balázs, Gál, Kis, Szűcs, Kocsis, Pintér, Fodor, Orsós, Szalai, Sipos, Magyar, Lukács, Gulyás, Biró, Király, Katona, László,
Jakab, Bogdán, Hegedűs, Sándor, Boros, Fazekas, Kelemen, Antal, Somogyi, Orbán, Szántó, Máté, Vincze, Pásztor, Fülöp, Veres, Deák, Bodnár, Budai,
Hajdú, Pál, Bálint, Illés, Gáspár, Barta, Bakos, Szücs, Soós, Virág, Pataki, Tamás, Bán, Sárközi, Dudás, Vass, Vörös, Szekeres, Halász, Kerekes, Ács,
Bakó, Bartha, Bencze, Bognár, Borbély, Csonka, Dobos, Erdős, Fábián, Faragó, Gombos, Hajnal, Hegyi, Imre, Jónás, Kárpáti, Kertész, Kozma, Lengyel,
Madarász, Major, Mezei, Mihály, Nemes, Pap, Rózsa, Sebők, Siket, Süle, Szakács, Székely, Szendrei, Tarnai, Tihanyi, Ujvári, Vadász, Vajda, Zöld,
Almási, Angyal, Árvai, Baji, Bagi, Balla, Barabás, Bede, Benkő, Berki, Bihari, Buda, Cseh, Csizmadia, Dávid, Dér, Dobó, Egri, Énekes, Fónagy, Gazdag,
Gerő, Gyarmati, Halmos, Hídvégi, Hollósi, Hubai, Jankó, Kalmár, Karácsony, Kardos, Kemény, Kolozsi, Korda, Kósa, Kürti, Laczkó, Lantos, Lázár, Lévai,
Lőrincz, Mák, Maróti, Mátrai, Mester, Mikó, Miklós, Nyári, Ódor, Ormai, Palotás, Pethő, Polgár, Radnai, Rajki, Salamon, Sárosi, Sebestyén, Sólyom,
Somlai, Szarka, Szegedi, Szigeti, Tarr, Tolnai, Turi, Újhelyi, Vámos, Váradi, Várkonyi, Vékony, Zsolnai, Zsiga, Albert, Baán, Cserna, Dancs, Ambrus,
Apró, Aradi, Bagó, Bakonyi, Bartos, Bátori, Bencsik, Berényi, Bertók, Bocskai, Bodó, Bohus, Borsos, Cseke, Czeglédi, Dobai, Dorogi, Dóra, Drávai, Elek,
Erdélyi, Falusi, Fenyvesi, Fürdős, Garai, Gedeon, Gémes, Gergely, Gönczi, Gyenes, Hajós, Halmi, Harsányi, Herczeg, Hajdu, Hevesi, Hudák, Inczédi,
Jámbor, Kapás, Kaszás, Kellner, Kenyeres, Kozák, Kulcsár, Lakos, Mágori, Mátyás, Mohácsi, Mosonyi, Nyíri, Olajos, Ónodi, Pálfi, Pálinkás, Pozsonyi,
Radics, Rádai, Rigó, Rózsás, Sárga, Sebő, Szeles, Szentes, Szerencsés, Tarján, Udvari, Vágó, Vékás, Zsák, Ajtay, Bajor, Bátyi, Cservenka, Csáki, Deli,
Domonkos, Dunai, Ecsedi, Fajkusz, Gaál, Győri, Hám, Jenei, Kárász, Keresztes, Mohos, Almássy, Bartus, Bélteki, Bodrogi, Csányi, Csiszár, Dargay, Egyed,
Erős, Fazakas, Fehérvári, Gáti, Gémesi, Gyulai, Hídasi, Hornyák, Jakus, Kálmán, Kapitány, Kismarty, Kolompár, Lipták, Mesterházy, Mikola, Olasz, Rákos,
Szüle, Ugró, Zakar, Zsoldos, Balázsi, Czinege, Dévényi, Ember, Gerendás, Hegedüs, Ivanics, Jancsó, Lovas, Magyari, Nyitrai, Orosz, Pék, Rab,
Szoboszlay, Tompa`);

// ---- romanian
def('romanian',
`Andrei, Alexandru, Ionuț, Mihai, Cristian, Gabriel, Daniel, Marius, Florin, Adrian, Răzvan, Bogdan, Cătălin, Costel, Dorin, Dragoș, Eugen, George, Ion,
Laurențiu, Liviu, Lucian, Marian, Nicolae, Octavian, Paul, Radu, Remus, Sorin, Ștefan, Teodor, Valentin, Vasile, Viorel, Vlad, Alin, Aurel, Cosmin,
Ciprian, Claudiu, Constantin, Dan, Darius, Denis, Dumitru, Emil, Eduard, Eusebiu, Flavius, Gheorghe, Horia, Iulian, Lazăr, Mircea, Narcis, Ovidiu,
Petru, Robert, Sebastian, Silviu, Sergiu, Tiberiu, Titus, Traian, Victor, Virgil, Zoltan, Tudor, Matei, Luca, David, Rareș, Cristi, Costin, Cornel,
Dacian, Doru, Fănel, Gelu, Ilie, Ionel, Iosif, Leonard, Marcel, Mădălin, Neculai, Nelu, Pavel, Romeo, Sabin, Sandu, Săvel, Teofil, Toma, Valeriu,
Vergil, Adi, Albert, Anghel, Aristotel, Basarab, Bebe, Beniamin, Bujor, Călin, Camil, Cezar, Corneliu, Cristea, Dionisie, Dorel, Elvis, Emanuel,
Eftimie, Ghiță, Grigore, Iancu, Ilarie, Ioan, Iuliu, Jean, Lupu, Maxim, Mihăiță, Mugur, Nistor, Petrică, Pompiliu, Răduț, Sever, Sima, Tănase, Vali,
Vintilă, Zamfir, Alexe, Bănel, Cicerone, Dănuț, Eugeniu, Fulger, Gabi, Lucrețiu, Nicu, Petre, Rădiță, Sandel, Tiță, Anton, Bartolomeu, Dorian, Elisei,
Felician`,
`Popescu, Ionescu, Popa, Radu, Stan, Stoica, Dumitru, Gheorghe, Constantin, Marin, Diaconu, Mihai, Dinu, Tudor, Serban, Florea, Voicu, Moldovan,
Munteanu, Dragomir, Ungureanu, Lazăr, Sandu, Preda, Vasile, Ilie, Cristea, Neagu, Toma, Nistor, Enache, Petrescu, Georgescu, Matei, Barbu, Rusu,
Iordache, Ciobanu, Nedelcu, Stancu, Anghel, Oprea, Lungu, Coman, Pavel, Avram, Balan, Cojocaru, Crăciun, Dobre, Dragan, Filip, Iacob, Luca, Manole,
Marinescu, Mocanu, Păun, Rădulescu, Stanciu, Tănase, Zamfir, Apostol, Banu, Bălan, Bucur, Chiriac, Ciocan, Cornea, Cozma, Dima, Dinca, Fieraru, Ghiță,
Grigore, Istrate, Lupu, Macovei, Manea, Mazilu, Mitrea, Niculescu, Olteanu, Pana, Petcu, Popovici, Postolache, Prisecaru, Rotaru, Sima, Soare, Surdu,
Tabacu, Tomescu, Trandafir, Ursu, Vlad, Zaharia, Albu, Alexandrescu, Amariei, Arsene, Balaban, Baciu, Barbulescu, Bejan, Bogdan, Bogza, Bratu, Burlacu,
Cazacu, Chirila, Ciucă, Coandă, Costache, Dănilă, Dascalu, Dobrescu, Drăgan, Dumbravă, Farcaș, Fotache, Gavrilă, Gheorghiu, Grosu, Iancu, Ichim, Ivan,
Jitaru, Lăzărescu, Lupescu, Maftei, Manolache, Mărgineanu, Miron, Mitu, Mușat, Naum, Neacșu, Necula, Oancea, Onofrei, Ostafi, Panait, Pătrașcu, Pîrvu,
Pop, Poenaru, Prodan, Racoviță, Roman, Rosu, Sârbu, Savu, Sirbu, Stoian, Stroe, Tatu, Teodorescu, Tudose, Țurcanu, Ardeleanu, Bănică, Calin, Ceaușu,
Chivu, Coroiu, Costea, Danciu, Dediu, Dumitrache, Dumitrescu, Eftimie, Ene, Frăţilă, Gălățeanu, Giurgiu, Hanganu, Ispas, Lăcătuș, Lixandru, Mardare,
Mihăilescu, Moraru, Nae, Oltean, Paraschiv, Pașca, Piticu, Pleșu, Roșca, Rus, Sabău, Săvulescu, Sofronie, Stefănescu, Tabacaru, Țâră, Vâlcu, Vișan,
Anton, Axente, Bădescu, Balint, Bud, Câmpeanu, Cărare, Chende, Crisan, Dragu, Fulga, Haiduc, Hategan, Jipa, Kovacs, Lascu, Man, Marcu, Pârvulescu,
Rațiu, Todoran, Aldea, Andrei, Arghezi, Axinte, Bălănescu, Beldie, Bîrsan, Bota, Brătescu, Bunea, Caragea, Chelaru, Cimpoeru, Ciuperca, Costin, Cucu,
Dănescu, Dobrin, Dragnea, Dumitraș, Fărcaș, Gavriș, Gîrbea, Ionașcu, Maxim, Mihalache, Nechita, Neguț, Nicolescu, Oprișan, Pascu, Pătrășcanu,
Pavelescu, Petrache, Pintilie, Pricop, Rădoi, Răducanu, Savin, Sîrbu, Stănescu, Stoenescu, Șerban, Țuțuianu, Turcu, Văduva, Vâlceanu, Vasilescu,
Voinea, Zăvoianu, Cârstea, Dobrică, Iosub, Nicoară, Obreja, Păunescu, Stefan, Tamaș, Ursache, Alecu, Bobocea, Bulgaru, Cernea, Ciobotaru, Dospinescu,
Eftimescu, Frunză, Ghinea, Hurmuzache, Ilinca, Jianu, Lăcustă, Mirea, Nastase, Opriș, Pădure, Rusescu, Ababei, Bălteanu, Furtună, Gîdea, Hurduc, Itu,
Jora, Lungeanu, Moisă, Neamțu, Prunescu, Ruse, Spiridon, Tomuța, Văcaru, Ardelean, Boboc, Constantinescu, Dragoș, Ianc, Mateescu, Pîrlea`);

// ---- turkish
def('turkish',
`Mehmet, Mustafa, Ahmet, Ali, Hüseyin, Hasan, İbrahim, İsmail, Yusuf, Ömer, Emre, Burak, Can, Cem, Deniz, Efe, Eren, Furkan, Gökhan, Kaan, Kemal, Murat,
Onur, Orhan, Oğuz, Selim, Serkan, Tolga, Umut, Volkan, Yasin, Yiğit, Barış, Berkay, Bilal, Çağlar, Doğan, Enes, Erdem, Ferhat, Hakan, Halil, Harun,
Kerem, Koray, Mahir, Mert, Metin, Nihat, Okan, Ozan, Raşit, Recep, Sercan, Soner, Şahin, Taner, Tarık, Uğur, Utku, Veli, Yavuz, Zafer, Abdullah, Adem,
Alp, Arda, Aydın, Batuhan, Bora, Cengiz, Cihan, Ersin, Emir, Fatih, Gürkan, Hamza, İlker, İsa, Kadir, Kenan, Levent, Lütfü, Mazlum, Muharrem, Nuri,
Oktay, Osman, Rıza, Ramazan, Salih, Sami, Selçuk, Süleyman, Talha, Turgut, Ufuk, Vedat, Yılmaz, Zeki, Abdurrahman, Atakan, Aykut, Barkın, Bedirhan,
Bünyamin, Cüneyt, Dursun, Erkan, Fikret, Güray, Haluk, Hikmet, İhsan, Kağan, Kürşat, Mesut, Melih, Mücahit, Nazım, Necati, Onat, Polat, Rıdvan, Rüzgar,
Sadık, Savaş, Tamer, Tayfun, Tuncay, Ulaş, Yaşar, Yücel, Zeynel, Alper, Anıl, Aras, Atilla, Barbaros, Berat, Cahit, Çetin, Adnan, Bayram, Caner, Doruk,
Fırat, Gürsel, Haydar, Ilhan, Kutay, Meriç, Necip, Oğuzhan, Rahmi, Salim, Tuğrul`,
`Yılmaz, Kaya, Demir, Şahin, Çelik, Yıldız, Yıldırım, Öztürk, Aydın, Özdemir, Arslan, Doğan, Kılıç, Aslan, Çetin, Kara, Koç, Kurt, Özkan, Şimşek, Polat,
Korkmaz, Özcan, Çakır, Erdoğan, Yavuz, Can, Acar, Şen, Aksoy, Aktaş, Güneş, Bulut, Tekin, Karaca, Ünal, Keskin, Bozkurt, Türk, Kaplan, Avcı, Güler,
Çiftçi, Taş, Işık, Gül, Uçar, Tunç, Eren, Bayram, Duman, Akın, Aydoğan, Sönmez, Altun, Oral, Ateş, Balcı, Coşkun, Demirci, Er, Erdem, Genç, Gök, Güzel,
Kahraman, Karakaya, Kocabaş, Kalkan, Meral, Önal, Özer, Özgür, Sarı, Sezer, Soylu, Tan, Toprak, Turan, Uysal, Yalçın, Yaman, Yurt, Zengin, Akgül,
Akpınar, Alkan, Altıntaş, Arıkan, Atasoy, Aygün, Bakır, Baş, Bilgin, Bingöl, Birinci, Cengiz, Ceylan, Çağlayan, Çınar, Çobanoğlu, Dağ, Dalgıç, Demirel,
Dinç, Dursun, Ekinci, Ergin, Erkan, Ersoy, Fidan, Gençer, Gökçe, Gündoğdu, Gürbüz, Hacıoğlu, Işıklı, İnan, İpek, Kandemir, Karadağ, Karagöz, Karataş,
Kaygusuz, Kılınç, Kızıl, Konuk, Köse, Kutlu, Kuşçu, Memiş, Mutlu, Nalbant, Narin, Oğuz, Ozan, Öz, Özbek, Özkaya, Pehlivan, Saygın, Selçuk, Sever,
Sevim, Soysal, Sungur, Susam, Tatlı, Tuna, Türkmen, Tüzün, Ulusoy, Uzun, Ülker, Vural, Yazıcı, Yetkin, Yiğit, Yücel, Yüksel, Abacı, Akay, Akbulut,
Akçay, Akdeniz, Akkaya, Aksu, Albayrak, Altay, Arabacı, Aras, Arı, Aslanoğlu, Atalay, Atik, Ay, Aydemir, Aytaç, Bal, Barut, Bayraktar, Bilen, Boz,
Büyük, Candan, Cebeci, Çalışkan, Çavuş, Çiçek, Çolak, Demirtaş, Deniz, Dikmen, Doğru, Durmaz, Ekmekçi, Emin, Engin, Eroğlu, Ertürk, Gezer, Gökmen,
Gürel, Güvenç, Hancı, Ilgaz, Kabadayı, Kadıoğlu, Kapıcı, Karabulut, Kasapoğlu, Kavak, Kesici, Kırmızı, Kızılay, Kuru, Mercan, Nar, Odabaşı, Ormancı,
Acıkgöz, Akbaş, Akdağ, Akyol, Alıcı, Altınok, Apaydın, Arıcı, Armağan, Aşık, Aytekin, Bahçeci, Balaban, Baltacı, Bardakçı, Başaran, Baykal, Bektaş,
Beyaz, Biçer, Bozdoğan, Bölük, Budak, Buldan, Cansız, Cömert, Dalkıran, Dedeoğlu, Dilmen, Dönmez, Durak, Eker, Elmas, Eryılmaz, Evren, Gedik, Gezgin,
Girgin, Gönül, Gümüş, Güngör, Hatipoğlu, Helvacı, İlhan, İşcan, Kafkas, Kalyoncu, Kaptan, Karlı, Kerimoğlu, Kıran, Kocaman, Koçak, Kömürcü, Kurtuluş,
Küçük, Mavi, Nergiz, Olcay, Ongun, Özaydın, Pala, Parlak, Sarıkaya, Sezgin, Tosun, Tuncer, Ulutaş, Vardar, Yaşar, Zorlu, Alpaslan, Bilgiç, Çalık,
Dağdelen, Fırat, Gündüz, Hazar, Kırbaş, Alpay, Birdal, Cebe, Doğanay, Egemen, Gökalp, Hızır, İzmirli, Kayhan, Mıhçı, Orbay, Peker, Taşçı, Uslu, Varol,
Yalman, Aksakal, Bakırcı, Cinar`);

// ---- greek
def('greek',
`Giorgos, Dimitris, Nikos, Konstantinos, Ioannis, Christos, Panagiotis, Vasilis, Alexandros, Manolis, Michalis, Thanasis, Stelios, Spyros, Petros,
Pavlos, Kostas, Yiannis, Antonis, Angelos, Apostolos, Argyris, Charalampos, Dionysis, Efstathios, Eleftherios, Evangelos, Fotis, Giannis, Grigoris,
Haris, Iraklis, Kyriakos, Lazaros, Leonidas, Lefteris, Marios, Miltiadis, Nektarios, Orestis, Pantelis, Periklis, Sotiris, Stavros, Symeon, Theodoros,
Thodoris, Tasos, Vangelis, Vassilios, Xenofon, Zisis, Aris, Alekos, Akis, Andreas, Anestis, Athanasios, Dimosthenis, Efthymios, Filippos, Ilias, Kimon,
Kleanthis, Lambros, Menelaos, Nestoras, Odysseas, Pericles, Prodromos, Rafail, Savvas, Solon, Telemachos, Theofanis, Thrasyvoulos, Vlasis, Yorgos,
Zacharias, Achilleas, Aggelos, Anargyros, Aristotelis, Aristeidis, Charilaos, Chrysostomos, Damianos, Epameinondas, Evripidis, Fanis, Gerasimos,
Hercules, Isidoros, Kleon, Leontios, Loukas, Mimis, Miltos, Neoklis, Nikolaos, Panos, Paraskevas, Pyrros, Sokratis, Spiros, Stefanos, Tryfon, Vyron,
Xenis, Zafiris, Alkis, Andronikos, Anthimos, Charis, Dimitrios, Efstratios, Evagoras, Ioakeim, Kallistratos, Kosmas, Marinos, Nikiforos, Nikitas,
Pelopidas, Pantazis, Praxitelis, Rigas, Stratos, Tilemachos, Vasileios, Xenophon, Yannos, Andrikos, Christoforos, Agisilaos, Alexios, Anastasios,
Aristomenis, Dionisios, Dorotheos, Ektoras, Gavriil, Kimonas, Klearchos, Lambis, Ploutarchos, Theodosis, Thomas, Paschalis, Sophoklis, Telis, Timos,
Yiorgos`,
`Papadopoulos, Vlachos, Angelopoulos, Nikolaidis, Georgiou, Papadakis, Dimitriou, Karagiannis, Alexiou, Vasileiou, Oikonomou, Ioannou, Konstantinou,
Makris, Papanikolaou, Antoniou, Christodoulou, Mavridis, Karamanlis, Pappas, Theodorou, Stavrou, Chatzis, Manolakis, Michailidis, Papageorgiou,
Sotiropoulos, Tsakiris, Zografos, Zervas, Spanos, Kyriakou, Galanis, Lazaridis, Katsaros, Gekas, Pantelidis, Stamatis, Kalogeropoulos, Anagnostou,
Bakas, Bouras, Chalkias, Charalambous, Daskalakis, Diamantis, Efthymiou, Fotiadis, Gavalas, Grigoriadis, Hatzigiannis, Iliopoulos, Kakaris,
Kanellopoulos, Karras, Kokkinos, Kolokotronis, Kontos, Koutras, Lampropoulos, Lymperis, Mastoras, Mitropoulos, Nikolopoulos, Orfanos, Pagonis,
Panagiotou, Paschalidis, Pavlidis, Petridis, Poulos, Psarros, Rallis, Rigas, Samaras, Skouras, Smyrnios, Sofianos, Soulis, Stefanidis, Tzanetakis,
Tzimas, Valavanis, Vardakis, Velissaris, Voulgaris, Xenakis, Zacharopoulos, Zoumboulakis, Andreou, Apostolou, Athanasiou, Bampis, Boukouvalas,
Chrysostomou, Dedes, Dellas, Drakos, Economou, Evangelou, Fragkos, Georgakopoulos, Giannakos, Gkikas, Hadjis, Kalamaras, Kapetanios, Karathanasis,
Karvelas, Kassimatis, Katsikas, Kefalas, Kitsos, Kollias, Kotsakis, Koukoulis, Kourtis, Laskaris, Liakos, Lougaris, Manousakis, Margaritis,
Markopoulos, Mastrogiannis, Mavrogenis, Mouzakis, Nakos, Ntouskas, Pallis, Panos, Pantazis, Papaioannou, Papathanasiou, Paraskevopoulos, Pateras,
Peppas, Plastiras, Prokopiou, Rizos, Roussos, Salpingidis, Sarantis, Skarlatos, Souvatzis, Spyropoulos, Stathakis, Synodinos, Thanos, Theocharis,
Tsatsos, Tsiolis, Tzouvelekis, Vassilakis, Vitalis, Vrettos, Zagoraios, Zisimopoulos, Zorbas, Alevras, Anastasiou, Argyropoulos, Barbas, Basdekis,
Bekiaris, Boutsis, Ganas, Gatsos, Giotis, Gounaris, Hatzis, Kalliris, Kampouris, Karageorgis, Katsimpras, Kontoleon, Kostopoulos, Kritikos, Louvaris,
Lykourgos, Mamalis, Manitsas, Mylonas, Nasiopoulos, Nikou, Ntinas, Oikonomidis, Palaiologos, Pavlopoulos, Prasinos, Roumeliotis, Saridis, Skiadas,
Stavropoulos, Tsagaris, Tsolakis, Vamvakas, Vergopoulos, Voutsas, Zavos, Zikos, Adamopoulos, Alexandridis, Anastasopoulos, Andrianos, Argiriou,
Athanasopoulos, Avgerinos, Bakogiannis, Bezos, Bikos, Bitsakos, Chantzis, Chatzidakis, Daras, Dimas, Drosos, Efraimidis, Fakitsas, Fountas, Galatas,
Gerasimou, Gioldasis, Giotopoulos, Kalogiannis, Karabelas, Kasimis, Katsouris, Kleftis, Kotsiras, Lambrou, Lazos, Livanos, Loukas, Malliaros,
Mavromatis, Melissinos, Nomikos, Oikonomopoulos, Pagoulatos, Panayotou, Pistiolis, Politis, Rapakousis, Sakellariou, Siskos, Sklavounos, Sotiriou,
Spyridakis, Stefanopoulos, Tsakalidis, Tsirigotis, Tsoukalas, Varelas, Vlachakis, Vlahopoulos, Zafeiropoulos, Andriopoulos, Basilakis, Charitos,
Deligiannis, Eleftheriou, Fotopoulos, Gavriilidis, Haralambous, Iordanidis, Kyrkos, Manolas, Nikiforidis, Orestidis, Panou, Rouvas, Sideris, Tsimikas,
Tzavellas, Vyzas, Alivizatos, Bouloukos, Chrysikopoulos, Doukas, Exarchos, Filippou, Gklavas, Hristodoulou, Ioannidis, Kallergis, Lekkas, Mantzios,
Neofytou, Paleologos, Avramidis, Bairaktaris, Chatzipanagiotou, Dimitropoulos, Economopoulos, Fragkoulis, Gialouris, Hadjipetrou, Iliadis, Kaldis,
Mavrommatis, Orfanidis, Pasalis, Rodopoulos, Stergiou, Triantafyllou, Vamvakopoulos, Xiros, Yiannakis, Zachariou, Argyros, Bouzoukis`);

// ---- arabic-maghreb
def('arabic-maghreb',
`Mohamed, Ahmed, Youssef, Ayoub, Amine, Karim, Hamza, Bilal, Omar, Ismail, Yassine, Zakaria, Anas, Hicham, Rachid, Samir, Nabil, Mehdi, Walid, Reda,
Soufiane, Abdelkader, Abdelhak, Abderrahmane, Adil, Achraf, Brahim, Driss, Elias, Fouad, Hakim, Hassan, Ilyes, Imad, Jamal, Kamel, Khalid, Larbi,
Lotfi, Mounir, Mourad, Mustapha, Nadir, Noureddine, Othmane, Redouane, Saad, Said, Salah, Sofiane, Tarek, Wassim, Yacine, Yahya, Zinedine, Aymen, Badr,
Chakib, Djamel, Farid, Faouzi, Ghali, Hatim, Idriss, Jaouad, Khaled, Lyes, Malik, Marouane, Nassim, Oussama, Rayan, Sami, Slimane, Tahar, Yanis,
Younes, Zouhair, Abdelaziz, Abdellah, Abdelilah, Abdelmajid, Adnane, Aissa, Amir, Anouar, Aziz, Badreddine, Bachir, Belaid, Boualem, Chafik, Chaker,
Djaber, Fares, Fayçal, Foued, Hamid, Hocine, Houssem, Ibrahim, Issam, Kais, Mahdi, Maher, Mansour, Mokhtar, Moncef, Mouloud, Nacer, Nizar, Rabie,
Raouf, Riad, Sabri, Salim, Seifeddine, Taha, Taoufik, Wael, Yassir, Zied, Amara, Aymane, Ayman, Azzedine, Bader, Cherif, Daoud, Dhia, Elyes, Fethi,
Ghassen, Habib, Haitham, Hedi, Jalil, Jaber, Kacem, Lakhdar, Layachi, Mabrouk, Mehrez, Nasreddine, Oualid, Rafik, Sadek, Sadok, Slim, Souhail, Tayeb,
Wahid, Yasser, Yazid, Zakariya, Abdelkarim, Abdelouahed, Mounib, Radouane, Tawfik, Youcef, Zaki, Zoubir, Hichem, Hakam, Ramzi, Marwan, Seddik,
Abdelghani, Akram, Bassem, Choukri, Fadel, Ghilas, Ihsane, Jawad, Kamal, Lahcen, Mimoun, Nordine, Ouahid`,
`Benali, El Amrani, El Idrissi, Alaoui, Bennani, Tazi, Berrada, Fassi, Lahlou, Chraibi, Benjelloun, Squalli, Sebti, Mansouri, Haddad, Bouzid, Ouali,
Belhadj, Bensaid, Zerrouki, Khelifi, Boukhari, Cherif, Hamdi, Mebarki, Merzouk, Messaoudi, Mokrani, Rahmani, Saadi, Slimani, Taleb, Yahiaoui, Amrani,
Bouchama, Belkacem, Benamar, Bencherif, Bensalah, Benyahia, Boudiaf, Boumediene, Brahimi, Chaoui, Djebbar, Djellal, Ferhat, Ghezali, Guerrouj, Hadj,
Hamidi, Hamlaoui, Kaci, Kadri, Khaldi, Lakhdari, Larbi, Meziane, Mihoubi, Nacer, Ouahab, Ouazani, Rezgui, Sahraoui, Salhi, Sebaa, Talbi, Touati,
Zeghdoud, Zouaoui, Ait Ali, Ait Taleb, Ben Youssef, Ben Ammar, Ben Salah, Ben Romdhane, Ayari, Bejaoui, Belhaj, Ben Hamida, Ben Slimane, Bouazizi,
Bouslama, Chaabane, Chebbi, Dridi, Ferchichi, Gharbi, Guesmi, Hajji, Jebali, Jelassi, Kacem, Karoui, Khemiri, Laabidi, Maaloul, Mejri, Messaoud, Nasri,
Ouertani, Rekik, Sassi, Sfar, Souissi, Trabelsi, Triki, Zouari, Zoghlami, Akhrif, Amellal, Aouam, Aqsalla, Atouani, Azzouzi, Bakkali, Barrada,
Belahcen, Benchekroun, Bencheikh, Benkirane, Bouazza, Boujemaa, Bouzoubaa, Chadli, Dahmani, Daoudi, El Fassi, El Fahli, El Ghazi, El Hajjaji,
El Khatib, El Mahdaoui, El Ouazzani, El Yamani, Filali, Ghazouani, Guennouni, Hamdaoui, Hammouchi, Idrissi, Jabri, Jebbari, Kabbaj, Kettani, Lamrani,
Lazrak, Maghraoui, Mekouar, Naciri, Ouazzani, Oukili, Rhazi, Sefrioui, Serghini, Tahiri, Tounsi, Zniber, Abbas, Aggoun, Aït Hamouda, Amokrane, Aouadi,
Arab, Atmani, Azzi, Bacha, Bahri, Belabbes, Belarbi, Belmadi, Bendjelloul, Benhamou, Benmoussa, Bentaleb, Berkani, Bouabdellah, Boucherit, Bouhadjar,
Boukadoum, Boumaza, Bouras, Bourahla, Chabane, Chikhi, Dahmane, Dib, Djaballah, Fellah, Gacem, Guendouz, Haouas, Kebir, Khoualed, Laribi, Maamar,
Mansour, Medjahed, Mehdaoui, Merabet, Metref, Moussaoui, Nouri, Ouadah, Rabhi, Remili, Sellami, Yousfi, Zaidi, Zemmouri, Zitouni, Zouaghi, Haouari,
Abid, Abidi, Agrebi, Allagui, Amara, Baccouche, Belaid, Ben Brahim, Ben Fredj, Bouhlel, Chaouch, Cherni, Dhaouadi, Ellouze, Fourati, Gabsi, Haddar,
Hamrouni, Jemmali, Khalfallah, Mabrouk, Nefzi, Abbassi, Abdelli, Aboulfath, Aggar, Ait Ben Said, Ait Brahim, Ali Khodja, Amar, Amghar, Aouchiche,
Azizi, Baba Ahmed, Bahmed, Bakhti, Belhadi, Belkheir, Benabdallah, Benaissa, Benhaddou, Benhima, Benkhaled, Benmakhlouf, Bensouda, Berrabah, Bessaoud,
Boudjemaa, Bouguerra, Bouhdiba, Boulahia, Bouraoui, Bourouba, Brik, Chamekh, Charef, Cheikh, Debbagh, Dellali, Djouadi, Drissi, El Ayoubi, El Bakkali,
El Haddadi, El Kaddouri, El Maliki, El Moutawakil, Ghazali, Guerfi, Haddouche, Hamzaoui, Jemai, Kaddour, Kassab, Khiari, Lachhab, Mahjoub, Mellouli,
Mezghani, Mrabet, Ouelhadj, Raissouni, Sebbar, Tlili, Zahraoui, Zerrad, Aouni, Bechir, Chakroun, Daghfous, Essid, Frikha, Gannouni, Hentati, Jaziri,
Kefi, Louati, Meddeb, Nafti, Ouni, Rachdi, Sellemi`);

// ---- arabic-gulf
def('arabic-gulf',
`Mohammed, Abdullah, Ahmed, Khalid, Faisal, Saud, Fahad, Salman, Nasser, Turki, Sultan, Bandar, Majed, Naif, Hamad, Yousef, Hassan, Ali, Omar, Ibrahim,
Mahmoud, Mostafa, Mahmood, Tarek, Hossam, Amr, Karim, Ramy, Sherif, Walid, Wael, Yasser, Hany, Essam, Ashraf, Adel, Ayman, Emad, Gamal, Hesham, Khaled,
Magdy, Medhat, Nader, Osama, Rami, Sameh, Tamer, Wahid, Zaki, Abdulaziz, Abdulrahman, Abdulmajeed, Ahmad, Anwar, Awad, Badr, Bader, Basim, Dawood, Eid,
Fares, Ghanem, Hadi, Hamza, Hazem, Hussein, Idris, Jaber, Jassim, Kamal, Lutfi, Mansour, Marwan, Mazen, Meshal, Mishari, Muath, Mubarak, Nawaf, Nayef,
Rayan, Rashid, Saad, Saeed, Salem, Salim, Sami, Samir, Talal, Thamer, Waleed, Yaser, Zayed, Ziyad, Abdulhadi, Abdulilah, Abdullatif, Adnan, Ammar,
Anas, Assem, Ayad, Aziz, Basel, Bassem, Fawaz, Fouad, Ghazi, Haitham, Hamdan, Hatem, Hisham, Humaid, Ismail, Jamal, Jihad, Kareem, Khalifa, Luay,
Maher, Marzouk, Moataz, Nabil, Naser, Nizar, Qais, Raed, Ramzi, Riyad, Sabri, Sadiq, Saleh, Shaker, Suhail, Tawfiq, Usama, Yazan, Yazeed, Zaid, Ziad,
Abdelrahman, Amgad, Anis, Awwad, Ayoub, Bakr, Darwish, Elsayed, Fathi, Gaber, Habib, Ihab, Kerolos, Lotfy, Maged, Mamdouh, Mounir, Nabeel, Rafat,
Ragab, Refaat, Sabry, Samy, Shady, Yehia, Youssef, Abdulwahab, Alaa, Dhari, Ehab, Fahd, Gharib, Hussam, Jawdat, Kassem, Labib, Muneer, Nidal, Obaid`,
`Al-Ghamdi, Al-Harbi, Al-Otaibi, Al-Qahtani, Al-Dosari, Al-Shehri, Al-Zahrani, Al-Mutairi, Al-Subaie, Al-Anazi, Al-Shammari, Al-Juhani, Al-Amri,
Al-Malki, Al-Rashidi, Al-Saadi, Al-Hajri, Al-Marri, Al-Kuwari, Al-Sulaiti, Al-Naimi, Al-Mohannadi, Al-Emadi, Al-Yafei, Al-Nuaimi, Al-Mansoori,
Al-Shamsi, Al-Hammadi, Al-Kaabi, Al-Zaabi, Al-Falasi, Al-Suwaidi, Al-Ketbi, Al-Dhaheri, Al-Mazrouei, Al-Qubaisi, Al-Muhairi, Ibrahim, Hassan, Mahmoud,
Mohamed, Ahmed, Ali, Said, Mostafa, Abdelaziz, Hussein, Salah, Farouk, Fahmy, Saleh, Nasr, Othman, Khalil, Gaber, Soliman, Mansour, El-Sayed, El-Masry,
El-Shenawy, El-Gohary, El-Dessouky, El-Naggar, El-Badry, El-Hadary, El-Sebai, Abdel-Rahman, Abdel-Hamid, Abdel-Fattah, Abdel-Gawad, Abdel-Aal,
Abdel-Wahab, Zaki, Shehata, Fouad, Rashed, Youssef, Hegazy, Radwan, Metwally, Kamel, Ghoneim, Lotfy, Sabry, Taha, Hamed, Ragab, Eid, Fathy, Fawzy,
Hosny, Ismail, Makram, Morsi, Nabil, Ramadan, Rizk, Sayed, Shaker, Shawky, Tawfik, Wahba, Zaghloul, Zayed, Abaza, Abdallah, Adly, Amer, Anwar, Awad,
Bakr, Barakat, Darwish, Emara, Ezzat, Gad, Gomaa, Habib, Halim, Hamdy, Helmy, Kandil, Khattab, Labib, Lashin, Mabrouk, Maher, Mekky, Mohsen, Moustafa,
Naguib, Nour, Osman, Qassem, Rabie, Riad, Salem, Samir, Selim, Serag, Sherif, Tantawi, Wagdy, Yassin, Zahran, Zidan, Abu Hamdan, Abu Khalil,
Abu Shanab, Bakri, Daher, Dajani, Hajjar, Haddad, Hijazi, Jaber, Khoury, Nasser, Najjar, Qasem, Rahman, Saadeh, Shaheen, Shammas, Tamimi, Taweel,
Zayyad, Al-Fahad, Al-Fayez, Al-Jaber, Al-Khaldi, Al-Lami, Al-Obaidi, Al-Rubaie, Al-Saffar, Al-Tamimi, Al-Utaibi, Al-Zubaidi, Al-Hashimi, Al-Dulaimi,
Al-Jumaili, Al-Janabi, Al-Mousawi, Al-Bayati, Al-Dabbagh, Al-Hussaini, Al-Ibrahim, Al-Sayegh, Al-Awadhi, Al-Bader, Al-Hajeri, Al-Rumaihi, Al-Ansari,
Al-Binali, Al-Hail, Al-Khater, Al-Kubaisi, Al-Mannai, Al-Meer, Al-Muftah, Al-Obaidly, Al-Sada, Al-Shaibani, Al-Sheeb, Al-Thawadi, Al-Hamad, Al-Jabri,
Al-Mulla, Al-Nasr, Abdelmoneim, Abdelsalam, Abdulla, Abu Zahra, Abu Taleb, Afifi, Ajlan, Akl, Alloush, Ammar, Aql, Awadallah, Ayyad, Badawi, Baghdadi,
Bahgat, Basha, Bishara, Borhan, Dabbas, Dawoud, Ehsan, Elkhatib, Farag, Fares, Ghanem, Hafez, Hakim, Hamouda, Harb, Hasan, Hijab, Idriss, Jarrah,
Kabeer, Khalifa, Lutfi, Madkour, Maghrabi, Nabhan, Nassar, Qaddoura, Rabbani, Sabbagh, Sakr, Tawil, Wehbe, Yaqoub, Zeidan, Al-Awami, Al-Enezi,
Al-Fadhli, Al-Ghanim, Al-Harthy, Al-Jasmi, Al-Mutawa, Al-Naqbi, Al-Rowaili, Al-Shahrani, Al-Tuwaijri, Al-Yami, Al-Zayani, Al-Bishi, Al-Dawood,
Al-Faraj, Al-Ghazal, Al-Hazmi, Al-Khoury, Al-Maliki, Al-Nahdi, Al-Omari, Al-Qarni, Al-Rasheed, Al-Salem, Al-Tayeb, Abdelhady, Ashour, Bedair, Dessouky,
Al-Abdali, Al-Banna, Al-Duwaihi, Al-Eisa, Al-Fawzan, Al-Habib, Al-Jarallah, Al-Kandari, Al-Lahim, Al-Mulhim, Al-Nasser, Al-Quraishi, Al-Rajhi,
Al-Sudairi, Al-Turki, Al-Wazzan, Al-Zamil, Al-Hadidi, Al-Baddad, Al-Daghestani, Mourad, Nagy`);

// ---- west-african-anglo
def('west-african-anglo',
`Emeka, Chinedu, Chukwuemeka, Obinna, Ikechukwu, Nnamdi, Ugochukwu, Oluwaseun, Oluwatobi, Olamide, Tunde, Femi, Kunle, Segun, Babatunde, Adebayo,
Ayodele, Damilola, Folarin, Gbenga, Ifeanyi, Kelechi, Kingsley, Leke, Musa, Uche, Victor, Wilfred, Yakubu, Abubakar, Aliyu, Bashir, Chidi, Chima,
Chisom, Chukwuma, Daniel, Dayo, Emmanuel, Eze, Godwin, Henry, Ibrahim, Ifeanyichukwu, Innocent, Jide, Kayode, Lanre, Michael, Nelson, Ndubuisi,
Obafemi, Odion, Ogbonna, Okechukwu, Olumide, Onyeka, Paul, Peter, Raphael, Samson, Sunday, Taiwo, Tobi, Uchenna, Wale, Yusuf, Zaki, Kwame, Kofi,
Kwabena, Kwaku, Yaw, Kojo, Kwadwo, Kweku, Nana, Akwasi, Ebenezer, Edem, Fiifi, Isaac, Jerry, Joseph, Kwesi, Mensah, Nii, Papa, Prince, Richmond,
Samuel, Seth, Solomon, Thomas, Abdul, Alhassan, Baba, Ernest, Frank, Gideon, Hamza, Issah, Jonathan, Kassim, Lawrence, Mohammed, Naa, Osman, Patrick,
Razak, Sulemana, Tijani, Wahab, Yussif, Adewale, Akin, Bolaji, Chigozie, Chinonso, Dare, Duro, Efe, Eniola, Ezekiel, Felix, Gabriel, Hassan, Idris,
Jamiu, Kabiru, Kola, Lekan, Moses, Ngozi, Obi, Ola, Oluwaseyi, Osita, Rilwan, Sani, Shola, Temitope, Tosin, Uzoma, Yinka, Zubair, Appiah, Atta, Bright,
Clifford, Dennis, Elvis, Gyan, Hakeem, Joe, Kobina, Latif, Mubarak, Nicholas, Philip, Quincy, Rashid, Sampson, Tetteh, Wisdom, Abiodun, Banji,
Chukwudi, Dotun, Ejike, Fatai, Gbolahan, Ikenna, Jelani, Mide, Nonso, Oyekunle, Pelumi, Rotimi, Sodiq, Tochukwu, Kwamena`,
`Okafor, Adeyemi, Okonkwo, Eze, Nwosu, Obi, Okoye, Chukwu, Ibrahim, Musa, Bello, Adebayo, Ogunleye, Balogun, Adeleke, Ajayi, Akinola, Oladipo, Olawale,
Onyeama, Umeh, Uzor, Nwankwo, Nnamani, Ogbu, Ogunbiyi, Okeke, Okpara, Onuoha, Oyebanji, Salami, Suleiman, Yusuf, Abubakar, Aliyu, Danjuma, Garba,
Idowu, Lawal, Mohammed, Odukoya, Ojo, Okon, Oladele, Olatunji, Olayinka, Omotosho, Onyekachi, Osagie, Owolabi, Raji, Sanni, Tijani, Usman, Williams,
Yakubu, Adewale, Afolabi, Agbaje, Aina, Akande, Akintola, Alabi, Amadi, Anyanwu, Arinze, Ayeni, Babalola, Bamidele, Chidiebere, Dike, Edet, Egbuna,
Ekpo, Eke, Emenike, Eniola, Etim, Ezeh, Fashola, Folarin, Gbadamosi, Ijeoma, Jimoh, Kalu, Lasisi, Madu, Mbah, Mbonu, Nduka, Nnadi, Nwachukwu, Nwafor,
Nwogu, Odunsi, Ogundipe, Ohakim, Ojukwu, Okechukwu, Okorie, Olabode, Olakunle, Oloyede, Onwudiwe, Opara, Oyelaran, Oyewole, Taiwo, Uche, Udoh, Ugwu,
Umoh, Wada, Yahaya, Zubairu, Adjei, Agyeman, Amankwah, Amoah, Annan, Antwi, Appiah, Asamoah, Ashong, Asiedu, Atta, Badu, Baffoe, Bonsu, Boateng, Danso,
Darko, Donkor, Duah, Frimpong, Gyamfi, Gyasi, Kuffour, Kwarteng, Larbi, Mensah, Nyarko, Obeng, Ofori, Opoku, Osei, Owusu, Quaye, Quartey, Sarpong,
Tagoe, Tetteh, Tettey, Yeboah, Acheampong, Addai, Addo, Adomako, Afriyie, Agyei, Ampofo, Anane, Ansah, Armah, Arthur, Asare, Awuah, Bediako, Boakye,
Brobbey, Coffie, Dadzie, Dankwa, Dwamena, Fosu, Gyimah, Kyei, Lamptey, Mintah, Nsiah, Nti, Ocran, Odoom, Oppong, Pappoe, Quansah, Sackey, Sakyi,
Tawiah, Twumasi, Wiredu, Yamoah, Abdulai, Adamu, Alhassan, Fuseini, Issahaku, Mahama, Salifu, Seidu, Zakaria, Bawa, Adegoke, Adekunle, Adesina, Agu,
Ahmadu, Ajibola, Akpan, Anozie, Bankole, Chinwuba, Dosunmu, Ebuka, Ekwueme, Emeka, Eyo, Falola, Gabriel, Harrison, Iwuchukwu, Johnson, Oduya, Ogidi,
Abara, Abiola, Adebisi, Adedeji, Adeniran, Adesanya, Adeyinka, Agbonlahor, Ajagbe, Akinwale, Akpabio, Anigbogu, Anukam, Atiku, Awosika, Ayodele,
Azubuike, Balewa, Bassey, Chidozie, Dosumu, Ebere, Edozie, Ejiofor, Emeagwali, Enyeama, Etuk, Ezekwesili, Fagbemi, Giwa, Ikpeba, Imoh, Isichei,
Kolawole, Lekan, Macaulay, Nwoke, Obiora, Odegbami, Ogunsanya, Olaniyan, Onuigbo, Orji, Oshodi, Otubu, Shittu, Soyinka, Uwaifo, Yerima, Agyapong,
Ankrah, Appau, Asante, Baah, Bampoe, Bortey, Cobbinah, Dapaah, Ennin, Gyekye, Kumi, Manu, Marfo, Nkansah, Okyere, Sarfo, Takyi, Tuffour, Yawson, Addy,
Ayensu, Bonney, Hammond, Konadu, Lartey, Mills, Nortey, Offei, Pobee, Quainoo, Adjaye, Boadu, Dzorkpe, Folorunsho, Gbadebo, Hamzat, Iheanacho, Jolaoso,
Kuti`);

// ---- west-african-franco
def('west-african-franco',
`Mamadou, Moussa, Ousmane, Ibrahima, Cheikh, Abdoulaye, Souleymane, Modou, Pape, Babacar, Idrissa, Lamine, Boubacar, Samba, Alioune, Mouhamed, Omar,
Saliou, Serigne, Seydou, Amadou, Aboubacar, Adama, Bakary, Bassirou, Demba, Diadie, Djibril, Fode, Gora, Habib, Issa, Kalidou, Lassana, Mahamadou,
Malick, Mbaye, Mody, Ngagne, Ousseynou, Sadio, Salif, Sekou, Tidiane, Yaya, Youssouf, Yacouba, Zakaria, Franck, Serge, Wilfried, Gervais, Didier,
Cheick, Emmanuel, Eric, Arsène, Christian, Hervé, Jonathan, Kevin, Lacina, Max, Nicolas, Olivier, Pascal, Roger, Sylvain, Stéphane, Thierry, Yannick,
Aristide, Bertrand, Blaise, Brice, Cédric, Clovis, Désiré, Éric, Fabrice, Gaston, Guy, Hugues, Ismael, Jacques, Landry, Léonce, Marcel, Narcisse,
Parfait, Rodrigue, Salomon, Stanislas, Alassane, Bamba, Brahima, Cyriaque, Dramane, Fousseni, Gnagna, Hamed, Inza, Kassoum, Lansana, Mamoutou, Nouhoum,
Oumar, Siaka, Tiemoko, Vamara, Zoumana, Aly, Amara, Aliou, Ansoumane, Baba, Bocar, Daouda, Drissa, Gaoussou, Hamidou, Ibou, Kader, Karim, Madiba,
Makan, Mohamed, Moulaye, Moustapha, Nene, Papa, Sada, Sambou, Sidiki, Sory, Tafsir, Thierno, Yero, Zeyni, Ange, Auguste, Beaudelaire, Boris, Cyrille,
Dieudonné, Eyenga, Gaël, Hippolyte, Jules, Kisito, Lambert, Mathurin, Nestor, Oswald, Privat, Rostand, Sébastien, Thibaut, Valéry, Wilfrid, Xavier,
Abdou, Boureima, Cheickna, Daba, Elhadji, Halidou, Ismaila, Joseph, Koffi, Mawuli, Nafi, Fadiga`,
`Diop, Ndiaye, Fall, Sow, Sarr, Gueye, Diallo, Ba, Faye, Mbaye, Seck, Sy, Cissé, Thiam, Niang, Ndao, Kane, Camara, Diouf, Mendy, Sané, Badji, Bâ, Dione,
Diatta, Gomis, Sagna, Tendeng, Toure, Traoré, Koné, Coulibaly, Ouattara, Bamba, Doumbia, Keita, Sissoko, Sangaré, Konaté, Dembélé, Diarra, Cissokho,
Fofana, Kouyaté, Sidibé, Samaké, Sanogo, Maïga, Touré, Haidara, Doucouré, Diakité, Bagayoko, Koita, Soumaré, Kamara, Sylla, Bakayoko, Yao, Kouassi,
Kouamé, N'Guessan, Gnahoré, Zokora, Tiéné, Aka, Brou, Kobenan, Koffi, Konan, Kouadio, Loukou, N'Dri, N'Zi, Ahoua, Adingra, Agbo, Akpa, Anoh, Assi,
Bédi, Bi, Boka, Dago, Dje, Doh, Dosso, Eboué, Gnagne, Gnako, Gohou, Guédé, Kacou, Kaba, Lago, Lépine, Mian, Niamien, Ouédraogo, Sawadogo, Compaoré,
Zongo, Kaboré, Tapsoba, Nikiéma, Barry, Bah, Baldé, Soumah, Bangoura, Keïta, Kourouma, Conté, Condé, Yattara, Mansaré, Dramé, Mbarga, Ndongo, Nkoulou,
Etame, Fouda, Ekambi, Mbida, Mvondo, Ngadjui, Njie, Nguele, Nyom, Ondoa, Ebogo, Abena, Abanda, Atangana, Bahoken, Djeumou, Ebanga, Fai, Feutchou,
Ganji, Hongla, Kunde, Lembi, Mandjeck, Mbock, Nana, Ngom, Nlend, Olinga, Owona, Tabekou, Tagne, Tchana, Tsoungui, Yong, Zambo, Akono, Bekolo, Biyik,
Bilong, Dikongue, Eloundou, Essomba, Evina, Fotso, Kamga, Kengne, Kouam, Menye, Minkoulou, Mongo, Nanga, Ndzana, Ngono, Noubissi, Pouaha, Sabi, Songo,
Talla, Tchoupo, Wamba, Wouapi, Zogo, Ayissi, Bingono, Biwole, Ebelle, Esso, Mballa, Mimbang, Aïdara, Badiane, Bakhoum, Bathily, Bocoum, Bouaré, Boye,
Coly, Dabo, Dème, Dia, Dieng, Dieye, Diome, Doukouré, Fadiga, Fatty, Gaye, Gning, Goudiaby, Guirassy, Kanté, Kébé, Konaré, Koulibaly, Lô, Loum, Mané,
Mansaly, Mbodj, Mboup, Ndoye, Niasse, Niangadou, Pouye, Sabaly, Sakho, Samb, Sambou, Sène, Sonko, Tall, Tandjigora, Thioub, Wade, Yade, Zerbo,
Aboubakar, Bayiha, Bessala, Dikoumé, Djeukam, Eboa, Fomba, Gwet, Kana, Kemajou, Lobe, Manga, Mbella, Ndjock, Tchami, Tchatchoua, Bonga, Dagbo, Gadji,
Gnonka, Guéi, Kossonou, Loba, N'Cho, Ouégnin, Séry, Tano, Yapi, Zadi, Agbessi, Bahi, Boli, Dadié, Djédjé, Ehui, Gouet, Kodjo, Lasme, Mel, Ngatta,
Oulai, Tiemoko, Vagba, Wognin, Yoboué, Zoro, Cissoko, Dagnogo, Gbané, Haïdara, Iba, Lougué, Mounkoro, Nabé, Poda, Sanou, Tamboura, Ye, Zio, Diabaté,
Diagouraga, Diarrassouba, Doumbouya, Samassékou, Tangara, Yaffa, Cherif`);

// ---- east-southern-african
def('east-southern-african',
`Thabo, Sipho, Themba, Lungile, Bongani, Siyabonga, Mandla, Sibusiso, Thulani, Vusi, Zola, Lucky, Tshepo, Kagiso, Katlego, Lebohang, Mpho, Neo, Orlando,
Percy, Teboho, Tumelo, Teko, Thato, Itumeleng, Kamogelo, Lesego, Oupa, Patrick, Phumlani, Siphiwe, Sandile, Sizwe, Steven, Tebogo, Tiyani, Wandile,
Xolani, Yaya, Zakhele, Andile, Ayanda, Bheki, Blessing, Cebo, Dumisani, Eric, Fanele, Given, Hlompho, Innocent, Jabu, Khulekani, Khama, Lerato,
Luyanda, Mduduzi, Mthokozisi, Ndumiso, Nkosana, Nkosinathi, Pule, Raymond, Reneilwe, Sbu, Siyanda, Solly, Tendai, Thando, Tshepiso, Unathi, Vuyo,
Wiseman, Zwelithini, Kelvin, Kevin, Brian, Dennis, Elijah, Felix, Geoffrey, George, Hassan, Isaac, Jackson, Joseph, Kennedy, Lawrence, Moses, Nelson,
Oscar, Peter, Rashid, Samuel, Simon, Victor, Wycliffe, Allan, Amani, Baraka, Daudi, Emmanuel, Faraji, Hamisi, Jabari, Juma, Kibwe, Mwangi, Njoroge,
Otieno, Omondi, Odhiambo, Kipchoge, Kiprop, Kamau, Karanja, Mutua, Wanyama, Chege, Dedan, Gitau, Hassani, Jengo, Kioko, Macharia, Mohamed, Mulenga,
Musonda, Chipo, Emmerson, Kondwani, Lloyd, Mwamba, Nyasha, Prince, Rufaro, Takudzwa, Tafadzwa, Tatenda, Tinashe, Tonderai, Wallace, Admire, Benjani,
Carlington, Cuthbert, Edzai, Farai, Gift, Hope, Itai, Justice, Knowledge, Lovemore, Munashe, Ngoni, Obert, Panashe, Quinton, Rodwell, Shingi,
Washington, Ayabonga, Bonginkosi, Cyril, Goodman, Jerry, Kabelo, Linda, Malusi, Nhlanhla, Phelelani, Sifiso, Thamsanqa, Vukile, Zakes, Mxolisi,
Njabulo`,
`Nkosi, Dlamini, Zulu, Khumalo, Ndlovu, Mokoena, Molefe, Sithole, Mahlangu, Mthembu, Ngcobo, Radebe, Maseko, Modise, Mabaso, Masilela, Mkhize, Mthethwa,
Ntuli, Shabalala, Zungu, Buthelezi, Cele, Dube, Gumede, Hlongwane, Khanyile, Langa, Majola, Mabena, Makhanya, Malinga, Mazibuko, Mbatha, Mdluli,
Msimang, Mtshali, Ngubane, Nxumalo, Sibiya, Xaba, Zondi, Mokwena, Moloi, Mosia, Motaung, Mphahlele, Ngwenya, Nkabinde, Phiri, Phakathi, Pienaar, Botha,
van der Merwe, du Plessis, Venter, Coetzee, Joubert, Kruger, Steyn, Swanepoel, van Wyk, Viljoen, Visagie, Jacobs, Adams, Arendse, Davids, Fortuin,
Isaacs, Jantjies, Julies, Petersen, Samuels, September, Solomons, Abrahams, Booysen, Cupido, Dlomo, Kekana, Lekgoathi, Maake, Mabunda, Machaba,
Mafokeng, Makhubela, Malatji, Maluleke, Masango, Mashaba, Mashego, Mathebula, Matlala, Mavuso, Mbele, Mdlalose, Mhlongo, Mkhwanazi, Mncube, Mnisi,
Mokgosi, Mokone, Molapo, Monyela, Mudau, Mulaudzi, Munyai, Nel, Netshitenzhe, Ngema, Nhlapo, Nkomo, Nsele, Ntombela, Nyathi, Pretorius, Rabothata,
Rapuleng, Sebata, Sedibe, Seleka, Sekgota, Shongwe, Sibanda, Skosana, Tau, Thwala, Tladi, Tshabalala, Tshwete, Vilakazi, Zwane, Kamau, Mwangi, Njoroge,
Otieno, Omondi, Odhiambo, Kipchoge, Kiprop, Mutua, Njuguna, Wafula, Kariuki, Kimani, Kibet, Cheruiyot, Mwenda, Ochieng, Onyango, Ouma, Owino, Wekesa,
Mbugua, Gathogo, Mulenga, Banda, Mwale, Tembo, Chanda, Zimba, Lungu, Daka, Kalaba, Sakala, Katongo, Chama, Mumba, Nyirenda, Musonda, Siame, Bwalya,
Mwila, Simukonda, Moyo, Ncube, Mutasa, Chigumba, Mpofu, Mudzingwa, Chikwanha, Chirwa, Gwaze, Hove, Madzivire, Mapfumo, Muzondo, Nyoni, Tshuma, Zvobgo,
Mushonga, Tarimo, Mwakyusa, Msuya, Kimaro, Massawe, Mushi, Swai, Temba, Lyimo, Mtui, Shayo, Kileo, Mrema, Mollel, Ndosi, Urassa, Kiwelu, Ngowi, Lema,
Tesha, Mkenda, Mfinanga, Magesa, Chacha, Bhengu, Biyela, Blose, Cebekhulu, Chonco, Dladla, Dludla, Duma, Gabela, Gasa, Hadebe, Jele, Khoza, Kubheka,
Luthuli, Madlala, Magagula, Mchunu, Mdletshe, Mkhabela, Mlambo, Mngadi, Mpanza, Msomi, Mthiyane, Myeni, Ndaba, Ndwandwe, Ngidi, Ngwane, Nhleko, Njoko,
Ntshangase, Nzama, Qwabe, Sangweni, Shange, Shezi, Sikhakhane, Thusi, Vezi, Xulu, Zikalala, Chiwenga, Dzvairo, Gondwe, Gumbo, Jongwe, Makoni, Mhlanga,
Mlilo, Chebet, Kiptoo, Korir, Langat, Maina, Mutai, Ngugi, Rotich, Wambui, Kalonji, Katanga, Kunda, Lubinda, Mubanga, Mukuka, Mwansa, Ngulube, Sichone,
Bosman, Brits, de Beer, Fourie, Grobler, Human, Labuschagne, Lombard, Malan, Nortje, Adhiambo, Barasa, Chepkoech, Gitonga, Kamande, Lagat, Mbithi,
Nyaga, Oduor, Owuor, Wanjala, Zakayo, Kasonde, Lupiya, Mutale, Nkandu, Sikazwe, Chimedza, Hlatshwayo, Mavhunga`);

// ---- japanese
def('japanese',
`Haruto, Yuto, Sota, Yuki, Hayato, Ren, Riku, Kaito, Daiki, Takumi, Kenta, Shota, Ryota, Kosuke, Naoki, Takeshi, Hiroshi, Kazuki, Masato, Satoshi,
Tomoya, Yusuke, Yuma, Akira, Daisuke, Eiji, Fumiya, Genki, Goro, Haruki, Hideki, Hikaru, Hiroki, Isamu, Jun, Junya, Kaede, Keita, Kensuke, Kohei, Koji,
Kota, Makoto, Manabu, Masaki, Minato, Nao, Noboru, Osamu, Ryo, Ryusei, Ryuji, Seiji, Shin, Shingo, Shinji, Shun, Shunsuke, Sosuke, Susumu, Taichi,
Taiga, Taisei, Takahiro, Takashi, Takuma, Taro, Tatsuya, Teruo, Tetsuya, Tsubasa, Wataru, Yasuo, Yoshi, Yoshiki, Yosuke, Yuji, Yukio, Yuya, Atsushi,
Daichi, Hajime, Hideo, Hisashi, Itsuki, Jiro, Kazuya, Kei, Kenji, Kiyoshi, Kunio, Masahiro, Mitsuru, Nobuo, Rei, Rintaro, Ryosuke, Saburo, Satoru,
Seiya, Shigeru, Shiro, Sho, Soma, Takayuki, Tomohiro, Toru, Toshi, Tsuyoshi, Yasuhiro, Yoichi, Yoshio, Yuichi, Yukihiro, Yusei, Akio, Arata, Daigo,
Eita, Gaku, Hibiki, Hinata, Issei, Jo, Kazuo, Kento, Kouki, Leo, Mamoru, Michio, Nagi, Naoto, Norio, Reo, Ryohei, Sakuya, Seigo, Shuhei, Takuto,
Tomoki, Yamato, Yoshitaka, Yudai, Yushi, Zen, Reiji, Eisuke, Fuma, Gen, Isao, Jin, Kinji, Mikio, Raiki, Tetsu, Yusaku, Kazuma, Natsuki, Ruka`,
`Sato, Suzuki, Takahashi, Tanaka, Watanabe, Ito, Yamamoto, Nakamura, Kobayashi, Kato, Yoshida, Yamada, Sasaki, Yamaguchi, Matsumoto, Inoue, Kimura,
Hayashi, Shimizu, Yamazaki, Mori, Abe, Ikeda, Hashimoto, Yamashita, Ishikawa, Nakajima, Maeda, Fujita, Ogawa, Goto, Okada, Hasegawa, Murakami, Kondo,
Ishii, Saito, Sakamoto, Endo, Aoki, Fujii, Nishimura, Fukuda, Ota, Miura, Fujiwara, Okamoto, Matsuda, Nakagawa, Nakano, Harada, Ono, Tamura, Takeuchi,
Kaneko, Wada, Nakayama, Ishida, Ueda, Morita, Hara, Shibata, Sakai, Kudo, Yokoyama, Miyazaki, Miyamoto, Uchida, Takagi, Ando, Taniguchi, Ohno,
Maruyama, Imai, Takada, Fujimoto, Takeda, Murata, Ueno, Sugiyama, Masuda, Sugawara, Hirano, Kojima, Otsuka, Chiba, Kubo, Matsui, Iwasaki, Sakurai,
Kinoshita, Noguchi, Matsuo, Nomura, Kikuchi, Sano, Onishi, Sugimoto, Arai, Hamada, Aihara, Akagi, Akiyama, Amano, Arakawa, Asano, Baba, Bando, Chono,
Daimon, Ebina, Fukui, Fukushima, Furukawa, Gonda, Hagiwara, Hanada, Hasebe, Higuchi, Hirata, Hirose, Hoshino, Ichikawa, Iida, Imamura, Inagaki,
Inamura, Isobe, Iwamoto, Iwata, Izumi, Jinno, Kai, Kamiya, Kanai, Kataoka, Katayama, Kawabata, Kawaguchi, Kawakami, Kawamura, Kawasaki, Kishi,
Kitagawa, Kitamura, Kobashi, Koga, Komatsu, Konishi, Koyama, Kurata, Kurihara, Kuroda, Kusunoki, Maekawa, Maki, Masaki, Matsubara, Matsuoka, Mikami,
Minami, Mishima, Mitani, Miyake, Miyata, Mizuno, Mochizuki, Motoki, Nagai, Nagata, Nagasawa, Naito, Nakai, Nakata, Nakazawa, Namba, Narita, Nishida,
Nishikawa, Nishio, Noda, Obata, Ochiai, Ogasawara, Ohashi, Oka, Okabe, Okumura, Omori, Oshima, Otani, Sakata, Sakuma, Sawada, Seki, Shimada, Shimura,
Shinohara, Soma, Sone, Sugita, Tabata, Tachibana, Takayama, Takemura, Tamaki, Tanabe, Terada, Tomita, Toyoda, Tsuchiya, Tsukamoto, Umeda, Uehara,
Utsumi, Wakabayashi, Wakamatsu, Yagi, Yamane, Yamauchi, Yasuda, Yoneda, Yoshikawa, Yoshimura, Yuasa, Yagami, Hosokawa, Ichinose, Kamata, Kuwabara,
Nakahara, Orita, Sagara, Tsujimoto, Usui, Mizuhara, Nagano, Shirai, Takano, Abiko, Adachi, Aizawa, Anzai, Asakura, Daito, Eguchi, Fujisawa, Fukumoto,
Hamano, Hanzawa, Hayakawa, Hirabayashi, Hosoda, Ichihara, Ide, Inui, Iwai, Kakinuma, Kamimura, Kanemoto, Kasahara, Kawai, Kijima, Kiyota, Kobayakawa,
Koizumi, Kuramochi, Kurosawa, Maruta, Masuoka, Mitsui, Miyauchi, Mukai, Nagayama, Nemoto, Nitta, Oda, Ogura, Osawa, Sakaguchi, Sasayama, Shiraishi,
Sugiura, Tachikawa, Tajima, Tsutsumi, Umemura, Wakui, Yanagisawa, Yokota, Yoshioka, Akimoto, Bessho, Dohi, Enomoto, Fukaya, Gotoh, Hirayama, Ishizaki,
Akaike, Doi, Fujishima, Gunji, Hayami, Iwabuchi, Kaneda, Koshiba, Machida, Noro, Otake, Saegusa, Takaoka, Uemura, Yokoi`);

// ---- korean
def('korean',
`Min-jun, Seo-jun, Ji-hoon, Joon-ho, Hyun-woo, Dong-hyun, Sung-min, Jae-hyun, Tae-yang, Woo-jin, Seung-ho, Young-jae, Jin-woo, Kang-in, Do-hyun,
Ha-joon, Ye-jun, Si-woo, Eun-woo, Ji-ho, Sang-hoon, Chang-min, Dae-hyun, Do-yoon, Gun-woo, Hae-sung, Han-bin, Hee-chan, Hyo-jun, In-seong, Jae-min,
Jae-won, Jeong-hoon, Ji-sung, Jin-ho, Jong-ho, Jun-seo, Jun-young, Ki-hoon, Kyung-ho, Myung-soo, Sang-woo, Se-jun, Seok-jin, Seong-hyeon, Seung-min,
Shin-woo, Su-hyeok, Sun-woo, Tae-hoon, Tae-min, Won-jun, Woo-sung, Yeong-ho, Yong-sik, Yoon-seo, Young-min, Yu-jin, Beom-seok, Bo-gyeom, Chan-ho,
Chul-soo, Dae-sung, Dong-won, Dong-jun, Eui-jo, Gi-tae, Gwang-hyun, Hak-soo, Hyeon-seok, Hyun-jin, Il-kwon, In-beom, Jae-sung, Jin-young, Joo-ho,
Jung-hwan, Ki-sung, Kwang-soo, Min-hyuk, Min-kyu, Moon-hwan, Nam-il, Pil-jae, Sang-ho, Seon-ho, Seul-ki, Sung-hoon, Tae-hwan, Won-sik, Woo-young,
Yeong-jin, Young-gwon, Yun-ho, Bum-soo, Byung-hoon, Cheol-min, Dong-gook, Doo-ri, Gyu-seong, Ha-neul, Hyeong-jun, Jae-ho, Joon-seo, Ju-won, Kang-soo,
Kyu-bin, Man-ho, Mu-yeol, Ok-sung, Pyeong-ho, Ryu-hyeon, Seung-woo, Shi-hyeon, Soo-bin, Tae-seok, Ung-jae, Wan-kyu, Yo-han, Yu-seong, Bong-jun,
Chung-ho, Dong-wook, Eun-sung, Gyeong-su, Hee-seong, Hyun-soo, Jae-yeong, Ji-won, Ki-yong, Mun-su, Sang-min, Seong-ho, Seung-hyun, Sun-hwan, Yeon-ho,
Yong-jun, Yun-seok, Zin-hyuk, Do-young, Dong-gun, Eun-ho, Gi-bum, Hyo-seok, Jae-jin, Kyung-min, Min-seok, Nam-gil, Sang-yeop, Tae-ho, Won-bin,
Yoon-sik, Chan-yeol, Deok-hwan, Hye-seong, Ik-hyun`,
`Kim, Lee, Park, Choi, Jung, Kang, Cho, Yoon, Jang, Lim, Han, Oh, Seo, Shin, Kwon, Hwang, Ahn, Song, Yoo, Hong, Jeon, Ko, Moon, Yang, Son, Bae, Baek,
Heo, Nam, Sim, Noh, Ha, Gwak, Sung, Cha, Joo, Woo, Min, Ryu, Na, Jin, Ji, Um, Chae, Won, Cheon, Bang, Gong, Hyun, Ham, Byun, Yeom, Yeo, Choo, Do, So,
Seok, Seon, Bok, Mun, Bu, Pyo, Eo, Gu, Ma, Pi, Tak, Wi, Gil, Gye, Ban, Bin, Ga, Dae, Dong, Gi, Kyung, Myeong, Nae, Ok, Pak, Jeong, Yu, Gang, Cheong,
Gwon, Sin, Seonu, Namgung, Jegal, Dokgo, Hwangbo, Sagong, Seomun, Sa, Jo, Yi, Baik, Beom, Boo, Chun, Dan, Eun, Gam, Geum, Gyeon, Hoo, Hur, Hwa, Ihm,
Im, Jwa, Kam, Kil, Kye, Maeng, Mo, Moh, Myung, Paik, Pae, Rho, Roh, Ryoo, Sohn, Soh, Suh, Tae, Wang, Yook, Yun, Yeon, Yong, Ju, Jae, Jun, Kyu, Lyu,
Mok, Nho, Oak, Ohn, Pang, Pyun, Rim, Seong, Shim, Tchoi, Wee, Yim, Young, Zhoo, Gim, Kym, Rhee, Ri, Bak, Pahk, Choe, Chwe, Choy, Chung, Joe, Youn,
Chang, O, Seoh, Koh, Go, Jeun, Chon, Hyeon, Heoh, Huh, No, Kwak, U, Eom, Yum, Chu, Byeon, Hahm, Gweon, Bhang, Simm, Tcho, Soo, Suk, Pyon, Jeung, Chai,
Che, Kyeong, Koo, Ku, Mah, Namkung, Seonwoo, Dongbang, Gwang, Haam, Seol, Yeong, A, Ae, Gae, Gak, Gan, Gyo, Guk, Gun, Gung, Geun, Ki, Ra, Nan, Nang,
Noe, Nu, Dam, Don, Du, Man, Mae, Myo, Mu, Mi, Beon, Bong, Bi, Bing, Sam, Sang, Seop, Seung, Si, Sip, Ya, Ye, On, Ong, Yuk, Eum, In, Jeom, Je, Jong,
Tan, Pan, Paeng, Pyeon, Pyeong, Po, Pung, Hak, Hae, Hyeong, Ho, Hu, Heung, Mangjeol, Ree, Lie, Rie, Yee, Pack, Bahk, Boak, Chey, Jhung, Chong, Kahng,
Cheo, Jho, Joh, Zo, Yune, Yeun, Limm, Ohh, Sur, Sheen, Shinn, Kwun, Kuon, Gwun, Whang, Ann, Soong, You, Rue, Lew, Gahng, Kweon, Haan, Hahn, Hwahng,
Jhang, Zang, Joung, Rhim, Nahm, Yahng, Shimm, Yeoh, Yoh, Kyoung, Jhee, Shon, Jeoung, Jeoun, Chou, Lyoo, Yeu, Euh, Bahng, Gwuk, Guen, Gyoung, Dohn,
Dook, Hoh, Hyoun, Moo, Naa, Nohh, Pahn, Seoul, Taek`);

// ---- chinese
def('chinese',
`Wei, Lei, Jun, Hao, Yang, Ming, Jian, Tao, Bo, Chao, Dong, Feng, Gang, Hui, Jie, Kai, Liang, Long, Peng, Qiang, Rui, Shuai, Tian, Xin, Yan, Yong, Yu,
Zhi, Zhong, Bin, Cheng, Fan, Guang, Heng, Jing, Kun, Lin, Meng, Nan, Ping, Qing, Rong, Sheng, Tong, Wen, Xiang, Xu, Yi, Yuan, Zhen, Zheng, Zhou, Bing,
Chen, Da, Fei, Guo, Han, Jia, Jin, Kang, Lu, Ning, Qi, Shan, Tie, Wu, Xian, Xiao, Yao, Zhe, Zhuo, An, Bao, Cai, Dan, En, Fu, Gui, Hong, Jiang, Ke, Le,
Mu, Pei, Qin, Ren, Shi, Teng, Wang, Xing, Ya, Zi, Ao, Chang, Chun, De, Er, Fa, Gen, He, Hu, Ji, Jiu, Kuan, Lian, Min, Nuo, Pu, Qian, Ruo, Song, Tai,
Wan, Xia, Yun, Zhan, Zhao, Zhuang, Yuchen, Haoran, Zihan, Yuxuan, Zhihao, Junjie, Minghao, Wenjun, Xiaolong, Yifan, Jiahao, Hongwei, Shijie, Tianyu,
Yuhang, Zhenhua, Bowen, Chenyu, Guoliang, Haibo, Jingyi, Kaixuan, Lijun, Muchen, Ningyuan, Qiming, Ruixiang, Shaoqi, Taoran, Weidong, Xinyu, Yanming,
Zhongyi, Aoxiang, Bingwen, Chenggong, Dawei, Enlai, Fengyuan, Gangqiang, Hengxin, Jiale, Kunpeng, Linfeng, Mengyao, Peiyuan, Ronghui, Shengli,
Tongshan, Xiangyu, Yongjian, Zhiqiang, Zhiyuan, Haoyu, Yutong, Changlin, Fengshan, Junhao, Mingyu, Tianci, Weiming`,
`Wang, Li, Zhang, Liu, Chen, Yang, Huang, Zhao, Wu, Zhou, Xu, Sun, Ma, Zhu, Hu, Guo, He, Lin, Gao, Luo, Zheng, Liang, Xie, Song, Tang, Han, Feng, Deng,
Cao, Peng, Zeng, Xiao, Tian, Dong, Pan, Yuan, Cai, Jiang, Yu, Du, Ye, Cheng, Wei, Su, Lv, Ding, Ren, Lu, Yao, Shen, Zhong, Fan, Fang, Shi, Yan, Jia,
Xia, Zou, Xiong, Bai, Meng, Qin, Qiu, Hou, Jin, Duan, Lei, Long, Tao, Lai, Hao, Kong, Bo, Tan, Hong, Gu, Wan, Qian, Yin, Mao, Xue, Yi, Cui, Zhan, Niu,
Liao, Gong, Chang, Shao, Kang, Wen, Xiang, Tong, Pei, Ning, Geng, Ji, Fu, Mo, Ou, Gan, Si, Ao, Huo, Rao, Bian, Dai, Ai, Ban, Bao, Bu, Cen, Chu, Cong,
Dou, Fei, Ge, Gui, Hua, Jie, Ke, Lang, Lan, Lian, Ling, Lou, Miao, Min, Nie, Pang, Pu, Qi, Qu, Ran, Rong, Sha, Shang, Shu, Sui, Tu, Xi, Xin, Xing, Yue,
Zang, Zhai, Zhuang, An, Bi, Cang, Chai, Che, Diao, Fa, Gai, Gou, Hai, Heng, Jing, Kuang, Lü, Mei, Ni, Ouyang, Qiao, Sang, Tie, Xun, Zhi, Situ, Duanmu,
Murong, Shangguan, Xiahou, Zhuge, Sima, Linghu, Gongsun, Huangfu, Chan, Cheung, Wong, Lau, Leung, Ho, Ng, Yeung, Chow, Lam, Tsang, Kwok, Fung, Tse, Ip,
Siu, Yip, Chiu, Lok, Poon, Mak, Chung, Hui, Kwan, Shek, Tam, Yau, Law, Sit, Ngai, Au, Kam, Lim, Teo, Goh, Ong, Koh, Chua, Yap, Foo, Khoo, Soh, Seah,
Loh, Phua, Quek, Toh, Wee, Yeo, Chew, Chia, Chin, Chong, Choo, Eng, Gwee, Hoo, Kwa, Liew, Low, Mah, Moh, Neo, Ow, Pek, Sia, Tay, Thio, Woon, Yong,
Zhuo, Ba, Bei, Ben, Biao, Bing, Cha, Chi, Dang, Di, Fen, Guan, Hang, Jian, Jiao, Ju, Kou, Lie, Mi, Mou, Qiang, Ruan, She, Shou, Weng, Xian, Zuo,
Dongfang, Nangong, Zhangsun, Yuchi, Shentu, Dugu, Taishi, Zhongli, Wenren, Helian, Xiu, Mu, Nan, Tai, Bie, Ci, Ha, Kan, La, Le, Lun, Mai, Man, Nai, Sa,
Se, Wa, Ya, Zan, Dongguo, Ximen, Nanmen, Zuoqiu, Gongye, Yuwen, Chunyu, Ang, Ooi, Saw, Seow, Sng, Tiong, Yoong, Cheah, Lieu, Lui, Ngan, Pun, Sin, Hon`);

// ---- persian
def('persian',
`Ali, Mohammad, Reza, Hossein, Hassan, Mehdi, Amir, Mahdi, Saeed, Majid, Mojtaba, Ehsan, Behnam, Farhad, Kaveh, Arash, Babak, Bijan, Dariush, Ebrahim,
Esmaeil, Farid, Hamed, Hamid, Hesam, Iman, Javad, Kamran, Kourosh, Masoud, Milad, Morteza, Navid, Omid, Payam, Peyman, Pouya, Rahim, Ramin, Sajjad,
Saman, Sasan, Shahin, Shahram, Siamak, Sina, Soheil, Sohrab, Taher, Vahid, Yaser, Yousef, Abbas, Abolfazl, Alireza, Amin, Ardeshir, Armin, Aydin,
Behrouz, Bahram, Cyrus, Darius, Farzad, Fereydoun, Gholamreza, Hadi, Hooman, Houshang, Jamshid, Karim, Keyvan, Khosrow, Mansour, Mazyar, Mostafa,
Nader, Nasser, Nima, Parviz, Pedram, Rasoul, Roozbeh, Sadegh, Shapour, Siavash, Tahmoures, Behdad, Teymour, Ziya, Yashar, Abdollah, Afshin, Akbar,
Alborz, Anoush, Ardalan, Arman, Atabak, Bardia, Behzad, Bizhan, Daniyal, Davood, Emad, Fariborz, Farshid, Fazel, Firouz, Ghasem, Hashem, Hormoz, Iraj,
Jalal, Kasra, Kianoush, Manouchehr, Mehran, Mohsen, Nariman, Nowzar, Omran, Pejman, Rostam, Sepehr, Shahab, Shayan, Soroush, Tohid, Vafa, Yadollah,
Zahed, Amirhossein, Amirreza, Arya, Artin, Ashkan, Barbod, Danial, Fouad, Hanif, Kian, Kiarash, Mani, Mobin, Mohammadreza, Nikan, Parsa, Radin, Sadra,
Shervin, Venous, Yahya, Zaniar, Bagher, Fakhreddin, Kamal, Mahyar, Rouzbeh, Sharif, Aref, Bahman, Dara, Farhang, Hojjat, Ilkhan, Jahangir, Khashayar,
Lotfali, Mehrdad`,
`Mohammadi, Hosseini, Ahmadi, Rezaei, Karimi, Hashemi, Jafari, Mousavi, Ebrahimi, Moradi, Hosseinzadeh, Rahimi, Asadi, Sadeghi, Khosravi, Rostami,
Nazari, Akbari, Abbasi, Yousefi, Gholami, Safari, Taheri, Mahdavi, Esmaeili, Farhadi, Zarei, Heidari, Amini, Bagheri, Daneshvar, Ghorbani, Fallah,
Habibi, Jamshidi, Kazemi, Latifi, Maleki, Naderi, Parvizi, Qasemi, Rashidi, Salehi, Tavakoli, Valizadeh, Zand, Alavi, Azizi, Bahrami, Barati, Dehghan,
Ghasemi, Haghighi, Irani, Jalali, Kamali, Lotfi, Mirzaei, Nouri, Omidi, Pakzad, Rafiei, Sharifi, Tabatabaei, Vaziri, Yazdani, Zamani, Afshar, Alizadeh,
Amiri, Ansari, Arabi, Ashrafi, Atashi, Babaei, Behbahani, Bozorgi, Dadashi, Dastgheib, Ettehadi, Farahani, Fazeli, Feyzi, Ghaffari, Ghanbari,
Golestani, Hakimi, Hamidi, Hemmati, Jahanbakhsh, Jahani, Kaviani, Khalili, Khatami, Khorasani, Mansouri, Maroufi, Mehrabi, Mirhosseini, Moghaddam,
Mokhtari, Mortazavi, Najafi, Namdar, Nikbakht, Niknam, Oskouei, Pahlavan, Pourmohammadi, Pourali, Ramezani, Sabet, Sadri, Saedi, Samadi, Sarraf,
Shafiei, Shahbazi, Shakeri, Shirazi, Soltani, Tabrizi, Tehrani, Tousi, Vahdati, Zahedi, Zareei, Zargar, Abedini, Adeli, Aghaei, Alipour, Arjmand,
Ashouri, Azimi, Badiee, Bakhtiari, Banihashemi, Dehkordi, Dorri, Eftekhari, Eslami, Etemadi, Faraji, Gharib, Hatami, Jabbari, Jalilvand, Kalantari,
Karami, Keshavarz, Khademi, Lari, Madani, Mahmoudi, Makki, Marandi, Mashhadi, Mehdizadeh, Nematollahi, Nezami, Noorani, Paknejad, Pashaei, Pirouzi,
Rahmani, Razavi, Sabzevari, Saeidi, Sajadi, Sanaei, Shams, Taghavi, Talebi, Tehranchi, Tirandaz, Vakili, Yaghoubi, Zakeri, Zolfaghari, Aminian,
Baradaran, Bayat, Chehrazi, Dashti, Eghbali, Falahati, Gilani, Hadian, Hajizadeh, Iranmanesh, Jozani, Kordestani, Lorestani, Mazandarani, Nasiri,
Ostad, Piri, Qomi, Rasouli, Sahraei, Tafreshi, Ardakani, Behrouzi, Dolatabadi, Esfahani, Fouladi, Ghiasi, Hejazi, Isfahani, Jahromi, Kashani, Lavasani,
Nikoo, Poorhaji, Roshan, Sefidi, Tahmasebi, Zanjani, Zibaei, Abolhassani, Ahangari, Alamdari, Alikhani, Amirkhani, Ansarian, Arbabi, Ardalani, Asgari,
Ashtiani, Ataei, Azad, Bahmani, Bakhshi, Bashiri, Behzadi, Dabiri, Danaei, Derakhshan, Ebadi, Emami, Eskandari, Faghih, Farrokhi, Fathi, Ghodsi, Gilak,
Haddadi, Hajian, Hamzehei, Hekmat, Hooshmand, Javadi, Jazayeri, Kamyab, Karbasi, Khayami, Khodadadi, Lahiji, Mahmoodi, Masoumi, Mirzakhani, Moayeri,
Mohseni, Nabavi, Nafisi, Nahavandi, Nikpour, Panahi, Pezeshki, Rezvani, Sadeghian, Safavi, Salimi, Sedighi, Shariati, Soleimani, Tavassoli, Yarahmadi,
Zandi, Afrasiabi, Bolourchi, Chamran, Dastjerdi, Ferdowsi, Hashemzadeh, Javanmard, Khoshbakht, Lajevardi, Azarpour, Bakhtiar, Dehghani, Fanaei, Gerami,
Hashemian, Jalilian, Karimian, Lotfollahi, Mansoorian, Nourbakhsh, Rahnavard, Sarvari, Tabibi, Aalami, Behnam, Cheraghi, Dowlatshahi, Esfandiari,
Fakhri, Gharavi, Hosseinian, Jamali, Kiani`);

// ---- anglo-oceanian-american
def('anglo-oceanian-american',
`Jackson, Liam, Noah, Mason, Logan, Ethan, Aiden, Caleb, Carter, Dylan, Evan, Grayson, Hunter, Jaxon, Landon, Levi, Lincoln, Nolan, Owen, Parker,
Austin, Brayden, Brody, Chase, Cole, Colton, Connor, Cooper, Dawson, Easton, Elijah, Gavin, Hayden, Isaiah, Jace, Jordan, Kyle, Landen, Lucas, Miles,
Nathaniel, Preston, Reid, Ryder, Sawyer, Tanner, Tristan, Wyatt, Zane, Zachary, Bryce, Cody, Corey, Derek, Dustin, Garrett, Jared, Jeremiah, Josh,
Justin, Kevin, Kurt, Lance, Marcus, Nick, Quinn, Randy, Reggie, Shawn, Spencer, Trent, Troy, Tyrone, Vince, Wade, Xavier, Andre, Antonio, Brandon,
Cedric, Darnell, DeShawn, Dwayne, Jamal, Jerome, Keenan, Malik, Marquis, Terrence, Tyrell, Aidan, Bailey, Beau, Callum, Clancy, Darcy, Fletcher, Flynn,
Hamish, Harrison, Heath, Jai, Jett, Kai, Lachlan, Mitchell, Nash, Riley, Rhys, Rohan, Sully, Tane, Toby, Wiremu, Hemi, Manaia, Nikau, Rawiri, Tama,
Anthony, Devon, Dwight, Everton, Garfield, Horace, Junior, Kemar, Lloyd, Maurice, Ricardo, Shaun, Wayne, Winston, Zavian, Adrian, Barrett, Blake,
Brent, Chad, Clay, Craig, Dale, Doug, Greg, Hank, Jeff, Kent, Kirk, Lyle, Mack, Neil, Rick, Ron, Todd, Wes, Zeke, Sam, Dean, Archer, Hudson, Axel,
Brock, Dane, Kobe, Nixon, Rowan, Tate, Zander, Ryker, Beckett, Cruz, Ezra`,
`Johnson, Smith, Williams, Brown, Jones, Miller, Davis, Garcia, Wilson, Anderson, Taylor, Thomas, Moore, Martin, Jackson, Thompson, White, Harris,
Clark, Lewis, Robinson, Walker, Young, Allen, King, Wright, Scott, Hill, Green, Adams, Baker, Nelson, Carter, Mitchell, Roberts, Turner, Phillips,
Campbell, Parker, Evans, Edwards, Collins, Stewart, Morris, Murphy, Cook, Rogers, Morgan, Peterson, Cooper, Reed, Bailey, Bell, Kelly, Howard, Ward,
Cox, Richardson, Wood, Watson, Brooks, Bennett, Gray, James, Hughes, Price, Sanders, Patterson, Barnes, Ross, Henderson, Coleman, Jenkins, Perry,
Powell, Long, Patel, Hayes, Foster, Simmons, Butler, Bryant, Alexander, Russell, Griffin, Hayden, Fisher, Graham, Ellis, Hamilton, Harrison, Gibson,
Ford, Marshall, Owens, Stone, Wallace, West, Cole, Hunt, Mason, Crawford, Hicks, Henry, Boyd, Mills, Warren, Fox, Rose, Rice, Moreno, Schmidt, Webb,
Washington, Tucker, Burns, Hawkins, Lawson, Hart, Knight, Sullivan, Walsh, Nguyen, Kim, Tran, Lee, Singh, Chen, Wong, Wang, Ryan, Gallagher, McDonald,
O'Neill, Fraser, MacLeod, Blair, Hunter, Ferguson, Burke, Reid, Murray, Duncan, Sinclair, Fitzgerald, Kennedy, Doyle, Lynch, McCarthy, O'Brien, Quinn,
Daly, Black, Bryce, Chambers, Dalton, Eastwood, Farrell, Gilbert, Haines, Irving, Kemp, Langdon, Maddox, Nash, Oakley, Pearson, Quigley, Rennie,
Sutherland, Tait, Upton, Vaughn, Whitaker, Yates, Zimmerman, Abbott, Barlow, Cassidy, Delaney, Ewing, Fleming, Gordon, Holloway, Ingram, Jarvis, Kirby,
Lowe, McKay, Norris, Osborne, Pratt, Rhodes, Shepherd, Tanner, Vance, Walters, Yeo, Ashworth, Burgess, Dixon, Elliott, Francis, Gayle, Hinds, Lawrence,
McFarlane, Morrison, Palmer, Reynolds, Spencer, Barrett, Blackwood, Clarke, Facey, Grant, Haughton, Isaacs, Johnston, Kerr, Lindo, McIntosh, Neita,
Ottey, Rowe, Samuels, Vassell, Whyte, Wint, Aroha, Hohepa, Kereama, Mahuta, Ngata, Parata, Rangi, Tamihana, Waaka, Whaanga, Aldridge, Ballard, Beckett,
Bishop, Bowman, Callahan, Carlisle, Dorsey, Duffy, Eaton, Fairchild, Gentry, Hendrix, Hollis, Jernigan, Kessler, Lockhart, Mercer, Novak, Prescott,
Rowland, Talbot, Underwood, Vickers, Whitfield, Aitken, Bray, Cairns, Dempsey, Eldridge, Farley, Goodall, Hargrove, Ivory, Keating, Lindsay,
McAllister, Nolan, Pritchard, Radley, Stanton, Thorne, Tobin, Voss, Wickham, Yardley, Zeller, Marsden, Callender, Dennis, Forbes, Gooden, Hylton,
Minott, Pinnock, Rhoden, Stennett, Tomlinson, Archer, Bain, Cuthbert, Dyer, Ames, Bixby, Clemens, Dunbar, Eastman, Fenton, Gilmore, Hobart, Ingersoll,
Jessup, Keller, Landry`);

// ============================================================ build the culture tables
function parseList(str) {
  const seen = new Set();
  const out = [];
  for (const part of str.split(',')) {
    const s = part.trim();
    if (s && !seen.has(s)) { seen.add(s); out.push(s); }
  }
  return out;
}

/**
 * @typedef {Object} Culture
 * @property {string} id
 * @property {readonly string[]} first   append-only
 * @property {readonly string[]} last    append-only
 */
/** @type {readonly Culture[]} */
export const CULTURES = Object.freeze(RAW.map(({ id, first, last }) => Object.freeze({
  id,
  first: Object.freeze(parseList(first)),
  last: Object.freeze(parseList(last)),
})));

/** @type {Readonly<Object<string, Culture>>} */
export const CULTURE_BY_ID = Object.freeze(Object.fromEntries(CULTURES.map((c) => [c.id, c])));
export const CULTURE_IDS = Object.freeze(CULTURES.map((c) => c.id));

/** Number of first names / surnames per culture id. */
export const FIRST_COUNT = Object.freeze(Object.fromEntries(CULTURES.map((c) => [c.id, c.first.length])));
export const LAST_COUNT = Object.freeze(Object.fromEntries(CULTURES.map((c) => [c.id, c.last.length])));
export const firstCount = (cultureId) => FIRST_COUNT[cultureId] || 0;
export const lastCount = (cultureId) => LAST_COUNT[cultureId] || 0;

function cultureOrThrow(cultureId) {
  const c = CULTURE_BY_ID[cultureId];
  if (!c) throw new Error(`names: unknown culture "${cultureId}"`);
  return c;
}

/** Culture id of a nation code (falls back to "english" for an unknown code). */
export function cultureOfNation(code) {
  const n = NATION_BY_CODE[code];
  return n ? n.culture : 'english';
}

// ============================================================ text normalisation
const FOLD = { 'ß': 'ss', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i' };

/** Lowercase and strip accents. */
export function foldText(s) {
  return s.toLowerCase().replace(/[ßøæœłđðþı]/g, (c) => FOLD[c]).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Comparison key: folded, alphanumerics only, single spaces. */
export function normKey(s) {
  // "F.C. Barcelona" -> "fc barcelona": drop the dot after a single letter that is followed by another letter
  return foldText(s).replace(/(?<![a-z])([a-z])[.](?=[a-z](?![a-z]))/g, '$1').replace(/[^a-z0-9]+/g, ' ').trim();
}

// ============================================================ player names
// Real-player guard. The list lives in realNames.js as FNV-1a hashes of the normalised "first last"
// string (no plaintext real names in the source). A picked pair whose hash is in the set is re-rolled;
// after many re-rolls a deterministic scan finds the next unguarded pair, so a guarded name is never returned.
const GUARDED_HASHES = new Set(REAL_PLAYER_HASHES.replace(/\s+/g, '').match(/.{8}/g).map((h) => parseInt(h, 16)));

const blockedCache = new Map();

/** Set of (firstIdx * 65536 + lastIdx) pairs that must not be produced for a culture (computed once per culture). */
function blockedPairs(cultureId) {
  let set = blockedCache.get(cultureId);
  if (set) return set;
  const c = cultureOrThrow(cultureId);
  const lk = c.last.map(normKey);
  set = new Set();
  c.first.forEach((f, i) => {
    const h0 = hashKey(`${normKey(f)} `);
    for (let j = 0; j < lk.length; j++) if (GUARDED_HASHES.has(hashKey(lk[j], h0))) set.add(i * 65536 + j);
  });
  blockedCache.set(cultureId, set);
  return set;
}

/** True if the (first, last) index pair equals a guarded real-player name (such a pair is never produced). */
export function isGuardedPlayerName(cultureId, firstIdx, lastIdx) {
  const c = cultureOrThrow(cultureId);
  return blockedPairs(cultureId).has((firstIdx % c.first.length) * 65536 + (lastIdx % c.last.length));
}

/** Number of guarded pairs for a culture (diagnostics). */
export function guardedPairCount(cultureId) {
  return blockedPairs(cultureId).size;
}

/**
 * Pick a (firstIdx, lastIdx) pair. Both fit Uint16. Uniform over the culture lists, re-rolling every
 * combination that equals a well-known real player; never returns a guarded pair.
 * @returns {[number, number]}
 */
export function pickNameIndices(rng, cultureId) {
  const c = cultureOrThrow(cultureId);
  const blocked = blockedPairs(cultureId);
  const nf = c.first.length;
  const nl = c.last.length;
  let f = 0;
  let l = 0;
  for (let t = 0; t < 64; t++) {
    f = rng.int(0, nf - 1);
    l = rng.int(0, nl - 1);
    if (!blocked.has(f * 65536 + l)) return [f, l];
  }
  for (let df = 0; df < nf; df++) {
    for (let dl = 0; dl < nl; dl++) {
      const ff = (f + df) % nf;
      const ll = (l + dl) % nl;
      if (!blocked.has(ff * 65536 + ll)) return [ff, ll];
    }
  }
  throw new Error(`names: every name pair of culture ${cultureId} is guarded`);
}

/** First name for an index (index wraps, so an index from a larger future list never throws). */
export function firstNameAt(cultureId, firstIdx) {
  const c = cultureOrThrow(cultureId);
  return c.first[firstIdx % c.first.length];
}

/** Surname for an index. */
export function lastNameAt(cultureId, lastIdx) {
  const c = cultureOrThrow(cultureId);
  return c.last[lastIdx % c.last.length];
}

/** Full name "First Last" from stored indices. */
export function nameFromIndices(cultureId, firstIdx, lastIdx) {
  return `${firstNameAt(cultureId, firstIdx)} ${lastNameAt(cultureId, lastIdx)}`;
}

/** Short name "F. Last" from stored indices (for tight card layouts). */
export function shortNameFromIndices(cultureId, firstIdx, lastIdx) {
  const f = firstNameAt(cultureId, firstIdx);
  return `${Array.from(f)[0]}. ${lastNameAt(cultureId, lastIdx)}`;
}

/** Surname only, for cards. */
export function surnameFromIndices(cultureId, lastIdx) {
  return lastNameAt(cultureId, lastIdx);
}

/**
 * Generate a person name.
 * @returns {{first:string, last:string, firstIdx:number, lastIdx:number, full:string}}
 */
export function makeName(rng, cultureId) {
  const [firstIdx, lastIdx] = pickNameIndices(rng, cultureId);
  const first = firstNameAt(cultureId, firstIdx);
  const last = lastNameAt(cultureId, lastIdx);
  return { first, last, firstIdx, lastIdx, full: `${first} ${last}` };
}

/** Manager / staff name for a nation, as a plain string "First Last". */
export function makeManagerName(rng, nationCode) {
  return makeName(rng, cultureOfNation(nationCode)).full;
}

// ============================================================ real club blocklist
// Real club names the generator must never produce. Used only for refusal, compared after normalisation.
export const REAL_CLUB_BLOCKLIST = [
  // England and the British Isles
  'Arsenal', 'Chelsea', 'Liverpool', 'Everton', 'Tottenham Hotspur', 'Manchester United', 'Manchester City', 'Newcastle United', 'West Ham United', 'Aston Villa',
  'Leeds United', 'Leicester City', 'Wolverhampton Wanderers', 'Brighton and Hove Albion', 'Crystal Palace', 'Fulham', 'Brentford', 'Southampton', 'Nottingham Forest', 'Burnley',
  'Sheffield United', 'Sheffield Wednesday', 'Norwich City', 'Watford', 'Bournemouth', 'Ipswich Town', 'Derby County', 'Stoke City', 'West Bromwich Albion', 'Sunderland',
  'Middlesbrough', 'Blackburn Rovers', 'Bolton Wanderers', 'Celtic', 'Rangers', 'Heart of Midlothian', 'Hibernian', 'Aberdeen', 'Cardiff City', 'Swansea City',
  'Birmingham City', 'Coventry City', 'Portsmouth', 'Reading', 'Charlton Athletic', 'Queens Park Rangers', 'Huddersfield Town', 'Luton Town', 'Wigan Athletic', 'Hull City',
  // Spain
  'Real Madrid', 'FC Barcelona', 'Barcelona', 'Atletico Madrid', 'Sevilla', 'Real Betis', 'Valencia', 'Villarreal', 'Athletic Bilbao', 'Athletic Club',
  'Real Sociedad', 'Celta Vigo', 'Getafe', 'Espanyol', 'Osasuna', 'Mallorca', 'Girona', 'Rayo Vallecano', 'Alaves', 'Granada',
  'Levante', 'Cadiz', 'Elche', 'Almeria', 'Real Valladolid', 'Deportivo La Coruna', 'Malaga', 'Sporting Gijon', 'Real Zaragoza', 'Las Palmas',
  'Tenerife', 'Racing Santander', 'Real Oviedo', 'Eibar', 'Leganes', 'Real Murcia', 'Albacete', 'Numancia',
  // Italy
  'Juventus', 'Inter', 'Internazionale', 'AC Milan', 'Milan', 'Napoli', 'Roma', 'AS Roma', 'Lazio', 'Atalanta',
  'Fiorentina', 'Torino', 'Bologna', 'Genoa', 'Sampdoria', 'Udinese', 'Sassuolo', 'Hellas Verona', 'Verona', 'Cagliari',
  'Lecce', 'Empoli', 'Parma', 'Monza', 'Spezia', 'Salernitana', 'Cremonese', 'Brescia', 'Palermo', 'Bari',
  'Venezia', 'Frosinone', 'Como', 'Pisa', 'Cesena', 'Chievo', 'Catania', 'Reggina',
  // Germany
  'Bayern Munich', 'FC Bayern Munchen', 'Bayern Munchen', 'Borussia Dortmund', 'Bayer Leverkusen', 'RB Leipzig', 'Eintracht Frankfurt', 'VfL Wolfsburg', 'Borussia Monchengladbach', 'VfB Stuttgart',
  'Werder Bremen', 'SC Freiburg', 'FC Koln', 'Hertha BSC', 'Union Berlin', 'Mainz 05', 'FC Augsburg', 'TSG Hoffenheim', 'Schalke 04', 'Hamburger SV',
  'Hannover 96', 'Fortuna Dusseldorf', 'FC St Pauli', 'Holstein Kiel', 'Hansa Rostock', 'Dynamo Dresden', '1 FC Nurnberg', 'Karlsruher SC', 'Darmstadt 98', 'Arminia Bielefeld',
  'VfL Bochum', 'Greuther Furth', 'Heidenheim', 'Paderborn', 'TSV 1860 Munchen', 'Kaiserslautern', 'Eintracht Braunschweig',
  // France
  'Paris Saint-Germain', 'Paris Saint Germain', 'PSG', 'Paris FC', 'Olympique de Marseille', 'Olympique Marseille', 'Marseille', 'Olympique Lyonnais', 'Olympique Lyon', 'Lyon',
  'AS Monaco', 'Monaco', 'LOSC Lille', 'Lille', 'OGC Nice', 'Nice', 'Stade Rennais', 'Rennes', 'RC Lens', 'Lens',
  'Stade de Reims', 'Reims', 'FC Nantes', 'Nantes', 'Montpellier', 'RC Strasbourg', 'Strasbourg', 'Toulouse FC', 'Toulouse', 'FC Metz',
  'Girondins de Bordeaux', 'Bordeaux', 'AS Saint-Etienne', 'Saint-Etienne', 'Angers SCO', 'Angers', 'Stade Brestois', 'Brest', 'Clermont Foot', 'Lorient',
  'Auxerre', 'Troyes', 'Ajaccio', 'SC Bastia', 'Bastia', 'Le Havre', 'Caen', 'Guingamp', 'Dijon', 'Nancy', 'Sochaux',
  // rest of Europe
  'Ajax', 'PSV Eindhoven', 'Feyenoord', 'AZ Alkmaar', 'FC Twente', 'FC Utrecht', 'Benfica', 'FC Porto', 'Porto', 'Sporting CP',
  'Sporting Lisbon', 'Sporting Clube de Portugal', 'Braga', 'Anderlecht', 'Club Brugge', 'Standard Liege', 'KRC Genk', 'Galatasaray', 'Fenerbahce', 'Besiktas',
  'Trabzonspor', 'Olympiacos', 'Panathinaikos', 'AEK Athens', 'PAOK', 'Red Star Belgrade', 'Partizan', 'Dinamo Zagreb', 'Hajduk Split', 'Shakhtar Donetsk',
  'Dynamo Kyiv', 'Zenit', 'Spartak Moscow', 'CSKA Moscow', 'Lokomotiv Moscow', 'Rapid Wien', 'Red Bull Salzburg', 'Young Boys', 'FC Basel', 'FC Zurich',
  'FC Copenhagen', 'Brondby', 'Malmo FF', 'Rosenborg', 'Legia Warsaw', 'Slavia Prague', 'Sparta Prague', 'Ferencvaros', 'Steaua Bucharest', 'FCSB',
  // Americas, Africa, Asia
  'Boca Juniors', 'River Plate', 'Flamengo', 'Palmeiras', 'Corinthians', 'Santos', 'Sao Paulo', 'Gremio', 'Internacional', 'Fluminense',
  'Vasco da Gama', 'Botafogo', 'Cruzeiro', 'Atletico Mineiro', 'Penarol', 'Nacional', 'Club America', 'Chivas', 'Cruz Azul', 'Pumas',
  'LA Galaxy', 'Inter Miami', 'Al Ahly', 'Zamalek', 'Al Hilal', 'Al Nassr', 'Al Ittihad', 'Esperance', 'Wydad Casablanca', 'Raja Casablanca',
  'Kaizer Chiefs', 'Orlando Pirates', 'Mamelodi Sundowns', 'Urawa Red Diamonds', 'Kashima Antlers', 'Gamba Osaka', 'Jeonbuk Hyundai Motors', 'Guangzhou Evergrande',
];

const GENERIC_CLUB_TOKENS = new Set([
  'fc', 'afc', 'cf', 'ac', 'as', 'sc', 'cd', 'ud', 'sv', 'fk', 'sk', 'ssc', 'ss', 'us', 'vfl', 'vfb', 'tsv', 'fsv', 'rc', 'og', 'ogc', 'cs',
  'club', 'the', 'of', 'and', 'de', 'du', 'des', 'la', 'le', 'les', 'di', 'del', 'della', 'da', 'el', 'al', 'sg', 'ad', 'sd', 'rcd',
  'city', 'town', 'united', 'athletic', 'athletico', 'atletico', 'rovers', 'wanderers', 'rangers', 'albion', 'county', 'borough', 'real',
  'sporting', 'sport', 'sports', 'racing', 'deportivo', 'dynamo', 'dinamo', 'lokomotiv', 'lokomotiva', 'spartak', 'torpedo', 'olympique',
  'olympic', 'stade', 'union', 'unione', 'virtus', 'calcio', 'polisportiva', 'pro', 'audace', 'libertas', 'fortitudo', 'sportiva',
  'sportive', 'sportif', 'etoile', 'jeunesse', 'avenir', 'entente', 'eintracht', 'fortuna', 'viktoria', 'concordia', 'germania', 'rot',
  'weiss', 'blau', 'schwarz', 'kf', 'nk', 'hnk', 'ks', 'mks', 'lks', 'gks', 'se', 'te', 'vse', 'tj', 'mfk', 'acs', 'csm', 'ik', 'if', 'bk',
  'ff', 'ifk', 'boldklub', 'boys', 'harriers', 'victoria', 'orient', 'alexandra', 'argyle', 'swifts', 'villa', 'thistle', 'harps', 'stars',
  'chiefs', 'eagles', 'lions', 'warriors', 'storm', 'thunder', 'phoenix', 'dragons', 'rising', 'stella', 'citizen', 'belediye',
  'genclik', 'gucu', 'idman', 'yurdu', 'nadi', 'shabab', 'academie', 'academia', 'clube', 'futebol', 'esporte', 'associacao', 'desportiva',
  'desportivo', 'uniao', 'academico', 'independiente', 'juventud', 'municipal', 'estudiantes', 'defensores', 'unirea', 'viitorul', 'dacia',
  'sokol', 'slovan', 'banik', 'zryw', 'rus', 'avangard', 'energia', 'zorya', 'metallurg', 'rudar', 'sloga', 'mladost', 'borac', 'zrinski',
  'besa', 'rudari', 'apollon', 'ethnikos', 'asteras', 'ao', 'gs', 'hotspur', 'excelsior', 'olympia', 'sparta', 'egyesulet', 'ssd', 'asd',
  'spvgg', 'ksv',
]);
const PLACE_PREFIX = new Set(['saint', 'sainte', 'st', 'san', 'santa', 'sao', 'north', 'south', 'east', 'west', 'new', 'old', 'bad', 'neu', 'alt', 'agios', 'agia']);

/** Core of a club or place name for real-world comparison: generic words, pure numbers and a trailing "spor" dropped. */
function clubCore(name) {
  return normKey(name).split(' ')
    .map((t) => (t.length > 4 && t.endsWith('spor') ? t.slice(0, -4) : t))
    .filter((t) => t && !GENERIC_CLUB_TOKENS.has(t) && !/^\d+$/.test(t)).join(' ');
}

const BLOCK_FULL = new Set(REAL_CLUB_BLOCKLIST.map(normKey));
const REAL_CORES = new Set();
function addCoreVariants(core) {
  REAL_CORES.add(core);
  REAL_CORES.add(core.replace(/ /g, ''));
  const toks = core.split(' ');
  if (toks.length > 1 && PLACE_PREFIX.has(toks[0])) addCoreVariants(toks.slice(1).join(' '));
}
for (const entry of [...REAL_CLUB_BLOCKLIST, ...REAL_CLUB_GAZETTEER]) {
  const core = clubCore(entry);
  if (core) addCoreVariants(core);
}

/** True if a place name (or a whole club name) has the same core as a real club or well-known real town. */
export function isRealPlaceName(place) {
  let core = clubCore(place);
  while (core) {
    if (REAL_CORES.has(core) || REAL_CORES.has(core.replace(/ /g, ''))) return true;
    const toks = core.split(' ');
    if (toks.length > 1 && PLACE_PREFIX.has(toks[0])) core = toks.slice(1).join(' ');
    else break;
  }
  return false;
}

/** True if the name equals (after normalisation) a real club, or its core equals a real club / well-known town core. */
export function isRealClubName(name) {
  return BLOCK_FULL.has(normKey(name)) || isRealPlaceName(name);
}

/** Draw a place with `make` until it is not a real club / town core (generous cap, the club-level check still follows). */
function realFreePlace(make) {
  let p = make();
  for (let t = 0; t < 400 && isRealPlaceName(p); t++) p = make();
  return p;
}

// ============================================================ club name machinery
const pickForm = (rng, forms) => rng.weighted(forms.map((f) => f[1]), forms.map((f) => f[0]));

function frDe(place) {
  return /^[AEIOUHÉÈÊÂÎÔaeiouhéèêâîô]/.test(place) ? `d'${place}` : `de ${place}`;
}

function fillTemplate(rng, tpl, place) {
  let out = tpl;
  if (out.includes('{Pde}')) out = out.replace('{Pde}', frDe(place));
  out = out.replace('{P}', place);
  if (out.includes('{Y}')) out = out.replace('{Y}', String(rng.int(1895, 1925)));
  if (out.includes('{y}')) out = out.replace('{y}', String(rng.int(1899, 1925) % 100).padStart(2, '0'));
  return out;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Run a generator until it yields a name that is neither a real club nor already used.
 * Adds the winner to usedSet. After many collisions it disambiguates with a numeral.
 */
function uniqueClubName(gen, usedSet) {
  for (let t = 0; t < 80; t++) {
    const name = gen();
    if (isRealClubName(name)) continue;
    if (usedSet && usedSet.has(name)) continue;
    if (usedSet) usedSet.add(name);
    return name;
  }
  let base = gen();
  while (isRealClubName(base)) base = gen();
  for (let n = 2; ; n++) {
    const name = `${base} ${n < ROMAN.length ? ROMAN[n] : n}`;
    if (!usedSet || !usedSet.has(name)) {
      if (usedSet) usedSet.add(name);
      return name;
    }
  }
}

// ---------------------------------------------------------------- playable country club data
/** Fictional place parts for the 5 playable countries (>= 60 each). */
export const CLUB_PLACES = {
  ENG: [
    'Northgate', 'Harbourfield', 'Ashby Vale', 'Wexcombe', 'Brackenwick', 'Elmsford', 'Holmcastle', 'Thornley', 'Marlbridge', 'Kingsmere',
    'Oakhampton', 'Redcliffe Moor', 'Stonebridge', 'Wickersley', 'Copperfield', 'Fernhurst', 'Gladewick', 'Hartsmere', 'Ironsby', 'Jarrowfield',
    'Kettleby', 'Lindenhurst', 'Mereford', 'Netherby Green', 'Oldmoor', 'Pennywell', 'Quarryhill', 'Ravensmoor', 'Saltmarsh Quay', 'Tanfield Lock',
    'Underhill', 'Valeford', 'Whitlock', 'Yarrowby', 'Alderbrook', 'Beckwith', 'Cranmoor', 'Dunmere', 'Eastfold', 'Fallowmere',
    'Goldhaven', 'Heathcote Bridge', 'Inglemoor', 'Kirkwood', 'Larkmoor', 'Moorhaven', 'Nettlebridge', 'Oxenby', 'Quillham', 'Rushby',
    'Sedgewick', 'Tilbrook', 'Upperthorpe', 'Wolvesley', 'Ambleford', 'Bramblewick', 'Calderbank', 'Deepmere', 'Edgemoor', 'Foxhollow',
    'Greywater', 'Hollinfield', 'Kingsholt', 'Lowerby', 'Millbrook Cross', 'Normanby Heath', 'Penhallow', 'Rooksbury', 'Stanmoor', 'Tarnbrook',
  ],
  ESP: [
    'Costa Dorada', 'Sierra Verde', 'Valdecastro', 'Monteclaro', 'Puerto Alegre', 'Villaluna', 'Riobravo', 'Santa Marenda', 'San Telmo del Mar', 'Alcazaba Nueva',
    'Torremayor', 'Valdeflores', 'Pueblonuevo', 'Campomarra', 'Fuenteclara', 'Cerro Alvero', 'Peñascal', 'Llanosol', 'Altamar', 'Arroyoseco',
    'Benaventura', 'Castelmar', 'Dehesa Real', 'Encinares', 'Fontanar', 'Garrovilla', 'Hondonera', 'Iruelas', 'Jaralejo', 'Lomaverde',
    'Marejada', 'Navalcarro', 'Olivares del Sur', 'Pinarejo', 'Quintanilla Mar', 'Retamar', 'Sotomarra', 'Tierrablanca', 'Umbralejo', 'Valmadrid Norte',
    'Villasol', 'Zarzalejo', 'Almendral', 'Barrancos', 'Cabo Sereno', 'Dos Aguas', 'Espinardo Alto', 'Fresnedo', 'Guadiaro Viejo', 'Huertalba',
    'Jarandilla', 'La Marisma', 'Moncloa Nueva', 'Naranjal', 'Ojedal', 'Puerto Sol', 'Rinconada Verde', 'Sierra Nevada Baja', 'Torrelavega Mar', 'Valdelagua',
    'Villaplana', 'Yeguada', 'Castillo Blanco', 'Playa Serena', 'Los Cedros', 'Cumbre Azul', 'Montijano', 'Rioseco de Abajo',
  ],
  ITA: [
    'Valdorno', 'Montecalvo', 'Castelrosso', 'Portoverde', 'Roccabruna', 'Borgo Alto', 'San Fiorenzo', 'Lagonero', 'Villabianca', 'Monteluce',
    'Marinella Bassa', 'Pontelungo', 'Rivalta Vecchia', 'Sassoforte', 'Torreverde', 'Valmarina', 'Colledoro', 'Fontanaviva', 'Gualdoro', 'Isolabella Nova',
    'Lucerna Alta', 'Montegrigio', 'Nuovaterra', 'Orsolana', 'Pianoro Basso', 'Quarto Mare', 'Rocchetta Sole', 'Salinara', 'Tramonte', 'Umbriano',
    'Vallesole', 'Zafferano Alto', 'Altopiano', 'Bellavista Sud', 'Cascinetta', 'Dolcemare', 'Erbaluna', 'Ferraiolo', 'Gioiamare', 'Lunamonte',
    'Mirabello Basso', 'Neroviva', 'Ombrone Alto', 'Pergolo', 'Ravenzano', 'Santa Valdina', 'Torrebruna', 'Valbruna', 'Villanuova Mare', 'Argentara',
    'Boscoverde', 'Calamaro', 'Dorsale', 'Fiorenzuola Alta', 'Gabbiano', 'Lidomare', 'Montesereno', 'Ponteverde', 'Rosalba', 'Sangiovese Alto',
    'Terrarossa', 'Venezzano', 'Collina Bianca', 'Porto Salvo',
  ],
  GER: [
    'Rotenau', 'Elbtal', 'Tannenau', 'Hohenfels', 'Eichenberg', 'Lindenau', 'Sonnenthal', 'Buchenfeld', 'Kirchwald', 'Falkenau',
    'Rheinbrück', 'Bergheim Nord', 'Steinhagen', 'Waldhagen', 'Seebruck', 'Neuwiese', 'Altenstedt', 'Birkenfeld', 'Dornburg', 'Eisenau',
    'Fichtenberg', 'Grünwiese', 'Habichtswald', 'Immenstadt Süd', 'Jagdhausen', 'Kupferberg', 'Lerchenau', 'Moorbach', 'Nordhagen', 'Oderbruch',
    'Pappelau', 'Quellental', 'Rabenstein', 'Schwarzenau', 'Tiefenbach', 'Uferhausen', 'Veilsdorf', 'Weidenau', 'Zeilsheim Ost', 'Auenwald',
    'Bärental', 'Dachsberg', 'Erlenhain', 'Feldkirchen Süd', 'Gerstenau', 'Hainsfeld', 'Ilmtal', 'Jungholz', 'Krähenwinkel', 'Laubenhagen',
    'Mühlenau', 'Nussdorf', 'Ottenbach', 'Pfeilstadt', 'Rübenau', 'Salzhausen', 'Trebelau', 'Unterlinden', 'Vogelsang Nord', 'Wiesenburg',
    'Ziegelhagen', 'Brunnenfeld', 'Hirschau', 'Kornberg', 'Marktfeld', 'Rosenhain',
  ],
  FRA: [
    'Valmorin', 'Rochemare', 'Aubemont', 'Saint-Orlan', 'Beaurivage', 'Clairval', 'Fontbelle', 'Pontarlay', 'Rivemont', 'Montclairin',
    'Beauchamp-sur-Mer', 'Lacroisette', 'Saint-Aubray', 'Bellecombe', 'Roquefeuil', 'Vauxdemer', 'Chênaie', 'Pierrefonte', 'Sainte-Maurelle', 'Courmarais',
    'Haute-Rive', 'Valdoran', 'Brumelle', 'Castelvieil', 'Dunoise', 'Étangvert', 'Fleurance-le-Haut', 'Garrigue', 'Hautebrune', 'Isleroche',
    'Jarnac-les-Prés', 'Lavandières', 'Mérelles', 'Noirmontier', 'Orvaux', 'Plaine-Verte', 'Quincampoix-Bas', 'Rochebelle', 'Saint-Gervaise', 'Terrefort',
    'Ulvaux', 'Vendeuvre-les-Eaux', 'Aiguebelle', 'Beaumarais', 'Cormeilles-la-Mer', 'Domrémy-le-Pont', 'Escarvelle', 'Fontaneil', 'Grandval', 'Hérisson-sur-Ourse',
    'Ivoy-le-Val', 'Lamothe-Rouge', 'Montferrat-le-Bas', 'Nogentel', 'Ouessant-Haut', 'Pontcharra-sur-Lac', 'Rieumes-le-Fort', 'Sorèze-la-Neuve', 'Tournebride', 'Veyrac',
    'Belle-Île-Sud', 'Cabrières', 'Dampierre-les-Bois', 'Évrard-sur-Mer', 'Gorges-du-Val', 'Orsaint-les-Pins',
  ],
};

/** Name patterns for the 5 playable countries: [weight, template]. Tokens: {P} place, {Pde} "de/d'" + place, {Y} year, {y} 2-digit year. */
export const CLUB_FORMS = {
  ENG: [
    [14, '{P} Rovers'], [14, '{P} United'], [13, '{P} Athletic'], [12, '{P} Town'], [9, '{P} City'], [8, '{P} Albion'], [8, '{P} Wanderers'],
    [6, '{P} Borough'], [5, '{P} County'], [5, 'AFC {P}'], [5, '{P} Rangers'], [4, '{P} Harriers'], [4, '{P} Victoria'], [3, '{P} Orient'],
    [3, '{P} Alexandra'], [3, '{P} Argyle'], [3, '{P} Swifts'], [3, '{P} Villa'],
  ],
  ESP: [
    [12, 'Real {P}'], [10, 'CD {P}'], [10, 'UD {P}'], [9, 'CF {P}'], [8, 'Atlético {P}'], [8, 'Deportivo {P}'], [6, 'Racing {P}'],
    [6, 'SD {P}'], [6, '{P} CF'], [5, 'Sporting {P}'], [5, 'RCD {P}'], [5, 'AD {P}'], [4, 'Real Club Deportivo {P}'], [4, 'Club Deportivo {P}'],
    [3, 'Unión Deportiva {P}'],
  ],
  ITA: [
    [12, 'Virtus {P}'], [12, 'Calcio {P}'], [10, 'US {P}'], [10, 'AS {P}'], [9, '{P} Calcio'], [8, 'SSD {P}'], [6, 'Unione Sportiva {P}'],
    [6, 'Polisportiva {P}'], [5, 'Atletico {P}'], [5, 'Pro {P}'], [5, 'Audace {P}'], [5, 'Libertas {P}'], [5, 'Fortitudo {P}'], [4, 'ASD {P}'],
    [4, '{P} {Y}'],
  ],
  GER: [
    [14, 'SV {P} {Y}'], [12, 'FC {P}'], [10, 'TSV {P} {Y}'], [8, 'SpVgg {P}'], [8, 'VfB {P}'], [8, 'VfL {P} {Y}'], [7, 'FSV {P}'],
    [7, 'SC {P}'], [7, 'Eintracht {P}'], [6, 'Rot-Weiss {P}'], [6, 'Union {P}'], [8, 'FC {P} {y}'], [6, 'SG {P}'], [5, 'Fortuna {P}'],
    [5, 'Viktoria {P}'], [5, 'Concordia {P}'], [5, 'Blau-Weiss {P}'], [4, 'Germania {P}'], [4, 'Schwarz-Weiss {P}'], [3, '{P} {Y}'],
  ],
  FRA: [
    [12, 'AS {P}'], [12, 'FC {P}'], [10, 'US {P}'], [10, 'SC {P}'], [10, 'Olympique {Pde}'], [8, 'Stade {Pde}'], [7, 'Racing Club {Pde}'],
    [7, 'AJ {P}'], [7, 'ES {P}'], [6, '{P} FC'], [6, 'Union Sportive {Pde}'], [5, 'Sporting Club {Pde}'], [5, 'Étoile Sportive {Pde}'],
    [4, 'Athletic Club {Pde}'], [4, 'Avenir {Pde}'], [4, 'Jeunesse Sportive {Pde}'], [4, 'Entente {P}'],
  ],
};

/**
 * Fictional, local-sounding club name for one of the 5 playable countries.
 * usedSet: Set of names already taken in that country; the new name is added to it.
 * Any other country code falls back to makeBackgroundClubName.
 */
export function makeClubName(rng, countryCode, usedSet) {
  const places = CLUB_PLACES[countryCode];
  if (!places) return makeBackgroundClubName(rng, countryCode, usedSet);
  const forms = CLUB_FORMS[countryCode];
  return uniqueClubName(() => fillTemplate(rng, pickForm(rng, forms), realFreePlace(() => rng.pick(places))), usedSet);
}

// ---------------------------------------------------------------- background club styles
// place = optional prefix word + a + b. forms use the same tokens as above.
const S = (str) => str.split(/\s*,\s*/).filter(Boolean);

/**
 * Background club name styles, one per Nation.clubNameStyle value.
 * @type {Object<string, {a:string[], b:string[], pre?:{p:number, words:string[], sep:string}, forms:Array<[number,string]>}>}
 */
export const BG_CLUB_STYLES = {
  english: {
    a: S('Brook, Cliff, Elm, Fen, Grey, Hal, Holm, King, Lang, Mill, Pen, Red, Stan, Thorn, Wick, Bram, Cold, Dun, Marl, Sand, Stow, Heath, Brox, Calder, Dross, Evel, Kellam, Ulver, Yarr, Tarn'),
    b: S('ford, ham, ton, bury, field, wick, by, thorpe, worth, minster, mouth, bridge, ley, stead, combe, hurst, dale, mere, well, shaw'),
    pre: { p: 0.12, words: ['North', 'South', 'East', 'West', 'New', 'Old'], sep: ' ' },
    forms: CLUB_FORMS.ENG,
  },
  celtic: {
    a: S('Ard, Bally, Glen, Kil, Inver, Dun, Aber, Strath, Loch, Craig, Bun, Cairn, Dal, Tre, Pen, Llan, Car, Ros, Kin, Drum'),
    b: S('more, nock, kerry, bridge, rath, ross, gowan, vale, mawr, dale, glass, nagh, bane, beg, cross, rick'),
    forms: [[14, '{P} Athletic'], [14, '{P} United'], [12, '{P} Rovers'], [8, '{P} Thistle'], [10, '{P} FC'], [10, '{P} Town'], [8, '{P} Wanderers'], [5, '{P} Harps']],
  },
  iberian: {
    a: S('Villa, Monte, Castel, Puerto, Valle, Rio, Sierra, Peña, Cerro, Fuente, Torre, Campo, Alto, Bella, Sol, Mar, Pino, Roble, Val, Lomo'),
    b: S('nueva, verde, claro, alto, seco, mayor, bella, luna, blanca, negra, dorada, alegre, real, hondo, mar, rojo'),
    pre: { p: 0.12, words: ['San', 'Santa'], sep: ' ' },
    forms: CLUB_FORMS.ESP,
  },
  latin: {
    a: S('Villa, Monte, Castel, Puerto, Valle, Rio, Sierra, Peña, Cerro, Fuente, Torre, Campo, Alto, Bella, Sol, Mar, Pino, Roble, Val, Lago'),
    b: S('nueva, verde, claro, alto, seco, mayor, bella, luna, blanca, negra, dorada, alegre, real, hondo, mar, rojo'),
    pre: { p: 0.12, words: ['San', 'Santa'], sep: ' ' },
    forms: [
      [12, 'Club Deportivo {P}'], [12, 'Deportivo {P}'], [10, 'Atlético {P}'], [10, 'Club Atlético {P}'], [10, '{P} FC'], [8, 'Sporting {P}'],
      [6, 'Real {P}'], [6, 'Independiente {P}'], [6, 'Juventud {P}'], [6, 'Unión {P}'], [5, 'Municipal {P}'], [5, 'Estudiantes de {P}'], [4, 'Defensores de {P}'],
    ],
  },
  portuguese: {
    a: S('Vila, Monte, Porto, Praia, Serra, Rio, Campo, Terra, Alto, Lago, Ponte, Mar, Pedra, Val, Cabo'),
    b: S('nova, verde, alegre, branca, dourada, formosa, grande, mar, claro, velha, bela, fria, funda, real, doce'),
    pre: { p: 0.12, words: ['São', 'Santa'], sep: ' ' },
    forms: [
      [12, 'Sport Clube {P}'], [12, 'Clube Atlético {P}'], [10, '{P} Esporte Clube'], [10, 'Associação Desportiva {P}'], [10, 'Futebol Clube de {P}'],
      [8, 'União {P}'], [8, 'Sporting {P}'], [8, '{P} FC'], [6, 'Académico {P}'], [6, 'Desportivo {P}'], [6, 'Atlético {P}'],
    ],
  },
  italian: {
    a: S('Monte, Castel, Porto, Villa, Borgo, Rocca, Torre, Ponte, Valle, Campo, Lago, Mare, Fonte, Colle, Pian, Sasso, Cala, Val'),
    b: S('bianco, verde, rosso, alto, bello, mare, nero, vecchio, nuovo, forte, chiaro, lungo, grande, dorno, leone, marina'),
    pre: { p: 0.12, words: ['San', 'Santa'], sep: ' ' },
    forms: CLUB_FORMS.ITA,
  },
  german: {
    a: S('Ro, Elb, Tann, Linden, Eichen, Buchen, Sonnen, Falken, Hohen, Rhein, Wald, Berg, Nieder, Ober, Klein, Gross, Stein, Birken, Rosen, Fichten'),
    b: S('au, tal, berg, feld, burg, heim, dorf, stadt, hausen, bach, brück, see, wald, hagen, stedt, lohe'),
    pre: { p: 0.1, words: ['Bad', 'Neu', 'Alt'], sep: ' ' },
    forms: CLUB_FORMS.GER,
  },
  french: {
    a: S('Val, Mont, Beau, Clair, Fon, Pont, Rive, Roche, Bel, Chêne, Lac, Plan, Cour, Pré, Vieux, Haut, Bois, Terre, Source, Mare'),
    b: S('mont, val, fort, mare, ville, court, bourg, ac, lay, ère, ois, ance, sur, brune, claire, gny'),
    pre: { p: 0.12, words: ['Saint', 'Sainte'], sep: '-' },
    forms: CLUB_FORMS.FRA,
  },
  dutch: {
    a: S('Oost, West, Noord, Zuid, Berg, Wijk, Dijk, Hoog, Laag, Nieuw, Oud, Kerk, Molen, Zee, Veen, Heide, Bos, Stad, Water, Maas'),
    b: S('dam, dorp, wijk, kerk, burg, haven, hoek, veld, stede, zand, sluis, loo, beek, brug, hout, rade'),
    forms: [[14, 'FC {P}'], [12, 'SV {P}'], [12, 'VV {P}'], [8, '{P} Boys'], [6, 'Sparta {P}'], [6, 'Olympia {P}'], [6, 'Excelsior {P}'], [8, '{P} United'], [6, 'SC {P}']],
  },
  nordic: {
    a: S('Sol, Vik, Bjørn, Stor, Nord, Øst, Vest, Sønder, Ny, Gamle, Lille, Fjord, Skog, Berg, Hav, Lund, Ål, Ring, Svart, Kvist'),
    b: S('vik, berg, by, strand, holm, lund, näs, sund, dal, vang, havn, heim, sjö, stad, fors, torp'),
    forms: [[12, '{P} IF'], [12, '{P} BK'], [10, '{P} FK'], [10, 'IFK {P}'], [10, 'FC {P}'], [8, '{P} FF'], [8, '{P} Boldklub'], [8, 'IK {P}'], [6, '{P} SK']],
  },
  westslavic: {
    a: S('Now, Star, Biel, Czarn, Wielk, Mał, Zielon, Dobr, Krasn, Brzez, Sokol, Gór, Doln, Podg, Zawi, Wol, Rad, Lesz, Kamien, Jaros'),
    b: S('owo, ice, ów, sko, any, ec, in, ewo, owice, yn, ica, ów'),
    forms: [[12, '{P} FC'], [10, 'KS {P}'], [10, 'MKS {P}'], [10, 'LKS {P}'], [10, 'GKS {P}'], [8, 'Sokół {P}'], [6, 'Unia {P}'], [8, 'Dynamo {P}'], [6, 'Lokomotiv {P}'], [8, 'Zryw {P}']],
  },
  czechoslovak: {
    a: S('Horní, Dolní, Nová, Stará, Velká, Malá, Zlatá, Bílá, Černá, Lipová, Dubová, Horská, Žlutá, Zelená'),
    b: S('Lhota, Ves, Hora, Vrba, Louka, Skála, Lipa, Doubrava, Březina, Jasenice, Podolí, Studánka, Dědina, Rudná'),
    join: ' ',
    forms: [[14, 'FK {P}'], [12, 'SK {P}'], [12, 'TJ {P}'], [10, 'Sokol {P}'], [8, 'ŠK {P}'], [8, 'MFK {P}'], [8, '{P} FC'], [6, 'Slovan {P}'], [6, 'Baník {P}'], [6, 'Dynamo {P}']],
  },
  eastslavic: {
    a: S('Nov, Stary, Belo, Cherno, Krasno, Zele, Bolsho, Malo, Vishne, Gorno, Nizhne, Verkhne, Zolo, Lipo, Berez, Dubo, Soln, Kamen, Rechno, Lesno'),
    b: S('grad, sk, ovka, ino, evo, gorod, polye, nka, ets, ovo, yar, ka, burg, pil, ya, ino'),
    forms: [[14, 'FC {P}'], [10, 'Dynamo {P}'], [10, 'Lokomotiv {P}'], [8, 'Spartak {P}'], [8, 'Torpedo {P}'], [8, 'Metallurg {P}'], [8, 'Zorya {P}'], [6, 'Avangard {P}'], [6, 'Energia {P}'], [6, '{P} Rus']],
  },
  southslavic: {
    a: S('Novi, Stari, Bijelo, Crno, Zlato, Visoko, Dobro, Mali, Veliki, Plavo, Zeleno, Kamen, Gorno, Podgor, Sredo, Donje, Gornje, Lipo, Brdo, Krasno'),
    b: S('grad, polje, vac, ica, ovo, ac, ište, brod, gora, selo, dol, mir, vica, nik, ina, ska'),
    forms: [[14, 'NK {P}'], [14, 'FK {P}'], [10, 'HNK {P}'], [8, '{P} United'], [8, 'ŠK {P}'], [6, 'Rudar {P}'], [6, 'Sloga {P}'], [6, 'Mladost {P}'], [6, 'Borac {P}'], [6, 'Zrinski {P}']],
  },
  balkan: {
    a: S('Vlo, Shko, Kru, Pe, Gji, Dur, Kor, Lez, Ber, Pog, Peshk, Bur, Kuk, Lush, Fier, Tir, Kam, Rre, Sar, Gram'),
    b: S('ra, dër, jë, nik, ës, ova, ani, ikë, ica, aj, ezë, ik, ushë, ar, ina, ëk'),
    forms: [[14, 'KF {P}'], [14, 'FK {P}'], [10, '{P} FC'], [8, 'SK {P}'], [8, 'Besa {P}'], [8, 'Dinamo {P}'], [6, 'Lokomotiva {P}'], [6, 'Rudari {P}']],
  },
  magyar: {
    a: S('Új, Kis, Nagy, Szür, Fekete, Zöld, Hegy, Völgy, Duna, Tisza, Szent, Kő, Sas, Arany, Zsolt, Erdő, Bor, Gyöngy, Mező, Hárs'),
    b: S('háza, falva, város, kert, szeg, hely, fa, mező, pataka, halom, tó, szék, vár, liget, sziget, tanya'),
    forms: [[14, '{P} SE'], [14, '{P} FC'], [10, '{P} SC'], [10, '{P} TE'], [10, '{P} VSE'], [6, '{P} Sporting'], [8, 'FK {P}'], [6, '{P} Egyesület']],
  },
  romanian: {
    a: S('Nou, Vechi, Alb, Negru, Verde, Deal, Vale, Luncă, Câmp, Podu, Piatra, Rău, Cetate, Măgura, Fântâna, Brad, Plopi, Salcia, Livada, Muscel'),
    b: S('ești, eni, ova, ița, oara, ana, ic, iu, easa, ăria, uleț, ar'),
    forms: [[14, 'FC {P}'], [12, 'CS {P}'], [10, 'ACS {P}'], [10, 'AS {P}'], [10, 'CSM {P}'], [6, 'Unirea {P}'], [6, 'Viitorul {P}'], [6, 'Voința {P}'], [6, 'Dacia {P}']],
  },
  turkish: {
    a: S('Tur, Bal, Yeni, Eski, Kızıl, Sarı, Göl, Dağ, Deniz, Taş, Demir, Yeşil, Bağ, Çam, Su, Kale, Ova, Bozkır, Gök, Alt'),
    b: S('köy, hisar, pınar, tepe, ova, kent, bük, dere, şehir, çay, abat, kaya, yurt, belen, lar, ören'),
    forms: [[24, '{P}spor'], [12, '{P} Belediyespor'], [10, '{P} SK'], [10, '{P} FK'], [8, '{P} Gençlik'], [8, '{P} Gücü'], [8, '{P} İdman Yurdu'], [6, 'Yeni {P}spor']],
  },
  greek: {
    a: S('Kalo, Neo, Palaio, Mega, Mikro, Pyrgo, Lefko, Mavro, Pefko, Elato, Kastro, Limano, Xylo, Thalas, Petro, Aspro, Kokki, Platani, Amygda, Agri'),
    b: S('chori, polis, nisi, ia, ada, eri, ikos, akia, ouri, itsa, ero, avlo, ona, ori, kastro, thea'),
    pre: { p: 0.1, words: ['Agios', 'Agia'], sep: ' ' },
    forms: [[16, 'AO {P}'], [12, 'GS {P}'], [12, '{P} FC'], [8, 'Apollon {P}'], [8, 'Ethnikos {P}'], [8, 'Asteras {P}'], [6, 'Olympic {P}']],
  },
  arabic: {
    a: S('Qas, Jab, Ras, Wad, Mad, Bah, Ham, Zah, Nah, Sah, Dar, Bur, Kho, Ain, Sid, Rem, Taf, Sal, Maz, Har'),
    b: S('ra, ala, iyya, ar, ina, aya, ur, ib, un, awi, ani, ayn, ia, ouna, ima, ran'),
    forms: [[20, 'Al-{P}'], [12, 'Al-{P} SC'], [12, '{P} Club'], [10, '{P} FC'], [8, 'Nadi {P}'], [8, 'Shabab {P}'], [8, 'Al-{P} Sports Club'], [6, 'Union {P}']],
  },
  'anglo-african': {
    a: S('Ash, Bright, Cape, Coast, Glad, Gold, Grace, Hope, Kings, Lake, Maple, New, Palm, Port, Sun, Royal, Savanna, Valley, Union, Peace'),
    b: S('town, field, ville, ton, wood, land, port, hill, view, gate, bridge, side, point, haven, stone, rock'),
    forms: [[14, '{P} United'], [12, '{P} FC'], [10, '{P} Stars'], [10, '{P} City'], [8, '{P} Rovers'], [8, '{P} Wanderers'], [8, '{P} Athletic'], [6, '{P} Chiefs'], [6, '{P} Eagles'], [6, '{P} Lions'], [6, '{P} Warriors']],
  },
  'franco-african': {
    a: S('Ba, Ko, Ni, Sa, Ou, Dia, Ma, Ta, Ke, Kou, Se, Man, Yo, Bou, Gni, Dja, Sik, Tam, Kor, Bon'),
    b: S('bo, ko, ma, ni, ra, ba, dou, gou, la, ndé, ssa, bé, ya, tou, wa, gba'),
    forms: [[14, 'AS {P}'], [14, 'FC {P}'], [10, '{P} FC'], [8, 'Étoile {Pde}'], [8, 'Racing Club {Pde}'], [8, 'Olympique {P}'], [6, 'Académie {P}'], [6, 'Jeunesse {Pde}'], [8, 'Union Sportive {Pde}'], [6, 'Stade {Pde}']],
  },
  japanese: {
    a: S('Kita, Minami, Higashi, Nishi, Shin, Moto, Ao, Aka, Shiro, Kuro, Taka, Naka, Ishi, Kawa, Yama, Hama, Mori, Fuji, Sakura, Matsu, Take, Oka'),
    b: S('mori, yama, kawa, saki, hara, sawa, ura, shima, oka, mura, gaoka, numa, bashi, zaka, dani, machi'),
    forms: [[16, '{P} FC'], [14, 'FC {P}'], [10, '{P} United'], [8, '{P} Athletic'], [8, '{P} SC'], [6, '{P} Sporting Club'], [6, '{P} Verde'], [6, '{P} Stella']],
  },
  korean: {
    a: S('Dong, Seo, Nam, Buk, Han, Baek, Geum, Sam, Gok, Yeon, Mun, Seon, Ha, Gok, Dae, Bae, Jae'),
    b: S('gang, san, ju, cheon, gok, bong, pyeong, ri, myeon, dong, seong, han, do, po, am, nam'),
    forms: [[16, '{P} FC'], [14, 'FC {P}'], [10, '{P} United'], [8, '{P} Citizen'], [8, '{P} City'], [8, '{P} Athletic'], [6, '{P} Phoenix']],
  },
  chinese: {
    a: S('Bei, Nan, Dong, Xi, Tian, Jin, Yin, Qing, Hua, Shan, Hai, He, Long, Feng, Yun, Chang, Yang, Zhong, Ping, An'),
    b: S('jing, hai, shan, cheng, zhou, ning, chuan, yuan, kou, tai, fu, men, bin, lin, qiao, tang'),
    forms: [[16, '{P} FC'], [12, '{P} City'], [12, '{P} United'], [8, '{P} Dragons'], [10, '{P} Sports Club'], [8, '{P} Athletic'], [6, '{P} Rising']],
  },
  persian: {
    a: S('Sar, Ab, Gol, Dasht, Kuh, Shahr, Bagh, Rud, Tang, Deh, Pol, Sang, Mah, Zar, Naz, Kaj, Gor, Mian, Bala, Pas'),
    b: S('abad, shahr, an, eh, ak, deh, kuh, rud, jan, estan, ab, var, zar, dasht'),
    forms: [[16, '{P} FC'], [12, '{P} Sports Club'], [10, 'Shahrdari {P}'], [10, 'Sanat {P}'], [10, 'Naft {P}'], [8, 'Mes {P}'], [8, '{P} United']],
  },
  american: {
    a: S('Spring, River, Lake, Oak, Pine, Cedar, Maple, Red, Rock, Silver, Iron, Fort, Port, Stone, Green, Sun, Bay, Blue, North, West'),
    b: S('field, ville, ton, view, side, ridge, wood, brook, hill, haven, port, burg, land, creek, fall, point'),
    forms: [[16, '{P} FC'], [12, '{P} United'], [12, '{P} Athletic'], [10, '{P} City'], [10, '{P} SC'], [10, 'FC {P}'], [8, '{P} Rovers'], [6, '{P} Rangers'], [6, '{P} Storm'], [6, '{P} Thunder']],
  },
};

export const CLUB_NAME_STYLES = Object.freeze(Object.keys(BG_CLUB_STYLES));

function makePlace(rng, style) {
  let place = rng.pick(style.a) + (style.join || '') + rng.pick(style.b);
  if (style.pre && rng.chance(style.pre.p)) place = rng.pick(style.pre.words) + style.pre.sep + place;
  return place;
}

/**
 * Fictional club name for ANY nation (used for background clubs). Style comes from the nation's
 * clubNameStyle. usedSet is the set of names already taken (the caller decides the scope: per nation
 * is enough); the new name is added to it.
 */
export function makeBackgroundClubName(rng, nationCode, usedSet) {
  const nation = NATION_BY_CODE[nationCode];
  const style = BG_CLUB_STYLES[nation ? nation.clubNameStyle : 'english'] || BG_CLUB_STYLES.english;
  return uniqueClubName(() => fillTemplate(rng, pickForm(rng, style.forms), realFreePlace(() => makePlace(rng, style))), usedSet);
}

// ============================================================ stadiums
const GER_FEATURES = ['Wald', 'Fluss', 'Hang', 'Bahnhof', 'See', 'Park', 'Hafen', 'Markt'];
const FRA_FEATURES = ['Rivière', 'Forêt', 'Colline', 'Gare', 'Plage', 'Source', 'Vallée', 'Citadelle'];

/** Fictional stadium name for a country (5 playable countries get local flavour, any other code works). */
export function makeStadiumName(rng, countryCode) {
  const culture = cultureOfNation(countryCode);
  const places = CLUB_PLACES[countryCode];
  const place = realFreePlace(() => (places ? rng.pick(places) : makePlace(rng, BG_CLUB_STYLES[(NATION_BY_CODE[countryCode] || {}).clubNameStyle] || BG_CLUB_STYLES.english)));
  const person = makeName(rng, culture);
  switch (countryCode) {
    case 'ENG':
      return rng.weighted(
        [`${place} Park`, `${place} Road`, `${place} Lane`, `${place} Ground`, `${place} Stadium`, `The ${place} Arena`, `${person.last} Park`, `${person.last} Road`],
        [18, 14, 10, 10, 8, 4, 8, 6],
      );
    case 'ESP':
      return rng.weighted(
        [`Estadio ${place}`, `Estadio Municipal de ${place}`, `Campo de ${place}`, `Estadio ${person.last}`, `Ciudad Deportiva ${place}`, `Nuevo Estadio ${place}`],
        [18, 18, 10, 8, 6, 6],
      );
    case 'ITA':
      return rng.weighted(
        [`Stadio ${place}`, `Stadio Comunale ${place}`, `Stadio ${person.first} ${person.last}`, `Stadio Comunale di ${place}`, `Arena ${place}`],
        [18, 16, 10, 10, 6],
      );
    case 'GER':
      return rng.weighted(
        [`${place}-Arena`, `${place} Stadion`, `Stadion am ${rng.pick(GER_FEATURES)}`, `${person.last}-Stadion`, `Waldstadion ${place}`, `Sportpark ${place}`],
        [14, 18, 8, 8, 6, 8],
      );
    case 'FRA':
      return rng.weighted(
        [`Stade ${frDe(place)}`, `Stade Municipal ${frDe(place)}`, `Stade ${person.first} ${person.last}`, `Stade de la ${rng.pick(FRA_FEATURES)}`, `Parc des Sports ${frDe(place)}`],
        [18, 16, 8, 8, 8],
      );
    default:
      return rng.weighted([`${place} Stadium`, `${place} Arena`, `${place} Park`, `${person.last} Stadium`], [16, 8, 8, 6]);
  }
}

// ============================================================ sponsors
const SPONSOR_A = S('Nova, Veri, Alto, Zen, Quor, Lumi, Kora, Vanta, Orbi, Pyra, Sola, Terra, Nexa, Axi, Brio, Cala, Dyna, Elio, Fenix, Gala, Helio, Ixa, Juno, Kyra, Lyra, Mira, Nuvo, Opti, Prima, Quanta, Ryo, Sera, Tavi, Ulti, Vero, Wexa, Xeno, Yara, Zeta, Arca, Belo, Cory, Delta, Evra, Flux, Gyro, Hexa, Ibera, Jovi, Kinet');
const SPONSOR_B = S('tex, ron, via, nix, lon, dex, mar, gen, lia, tra, vox, zen, ora, ium, ent, ica, ova, aro, eon, ity');
const SPONSOR_SECTOR = S('Bank, Energy, Telecom, Motors, Foods, Airlines, Insurance, Logistics, Mobile, Bikes, Brewing, Pharma, Media, Software, Builders, Travel, Sports, Payments, Water, Electric, Group, Holdings, Studios, Cloud, Hotels, Pay, Capital, Direct');
const SPONSOR_BLOCK = new Set(S('nike, adidas, puma, emirates, etihad, qatar airways, samsung, sony, pepsi, coca cola, heineken, carlsberg, vodafone, orange, visa, mastercard, fly emirates, toyota, honda, bmw, audi, ford, shell, bp, total, amazon, google, apple, meta, microsoft, ikea, lego, nokia, ericsson, volvo, unicredit, santander, allianz, lufthansa').map(normKey));

/** Fictional sponsor brand, e.g. "Veltrix Telecom". */
export function makeSponsorName(rng) {
  for (let t = 0; t < 40; t++) {
    const brand = rng.pick(SPONSOR_A) + rng.pick(SPONSOR_B);
    const name = rng.chance(0.85) ? `${brand} ${rng.pick(SPONSOR_SECTOR)}` : brand;
    if (!SPONSOR_BLOCK.has(normKey(name))) return name;
  }
  return 'Nova Group';
}
