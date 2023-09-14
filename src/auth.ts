import {
	default as stravaApi,
	RateLimiting,
	AuthenticationConfig,
} from 'strava-v3'
import { Notice, ObsidianProtocolData } from 'obsidian'
import { ee } from './eventEmitter'
import { isNumber } from 'lodash'

export interface Token {
	token_type: string
	expires_at: number
	expires_in: number
	refresh_token: string
	access_token: string
	athlete: any
}

class Auth {
	private token: Token | null
	private code: string
	private authConfig: AuthenticationConfig

	constructor() {}

	async validateToken() {
		if (!this.token || !this.token.access_token) {
			throw Error('Please login first')
		}
		if (this.token.expires_in < 10) {
			const refreshResponse = await stravaApi.oauth.refreshToken(
				this.token.refresh_token
			)
			this.token = Object.assign(this.token, refreshResponse, this.token)
			this.onTokenUpdated(this.token)
		}
	}

	validateUtilization(rateLimiting: RateLimiting) {
		const usageFraction = rateLimiting.fractionReached()
		console.log(`Strava API usage fraction reached: ${usageFraction}`)

		//if (rateLimiting.exceeded()) return false

		// happens when no usage data is available
		if (isNaN(usageFraction)) return true

		if (usageFraction < 0.8) {
			return true
		}

		return false
	}

	async authenticate(authConfig: AuthenticationConfig) {
		this.authConfig = authConfig
		stravaApi.config(authConfig)
		const url = await stravaApi.oauth.getRequestAccessURL({
			scope: 'activity:read_all',
		})
		await open(url, undefined)
	}

	async OAuthCallback(args: ObsidianProtocolData) {
		if (args.scope != 'read,activity:read_all') {
			new Notice('Please authorize required permissions.')
			return
		}
		try {
			this.code = args.code
			const token = await stravaApi.oauth.getToken(args.code)
			this.onTokenUpdated(token)
			new Notice('Authenticated with Strava')
		} catch (err) {
			new Notice('Could not authenticate user')
		}
	}

	isSignedIn() {
		return (
			this.token && this.token.access_token && this.token.expires_in > 0
		)
	}

	private onTokenUpdated(token: Token | null) {
		this.token = token
		ee.emit('oauthTokenUpdated', token)
		this.authConfig.access_token = token?.access_token ?? ''
		stravaApi.config(this.authConfig)
		stravaApi.client(this.authConfig.access_token)
	}
}

const authInstance = new Auth()

export default authInstance
