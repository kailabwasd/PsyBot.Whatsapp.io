export interface AccessibilitySettings {
  fontSize: 'normal' | 'medium' | 'large' | 'extralarge';
  contrast: 'normal' | 'high' | 'soft';
  darkMode: boolean;
  boldText: boolean;
  dyslexiaFont: boolean;
  wideSpacing: boolean;
  reducedMotion: boolean;
  highlightLinks: boolean;
}

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  fontSize: 'normal',
  contrast: 'normal',
  darkMode: false,
  boldText: false,
  dyslexiaFont: false,
  wideSpacing: false,
  reducedMotion: false,
  highlightLinks: false,
};

const STORAGE_KEY = 'psybot_accessibility_settings';

export function getStoredAccessibilitySettings(): AccessibilitySettings {
  if (typeof window === 'undefined') return DEFAULT_ACCESSIBILITY_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ACCESSIBILITY_SETTINGS;
    return { ...DEFAULT_ACCESSIBILITY_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  }
}

export function saveAccessibilitySettings(settings: AccessibilitySettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applyAccessibilitySettings(settings);
    window.dispatchEvent(new CustomEvent('applet:accessibilitychange', { detail: settings }));
  } catch (e) {
    console.error('Error saving accessibility settings:', e);
  }
}

export function applyAccessibilitySettings(settings: AccessibilitySettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // 1. Font Size
  root.classList.remove('font-size-normal', 'font-size-medium', 'font-size-large', 'font-size-extralarge');
  root.classList.add(`font-size-${settings.fontSize}`);

  if (settings.fontSize === 'medium') {
    root.style.fontSize = '17px';
  } else if (settings.fontSize === 'large') {
    root.style.fontSize = '18.5px';
  } else if (settings.fontSize === 'extralarge') {
    root.style.fontSize = '20px';
  } else {
    root.style.fontSize = '';
  }

  // 2. Contrast
  root.classList.remove('contrast-normal', 'contrast-high', 'contrast-soft');
  root.classList.add(`contrast-${settings.contrast}`);

  // 3. Dark Mode
  if (settings.darkMode) {
    root.classList.add('access-dark-mode');
  } else {
    root.classList.remove('access-dark-mode');
  }

  // 4. Bold Text
  if (settings.boldText) {
    root.classList.add('access-bold-text');
  } else {
    root.classList.remove('access-bold-text');
  }

  // 5. Dyslexia / Readable Font
  if (settings.dyslexiaFont) {
    root.classList.add('access-readable-font');
  } else {
    root.classList.remove('access-readable-font');
  }

  // 6. Wide Spacing
  if (settings.wideSpacing) {
    root.classList.add('access-wide-spacing');
  } else {
    root.classList.remove('access-wide-spacing');
  }

  // 7. Reduced Motion
  if (settings.reducedMotion) {
    root.classList.add('access-reduced-motion');
  } else {
    root.classList.remove('access-reduced-motion');
  }

  // 8. Highlight Links & Interactive Elements
  if (settings.highlightLinks) {
    root.classList.add('access-highlight-links');
  } else {
    root.classList.remove('access-highlight-links');
  }
}
