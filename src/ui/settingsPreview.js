import { settingsFormFields, SETTINGS_WINDOW_HOOKS } from '../compat.js';
import { previewTheme } from '../theme.js';

/** Settings that restyle our windows, and so preview live while the settings window is open. */
const PREVIEW_KEYS = ['theme', 'worldTheme', 'worldTextureStrength', 'textureStrength', 'headingFont', 'bodyFont', 'worldHeadingFont', 'worldBodyFont'];

/**
 * Previews theme and font choices on open quest windows and the Beacon as soon as they change in
 * Module Settings, before Save. Closing the settings window shows the saved settings again.
 */
export function registerSettingsPreview()
{
   Hooks.on(SETTINGS_WINDOW_HOOKS.render, (app, element) =>
   {
      const root = element instanceof HTMLElement ? element : app.element;
      if (!root || root.dataset.fhqlPreview) { return; }
      root.dataset.fhqlPreview = 'true';
      root.addEventListener('change', (event) =>
      {
         const fields = settingsFormFields(root, PREVIEW_KEYS);
         if (!Object.values(fields).includes(event.target)) { return; }
         previewTheme(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.type === 'checkbox' ? field.checked : field.value])));
      });
   });
   Hooks.on(SETTINGS_WINDOW_HOOKS.close, () => previewTheme(null));
}
