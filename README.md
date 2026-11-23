# Pappy Run · Home Base

A GitHub Pages PWA for the 2026 Louisville Kroger Pappy drawing. It loads the 17-stop Home Base route and two optional stops. Tap **Directions** at any stop to open Google Maps, then tap **Done** after entering. **Undo** reopens a completed stop.

**Use my location** finds the closest unfinished planned stop by straight-line distance. It leaves the planned route order in place. The app asks for location only when you tap the button and uses the coordinates in memory. It saves your completed stops in your browser. No account or Maps API key is required.

## Run locally

From this folder, run:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://localhost:8765`. Use an HTTPS host for testing on a phone.

## Publish to GitHub Pages

With the GitHub CLI installed, run these commands from this folder:

```sh
gh auth login --hostname github.com --web
git init -b main
git add .
git commit -m "Build Pappy Run Home Base PWA"
gh repo create kroger-pappy-home-base --public --source=. --remote=origin --push
gh api --method POST 'repos/{owner}/{repo}/pages' -f 'source[branch]=main' -f 'source[path]=/' --jq .html_url
```

These commands create a public repository. The site URL appears under **Settings → Pages** when the first deployment completes. To enable Pages in the browser, select **Deploy from a branch**, then **main** and **/ (root)**.

## Install on a phone

- **iPhone or iPad** · Open the HTTPS Pages URL in Safari. Tap **Share → Add to Home Screen** and turn on **Open as Web App** if shown.
- **Android** · Open the HTTPS Pages URL in Chrome. Tap **Install** in the app or choose **Install app** from the browser menu.

The checklist and addresses work offline after a successful online load. Google Maps handles directions separately. Progress is specific to the browser or installed app and the site's URL.

When updating the app shell, increase the cache version in `sw.js` so existing installations pick up the new files.
