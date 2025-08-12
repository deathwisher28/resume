Detective Resume — Starter Package
===================================

Contents:
- index.html
- style.css
- app.js
- config.json
- assets/ (icons + sample audio placeholders)
- README.md

How to run locally
------------------
This project uses fetch('config.json'), so open via a local server:

1) Python 3:
   cd path/to/unzip
   python -m http.server 8000
   Open http://localhost:8000 in your browser

2) VSCode Live Server:
   Install Live Server extension, open the folder, and choose "Open with Live Server".

Editing content
---------------
- Edit `config.json` to change hotspot positions (percentages), dialog lines, sequence order,
  or the icon paths. Replace icon files in assets/svg/ to change visuals.

Assets & Audio
--------------
- The package includes simple SVG icons and no external BGM files. SFX used are synthesized
  via the WebAudio API in app.js (simple beeps) so no external audio files are required.
- To add external audio, extend config.json with entries for 'audio' and update app.js to load them.

Deployment
----------
This is a static site and can be hosted on any static host:
- GitHub Pages
- Netlify (drag and drop)
- Vercel / Cloudflare Pages

License & Credits
-----------------
Placeholder assets included. Replace them with your artwork as needed.
