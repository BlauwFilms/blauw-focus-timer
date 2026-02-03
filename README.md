# Creative Focus Timer | Blauw Films

A minimal, calm, and functional focus timer designed with Dieter Rams × MUJI aesthetics. Built for filmmakers, writers, designers, developers, artists, and students.

## Features

- **Pomodoro Timer** — Customizable focus/break cycles
- **Countdown Timer** — Single duration countdown
- **Stopwatch** — Open-ended time tracking
- **Breathing Exercise** — 4-7-8, Box, and Energizing patterns
- **Task Management** — Drag-and-drop reordering, single-task focus
- **Fullscreen Mode** — Distraction-free focus backdrop
- **Picture-in-Picture** — Floating window outside the browser
- **Session Persistence** — Automatic save and recovery
- **Statistics** — Daily focus time, tasks completed, pomodoros

## Setup Instructions

### Step 1: Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name your repository (e.g., `blauw-focus-timer`)
3. Set it to **Public**
4. Click "Create repository"

### Step 2: Upload Files

Upload these files to your repository:
- `focus-timer.css`
- `focus-timer.html`
- `focus-timer.js`

You can drag and drop files directly in GitHub, or use:
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 3: Add to Webflow

1. Open your Webflow project
2. Add an **Embed** element where you want the timer
3. Copy the contents of `webflow-embed-loader.html`
4. Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username
5. Paste into the Embed element
6. Publish your site

### Example Embed Code

```html
<div id="focus-timer-root"></div>

<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/yourusername/blauw-focus-timer@main/focus-timer.css">

<script>
(function() {
  fetch('https://cdn.jsdelivr.net/gh/yourusername/blauw-focus-timer@main/focus-timer.html')
    .then(response => response.text())
    .then(html => {
      document.getElementById('focus-timer-root').innerHTML = html;
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/gh/yourusername/blauw-focus-timer@main/focus-timer.js';
      document.body.appendChild(script);
    })
    .catch(err => console.error('Failed to load Focus Timer:', err));
})();
</script>
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start/Pause timer or breathing |
| `R` | Reset |
| `S` | Skip (timer modes only) |
| `F` | Toggle fullscreen |
| `P` | Toggle Picture-in-Picture |
| `Escape` | Exit fullscreen |

## Customization

The timer uses Blauw Films design tokens. To customize colors, edit these values in `focus-timer.css`:

```css
/* Primary button color */
background: #1451eb;  /* Default */
background: #112347;  /* Hover */

/* Backgrounds */
background: #f9f9f9;  /* Body */
background: #ececec;  /* Container */
border-color: #dadada; /* Borders */
```

## Cache Busting

jsDelivr caches files. To force an update after changes:

1. Create a new release/tag in GitHub
2. Update the URL to use the specific version:
   ```
   https://cdn.jsdelivr.net/gh/username/repo@v1.0.1/focus-timer.css
   ```

Or purge the cache manually:
```
https://purge.jsdelivr.net/gh/username/repo@main/focus-timer.css
```

## License

Built for Blauw Films. All rights reserved.
