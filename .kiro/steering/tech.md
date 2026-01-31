# Technology Stack & Build System

## Core Technologies

- **Frontend Framework**: React 19.2.3 with TypeScript
- **Build Tool**: Vite 6.2.0 with ES modules
- **Styling**: Tailwind CSS (utility-first approach)
- **Charts**: Recharts 3.7.0 for data visualization
- **Icons**: Font Awesome (via CDN)

## Backend & Data

- **Database**: Firebase Firestore (cloud) + localStorage (local fallback)
- **AI Integration**: Google Gemini AI (@google/genai) for performance analysis
- **File Processing**: XLSX library for Excel import/export
- **Authentication**: Simple credential-based admin access

## Development Environment

- **Node.js**: Required for development
- **TypeScript**: Strict typing with ES2022 target
- **Module System**: ESNext with bundler resolution
- **Path Aliases**: `@/*` maps to project root

## Common Commands

```bash
# Install dependencies
npm install

# Start development server (port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Configuration

- **Required**: `GEMINI_API_KEY` in `.env.local` for AI features
- **Firebase**: Configuration embedded in `firebaseConfig.ts`
- **Development**: Runs on `http://localhost:3000` with host `0.0.0.0`

## Build Configuration

- **Vite Config**: Custom alias setup, environment variable injection
- **TypeScript**: Experimental decorators enabled, DOM types included
- **Output**: Static files optimized for deployment

## Key Dependencies

- **Runtime**: React, React-DOM, Firebase SDK, Google GenAI
- **Development**: Vite React plugin, TypeScript, Node types
- **Data**: XLSX for spreadsheet operations, Recharts for visualization