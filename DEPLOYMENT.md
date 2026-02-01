# Deployment Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   Create `.env.local`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Deploy the `dist` folder** to your hosting platform.

## Environment Variables

- `GEMINI_API_KEY` - Required for AI-powered performance insights

## Hosting Platforms

### Vercel (Recommended)
- Already configured with `vercel.json`
- Automatic deployments from GitHub

### Netlify
- Deploy the `dist` folder
- Add environment variables in dashboard

### GitHub Pages
- Build locally and push `dist` to `gh-pages` branch

## Production Checklist

- [ ] Environment variables configured
- [ ] Firebase project set up
- [ ] Build completes without errors
- [ ] All routes accessible
- [ ] Mobile responsiveness tested
- [ ] Print functionality working

## Support

For issues, check the main README.md or component documentation.