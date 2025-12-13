import { TFile, TFolder, Vault, normalizePath } from 'obsidian'
import { ee } from 'src/eventEmitter'
import * as _ from 'lodash'
import * as path from 'path'
import {
	convertPolylineToGeojson,
	getLeafletBlockForActivity,
} from 'src/mapUtils'

export default class FileManager {
	constructor(private vault: Vault, private settings: any) {
		ee.on('activitiesRetrieved', (activities) =>
			this.onNewActivitiesRetrieved(activities)
		)

		ee.on('activityRetrieved', (activity, filePath) => {
			this.onNewActivityRetrieved(activity, filePath)
		})
	}

	private get rootFolder(): string {
		return this.settings.syncSettings?.rootFolder || 'Strava'
	}

	private sanitizeFilename(name: string): string {
		return name
			.replace(/[\\/:*?"<>|#^[\]]/g, '-')  // Windows/Mac/Linux invalid chars + Obsidian special chars
			.replace(/^\.+/, '')                  // No leading dots (hidden files on Unix)
			.replace(/\.+$/, '')                  // No trailing dots (Windows issue)
			.replace(/\s+$/, '')                  // No trailing spaces (Windows issue)
			.substring(0, 200)                    // Limit length (255 max, leave room for extension + path)
	}

	private getActivityFilename(activity: any): string {
		const format = this.settings.syncSettings?.filenameFormat || 'summary'

		if (format === 'activity-name' && activity.name) {
			return `${this.sanitizeFilename(activity.name)}.md`
		}

		return 'Summary.md'
	}

	private getActivityBasePath(activityDate: string): string {
		const folderFormat = this.settings.syncSettings?.folderFormat || ''

		if (folderFormat.includes('{{date:')) {
			// Expand {{date:FORMAT}} tokens using moment.js
			// The format is expected to include the full path structure (no extra date appended)
			const expandedFormat = this.expandDateTokens(folderFormat, activityDate)
			return path.join(this.rootFolder, expandedFormat)
		}

		// Legacy flat structure: rootFolder/YYYY-MM-DD
		return path.join(this.rootFolder, activityDate)
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
				const basePath = this.getActivityBasePath(activityDate)
				await this.createFolderIfNonExistent(basePath)

				const activities = activityDates[activityDate]
				for (const activity of activities) {
					const activityId = `${activity.id}`
					const folderPath = path.join(basePath, activityId)
					await this.createFolderIfNonExistent(folderPath)
					await this.createMapGeojsonFile(
						activity,
						false,
						folderPath
					)
					const fileContents = this.getFormattedFileContents(activity)
					const filename = this.getActivityFilename(activity)
					await this.createOrOverwriteFile(
						path.join(folderPath, filename),
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

	private async createFolderIfNonExistent(folderPath: string) {
		if (this.vault.getAbstractFileByPath(folderPath) instanceof TFolder) {
			return
		}

		// Create parent folders first if needed
		const parts = folderPath.split('/')
		let currentPath = ''
		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part
			if (!(this.vault.getAbstractFileByPath(currentPath) instanceof TFolder)) {
				await this.vault.createFolder(currentPath)
			}
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

	private expandDateTokens(template: string, date: string): string {
		// Use Obsidian's bundled moment.js to expand {{date:FORMAT}} tokens
		const m = (window as any).moment(date)
		return template.replace(/\{\{date:([^}]+)\}\}/g, (_, format) => m.format(format))
	}

	private getFormattedFileContents(activity:any): string {
		if (!activity) {
			return ''
		}
		const activityDate = activity.start_date_local.split('T')[0]

		// Build daily note link if enabled
		let dailyNoteLink = ''
		if (this.settings.dailyNoteSettings?.enabled !== false) {
			const folderPrefix = this.settings.dailyNoteSettings?.folderPrefix || ''

			if (folderPrefix.includes('{{date:')) {
				// Format with {{date:FORMAT}} tokens - the format already includes the full path with date
				const expandedPath = this.expandDateTokens(folderPrefix, activityDate)
				dailyNoteLink = `[[${expandedPath}]]`
			} else if (folderPrefix) {
				// Legacy format: simple prefix + date
				const normalizedPrefix = folderPrefix.endsWith('/') ? folderPrefix : folderPrefix + '/'
				dailyNoteLink = `[[${normalizedPrefix}${activityDate}]]`
			} else {
				// No prefix, just the date
				dailyNoteLink = `[[${activityDate}]]`
			}
		}
		
		// Convert activity data to YAML frontmatter
		const yamlFrontmatter = this.convertActivityToYamlFrontmatter(activity)
		
		let activityDetails = `Activity Id: ${activity.id}\nSport Type: ${activity.sport_type}\nActivity Name: ${activity.name}`
		if (dailyNoteLink) {
			activityDetails += `\nDaily Note: ${dailyNoteLink}`
		}
		
		let mapFileContents = ''
		if (activity?.map.polyline || activity?.map.summary_polyline) {
			const  mapContents = getLeafletBlockForActivity(activity)
			mapFileContents = `## Map\n${mapContents}\n`
		}

		// Include both YAML frontmatter and JSON for backward compatibility
		let activityContents = `~~~json \n${JSON.stringify(
			activity,
			null,
			2
		)} \n~~~`

		const fileContents = `${yamlFrontmatter}${activityDetails}\n${mapFileContents}## Activity\n${activityContents}\n`
		return fileContents
	}

	private convertActivityToYamlFrontmatter(activity: any): string {
		if (!activity) return ''
		
		// Split start_date_local into separate date and time components
		const startDateTime = activity.start_date_local
		const startDate = startDateTime ? startDateTime.split('T')[0] : null
		const startTime = startDateTime ? startDateTime.split('T')[1].replace('Z', '') : null
		
		// Extract key fields for YAML frontmatter
		const frontmatterData: any = {
			activity_id: activity.id,
			name: activity.name,
			sport_type: activity.sport_type,
			start_date: startDate,
			start_time: startTime,
			distance: activity.distance,
			moving_time: activity.moving_time,
			elapsed_time: activity.elapsed_time,
			total_elevation_gain: activity.total_elevation_gain,
			average_speed: activity.average_speed,
			max_speed: activity.max_speed,
			average_heartrate: activity.average_heartrate,
			max_heartrate: activity.max_heartrate,
			elev_high: activity.elev_high,
			elev_low: activity.elev_low,
			pr_count: activity.pr_count,
			achievement_count: activity.achievement_count,
			kudos_count: activity.kudos_count,
			comment_count: activity.comment_count,
			athlete_count: activity.athlete_count,
			photo_count: activity.photo_count,
			trainer: activity.trainer,
			commute: activity.commute,
			manual: activity.manual,
			private: activity.private,
			visibility: activity.visibility,
			flagged: activity.flagged,
			gear_id: activity.gear_id,
			from_accepted_tag: activity.from_accepted_tag,
			upload_id: activity.upload_id,
			external_id: activity.external_id,
			has_heartrate: activity.has_heartrate,
			heartrate_opt_out: activity.heartrate_opt_out,
			display_hide_heartrate_option: activity.display_hide_heartrate_option,
			has_kudoed: activity.has_kudoed
		}

		// Remove undefined/null values
		Object.keys(frontmatterData).forEach(key => {
			if (frontmatterData[key] === undefined || frontmatterData[key] === null) {
				delete frontmatterData[key]
			}
		})

		// Convert to YAML format
		let yamlContent = '---\n'
		for (const key in frontmatterData) {
			if (frontmatterData.hasOwnProperty(key)) {
				const value = frontmatterData[key]
				if (typeof value === 'string') {
					yamlContent += `${key}: "${value}"\n`
				} else {
					yamlContent += `${key}: ${value}\n`
				}
			}
		}
		yamlContent += '---\n\n'

		return yamlContent
	}

	/**
	 * Get activity folder paths for a given date.
	 * Uses the folder format setting to determine the correct path.
	 * @param dateStr - ISO date string (YYYY-MM-DD)
	 */
	getActivityFolderPathsForDate(dateStr: string): string[] {
		const folderFormat = this.settings.syncSettings?.folderFormat || ''
		
		let basePath: string
		if (folderFormat.includes('{{date:')) {
			const expandedFormat = this.expandDateTokens(folderFormat, dateStr)
			basePath = path.join(this.rootFolder, expandedFormat)
		} else {
			basePath = path.join(this.rootFolder, dateStr)
		}
		
		const folder = this.vault.getAbstractFileByPath(basePath)
		if (!(folder instanceof TFolder)) {
			return []
		}
		return folder.children.filter(f => f instanceof TFolder).map(f => f.path)
	}

	/**
	 * @deprecated Use getActivityFolderPathsForDate instead
	 */
	getChildrenPathsInFolder(folderName: string) {
		const folder = this.vault.getAbstractFileByPath(path.join(this.rootFolder, folderName))
		if (!(folder instanceof TFolder)) {
			return []
		}
		return folder.children.map(f => f.path)
	}
}
