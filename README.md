An interactive 3D map of Stockholm with real-time data from SL (Stockholm public transport), weather, sun position, and aircraft. Fly around as a drone, play a guessing game, or use a command terminal for control.

**Visit:** [sthlm.fun](https://sthlm.fun/)

## Features

### 3D Map Navigation
- Interactive 3D visualization of Stockholm with terrain and buildings
- Real-time data from multiple APIs integrated into the map
- Telemetry panel displaying coordinates, altitude, zoom level, camera angle, and FPS

### Flight Radar (ADS-B)
- View active aircraft within 110 km of Stockholm
- Real-time data from adsb.lol
- Click on aircraft for details and follow them on the map

### Weather and Sun
- Real-time weather data from Open-Meteo
- Sun tracking with sunrise, sunset, sun position, and shadows
- Dynamic shadows on the map that follow the sun
- Toggle between real weather and simulated weather (rain, snow, thunderstorms)

### Public Transport (SL)
- Real-time data from SL APIs
- Stop registry for all stations in Stockholm
- See when the next bus, subway, or tram arrives

### FPV Mode (First-Person View)
- Fly freely as a drone using WASD or game controller
- Click and drag to control camera
- Altitude warning when approaching ground
- Perfect for exploring Stockholm from new angles

### Sthlm-Guessr Game
- Gameplay where you see a random location in Stockholm
- Guess the location on a minimap
- Scoring system and leaderboard saved in your browser
- 5 rounds per game

### Command Terminal
- Type commands to navigate (fly to [place])
- Change time (time 14:30)
- Activate weather effects (fx rain)
- Voice control in Swedish (type help for all commands)

### Voice Control
- Swedish speech recognition
- Say commands such as:
  - "fly to Globen" (flyg till Globen)
  - "show weather" (visa väder)
  - "enable shadows" (aktivera skuggor)
  - "play Guessr" (spela Guessr)
  - "drone" (drönare)

## Technology

| Component | Technology |
|-----------|-----------|
| Frontend | JavaScript (modular, ES6+) |
| 3D Rendering | MapLibre GL + WebGL |
| Map | OpenStreetMap tiles + 3D terrain |
| Styling | CSS3 (custom properties, glasomorphism) |
| Backend Scripts | Python 3 (fetch and cache data) |

### External APIs
- adsb.lol - Aircraft information (ADS-B)
- SL Transport API - Public transport data
- Open-Meteo - Weather data
- OpenStreetMap - Map data

## Project Structure

```
sthlm.fun/
├── index.html              # Main page (semantic HTML5)
├── assets/
│   ├── js/                 # JavaScript modules
│   │   ├── main.js         # Main module and initialization
│   │   ├── map.js          # 3D map functionality
│   │   ├── planes.js       # Aircraft monitoring
│   │   ├── weather.js      # Weather integration
│   │   ├── sun.js          # Sun and moon calculations
│   │   ├── sl.js           # Public transport API
│   │   ├── terminal.js     # Command terminal
│   │   ├── voice.js        # Voice control
│   │   ├── fpv.js          # Drone mode
│   │   ├── guessr.js       # Guessr game
│   │   ├── hud.js          # HUD elements
│   │   └── ...             # Other modules
│   └── css/
│       └── app.css         # All styles (responsive design)
├── data/                   # Generated data (gitignored)
│   ├── planes.json         # Cached aircraft data
│   └── sl-sites.json       # Cached SL stop registry
├── tools/                  # Backend scripts
│   ├── planes-feed.py      # Fetch aircraft data every minute
│   └── update-sl-sites.py  # Update SL registry
└── README.md              # This file
```

## Local Setup

### Prerequisites
- Modern web browser with WebGL 2 support
- Python 3.6+ (for backend scripts)
- Internet connection (for external APIs)

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/oovets/sthlm.fun.git
   cd sthlm.fun
   ```

2. Start a local web server:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # or Node.js
   npx http-server
   ```

3. Open in your browser:
   ```
   http://localhost:8000
   ```

### Backend Scripts (Optional)

To update aircraft and SL station data:

```bash
# Run scripts manually
python tools/planes-feed.py
python tools/update-sl-sites.py

# Or setup cronjobs (recommended for production)
# Add to crontab:
* * * * * cd /path/to/sthlm.fun && python tools/planes-feed.py
0 * * * * cd /path/to/sthlm.fun && python tools/update-sl-sites.py
```

## Design

The website uses a futuristic "mission control" theme with:
- Dark theme optimized for nighttime viewing
- Glasomorphism effects (blurred glass panels)
- Monospace typography (IBM Plex Mono) for terminal feel
- Neon accent colors for important elements
- Responsive design for desktop, tablet, and mobile
- Pixel art icons and grid effects

## Development

### Modules
Each function is a separate ES6 module:
- `createMap()` - 3D map initialization
- `createPlanes()` - Aircraft data and rendering
- `createWeather()` - Weather integration
- `createTerminal()` - Command terminal
- `createFpv()` - Drone mode
- `createGuessr()` - Guessr game

### Adding Commands to Terminal

```javascript
terminal.register('mycommand', {
  desc: 'Description of my command',
  usage: 'mycommand [arg1] [arg2]',
  run: async (args, fullString) => {
    // Logic here
    terminal.print('Result', 'ok');
  }
});
```

### Building for Production

Minify JavaScript and CSS:
```bash
# Use your favorite bundler (esbuild, webpack, etc.)
npx esbuild assets/js/main.js --bundle --minify --outfile=assets/js/main.min.js
```

## Language Composition

- Frontend: 76.4% JavaScript | 15.5% CSS | 5.9% HTML | 2.2% Python
- User Interface: Swedish
- Comments and Code: Swedish and English

## License

Not yet specified (add as needed)

## Contributing

Contributions are welcome! For major changes:
1. Fork the repository
2. Create a feature branch (git checkout -b feature/my-feature)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Author

**oovets** - @oovets

## Acknowledgments

- OpenStreetMap and MapLibre for map data
- adsb.lol for aircraft data
- SL for public transport APIs
- Open-Meteo for weather data
- Everyone using and providing feedback!

---

Note: This website is an interactive visualization with no business logic - it's pure frontend fun for exploring Stockholm in creative ways!
