/** Module ID. Also the flag scope, setting namespace, and page subtype prefix. */
export const MODULE_ID = 'fhql';

/** Base path for module assets. */
export const MODULE_PATH = `modules/${MODULE_ID}`;

/** Journal page subtype holding quest data. */
export const QUEST_TYPE = `${MODULE_ID}.quest`;

/** Theme setting values. `auto` follows Foundry's own light/dark theme. */
export const THEMES = Object.freeze({
   auto: 'auto',
   light: 'light',
   dark: 'dark',
   scifi: 'scifi',
   gothic: 'gothic'
});

/** Quest statuses, in display order. Each has an icon so status never relies on color alone. */
export const STATUSES = Object.freeze({
   active: { icon: 'fa-solid fa-person-walking' },
   available: { icon: 'fa-solid fa-circle-question' },
   hidden: { icon: 'fa-solid fa-eye-slash' },
   completed: { icon: 'fa-solid fa-circle-check' },
   failed: { icon: 'fa-solid fa-circle-xmark' }
});

/** Objective states, cycled in this order. */
export const OBJECTIVE_STATES = Object.freeze(['open', 'done', 'failed']);

/** Reward kinds. */
export const REWARD_TYPES = Object.freeze(['item', 'actor', 'text']);
