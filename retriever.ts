import { default as stravaApi, RateLimiting } from 'strava-v3'

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
	pageSize: number
): Promise<any[]> {
	try {
		const usageFraction = stravaApi.rateLimiting.fractionReached()
		console.log(`Rate reached: ${usageFraction}`)

		if (usageFraction >= 0.8) {
			console.log(
				`Retrieved until page ${
					page - 1
				}. Waiting for 15 mins to continue..`
			)
			await wait(15)
		}

		const activities = await stravaApi.athlete.listActivities({
			page: page,
			per_page: pageSize,
		})

		if (activities.length === pageSize) {
			const nextPageActivities = await fetchAthleteActivities(
				page + 1,
				pageSize
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

function wait(minutes: number) {
	const milliseconds = minutes * 60 * 1000 // Convert minutes to milliseconds
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(`Waited for ${minutes} minutes.`)
		}, milliseconds)
	})
}
