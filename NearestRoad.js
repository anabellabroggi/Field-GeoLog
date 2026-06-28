// =========================================================================
// 1. INGRESO MANUAL DE COORDENADAS (Modificá estos valores)
// =========================================================================

// Poné acá la longitud y latitud de tu punto de partida (tranquera del campo)
var longitud = -61.735915855598450;
var latitud = -34.953188382452290;

// Crear el punto geométrico a partir de las coordenadas
var puntoPartida = ee.Geometry.Point([longitud, latitud]);

// Centrar el mapa en tu punto con un zoom adecuado
Map.centerObject(puntoPartida, 12);
Map.addLayer(puntoPartida, {color: 'red'}, 'Tranquera del Campo');

// =========================================================================
// 2. CARGA RED VIAL
// =========================================================================

// Dataset GRIP4 región Central-South America (incluye Argentina)
var redVialGlobal = ee.FeatureCollection("projects/sat-io/open-datasets/GRIP4/Central-South-America");

// Filtramos caminos cercanos (radio 80 km)
var redVialLocal = redVialGlobal.filterBounds(puntoPartida.buffer(80000));

// Separamos rutas principales (Nacionales=1, Provinciales=2) de caminos internos
var rutasPrincipales = redVialLocal.filter(ee.Filter.inList('GP_RTP', [1, 2]));
var caminosInternos = redVialLocal.filter(ee.Filter.inList('GP_RTP', [3, 4, 5]));

// Mostrar caminos internos en gris y rutas principales en amarillo
Map.addLayer(caminosInternos, {color: 'gray', strokeWidth: 1}, 'Caminos Internos');
Map.addLayer(rutasPrincipales, {color: 'yellow', strokeWidth: 2}, 'Rutas Principales');

// =========================================================================
// 3. CÁLCULO DE DISTANCIA A RUTA PRINCIPAL MÁS CERCANA
// =========================================================================

// Calculamos la distancia geométrica para identificar la ruta más cercana
var rutasConDistancia = rutasPrincipales.map(function(feature) {
  var dist = feature.geometry().distance(puntoPartida);
  return feature.set('distancia_metros', dist);
});

// Tomamos la ruta más cercana
var rutaMasCercana = ee.Feature(rutasConDistancia.sort('distancia_metros').first());
var distanciaMetros = ee.Number(rutaMasCercana.get('distancia_metros'));

// =========================================================================
// 4. VISUALIZACIÓN Y RESULTADOS
// =========================================================================

print('========================================');
print('   RUTA PRINCIPAL MÁS CERCANA');
print('========================================');
print('Coordenadas tranquera:', [longitud, latitud]);
print('Tipo de ruta (GP_RTP):', rutaMasCercana.get('GP_RTP'));
print('========================================');

// Resaltar la ruta más cercana en azul
Map.addLayer(rutaMasCercana, {color: 'blue', strokeWidth: 3}, 'Ruta Principal Más Cercana');

// Punto más cercano sobre la ruta
var puntoEnRuta = rutaMasCercana.geometry().intersection(puntoPartida.buffer(distanciaMetros.add(50))).centroid();

// // Línea recta de referencia visual (deshabilitado - usamos Google Maps para distancia real)
// var lineaTrayecto = ee.Geometry.LineString([puntoPartida.coordinates(), puntoEnRuta.coordinates()]);
// Map.addLayer(lineaTrayecto, {color: 'orange', strokeWidth: 2}, 'Distancia recta (referencia)');

// Generar link de Google Maps Directions para distancia real por ruta
var coordsDestino = ee.List(puntoEnRuta.coordinates());
var linkGMaps = ee.String('https://www.google.com/maps/dir/')
  .cat(ee.String(ee.Number(latitud).format('%.6f')))
  .cat(',')
  .cat(ee.String(ee.Number(longitud).format('%.6f')))
  .cat('/')
  .cat(ee.String(coordsDestino.get(1)).replace('([^\\d.-])', '', 'g'))
  .cat(',')
  .cat(ee.String(coordsDestino.get(0)).replace('([^\\d.-])', '', 'g'));

print('');
print('LINK GOOGLE MAPS (distancia real por ruta):');
print(linkGMaps);
print('Copiá el link de arriba y pegalo en el navegador');