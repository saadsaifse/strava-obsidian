import { TFile, TFolder, Vault, normalizePath } from 'obsidian'
import { ee } from 'src/eventEmitter'
import * as _ from 'lodash'
import * as path from 'path'
import {
	convertPolylineToGeojson,
	getLeafletBlockForActivity,
} from 'src/mapUtils'

export default class FileManager {
	private rootFolder = 'Strava'
	constructor(private vault: Vault) {
		ee.on('activitiesRetrieved', (activities) =>
			this.onNewActivitiesRetrieved(activities)
		)

		ee.on('activityRetrieved', (activity, filePath) => {
			this.onNewActivityRetrieved(activity, filePath)
		})
	}

	private async onNewActivitiesRetrieved(activities: any[]) {
		if (!activities || activities.length == 0) {
			return
		}
		try {
			const activityDates = _.groupBy(
				activities,
				(activity) => activity.start_date.split('T')[0]
			)
			for (const activityDate in activityDates) {
				await this.createFolderIfNonExistent(this.rootFolder)
				await this.createFolderIfNonExistent(
					path.join(this.rootFolder, activityDate)
				)
				const activities = activityDates[activityDate]
				for (const activity of activities) {
					const activityId = `${activity.id}`
					await this.createFolderIfNonExistent(
						path.join(this.rootFolder, activityDate, activityId)
					)
					const folderPath = path.join(
						this.rootFolder,
						activityDate,
						activityId
					)
					const jsonData = JSON.stringify(activity, null, 2)
					let fileContents = `~~~json \n${jsonData} \n~~~`

					const leafletBlock = await this.createAndGetMapData(
						activity,
						false,
						folderPath
					)
					if (leafletBlock) {
						fileContents = leafletBlock + '\n\n' + fileContents
					}
					await this.createOrOverwriteFile(
						path.join(folderPath, 'summary.md'),
						fileContents
					)
					console.log(
						`Files at "${folderPath}" created or overwritten successfully.`
					)
				}
			}
			ee.emit('activitiesSynced')
		} catch (error) {
			console.log(`File creation failed`, error)
		}
	}

	private async onNewActivityRetrieved(activity: any, filePath?: string) {
		if (!activity) {
			return
		}
		try {
			if (filePath) {
				const dirname = path.dirname(filePath)
				let fileContents = `~~~json \n${JSON.stringify(
					activity,
					null,
					2
				)} \n~~~`
				const leafletBlock = await this.createAndGetMapData(
					activity,
					true,
					dirname
				)
				if (leafletBlock) {
					fileContents = leafletBlock + '\n\n' + fileContents
				}
				await this.createOrOverwriteFile(
					path.join(dirname, 'detailed.md'),
					fileContents
				)
			}
		} catch (error) {
			console.log(
				`Failed to create the detailed.md file for activity id ${activity?.id}`
			)
		}
	}

	private async createAndGetMapData(
		activity: any,
		detailed: boolean,
		folderPath: string
	) {
		try {
			const geoJson = convertPolylineToGeojson(activity, detailed)
			if (geoJson) {
				await this.createOrOverwriteFile(
					path.join(folderPath, 'map.geojson'),
					geoJson
				)
				return getLeafletBlockForActivity(activity, detailed)
			}
			return null
		} catch (error) {
			console.log('Map data for the activity not found', error)
		}
	}

	private async readFile(file: TFile): Promise<string> {
		return await this.vault.cachedRead(file)
	}

	private async createFolderIfNonExistent(path: string) {
		if (!(this.vault.getAbstractFileByPath(path) instanceof TFolder)) {
			await this.vault.createFolder(path)
		}
	}

	private async createOrOverwriteFile(path: string, contents: string) {
		const existingFile = this.vault.getAbstractFileByPath(path)
		if (existingFile instanceof TFile) {
			await this.vault.delete(existingFile, true)
		}
		await this.vault.create(path, contents)
	}

	private async getActivityDayFolderPath(last?: boolean) {
		if (
			!(
				this.vault.getAbstractFileByPath(this.rootFolder) instanceof
				TFolder
			)
		) {
			return null
		}
		const items = await this.vault.adapter.list(
			normalizePath(this.rootFolder)
		)

		if (!items || !items.folders) {
			return null
		}

		return last ? items.folders[-1] : items.folders[0]
	}
}
