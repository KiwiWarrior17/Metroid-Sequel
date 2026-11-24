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
audio/eod_audio.js     Original procedural Web Audio engine

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
   subsequent loads may work offline. Checkpoint progress is saved locally in
   this browser profile when you activate a save station; it does not sync.

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
PHASE          Phase through root barriers (once unlocked)
PAUSE          Pause/unpause

IMPORTANT
---------
This ZIP is ready to publish, but it is not itself a public website. ChatGPT
cannot publish it to a public hosting account or create a public URL on your
behalf. A static HTTPS host is required because mobile browsers generally do
not allow a local ZIP/file:// page to fetch and run its WebAssembly file.

This is the browser prototype, not an SNES ROM. It remains a blockout build;
visuals, content, and persistence are still under development.

MILESTONE 1.5 UPDATE
--------------------
This build includes the updated Crash Basin gameplay core. The map terminal in
Basalt Crossing has been moved onto the reachable upper basalt shelf. The
service-worker cache is versioned v2 so an already-installed mobile site will
fetch the updated game files on its next visit. Progress remains session-only.

BOSS ROOM UNLOAD FIX
--------------------
The Burrower is only drawn while the player is in room 01-09 The Nest.
Leaving the arena or respawning at a checkpoint hides the boss and clears its
active projectiles. Its unfinished fight state is retained and resumes if the
player returns; a defeated Burrower remains permanently defeated. The service
worker cache version was incremented so this update replaces the prior build.


Browser save persistence (Milestone 1.7): activating a checkpoint writes the paired C save records to this browser device using localStorage. Reloading the app restores the last activated checkpoint, energy snapshot, equipment, explored rooms, collected pickups, and destroyed Bomb blocks. Saves do not sync between browsers/devices. Clearing site data removes the local save.

Implementation note: the browser frontend uses the same paired C save format as the native tests. Checkpoint activation triggers the C save commit; the WebAssembly save buffer is persisted in localStorage and loaded on startup. The save contains a CRC/sequence/commit-validated player record and room-state record. If browser storage is unavailable, gameplay continues but saving is unavailable.

Milestone 1.8 presentation update:
- Eased camera follow with room-transition snap
- Layered cavern parallax and drifting bioluminescent motes
- Animated player run/airborne/morph poses and suit glow
- Subtle enemy idle motion and room-entry pulse
- Updated WebAssembly renderer bridge; service worker cache v5


MILESTONE 1.9 PRESENTATION UPDATE
---------------------------------
This build adds articulated, state-driven player poses (run, jump/fall, aim,
and Morph Ball), distinct animated silhouettes for all five ordinary enemy
types, and short-lived visual effects for shots, enemy defeats, boss hits, and
player damage. Impact feedback includes restrained screen shake. These effects
are renderer-only and do not change combat timing, collision, or physics.
The service-worker cache is versioned v6.

Milestone 2.0 environmental feedback: surface-specific beam/missile impact sparks, bomb detonation flash/debris/shock ring, rubble fragments for removed bomb blocks, animated energy-door cores, and v7 offline cache. Desktop and mobile renderers are identical.

MILESTONE 2.1 AUTHORED SPRITES AND ROOM ATMOSPHERE
-------------------------------------------------
The player and five ordinary enemy types now use a shared authored pixel-art
atlas. Player frames respond to idle/run/jump/fall/Morph Ball state; enemies
have two-frame animation cycles. Sinkhole Shaft has dusty light shafts,
Cracked Reservoir has moving water caustics and bubbles, and The Nest has
organic veins and drifting spores. These are cosmetic only and do not alter
gameplay or collision. The atlas is included at assets/actor_atlas.png and is
precached by service-worker cache v8. Browser checkpoint saves continue to
use localStorage on this browser/device.


MILESTONE 2.2 — REBUILT PIXEL ART
---------------------------------
This version replaces the first tiny placeholder atlas with larger authored pixel-art frames. It includes a 40x40-cell player/enemy atlas and a separate three-frame Burrower boss atlas. Both are loaded by the renderer and precached for offline use. The cache is v9. No gameplay rules or save data changed.

MILESTONE 2.2 REFERENCE SPRITE CORRECTION (2026-11-20)
-----------------------------------------------------
The shared actor atlas now uses the supplied blue-armored player and five
provided enemy designs. The two Morph Ball frames are also taken from that
sheet. The Burrower boss keeps its separate atlas. The service-worker cache
was advanced to v10 so previously installed mobile builds refresh the art.

MILESTONE 3.2 — PRISM PHASE
--------------------------
The Prism Sentinel's Prism Core now unlocks Prism Phase. Press L on desktop or
PHASE on the mobile touch controls to activate a 90-frame pulse that lets the
player pass through phase-root barriers. The ability has a 180-frame cooldown.
Two optional Missile Tanks are hidden behind phase-root barriers in 01-06 and
02-02. The regional map marks the rooms containing phase seals until Prism
Phase is acquired. The mobile offline cache is v20.

MILESTONE 3.6 — WORLD INTEGRATION
--------------------------------
The Pressure Regulator now opens a bidirectional shortcut between Drowned
Index (03-03) and Rootbound Grotto (02-03). The shortcut is locked in both
directions until the Archive Warden is defeated. A Missile Tank is hidden in
the Drowned Index pressure-block niche and persists after collection. The
regional map displays the shortcut and pressure-gate marker. Offline cache v24.


MILESTONE 3.7 COMBAT GEOMETRY UPDATE
------------------------------------
Hostile enemy and boss projectiles now stop at solid room geometry, including
sealed doors and ability barriers, instead of passing through cover. Clear
firing lanes still behave normally. The offline cache was advanced to
v25 so the updated WebAssembly gameplay core is fetched on the next load.

MILESTONE 3.8 ENEMY TERRAIN NAVIGATION
--------------------------------------
Ordinary enemies now collide with the authored room geometry while moving.
Flying enemies turn at solid walls and sealed ability barriers. Burrowling
rushes stop at walls or unsupported floor lanes and enter retreat. The offline
cache was advanced to v26 for the updated WebAssembly gameplay core.

MILESTONE 3.9 SPECIES-SPECIFIC SURFACE MOVEMENT
------------------------------------------------
Shard Crawlers now detect adjacent solid floors, ceilings, and vertical walls,
then crawl along the attached surface while retaining their armored ranged
attack. If no surface is present, they keep their previous stationary turret
behavior. The offline cache has been advanced to v27 so the updated WebAssembly
gameplay core is fetched on the next load.

MILESTONE 4.0 — SPECIES-SPECIFIC MOVEMENT
----------------------------------------
Shard Crawlers can now turn between connected floor, wall, and ceiling
surfaces. Cave Scuttlers can hop short gaps when a landing surface is nearby.
Reservoir Leeches drift and bob in the authored water-linked rooms, then
retreat after lunging at the player. The water behavior is room-contextual;
it is not a full liquid simulation. The mobile offline cache is v28.

MILESTONE 4.1 — ENCOUNTER TACTICS
--------------------------------
Silt Rays now pause for a 24-frame warning before firing an aimed shot, then
enter recovery with a firing cooldown. Their shots are absorbed by solid room
geometry and sealed ability barriers. Cave Mites abort dives when blocked by
room geometry and enter recovery rather than pushing against walls. The mobile
offline cache is v29.

MILESTONE 4.2 — ENEMY GROUP REACTIONS
------------------------------------
When an ordinary enemy is successfully hit, its nearest eligible nearby ally
can react using its species behavior. Cave Mites show an 18-frame warning
before diving, Burrowlings can emerge, and other species use their existing
alert responses. Only one ally reacts per hit; distant enemies do not join.
The mobile offline cache is v30.


MILESTONE 4.3 — ATTACK-LANE SPACING
----------------------------------
Cave Mites, Reservoir Leeches, and Burrowlings now stagger nearby dive, lunge,
and rush attacks. One nearby attacker may occupy a local lane; another waits
12 frames before retrying. Distant enemies do not block one another. Existing
room rosters, damage values, bosses, and save data are unchanged. Offline cache
v31 fetches the updated WebAssembly core.


MILESTONE 4.4 — VERTICAL-LANE ENCOUNTER TACTICS
------------------------------------------------
Enemy activation now respects the player's elevation as well as horizontal
proximity. Burrowlings wait until the player is near their floor lane before
emerging; Reservoir Leeches only begin a lunge when the player is within their
vertical engagement band; and Shard Crawlers only telegraph shots when the
player is within a practical firing elevation. Cave Mites retain their ability
to dive between nearby elevations, with a bounded vertical acquisition range.
The mobile offline cache is v32 so the updated gameplay core is fetched.
