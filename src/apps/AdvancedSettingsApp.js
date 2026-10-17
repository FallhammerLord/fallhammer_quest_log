import { HandlebarsApp, settingConfig } from '../compat.js';
import { MODULE_ID, MODULE_PATH } from '../constants.js';
import { applyTheme, trackApp, untrackApp } from '../theme.js';
import { getSetting, setSetting } from '../setting.js';

/**
 * World settings a GM sets once and rarely touches. They live in this window (a button in Module
 * Settings) instead of the main list, in this order. Each keeps its own registration in settings.js
 * (config: false there), so its name, hint, choices and onChange still apply.
 */
export const ADVANCED_SETTINGS = [
   'easterEggs', 'followerOwnership', 'defaultOwnership', 'autoUnlockRewards', 'announceOutcomes', 'playerJournalButton',
   'playerSceneControl'
];

/** GM window, from Module Settings: the advanced settings as one short form. */
export class AdvancedSettingsApp extends HandlebarsApp
{
   static DEFAULT_OPTIONS = {
      id: 'fhql-advanced-settings',
      tag: 'form',
      classes: ['fhql-app', 'fhql-advanced-settings'],
      window: { title: 'FHQL.Advanced.Title', icon: 'fa-solid fa-sliders', resizable: true },
      position: { width: 520, height: 'auto' },
      form: { handler: AdvancedSettingsApp.#onSubmit, closeOnSubmit: true }
   };

   static PARTS = {
      body: { template: `${MODULE_PATH}/templates/advanced-settings.hbs` }
   };

   /** @override */
   async _prepareContext(options)
   {
      const context = await super._prepareContext(options);
      const localize = (key) => game.i18n.localize(key);
      const fields = ADVANCED_SETTINGS.map((key) =>
      {
         const config = settingConfig(MODULE_ID, key) ?? {};
         const value = getSetting(key);
         return {
            key,
            id: `fhql-advanced-${key}`,
            name: localize(config.name ?? key),
            hint: config.hint ? localize(config.hint) : '',
            checkbox: config.type === Boolean,
            checked: value === true,
            options: config.choices ? Object.entries(config.choices).map(([choice, label]) => ({
               value: choice, label: localize(label), selected: String(value) === choice
            })) : null
         };
      });
      return { ...context, fields };
   }

   /** @override */
   _onRender(context, options)
   {
      super._onRender(context, options);
      applyTheme(this.element);
      trackApp(this);
   }

   /** @override */
   _onClose(options)
   {
      super._onClose(options);
      untrackApp(this);
   }

   /** @this {AdvancedSettingsApp} */
   static async #onSubmit(event, form, formData)
   {
      const values = formData.object;
      for (const key of ADVANCED_SETTINGS)
      {
         const config = settingConfig(MODULE_ID, key) ?? {};
         const raw = values[key];
         const value = config.type === Boolean ? !!raw : config.type === Number ? Number(raw) : raw;
         if (value !== getSetting(key)) { await setSetting(key, value); }
      }
   }
}
