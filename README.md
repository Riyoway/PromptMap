# PromptMap

CSR-only visual placement compiler for AI image and UI generation prompts.

## Features
- Upload a reference image locally
- Place draggable pins and resizable regions
- Edit element instructions and constraint strength
- Export annotated PNG
- Compile and copy a structured prompt
- Save/load project JSON
- No backend, no uploads, no analytics

## Run
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
```
The static output is generated in `dist/` and can be hosted on GitHub Pages, Cloudflare Pages, Vercel, Netlify, or any static server.
