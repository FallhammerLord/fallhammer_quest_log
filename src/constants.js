/** Module ID. Also the flag scope, setting namespace, and page subtype prefix. */
export const MODULE_ID = 'fhql';

/** Base path for module assets. */
export const MODULE_PATH = `modules/${MODULE_ID}`;

/** Theme setting values. `auto` follows Foundry's own light/dark theme. */
export const THEMES = Object.freeze({
   auto: 'auto',
   light: 'light',
   dark: 'dark',
   scifi: 'scifi'
});

/** Quest statuses, in display order. Each has an icon so status never relies on color alone. */
export const STATUSES = Object.freeze({
   hidden: { icon: 'fa-solid fa-eye-slash' },
   available: { icon: 'fa-solid fa-circle-question' },
   active: { icon: 'fa-solid fa-person-walking' },
   completed: { icon: 'fa-solid fa-circle-check' },
   failed: { icon: 'fa-solid fa-circle-xmark' }
});
