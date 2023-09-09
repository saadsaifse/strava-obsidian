import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFolder,
} from 'obsidian'
import { default as stravaApi, AuthenticationConfig } from 'strava-v3'
import * as path from 'path'

interface StravaAuthSettings {
	stravaConfig: AuthenticationConfig
	token: any // the response object from get token
	accessCode: string
}

interface StravaActivitiesSettings {
	authSetting: StravaAuthSettings
}

const DEFAULT_SETTINGS: StravaActivitiesSettings = {
	authSetting: {
		token: '',
		accessCode: '',
		stravaConfig: {
			access_token: '',
			client_id: '113274', // TODO: reset after input handler is implemented
			client_secret: 'a596836c309eb7f08067aa7504907664998c896f', // TODO: reset after input handler is implemented
			redirect_uri: 'obsidian://obsidianforstrava/callback',
		},
	},
}

export default class StravaActivities extends Plugin {
	settings = DEFAULT_SETTINGS

	async onload() {
		this.registerObsidianProtocolHandler(
			'obsidianforstrava/callback',
			async (args) => {
				if (args.scope != 'read,activity:read_all') {
					new Notice('Please authorize required permissions.')
					return
				}
				try {
					await this.getTokenFromAccessCode(args.code)
					new Notice('Authenticated with Strava')
				} catch (err) {
					new Notice('Could not authenticate user')
				}
			}
		)

		await this.loadSettings()

		this.addSettingTab(new StravaActivitiesSettingTab(this.app, this))

		this.addCommand({
			id: 'authenticate-command',
			name: 'Authenticate with Strava',
			callback: this.onAuthenticateCommand,
		})

		const ribbonIconEl = this.addRibbonIcon(
			'dice',
			'Strava Activities',
			async (evt: MouseEvent) => {
				if (this.settings.authSetting.stravaConfig.access_token != '') {
					// TODO: check if refresh is needed
					const activities = await stravaApi.athlete.listActivities({
						page: 1,
						per_page: 99,
					})
					console.log(activities)
					try {
						if (
							this.app.vault.getAbstractFileByPath(
								'Strava'
							) instanceof TFolder
						) {
						} else {
							await this.app.vault.createFolder('Strava')
						}
						const filePath = path.join(
							'Strava',
							`Activities_SyncedAt_${Date.now()}.json`
						)
						const jsonData = JSON.stringify(activities, null, 2)
						console.log(jsonData)
						await this.app.vault.create(filePath, jsonData)
						console.log(
							`Activities file "${filePath}" created or overwritten successfully.`
						)
						new Notice('Strava activities synchronized')
					} catch (err) {
						console.error(`Error: ${err}`)
						new Notice('Failed synchronizing Strava activities')
					}
				} else {
					new Notice(
						'Please authenticate to synchronize your Strava activities'
					)
				}
			}
		)
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class')
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

	getTokenFromAccessCode = async (code: string) => {
		const token = await stravaApi.oauth.getToken(code)
		this.settings.authSetting.token = token
		this.settings.authSetting.stravaConfig.access_token = token.access_token
		this.saveSettings()
		stravaApi.config(this.settings.authSetting.stravaConfig)
		stravaApi.client(this.settings.authSetting.stravaConfig.access_token)
	}

	onAuthenticateCommand = async () => {
		stravaApi.config(this.settings.authSetting.stravaConfig)
		const url = await stravaApi.oauth.getRequestAccessURL({
			scope: 'activity:read_all',
		})
		await open(url, undefined)
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
			value: this.plugin.settings.authSetting.stravaConfig.client_id,
		})
		form.createEl('br')
		form.createEl('br')
		form.createEl('label', { text: 'Client Secret: ' })
		const clientSecretElement = form.createEl('input', {
			type: 'password',
			attr: { id: 'clientSecret', name: 'clientSecret' },
			value: this.plugin.settings.authSetting.stravaConfig.client_secret,
		})
		form.createEl('br')
		form.createEl('br')
		const saveInputElement = form.createEl('input', {
			type: 'button',
			value: 'Save',
		})
		saveInputElement.onClickEvent(() => {
			this.plugin.settings.authSetting.stravaConfig.client_id =
				clientIdElement.value
			this.plugin.settings.authSetting.stravaConfig.client_secret =
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
					.onClick(this.plugin.onAuthenticateCommand)
			)
	}
}
