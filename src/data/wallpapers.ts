export interface WallpaperPreset {
  id: string
  label: string
  url: string
  thumbnailUrl: string
  description: string
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'midnight-mountain',
    label: 'Midnight Horizon',
    url: './wallpapers/midnight-mountain.jpg',
    thumbnailUrl: './wallpapers/midnight-mountain.jpg',
    description: 'Starry midnight mountain ridge with atmospheric indigo hues',
  },
  {
    id: 'dusk-ridge',
    label: 'Dusk Ridge',
    url: './wallpapers/dusk-ridge.jpg',
    thumbnailUrl: './wallpapers/dusk-ridge.jpg',
    description: 'Golden hour mountain crest with mist-filled valleys',
  },
  {
    id: 'forest-canopy',
    label: 'Forest Canopy',
    url: './wallpapers/forest-canopy.jpg',
    thumbnailUrl: './wallpapers/forest-canopy.jpg',
    description: 'Deep verdant forest canopy bathed in gentle mist',
  },
  {
    id: 'starlit-silhouette',
    label: 'Cosmic Starlight',
    url: './wallpapers/starlit-silhouette.jpg',
    thumbnailUrl: './wallpapers/starlit-silhouette.jpg',
    description: 'Minimalist cosmic silhouette overlooking starlit nebulae',
  },
  {
    id: 'none',
    label: 'Deep Charcoal Solid',
    url: '',
    thumbnailUrl: '',
    description: 'Solid minimalist neutral foundation without background imagery',
  },
]

export const DEFAULT_WALLPAPER_ID = 'midnight-mountain'
