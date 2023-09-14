export function wait(minutes: number) {
	const milliseconds = minutes * 60 * 1000 // Convert minutes to milliseconds
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(`Waited for ${minutes} minutes.`)
		}, milliseconds)
	})
}
