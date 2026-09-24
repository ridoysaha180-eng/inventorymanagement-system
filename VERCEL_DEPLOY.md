# Vercel Deployment

This project is configured for Vercel as a Vite/React application.

## Settings
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Node: 20+

## Firebase
The app reads its Firebase configuration from `firebase-applet-config.json`.
After deployment, add the Vercel domain (for example `your-project.vercel.app`) to Firebase Authentication > Settings > Authorized domains.

## Gemini
If Gemini is enabled later, do not commit a real API key. Add `GEMINI_API_KEY` in Vercel Project Settings > Environment Variables and move privileged Gemini calls to a server-side endpoint.
