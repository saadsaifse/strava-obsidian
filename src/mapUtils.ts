// @ts-ignore
import { decode } from 'geojson-polyline-collections-fix'

export function convertPolylineToGeojson(activity: any, detailed?: boolean) {
	if (
		!activity ||
		(detailed && !activity.map.polyline) ||
		(!detailed && !activity.map.summary_polyline)
	) {
		throw new Error('Polyline not found in the activity')
	}

	const lineString = {
		type: 'LineString',
		coordinates: detailed
			? activity.map.polyline
			: activity.map.summary_polyline,
	}
	let geoJSON = decode(lineString)

	const coordinates = JSON.stringify(geoJSON.coordinates)
	geoJSON = geojsonTemplate
		.replace('NAME', activity.name)
		.replace('COORDINATES', coordinates)
		.replace('START_COORDINATE', JSON.stringify(geoJSON.coordinates[0]))
		.replace(
			'END_COORDINATE',
			JSON.stringify(geoJSON.coordinates[geoJSON.coordinates.length - 1])
		)

	return geoJSON
}

export function getLeafletBlockForActivity(activity: any) {
	// Calculate bounds from the polyline coordinates
	const polyline = activity.map.polyline || activity.map.summary_polyline
	if (!polyline) {
		const leafletConfig = `id: ${activity.id}
zoomFeatures: true
maxZoom: 18
zoomDelta: 0.5
geojsonFolder: .
`
		return `~~~leaflet \n${leafletConfig} ~~~`
	}

	// Decode polyline to get coordinates
	const lineString = { type: 'LineString', coordinates: polyline }
	const geoJSON = decode(lineString)
	const coords = geoJSON.coordinates

	// Calculate bounds
	let minLat = coords[0][1], maxLat = coords[0][1]
	let minLng = coords[0][0], maxLng = coords[0][0]
	
	coords.forEach(([lng, lat]: [number, number]) => {
		minLat = Math.min(minLat, lat)
		maxLat = Math.max(maxLat, lat)
		minLng = Math.min(minLng, lng)
		maxLng = Math.max(maxLng, lng)
	})

	// Add padding to bounds (about 10%)
	const latPadding = (maxLat - minLat) * 0.1 || 0.01 // Minimum padding for point activities
	const lngPadding = (maxLng - minLng) * 0.1 || 0.01
	
	// Calculate center point and zoom level
	const centerLat = (minLat + maxLat) / 2
	const centerLng = (minLng + maxLng) / 2
	
	// Calculate appropriate zoom level based on bounds
	const latDiff = maxLat - minLat
	const lngDiff = maxLng - minLng
	const maxDiff = Math.max(latDiff, lngDiff)
	
	let zoom = 15 // Default zoom
	if (maxDiff > 1) zoom = 8
	else if (maxDiff > 0.5) zoom = 10
	else if (maxDiff > 0.1) zoom = 12
	else if (maxDiff > 0.05) zoom = 14
	
	const leafletConfig = `id: ${activity.id}
lat: ${centerLat}
long: ${centerLng}
zoom: ${zoom}
maxZoom: 18
zoomDelta: 0.5
geojsonFolder: .
`
	const leafletBlock = `~~~leaflet \n${leafletConfig} ~~~`
	return leafletBlock
}

const geojsonTemplate = `{
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "name": "NAME",
          "stroke": "#FC4C02",
          "stroke-width": 4
        },
        "geometry": {
          "type": "LineString",
          "coordinates": COORDINATES
        }
      },
      {
        "type": "Feature",
        "properties": {
          "name": "Start"
        },
        "geometry": {
          "type": "Point",
          "coordinates": START_COORDINATE
        }
      },
      {
        "type": "Feature",
        "properties": {
          "name": "End"
        },
        "geometry": {
          "type": "Point",
          "coordinates": END_COORDINATE
        }
      }
    ]
  }`
