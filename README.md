# HexaConquest - Location-Based Strategy Game

A responsive web and mobile strategy game built with Next.js, TypeScript, and Mapbox where players conquer hexagonal territories using their real-world location.

## 🎮 Features

- **Real-time Geolocation**: Uses browser geolocation API to track player position
- **Interactive Map**: Powered by Mapbox with custom hexagonal grid overlay
- **Offline Support**: IndexedDB for local data persistence without backend
- **Responsive Design**: Optimized for both desktop and mobile devices
- **PWA Ready**: Progressive Web App capabilities for mobile installation
- **Real-time HUD**: Displays player stats, position, and game status

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Modern web browser with geolocation support

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mapgo
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

5. Allow location permissions when prompted

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with metadata
│   ├── page.tsx           # Main game page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── HUD.tsx           # Heads-up display component
│   └── Map.tsx           # Mapbox map component
├── hooks/                 # Custom React hooks
│   └── useGameState.ts   # Game state management hook
├── types/                 # TypeScript type definitions
│   └── index.ts          # Shared types
└── utils/                 # Utility functions
    ├── geolocation.ts    # Geolocation API wrapper
    ├── indexedDB.ts      # IndexedDB operations
    └── mapbox.ts         # Mapbox map utilities
```

## 🗺️ Core Modules

### Geolocation Module (`src/utils/geolocation.ts`)

Handles browser geolocation API with error handling and position watching:

```typescript
import { getCurrentPosition, watchPosition, clearWatch } from '@/utils/geolocation';

// Get current position once
const position = await getCurrentPosition();

// Watch position changes
const watchId = watchPosition(
  (position) => console.log('New position:', position),
  (error) => console.error('Geolocation error:', error)
);

// Stop watching
clearWatch(watchId);
```

### IndexedDB Module (`src/utils/indexedDB.ts`)

Provides local storage for game data without requiring a backend:

```typescript
import { savePlayerPosition, getLatestPlayerPosition, savePlayerState } from '@/utils/indexedDB';

// Save player position
await savePlayerPosition({
  latitude: 40.7128,
  longitude: -74.0060,
  timestamp: Date.now(),
  accuracy: 10
});

// Get latest position
const position = await getLatestPlayerPosition();

// Save player state
await savePlayerState({
  id: 'player-1',
  position: position,
  health: 100,
  score: 1500,
  level: 3
});
```

### Mapbox Module (`src/utils/mapbox.ts`)

Initializes and manages Mapbox map with game-specific features:

```typescript
import { initializeMap, updatePlayerMarker, addHexGrid } from '@/utils/mapbox';

// Initialize map
const map = initializeMap('map-container', {
  center: [longitude, latitude],
  zoom: 15
});

// Add player marker
updatePlayerMarker(map, position);

// Add hex grid overlay
addHexGrid(map, [longitude, latitude]);
```

## 🎯 Game Mechanics

### Hexagonal Grid System

The game overlays a hexagonal grid on the real-world map:
- Each hex represents a territory that can be conquered
- Hexes change color based on ownership status
- Players can interact with hexes by tapping/clicking

### Player Progression

- **Health**: Decreases over time, can be restored by conquering territories
- **Score**: Increases by conquering hexes and completing objectives
- **Level**: Advances based on score milestones

### Data Persistence

All game data is stored locally using IndexedDB:
- Player positions (last 100 locations)
- Player state (health, score, level)
- Game settings and preferences

## 📱 Mobile Optimization

### PWA Features

- **Installable**: Can be installed as a native app on mobile devices
- **Offline Support**: Core functionality works without internet connection
- **Responsive Design**: Adapts to different screen sizes and orientations

### Touch Controls

- Tap hexes to interact
- Pinch to zoom
- Drag to pan
- Pull-to-refresh for position updates

## 🔧 Configuration

### Mapbox Setup

The Mapbox access token is configured in `src/utils/mapbox.ts`:

```typescript
const MAPBOX_TOKEN = 'pk.eyJ1IjoiNDIwYnRjIiwiYSI6ImNtOTN3ejBhdzByNjgycHF6dnVmeHl2ZTUifQ.Utq_q5wN6DHwpkn6rcpZdw';
```

### Environment Variables

For production, consider using environment variables:

```bash
# .env.local
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically on push

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler
```

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Tailwind CSS for styling
- Modular component architecture

## 🔒 Security Considerations

- Geolocation permissions are requested explicitly
- No sensitive data is stored in localStorage
- Mapbox token is client-side (consider server-side proxy for production)
- Input validation for all user interactions

## 🐛 Troubleshooting

### Common Issues

**Geolocation not working:**
- Ensure HTTPS is enabled (required for geolocation)
- Check browser permissions
- Verify location services are enabled on device

**Map not loading:**
- Check Mapbox token validity
- Verify internet connection
- Check browser console for errors

**Performance issues:**
- Reduce hex grid density
- Implement position update throttling
- Clear old IndexedDB data regularly

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the documentation

---

**Built with ❤️ using Next.js, TypeScript, Mapbox, and Tailwind CSS**
