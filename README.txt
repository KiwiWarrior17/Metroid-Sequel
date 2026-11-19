ECHOES OF THE DEEP — CRASH BASIN MOBILE WEB BUILD
=================================================

WHAT THIS IS
------------
A mobile-optimized static web build of the current Crash Basin prototype.
It includes the C11 gameplay core compiled to WebAssembly, the Canvas renderer,
touch controls, a phone-friendly layout, and an optional offline cache after the
first successful load.

FILES
-----
index.html             Launch page
 game.js               Canvas renderer, keyboard and touch controls
 eod.wasm              Compiled C gameplay core
manifest.webmanifest   Add-to-Home-Screen metadata
sw.js                 Offline cache (requires HTTPS or localhost)
icon.svg               App icon

HOW TO PUBLISH IT
-----------------
This folder is ready for any static HTTPS host. Upload the CONTENTS of this
folder (not the enclosing folder) to a static site host. No server-side code,
Node installation, or build step is required.

For Netlify Drop:
1. Extract this ZIP so you have the EOD_Crash_Basin_Mobile folder.
2. Open https://app.netlify.com/drop in a browser and sign in if prompted.
3. Upload/drag the extracted folder to the page.
4. Netlify will provide a public HTTPS URL. Open that URL on the iPhone.

For GitHub Pages:
1. Create a repository and upload all files in this folder to its root.
2. In repository Settings > Pages, deploy from the main branch and root folder.
3. Open the published HTTPS URL on the iPhone.

HOW TO PLAY ON IPHONE
---------------------
1. Open the published HTTPS URL in Safari.
2. Rotate to landscape for the largest play area (portrait also works).
3. Use the on-screen buttons. Hold LEFT/RIGHT while pressing JUMP or BEAM.
4. To install it like an app: Safari Share > Add to Home Screen.
5. After the first successful load, the service worker caches the game files;
   subsequent loads may work offline. Progress itself is session-only and is
   not saved between browser sessions in this prototype.

CONTROLS
--------
LEFT / RIGHT   Move
UP / DOWN AIM  Aim weapon
JUMP           Jump
BEAM           Fire beam
MISSILE        Fire missile (once acquired)
MORPH          Toggle Morph Ball (once acquired)
BOMB           Drop bomb (once acquired)
MAP            Open map (once unlocked)
PAUSE          Pause/unpause

IMPORTANT
---------
This ZIP is ready to publish, but it is not itself a public website. ChatGPT
cannot publish it to a public hosting account or create a public URL on your
behalf. A static HTTPS host is required because mobile browsers generally do
not allow a local ZIP/file:// page to fetch and run its WebAssembly file.

This is the browser prototype, not an SNES ROM. It remains a blockout build;
visuals, content, and persistence are still under development.
