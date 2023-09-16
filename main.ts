import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian'
import { AuthenticationConfig } from 'strava-v3'
import {
	fetchAthleteActivities,
	fetchAthleteActivity,
	fetchDetailedActivities,
} from 'src/retriever'
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
}

const DEFAULT_SETTINGS: StravaActivitiesSettings = {
	authSettings: {
		access_token: '',
		client_id: '113274', // TODO: reset after input handler is implemented
		client_secret: 'a596836c309eb7f08067aa7504907664998c896f', // TODO: reset after input handler is implemented
		redirect_uri: 'obsidian://obsidianforstrava/callback',
	},
	syncSettings: {
		// lastSyncedAt: '2023-09-14T14:44:56.106Z', // setting to avoid excessive retrievals during dev
		// activityDetailsRetrievedUntil: '2023-01-01T14:44:56.106Z', // setting to avoid excessive retrievals during dev
		lastSyncedAt: '', // setting to avoid excessive retrievals during dev
		activityDetailsRetrievedUntil: '', // setting to avoid excessive retrievals during dev
	},
}

export default class StravaActivities extends Plugin {
	settings = DEFAULT_SETTINGS
	fileManager: FileManager

	async onload() {
		await this.loadSettings()

		this.fileManager = new FileManager(this.app.vault)

		ee.on('activitiesSynced', async () => {
			this.settings.syncSettings.lastSyncedAt =
				DateTime.utc().toISO() ?? ''
			await this.saveSettings()
		})

		this.registerObsidianProtocolHandler(
			'obsidianforstrava/callback',
			async (args) => {
				await auth.OAuthCallback(args)
			}
		)

		this.addSettingTab(new StravaActivitiesSettingTab(this.app, this))

		this.addCommand({
			id: 'authenticate-command',
			name: 'Authenticate with Strava',
			callback: () => auth.authenticate(this.settings.authSettings),
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
			'dice',
			'Strava Activities',
			async (evt: MouseEvent) => {
				new Notice('Started Synchronizing Strava Activities')
				try {
					const activities = await fetchAthleteActivities(
						1,
						200,
						this.settings.syncSettings.lastSyncedAt
					)
					ee.emit('activitiesRetrieved', activities)
					new Notice('Strava activities synchronized')
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
					item.setTitle('Get detailed activity')
						.setIcon('document')
						.onClick(async () => {
							try {
								const activityDateFolder = path.dirname(
									file.path
								)
								const activityId =
									path.basename(activityDateFolder)
								const activity = await fetchAthleteActivity(
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
