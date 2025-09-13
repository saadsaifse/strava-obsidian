import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	addIcon,
	Editor
} from 'obsidian'
import { AuthenticationConfig } from 'strava-v3'
import { fetchAthleteActivities, fetchAthleteActivity } from 'src/retriever'
import FileManager from 'src/fileManager'
import { ee } from 'src/eventEmitter'
import { DateTime } from 'luxon'
import auth from 'src/auth'
import * as path from 'path'

interface SyncSettings {
	lastSyncedAt: string
	activityDetailsRetrievedUntil: string
}

interface StravaActivitiesSettings {
	authSettings: AuthenticationConfig
	syncSettings: SyncSettings
	savedToken?: any
}

const DEFAULT_SETTINGS: StravaActivitiesSettings = {
	authSettings: {
		access_token: '',
		client_id: '',
		client_secret: '',
		redirect_uri: 'obsidian://obsidianforstrava/callback',
	},
	syncSettings: {
		lastSyncedAt: '', // e.g., '2023-09-14T14:44:56.106Z'
		activityDetailsRetrievedUntil: '', // e.g., '2023-01-01T14:44:56.106Z'
	},
}

export default class StravaActivities extends Plugin {
	settings = DEFAULT_SETTINGS
	fileManager: FileManager

	async onload() {
		addIcon(
			'stravaIcon',
			`<path
				d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"
				transform="scale(4)"  />
`
		)
		await this.loadSettings()

		this.fileManager = new FileManager(this.app.vault)

		ee.on('activitiesSynced', async () => {
			this.settings.syncSettings.lastSyncedAt =
				DateTime.utc().toISO() ?? ''
			await this.saveSettings()
		})

		ee.on('oauthTokenUpdated', async (token) => {
			this.settings.savedToken = token
			await this.saveSettings()
		})

		// Initialize auth with saved token
		auth.initializeWithSavedToken(this.settings.authSettings, this.settings.savedToken)

		this.registerObsidianProtocolHandler(
			'obsidianforstrava/callback',
			async (args) => {
				await auth.OAuthCallback(args)
			}
		)

		this.addSettingTab(new StravaActivitiesSettingTab(this.app, this))

		this.addCommand({
			id: 'authenticate',
			name: 'Authenticate with Strava',
			callback: () => auth.authenticate(this.settings.authSettings),
		})

		this.addCommand({
			id: 'insert-todays-strava-activities',
			name: "Insert today's Strava activities",
			editorCallback: (editor: Editor) => {
				this.handleInsertStravaActivitiesCommand(editor, false)
			},
		})

		this.addCommand({
			id: 'insert-todays-strava-activity-maps',
			name: "Insert today's Strava activity maps",
			editorCallback: (editor: Editor) => {
				this.handleInsertStravaActivitiesCommand(editor, true)
			},
		})

		this.addCommand({
			id: 'force-resync-strava-activities',
			name: 'Force resync all Strava activities',
			callback: async () => {
				new Notice('Started force resync of all Strava activities')
				try {
					// Reset lastSyncedAt to force full resync
					const originalLastSyncedAt = this.settings.syncSettings.lastSyncedAt
					this.settings.syncSettings.lastSyncedAt = ''
					
					const activities = await fetchAthleteActivities(1, 200, '')
					ee.emit('activitiesRetrieved', activities)
					new Notice('Force resync completed successfully')
				} catch (err) {
					console.error(`Error during force resync: ${err}`)
					new Notice('Failed during force resync')
				}
			},
		})

		// this.addCommand({
		// 	id: 'activity-details-command',
		// 	name: 'Retrieve detailed activities',
		// 	callback: () =>
		// 		fetchDetailedActivities(
		// 			DateTime.fromISO(
		// 				this.settings.syncSettings.activityDetailsRetrievedUntil
		// 			)
		// 		),
		// })

		const ribbonIconEl = this.addRibbonIcon(
			'stravaIcon',
			'Synchronize Strava activities',
			async (evt: MouseEvent) => {
				new Notice('Started synchronizing Strava activities')
				try {
					// First, get recent activities using the normal sync
					const recentActivities = await fetchAthleteActivities(
						1,
						200,
						this.settings.syncSettings.lastSyncedAt
					)
					
					// If we have a lastSyncedAt timestamp, also check for activities
					// that might have been uploaded with earlier dates
					let backfillActivities: any[] = []
					if (this.settings.syncSettings.lastSyncedAt) {
						// Get activities from the last 30 days to catch any backdated uploads
						const thirtyDaysAgo = DateTime.utc().minus({ days: 30 }).toISO()
						backfillActivities = await fetchAthleteActivities(
							1,
							200,
							thirtyDaysAgo
						)
						
						// Filter out activities we already have by checking existing files
						backfillActivities = backfillActivities.filter(activity => {
							const activityDate = activity.start_date_local.split('T')[0]
							const activityPath = `Strava/${activityDate}/${activity.id}`
							return !this.app.vault.getAbstractFileByPath(activityPath)
						})
					}
					
					// Combine and deduplicate activities
					const allActivities = [...recentActivities, ...backfillActivities]
					const uniqueActivities = allActivities.filter((activity, index, self) => 
						index === self.findIndex(a => a.id === activity.id)
					)
					
					ee.emit('activitiesRetrieved', uniqueActivities)
					const totalCount = uniqueActivities.length
					const backfillCount = backfillActivities.length
					
					if (backfillCount > 0) {
						new Notice(`Strava activities synchronized (${totalCount} total, ${backfillCount} backfilled)`)
					} else {
						new Notice(`Strava activities synchronized (${totalCount} activities)`)
					}
				} catch (err) {
					console.error(`Error: ${err}`)
					new Notice('Failed synchronizing Strava activities')
				}
			}
		)
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class')

		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				menu.addItem((item) => {
					item.setTitle('Get Strava activity detail 🏃‍♀️')
						.setIcon('import')
						.onClick(async () => {
							try {
								const activityDateFolder = path.dirname(
									file.path
								)
								const activityId =
									path.basename(activityDateFolder)
								await fetchAthleteActivity(
									Number(activityId),
									true,
									file.path
								)
								new Notice('Activity retrieved')
							} catch (error) {
								new Notice('Failed retrieving the activity')
							}
						})
				})
			})
		)
	}

	handleInsertStravaActivitiesCommand(editor: Editor, onlyMaps: boolean) {
		const currentDate = DateTime.now().toISODate() ?? ''
		const activityFolderPaths = this.fileManager.getChildrenPathsInFolder(currentDate)
		let content = "## Today's Strava Activities\n"
		for (const path of activityFolderPaths) {
			console.log(path)
			content += onlyMaps ? `\n![[${path}/Summary#Map]]\n` : `\n![[${path}/Summary]]\n`
		}
		content+='\n'
		editor.replaceRange(
			content,
			editor.getCursor()
		);
	}

	onunload() {
		this.settings = DEFAULT_SETTINGS
		this.saveSettings()
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		)
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}

class StravaApplicationDetailsModal extends Modal {
	plugin: StravaActivities
	constructor(app: App, plugin: StravaActivities) {
		super(app)
		this.plugin = plugin
	}

	onOpen() {
		const { contentEl } = this
		const form = contentEl.createEl('div')
		form.createEl('label', { text: 'Client ID: ' })
		const clientIdElement = form.createEl('input', {
			type: 'number',
			attr: { id: 'clientId', name: 'clientId' },
			value: this.plugin.settings.authSettings.client_id,
		})
		form.createEl('br')
		form.createEl('br')
		form.createEl('label', { text: 'Client Secret: ' })
		const clientSecretElement = form.createEl('input', {
			type: 'password',
			attr: { id: 'clientSecret', name: 'clientSecret' },
			value: this.plugin.settings.authSettings.client_secret,
		})
		form.createEl('br')
		form.createEl('br')
		const saveInputElement = form.createEl('input', {
			type: 'button',
			value: 'Save',
		})
		saveInputElement.onClickEvent(() => {
			this.plugin.settings.authSettings.client_id = clientIdElement.value
			this.plugin.settings.authSettings.client_secret =
				clientSecretElement.value
			this.plugin.saveSettings()
			this.close()
		})
	}

	onClose() {
		this.contentEl.empty()
	}
}

class StravaActivitiesSettingTab extends PluginSettingTab {
	plugin: StravaActivities

	constructor(app: App, plugin: StravaActivities) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		new Setting(containerEl)
			.setName('Enter Strava Credentials')
			.setDesc('Set Strava Credentials')
			.addButton((button) =>
				button
					.setButtonText('Enter Strava Credentials')
					// TODO: set button class
					.onClick((me) =>
						new StravaApplicationDetailsModal(
							this.app,
							this.plugin
						).open()
					)
			)
		new Setting(containerEl)
			.setName('Authenticate')
			.setDesc('Authenticate your Strava account')
			.addButton((button) =>
				button
					.setButtonText('Authenticate')
					.onClick(() =>
						auth.authenticate(this.plugin.settings.authSettings)
					)
			)
	}
}
