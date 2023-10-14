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
	const leafletConfig = `id: ${activity.id}
zoomFeatures: true
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
