# Developer tools

## bake-story-gifs.tsx

The intro story scenes (`src/components/game/StoryAnimation.tsx`) are shipped as real GIF files in
`src/assets/story/`. They are drawn by the game's own `drawScene()` and encoded by this tool, so the GIFs
look exactly like the live canvas version. **If you change how a scene is drawn, bake it again.**
(The canvas version stays in the game as a fallback if a GIF fails to load.)

Scenes: `briefing`, `launch`, `coast`, `orbit`, `fail`, `fall`, `land`, `stranded`.
Output: 320×160, 88 frames at 12.5 fps (one 7 s loop), looping forever, about 0.2–1 MB each.

### How to bake one scene

1. Start the dev server: `npm run dev` (it prints the port, e.g. 5174).
2. Serve this tiny page from any other port (it only has to load the tool from the dev server):

   ```html
   <!doctype html><html><head><meta charset="utf-8"></head><body><script type="module">
   import RefreshRuntime from "http://localhost:5174/@react-refresh";
   RefreshRuntime.injectIntoGlobalHook(window);
   window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (t) => t;
   window.__vite_plugin_react_preamble_installed__ = true;
   await import("http://localhost:5174/tools/bake-story-gifs.tsx");
   </script></body></html>
   ```

3. Open it in headless Chrome/Edge and dump the page. The page ends up containing the GIF as base64:

   ```
   msedge --headless=new --user-data-dir=<tmp> --virtual-time-budget=60000 --dump-dom "http://localhost:8099/?scene=stranded" > stranded.html
   ```

4. Decode the text inside `<pre id="gif">…</pre>` from base64 and save it as `src/assets/story/<scene>.gif`.

Check the result with any GIF viewer: it must show 88 frames, 320×160, looping.
