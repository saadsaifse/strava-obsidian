# Strava Activities Plugin for Obsidian

This plugin enables downloading and visualizing your Strava activities to your Obsidian vault.

## Installation

### Option 1: Manual Installation (Recommended)
Since this plugin is not yet available in the Obsidian Community Plugin store, you'll need to install it manually:

1. Download the latest release from the [GitHub releases page](https://github.com/saadsaifse/strava-obsidian/releases)
2. Extract the files to your vault's plugins folder: `VaultFolder/.obsidian/plugins/strava-activities/`
3. The folder should contain: `main.js`, `styles.css`, `manifest.json`
4. Restart Obsidian or reload the app
5. Go to Settings → Community Plugins and enable "Strava Activities"

### Option 2: BRAT Plugin (Alternative)
You can also install using the BRAT (Beta Reviewer's Auto-update Tool) plugin:
1. Install BRAT from the Community Plugins
2. Add this repository: `saadsaifse/strava-obsidian`
3. Enable the plugin in Settings → Community Plugins

## Setup and Usage

1. **Create Strava API Application**: Login to your Strava account and visit https://www.strava.com/settings/api to create your API application. Use these values:

    ```yaml
    Application Name: Obsidian Strava Plugin (or any descriptive name)
    Category: Other
    Website: https://github.com/saadsaifse/strava-obsidian
    Authorization Callback Domain: obsidianforstrava
    ```

    **Note for Application Name**: Strava has strict brand guidelines. Use a descriptive name like "Obsidian Strava Plugin", "Personal Strava Sync", or "My Strava Data". Avoid using just "Strava" as this violates their brand guidelines.

    Once created, note your `Client ID` and `Client Secret`.

2. **Configure Plugin**: Go to Settings → Strava Activities and enter your Client ID and Client Secret, then click Save.

3. **Authenticate**: Click the Authenticate button to complete OAuth authorization in your browser.

4. **Sync Activities**: Click the Strava icon in the left ribbon to synchronize your activities.

## Features

### Core Functionality
1. **Activity Sync**: Download summaries of all your Strava activities with smart sync that prevents missing backdated uploads
2. **Detailed Activities**: Get detailed activity information including segment data via right-click context menu
3. **YAML Frontmatter**: Activities now include YAML frontmatter for easy Dataview queries and property-based filtering
4. **Daily Note Integration**: Each activity automatically links to daily notes using `[[YYYY-MM-DD]]` format
5. **Map Visualization**: View activity routes on interactive Leaflet maps (requires Obsidian Leaflet plugin)

### File Structure
Activities are organized in a clean directory structure:
```
Vault/
  Strava/
    2023-09-17/           # Activity date
      0123456789/         # Activity ID
        Summary.md        # Activity summary with YAML frontmatter
        Detailed.md       # Detailed activity data (created on demand)
        map.geojson       # Route data for map visualization
```

### Available Commands
- **Synchronize Strava Activities**: Smart sync that checks for new activities and backdated uploads
- **Force Resync All Activities**: Complete resync of all activities (useful for troubleshooting)
- **Insert Today's Strava Activities**: Add today's activities to your current note
- **Insert Today's Strava Activity Maps**: Add only the maps from today's activities
- **Authenticate with Strava**: Set up or refresh your Strava connection

### YAML Frontmatter Support
Each activity file now includes structured YAML frontmatter with key metrics:
```yaml
---
activity_id: 1234567890
name: "Morning Run"
sport_type: "Run"
start_date: "2023-09-17T06:30:00Z"
distance: 5000.0
moving_time: 1800
average_speed: 2.78
average_heartrate: 145
total_elevation_gain: 50.0
---
```

This enables powerful Dataview queries like:
```dataview
TABLE name, distance, average_speed, average_heartrate
FROM "Strava"
WHERE sport_type = "Run" AND distance > 5000
SORT start_date DESC
```

### Smart Sync Features
- **Incremental Sync**: Only downloads new activities since last sync
- **Backfill Detection**: Automatically checks last 30 days for activities uploaded with earlier dates
- **Duplicate Prevention**: Filters out activities that already exist in your vault
- **Detailed Sync Feedback**: Shows total activities synced and how many were backfilled



## Known Bugs

1. The leaflet map doesn't open centered. This is a bug in the Obsidian Leaflet plugin. Until that's fixed, please click on the Reset Zoom button on the left of map to zoom to the activity map.

## Funding URL

Hi 👋🏼, if I made your life easier, consider buying me a coffee :) https://www.buymeacoffee.com/saadsaif


## Developing

Quick starting guide for new plugin devs:

- Install NodeJS, then run `npm i` in the command line under the repo folder.
- Run `npm run dev` to compile the plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin. Or use the hot reload plugin to load changes as they occur https://github.com/pjeby/hot-reload.
- Enable plugin in settings window.

## Releasing

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. E.g.,
  ```
  git tag -a 1.0.0 -m "1.0.0"
  git push origin 1.0.0
  ```
- Github actions will execute upon pushing a new tag and will create a draft release on Github.
- Specify release notes on github and publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

## Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

## Obisdian API Documentation

See https://github.com/obsidianmd/obsidian-api
