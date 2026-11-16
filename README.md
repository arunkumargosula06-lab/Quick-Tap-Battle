# Quick Tap Battle

A browser-based real-time multiplayer reaction game for 2–8 players.

## Features
- Create a six-character room code and invite friends.
- Join from another browser or device.
- Ten timed reaction rounds.
- Live player presence and score updates.
- Final leaderboard and winner announcement.
- Responsive desktop and mobile layout.

## Run locally
Open `index.html` in a modern browser with an internet connection. The game loads Supabase's JavaScript client from jsDelivr and uses Supabase Realtime.

## Free GitHub Pages deployment
1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/(root)`, then save.
4. Wait for the Pages deployment to complete. Expected URL:
   `https://arunkumargosula06-lab.github.io/Quick-Tap-Battle/`

## Supabase
The game uses Supabase Realtime Broadcast and Presence. The URL and publishable client key are configured in `script.js`. A publishable key is designed for browser use; never place a Supabase service-role key in client-side code. Ensure Realtime is enabled and the project's Realtime access settings allow the players you want to invite.

## Limitations
Room codes are temporary and exist only while the host is connected. Scores are coordinated by browser clients, so this version is intended for casual play, not cheat-resistant ranked competition. Competitive scoring needs trusted server-side validation.
