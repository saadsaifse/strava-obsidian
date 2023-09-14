import { EventEmitter } from 'events'
import TypedEmitter, { EventMap } from 'typed-emitter'

interface MessageEvents extends EventMap {
	activitiesRetrieved: (activities: any[]) => void
	activityRetrieved: (activity: any) => void
	activitiesSynced: () => void
	oauthTokenUpdated: (token: any) => void
}

export const ee = new EventEmitter() as TypedEmitter<MessageEvents>
