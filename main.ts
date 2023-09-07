import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFolder,
} from 'obsidian'
import { default as stravaApi, Strava } from 'strava-v3'
//import request from 'request';
import { BrowserWindow } from '@electron/remote'
import * as fs from 'fs/promises'
import * as path from 'path'

// Remember to rename these classes and interfaces!

interface StravaAuthSettings {
	token: any
	accessCode: string
}

interface StravaActivitiesSettings {
	mySetting: string
	authSetting: StravaAuthSettings
}

const DEFAULT_SETTINGS: StravaActivitiesSettings = {
	mySetting: 'default',
	authSetting: { token: '', accessCode: '' },
}

export default class StravaActivities extends Plugin {
	settings: StravaActivitiesSettings

	async onload() {
		await this.loadSettings()

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			'dice',
			'Strava Activities',
			async (evt: MouseEvent) => {
				// Called when the user clicks the icon.
				if (this.settings.authSetting.token.access_token) {
					// TODO: check if refresh is needed
					const activities = await stravaApi.athlete.listActivities(
						{}
					)
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
						const filePath = path.join('Strava', 'Activities.json')
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

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem()
		statusBarItemEl.setText('Status Bar Text')

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open()
			},
		})
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection())
				editor.replaceSelection('Sample Editor Command')
			},
		})
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView =
					this.app.workspace.getActiveViewOfType(MarkdownView)
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open()
					}

					// This command will only show up in Command Palette when the check function returns true
					return true
				}
			},
		})

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this))

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt)
		})

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000)
		)
	}

	onunload() {}

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

class SampleModal extends Modal {
	constructor(app: App) {
		super(app)
	}

	onOpen() {
		const { contentEl } = this
		contentEl.setText('Woah!')
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
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
		})
		form.createEl('br')
		form.createEl('br')
		form.createEl('label', { text: 'Client Secret: ' })
		const clientSecretElement = form.createEl('input', {
			type: 'password',
			attr: { id: 'clientSecret', name: 'clientSecret' },
		})
		form.createEl('br')
		form.createEl('br')
		const submitInputElement = form.createEl('input', {
			type: 'button',
			value: 'Authenticate',
		})
		submitInputElement.onClickEvent(async (el) => {
			stravaApi.config({
				access_token: '',
				client_id: '113274',
				client_secret: '',
				redirect_uri: 'http://localhost/callback',
			})
			var accessCode = ''
			const url = await stravaApi.oauth.getRequestAccessURL({
				scope: 'activity:read_all',
			})
			console.log('browse to ' + url)
			const window = new BrowserWindow({
				width: 600,
				height: 800,
				webPreferences: {
					nodeIntegration: false, // We recommend disabling nodeIntegration for security.
					contextIsolation: true, // We recommend enabling contextIsolation for security.
					// see https://github.com/electron/electron/blob/master/docs/tutorial/security.md
				},
			})

			const {
				session: { webRequest },
			} = window.webContents

			const filter = {
				urls: ['http://localhost/callback*'],
			}

			webRequest.onBeforeRequest(filter, async ({ url }) => {
				console.log(
					'user granted previleges to temp credentials (requestToken) ' +
						url
				)
				var redirectUrl = new URL(url)
				accessCode = redirectUrl.searchParams.get('code') ?? ''
				this.plugin.settings.authSetting.accessCode = accessCode
				console.log('got access code', accessCode)
				window.close()
			})

			window.loadURL(url)

			window.on('closed', async () => {
				console.log('window closed')

				if (accessCode == '') {
					console.log('failed to authorize user')
				} else {
					console.log('in else with access code', accessCode)
					stravaApi.config({
						access_token: '',
						client_id: '113274',
						client_secret:
							'a596836c309eb7f08067aa7504907664998c896f',
						redirect_uri: 'http://localhost/callback',
					})
					const token = await stravaApi.oauth.getToken(accessCode)
					stravaApi.config({
						access_token: token.access_token,
						client_id: '113274',
						client_secret:
							'a596836c309eb7f08067aa7504907664998c896f',
						redirect_uri: 'http://localhost/callback',
					})
					stravaApi.client(token.access_token)
					this.plugin.settings.authSetting.token = token
					console.log('token', token)
				}
			})
		})
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: StravaActivities

	constructor(app: App, plugin: StravaActivities) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		// new Setting(containerEl)
		// 	.setName('Setting #1')
		// 	.setDesc('It\'s a secret')
		// 	.addText(text => text
		// 		.setPlaceholder('Enter your secret')
		// 		.setValue(this.plugin.settings.mySetting)
		// 		.onChange(async (value) => {
		// 			this.plugin.settings.mySetting = value;
		// 			await this.plugin.saveSettings();
		// 		}));
		new Setting(containerEl)
			.setName('Connect Strava')
			.setDesc('Connect to your Strava')
			.addButton((button) =>
				button
					.setButtonText('Enter Application Details')
					// TODO: set button class
					.onClick((me) =>
						new StravaApplicationDetailsModal(
							this.app,
							this.plugin
						).open()
					)
			)
	}
}
