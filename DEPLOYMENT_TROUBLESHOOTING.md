# Deployment Troubleshooting Guide

## Current Issue: ERR_FAILED on Vercel

The site at https://dawa-college-exam-portal.vercel.app/ is showing ERR_FAILED error.

## Potential Causes & Solutions

### 1. Environment Variables Missing ⚠️
**Most Likely Cause**: The `GEMINI_API_KEY` environment variable is not set in Vercel.

**Solution**:
1. Go to your Vercel dashboard
2. Navigate to your project settings
3. Go to "Environment Variables" section
4. Add: `GEMINI_API_KEY` with your actual API key value
5. Redeploy the project

### 2. Build Issues ✅ FIXED
- **Status**: Build is now successful after Performance Dashboard removal
- **Verification**: `npm run build` completes without errors

### 3. Runtime Errors
**Check for**:
- Missing dependencies
- Import errors
- Service initialization failures

### 4. Vercel Configuration
**Current config** (vercel.json):
```json
{
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "framework": "vite"
}
```

## Debugging Steps

### Step 1: Check Vercel Build Logs
1. Go to Vercel dashboard
2. Check the latest deployment
3. Look for build errors or warnings

### Step 2: Check Environment Variables
1. Ensure `GEMINI_API_KEY` is set in Vercel
2. Verify the API key is valid

### Step 3: Test Local Build
```bash
npm install
npm run build
npm run preview
```

### Step 4: Check for Runtime Errors
1. Open browser developer tools
2. Check console for JavaScript errors
3. Check network tab for failed requests

## Quick Fix Commands

```bash
# Clean install and build
rm -rf node_modules package-lock.json
npm install
npm run build

# Test locally
npm run preview
```

## Environment Variables Required

- `GEMINI_API_KEY` - Required for AI features (can be empty string for basic functionality)

## Files Recently Modified

- Removed Performance Dashboard components
- Fixed TypeScript errors in ServiceLocator.ts
- Updated dependency injection configuration

## Next Steps

1. **Set environment variables in Vercel**
2. **Redeploy the project**
3. **Check browser console for errors**
4. **Verify Firebase connectivity**

If the issue persists, check the Vercel function logs and browser console for specific error messages.