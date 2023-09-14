import { default as stravaApi } from 'strava-v3'
import auth from './auth'
import { ee } from './eventEmitter'
import { DateTime } from 'luxon'

/**
 * Fetches all user activities.
 *
 * @param {number} [page=1] - The page number to fetch (default: 1).
 * @param {number} [pageSize=100] - The number of activities per page (default: 100).
 * @param {number} [after] - An optional epoch timestamp to filter activities that occurred after a certain time.
 * @returns {Promise<any[]>} - An array of user activities.
 */
export async function fetchAthleteActivities(
	page: number,
	pageSize: number,
	after?: string
): Promise<any[]> {
	try {
		await auth.validateToken()
		if (!auth.validateUtilization(stravaApi.rateLimiting)) {
			return []
		}
		var args = {
			page: page,
			per_page: pageSize,
			after:
				after && after.length > 0
					? DateTime.fromISO(after, { zone: 'utc' }).valueOf() / 1000
					: null,
		}
		const activities = await stravaApi.athlete.listActivities(args)
		if (activities.length === pageSize) {
			const nextPageActivities = await fetchAthleteActivities(
				page + 1,
				pageSize,
				after
			)
			return [...activities, ...nextPageActivities]
		} else {
			return activities
		}
	} catch (error) {
		console.error('Error fetching activities:', error)
		throw error
	}
}

export async function fetchAthleteActivity(
	id: number,
	includeAllEfforts: boolean
): Promise<any> {
	try {
		auth.validateToken()
		if (!auth.validateUtilization(stravaApi.rateLimiting)) {
			return null
		}
		const activity = await stravaApi.activities.get({
			id: id,
			include_all_efforts: includeAllEfforts,
		})
		ee.emit('activityRetrieved', activity)
		return activity
	} catch (error) {
		console.error('Error fetching activity:', error)
		throw error
	}
}
