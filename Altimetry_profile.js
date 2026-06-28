// =======================================
// 1. LOTE desde Asset real
// =======================================
var loteFC = ee.FeatureCollection('projects/mystic-span-496901-q9/assets/shape402');
var lote = loteFC.geometry();
Map.centerObject(lote, 16);
Map.addLayer(lote, {color: 'black'}, 'Lote real');

// =======================================
// 2. DEM ALOS 12.5m
// =======================================
var alos = ee.ImageCollection('JAXA/ALOS/AW3D30/V3_2')
              .filterBounds(lote)
              .select('DSM');
var dem = alos.mosaic().clip(lote);

// =======================================
// 3. SUAVIZADO (reduce pixelado)
// =======================================
var demSmooth = dem.focal_mean({
  radius: 20,
  units: 'meters'
});

// =======================================
// 4. RANGO REAL DE ALTURA
// =======================================
var stats = demSmooth.reduceRegion({
  reducer: ee.Reducer.minMax(),
  geometry: lote,
  scale: 12.5,
  maxPixels: 1e9
});
print('Altura mínima y máxima:', stats);

// =======================================
// 5. VISUAL ALTIMITRÍA COLOR
// =======================================
var minElev = ee.Number(stats.get('DSM_min'));
var maxElev = ee.Number(stats.get('DSM_max'));

var minVal = minElev.getInfo();
var maxVal = maxElev.getInfo();

var elevVis = {
  min: minVal,
  max: maxVal,
  palette: [
    '#08306b','#2171b5','#6baed6','#74c476',
    '#fdae6b','#e6550d','#a50f15'
  ]
};
Map.addLayer(demSmooth, elevVis, 'Altimetría color');

// =======================================
// 6. HILLSHADE (relieve)
// =======================================
var hillshade = ee.Terrain.hillshade(demSmooth);
Map.addLayer(hillshade, {min: 0, max: 255}, 'Relieve (hillshade)');

// =======================================
// 7. PENDIENTE
// =======================================
var slope = ee.Terrain.slope(demSmooth);
Map.addLayer(
  slope,
  {min: 0, max: 3, palette: ['white', 'yellow', 'orange', 'red']},
  'Pendiente (%)'
);

// =======================================
// 8. CURVATURA (lomas y bajos)
// =======================================
var kernel = ee.Kernel.laplacian8();
var curvature = demSmooth.convolve(kernel);
Map.addLayer(
  curvature,
  {min:-3, max:3, palette:['blue','white','red']},
  'Curvatura (Bajos/Lomas)'
);

// =======================================
// 9. SUPERFICIE TOTAL REAL
// =======================================
var pixelArea = ee.Image.pixelArea().divide(10000);
var areaTotal = pixelArea.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry: lote,
  scale: 12.5,
  maxPixels: 1e10
});
var totalHa = ee.Number(areaTotal.get('area'));
print('Superficie total lote (ha):', totalHa);

// =======================================
// 10. CLASIFICAR ALTURA EN RANGOS
// =======================================
var nClases = 7;
var rango = maxElev.subtract(minElev);
var paso = rango.divide(nClases);

var clasificada = demSmooth.subtract(minElev)
                  .divide(paso)
                  .int()
                  .clamp(0, nClases - 1);

Map.addLayer(
  clasificada,
  {min:0, max:nClases-1, palette:[
    '#08306b','#2171b5','#6baed6','#74c476',
    '#fdae6b','#e6550d','#a50f15'
  ]},
  'Rangos altimétricos'
);

// =======================================
// 11. SUPERFICIE POR CLASE (ha)
// =======================================
var areaImage = pixelArea.addBands(clasificada);
var areas = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1,
    groupName: 'clase'
  }),
  geometry: lote,
  scale: 12.5,
  maxPixels: 1e10
});

var lista = ee.List(areas.get('groups'));

// =======================================
// 12. TABLA FINAL
// =======================================
var tabla = lista.map(function(item){
  item = ee.Dictionary(item);
  var clase = ee.Number(item.get('clase'));
  var ha = ee.Number(item.get('sum'));
  var porcentaje = ha.divide(totalHa).multiply(100);
  var alturaMin = minElev.add(paso.multiply(clase));
  var alturaMax = alturaMin.add(paso);
  return ee.Dictionary({
    Clase: clase,
    Altura_m: alturaMin.format('%.2f')
                .cat(' - ')
                .cat(alturaMax.format('%.2f')),
    Superficie_ha: ha,
    Porcentaje: porcentaje
  });
});
print('Superficie por rango altimétrico:', tabla);

// =======================================
// 13. PREPARAR EXPORT JPG CON LEYENDA INTEGRADA
// =======================================

// --- A) Datos de configuración ---
var paleta = ['#08306b','#2171b5','#6baed6','#74c476',
              '#fdae6b','#e6550d','#a50f15'];
var nombres = ['Bajo extremo','Bajo','Bajo medio',
               'Ambiente dominante','Media alta','Loma','Loma alta'];

// --- B) Visualizar el mapa con colores ---
var mapaColor = clasificada.visualize({
  min: 0,
  max: nClases - 1,
  palette: paleta
});

// --- C) Generar thumbnail JPG directo en consola ---
// (esto te muestra el resultado en la consola para previsualizar)
var thumbParams = {
  region: lote,
  dimensions: 1200,
  format: 'jpg',
  crs: 'EPSG:4326'
};

print('--- VISTA PREVIA DEL MAPA ---');
print(ui.Thumbnail({
  image: mapaColor,
  params: thumbParams,
  style: {width: '600px'}
}));

// --- D) Generar URL de descarga directa del JPG ---
var url = mapaColor.getThumbURL({
  region: lote,
  dimensions: 1200,
  format: 'jpg'
});
print('URL de descarga directa del mapa JPG:', url);

// --- E) Export task del mapa como GeoTIFF (alta resolución) ---
Export.image.toDrive({
  image: mapaColor,
  description: 'Altimetria_Lote_Mapa',
  folder: 'LotePerfecto_Altimetria',
  scale: 2, 
  region: lote,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e10
});

// =======================================
// 14. EXPORTAR TABLA COMO CSV
// =======================================

var tablaCompleta = tabla.map(function(item){
  item = ee.Dictionary(item);
  var clase = ee.Number(item.get('Clase'));
  var nombre = ee.List(nombres).get(clase);
  var color = ee.List(paleta).get(clase);
  
  return ee.Feature(null, {
    'Clase': clase,
    'Nombre': nombre,
    'Color_HEX': color,
    'Altura_m': item.get('Altura_m'),
    'Superficie_ha': ee.Number(item.get('Superficie_ha')).format('%.2f'),
    'Porcentaje': ee.Number(item.get('Porcentaje')).format('%.2f')
  });
});

var tablaFC = ee.FeatureCollection(tablaCompleta);

Export.table.toDrive({
  collection: tablaFC,
  description: 'Altimetria_Lote_Tabla',
  folder: 'LotePerfecto_Altimetria',
  fileFormat: 'CSV',
  selectors: ['Clase','Nombre','Color_HEX','Altura_m','Superficie_ha','Porcentaje']
});

// =======================================
// 15. PANEL VISUAL EN CONSOLA (para screenshot)
// =======================================

tabla.evaluate(function(tablaCliente){
  
  var panel = ui.Panel({
    style: {
      width: '480px',
      padding: '15px',
      backgroundColor: 'white',
      border: '1px solid #cccccc'
    }
  });
  
  // Título
  panel.add(ui.Label({
    value: 'Altimetría del Lote',
    style: {
      fontSize: '20px',
      fontWeight: 'bold',
      margin: '0 0 12px 0',
      color: '#2c5f2d'
    }
  }));
  
  // Encabezado
  var encabezado = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '4px 0', backgroundColor: '#f0f0f0', padding: '6px'}
  });
  encabezado.add(ui.Label('Color', {width: '50px', fontWeight: 'bold', fontSize: '12px'}));
  encabezado.add(ui.Label('Ambiente', {width: '140px', fontWeight: 'bold', fontSize: '12px'}));
  encabezado.add(ui.Label('Altura (m)', {width: '110px', fontWeight: 'bold', fontSize: '12px'}));
  encabezado.add(ui.Label('ha', {width: '60px', fontWeight: 'bold', fontSize: '12px'}));
  encabezado.add(ui.Label('%', {width: '60px', fontWeight: 'bold', fontSize: '12px'}));
  panel.add(encabezado);
  
  // Filas
  tablaCliente.forEach(function(fila){
    var idx = fila.Clase;
    var row = ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      style: {margin: '2px 0', padding: '4px'}
    });
    
    row.add(ui.Label('', {
      backgroundColor: paleta[idx],
      width: '40px',
      height: '20px',
      margin: '2px 10px 2px 0'
    }));
    row.add(ui.Label(nombres[idx], {width: '140px', fontSize: '12px'}));
    row.add(ui.Label(fila.Altura_m, {width: '110px', fontSize: '12px'}));
    row.add(ui.Label(fila.Superficie_ha.toFixed(2), {width: '60px', fontSize: '12px'}));
    row.add(ui.Label(fila.Porcentaje.toFixed(1) + '%', {width: '60px', fontSize: '12px'}));
    
    panel.add(row);
  });
  
  print(panel);
});