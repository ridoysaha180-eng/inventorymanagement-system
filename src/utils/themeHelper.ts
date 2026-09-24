import { BusinessSettings } from '../types';

export interface FontOption {
  id: string;
  name: string;
  family: string;
  category: string;
  preview: string;
}

export const AVAILABLE_FONTS: FontOption[] = [
  { 
    id: 'plus-jakarta', 
    name: 'Plus Jakarta Sans', 
    family: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif", 
    category: 'Modern UI (Default)',
    preview: 'Grocery Point - Smart Modern POS'
  },
  { 
    id: 'inter', 
    name: 'Inter', 
    family: "'Inter', ui-sans-serif, system-ui, sans-serif", 
    category: 'Clean & Neutral',
    preview: 'Grocery Point - Crisp & Accurate'
  },
  { 
    id: 'poppins', 
    name: 'Poppins', 
    family: "'Poppins', sans-serif", 
    category: 'Geometric & Friendly',
    preview: 'Grocery Point - Friendly & Bold'
  },
  { 
    id: 'outfit', 
    name: 'Outfit', 
    family: "'Outfit', sans-serif", 
    category: 'Contemporary & Sleek',
    preview: 'Grocery Point - Premium Aesthetics'
  },
  { 
    id: 'hind-siliguri', 
    name: 'Hind Siliguri', 
    family: "'Hind Siliguri', 'Plus Jakarta Sans', sans-serif", 
    category: 'Clean Sans-Serif',
    preview: 'Grocery Point - Clean Typography'
  },
  { 
    id: 'noto-bengali', 
    name: 'Noto Sans Bengali', 
    family: "'Noto Sans Bengali', 'Plus Jakarta Sans', sans-serif", 
    category: 'Standard Universal',
    preview: 'Grocery Point - Standard Font'
  },
  { 
    id: 'syne', 
    name: 'Syne', 
    family: "'Syne', sans-serif", 
    category: 'Distinctive Display',
    preview: 'Grocery Point - Trendy Display UI'
  },
  { 
    id: 'playfair', 
    name: 'Playfair Display', 
    family: "'Playfair Display', serif", 
    category: 'Classic Serif & Luxury',
    preview: 'Grocery Point - Luxury Boutique'
  },
  { 
    id: 'jetbrains-mono', 
    name: 'JetBrains Mono', 
    family: "'JetBrains Mono', ui-monospace, monospace", 
    category: 'Code & Monospace',
    preview: 'Grocery Point - 100% Monospace'
  }
];

export interface ThemePreset {
  id: string;
  name: string;
  rgb: { r: number; g: number; b: number };
  colorClass: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'teal', name: 'Teal Green', rgb: { r: 20, g: 184, b: 166 }, colorClass: 'bg-teal-500' },
  { id: 'indigo', name: 'Indigo Corporate', rgb: { r: 99, g: 102, b: 241 }, colorClass: 'bg-indigo-600' },
  { id: 'blue', name: 'Sky Blue', rgb: { r: 59, g: 130, b: 246 }, colorClass: 'bg-blue-500' },
  { id: 'emerald', name: 'Emerald Forest', rgb: { r: 16, g: 185, b: 129 }, colorClass: 'bg-emerald-500' },
  { id: 'rose', name: 'Rose Luxury', rgb: { r: 244, g: 63, b: 94 }, colorClass: 'bg-rose-500' },
  { id: 'amber', name: 'Amber Warm', rgb: { r: 245, g: 158, b: 11 }, colorClass: 'bg-amber-500' },
  { id: 'purple', name: 'Royal Purple', rgb: { r: 168, g: 85, b: 247 }, colorClass: 'bg-purple-500' },
  { id: 'cyan', name: 'Cyan Electric', rgb: { r: 6, g: 182, b: 212 }, colorClass: 'bg-cyan-500' },
  { id: 'orange', name: 'Sunset Orange', rgb: { r: 249, g: 115, b: 22 }, colorClass: 'bg-orange-500' },
  { id: 'slate', name: 'Dark Slate', rgb: { r: 71, g: 85, b: 105 }, colorClass: 'bg-slate-700' },
];

/**
 * Generate 10-shade theme palette from RGB
 */
export function generatePaletteFromRgb(r: number, g: number, b: number) {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  
  // Mix color with white (factor: 1 = all white, 0 = base color)
  const mixWhite = (factor: number) => {
    return `rgb(${clamp(r + (255 - r) * factor)}, ${clamp(g + (255 - g) * factor)}, ${clamp(b + (255 - b) * factor)})`;
  };

  // Mix color with black (factor: 1 = all black, 0 = base color)
  const mixBlack = (factor: number) => {
    return `rgb(${clamp(r * (1 - factor))}, ${clamp(g * (1 - factor))}, ${clamp(b * (1 - factor))})`;
  };

  return {
    '--theme-50': mixWhite(0.95),
    '--theme-100': mixWhite(0.85),
    '--theme-200': mixWhite(0.68),
    '--theme-300': mixWhite(0.48),
    '--theme-400': mixWhite(0.24),
    '--theme-500': `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`,
    '--theme-600': mixBlack(0.14),
    '--theme-700': mixBlack(0.28),
    '--theme-800': mixBlack(0.42),
    '--theme-900': mixBlack(0.56),
  };
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return !isNaN(r) && !isNaN(g) && !isNaN(b) ? { r, g, b } : null;
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return !isNaN(r) && !isNaN(g) && !isNaN(b) ? { r, g, b } : null;
  }
  return null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Apply theme colors and fonts globally
 */
export function applyThemeAndFont(settings: BusinessSettings | null) {
  if (!settings) return;

  const root = document.documentElement;

  // 1. Apply Font Style
  if (settings.fontFamily) {
    const fontObj = AVAILABLE_FONTS.find(f => f.id === settings.fontFamily);
    const familyVal = fontObj ? fontObj.family : settings.fontFamily;
    document.body.style.fontFamily = familyVal;
    root.style.setProperty('--font-sans', familyVal);
  }

  // 2. Apply Theme Color (RGB or Preset)
  if (settings.themeColor === 'custom' && settings.customRgb) {
    root.removeAttribute('data-theme');
    const shades = generatePaletteFromRgb(settings.customRgb.r, settings.customRgb.g, settings.customRgb.b);
    Object.entries(shades).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  } else if (settings.customRgb && settings.themeColor?.startsWith('rgb')) {
    root.removeAttribute('data-theme');
    const shades = generatePaletteFromRgb(settings.customRgb.r, settings.customRgb.g, settings.customRgb.b);
    Object.entries(shades).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  } else if (settings.themeColor) {
    // Preset theme
    root.setAttribute('data-theme', settings.themeColor);
    // Find preset rgb
    const preset = THEME_PRESETS.find(p => p.id === settings.themeColor);
    if (preset) {
      const shades = generatePaletteFromRgb(preset.rgb.r, preset.rgb.g, preset.rgb.b);
      Object.entries(shades).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
  }
}
