import { TFile, TFolder, Vault } from 'obsidian'
import { ee } from 'src/eventEmitter'
import * as _ from 'lodash'
import * as path from 'path'

export default class FileManager {
	private rootFolder = 'Strava'
	constructor(private vault: Vault) {
		ee.on('activitiesRetrieved', (activities) =>
			this.onNewActivitiesRetrieved(activities)
		)
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
					const filePath = path.join(
						this.rootFolder,
						activityDate,
						activityId,
						'summary.md'
					)
					const jsonData = JSON.stringify(activity, null, 2)
					const jsonBlock = `~~~json \n${jsonData} \n~~~`
					await this.createOrOverwriteFile(filePath, jsonBlock)
					console.log(
						`File "${filePath}" created or overwritten successfully.`
					)
				}
			}
			ee.emit('activitiesSynced')
		} catch (error) {
			console.log(`File creation failed`, error)
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
}
