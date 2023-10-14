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
				(activity) => activity.start_date_local.split('T')[0]
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
					await this.createMapGeojsonFile(
						activity,
						false,
						folderPath
					)
					const fileContents = this.getFormattedFileContents(activity)
					await this.createOrOverwriteFile(
						path.join(folderPath, 'Summary.md'),
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
				await this.createMapGeojsonFile(
					activity,
					true,
					dirname
				)
				const fileContents = this.getFormattedFileContents(activity)
				await this.createOrOverwriteFile(
					path.join(dirname, 'Detailed.md'),
					fileContents
				)
			}
		} catch (error) {
			console.log(
				`Failed to create the detailed.md file for activity id ${activity?.id}`
			)
		}
	}

	private async createMapGeojsonFile(
		activity: any,
		detailed: boolean,
		folderPath: string
	) {
		if (!activity?.map.polyline && !activity?.map.summary_polyline) {
			return
		}
		try {
			const geoJson = convertPolylineToGeojson(activity, detailed)
			if (geoJson) {
				await this.createOrOverwriteFile(
					path.join(folderPath, 'map.geojson'),
					geoJson
				)
			}
		} catch (error) {
			console.log('Error creating geojson file', error)
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

	private getFormattedFileContents(activity:any): string {
		if (!activity) {
			return ''
		}
		const activityDetails = `Activity Id: ${activity.id}\nSport Type: ${activity.sport_type}\nActivity Name: ${activity.name}`
		let activityContents = `~~~json \n${JSON.stringify(
			activity,
			null,
			2
		)} \n~~~`
		let mapFileContents = ''
		if (activity?.map.polyline || activity?.map.summary_polyline) {
			const  mapContents = getLeafletBlockForActivity(activity)
			mapFileContents = `## Map\n${mapContents}\n`
		}

		const fileContents = `${activityDetails}\n${mapFileContents}## Activity\n${activityContents}\n`
		return fileContents
	}

	getChildrenPathsInFolder(folderName: string) {
		const folder = this.vault.getAbstractFileByPath(path.join(this.rootFolder, folderName))
		if (!(folder instanceof TFolder)) {
			return []
		}
		return folder.children.map(f => f.path)
	}
}
