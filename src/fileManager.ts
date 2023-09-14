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
				const activities = activityDates[activityDate]
				for (const activity of activities) {
					const subfolder = path.join(this.rootFolder, activityDate)
					if (
						!(
							this.vault.getAbstractFileByPath(
								this.rootFolder
							) instanceof TFolder
						)
					) {
						await this.vault.createFolder(this.rootFolder)
					}
					if (
						!(
							this.vault.getAbstractFileByPath(
								subfolder
							) instanceof TFolder
						)
					) {
						await this.vault.createFolder(subfolder)
					}
					const filePath = path.join(subfolder, `summary.md`)
					const existingFile =
						this.vault.getAbstractFileByPath(filePath)
					if (existingFile instanceof TFile) {
						this.vault.delete(existingFile, true)
					}
					const jsonData = JSON.stringify(activity, null, 2)
					const jsonBlock = `~~~json \n${jsonData} \n~~~`
					await this.vault.create(filePath, jsonBlock)
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
}
