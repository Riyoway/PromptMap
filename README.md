# PromptMap

PromptMap is a local-first visual prompt mapping tool for AI image generation, UI generation, and composition-heavy creative workflows.

Instead of describing placement only in words, you can drop in a reference image, mark exact points with pins, draw regions for larger areas, and attach instructions to each annotation. PromptMap then compiles those spatial notes into a structured prompt that is easier to hand to an image model, design tool, or UI generation workflow.

## Why PromptMap exists

Text prompts are good at describing intent, but they are often weak at describing layout. Phrases like "put this near the top left" or "keep the button under the hero image" can be interpreted loosely by generation tools.

PromptMap gives those instructions coordinates. It turns a reference image into a small visual specification:

- pins for exact placement
- boxes for areas and composition zones
- per-element constraints such as exact, near, flexible, or reference-only
- a compiled markdown-style prompt that explains both the global direction and each annotated position

The result is a lightweight bridge between visual thinking and prompt engineering.

## Core features

- Drag and drop a PNG, JPG, or WEBP reference image onto the canvas
- Upload or replace the reference image without sending it to a backend
- Place continuous pins for exact point annotations
- Draw resizable box regions for layout zones
- Select, multi-select, move, resize, and bulk-delete annotations
- Pan with right-drag and zoom with the mouse wheel
- Use a custom context menu for canvas and selection actions
- Edit global project direction and per-element prompt instructions
- Copy the compiled prompt
- Export an annotated PNG
- Export a ZIP package containing the prompt, source image, annotated image, and project JSON
- Save and reload `.promptmap.json` project files
- Install as a PWA on supported browsers

## Export ZIP contents

`Export ZIP` creates a portable package for sharing or archiving a prompt map:

- `prompt.md`  
  The compiled prompt plus an annotation table.

- `images/<reference-image>`  
  The original image that was uploaded or dropped into PromptMap.

- `images/<project>-annotated.png`  
  A rendered canvas image with all pins and regions visible.

- `project.promptmap.json`  
  Structured project data for restoring the map later.

## Typical workflow

1. Add a reference image.
2. Use `Pin` for precise locations and `Box` for regions.
3. Select each annotation and write what should happen there.
4. Adjust placement strength and constraints.
5. Copy the compiled prompt or export a ZIP for handoff.

## Privacy model

PromptMap runs entirely in the browser. Reference images and project files are handled locally by the app and are not uploaded to an application server.

The production page includes Google Analytics via `gtag.js` for basic site analytics. This does not change how PromptMap handles your image files or prompt map data locally.

## Tech stack

- React
- TypeScript
- Vite
- Konva / react-konva
- Zustand
- Lucide icons
- PWA manifest and service worker

## Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

The static output is generated in `dist/` and can be hosted on GitHub Pages, Cloudflare Pages, Vercel, Netlify, or any static server.

## Project status

PromptMap is an early, focused visual prompt compiler. The current version is intentionally lightweight: no account system, no backend storage, and no required cloud service.
