import { HandlebarsApp, browseImage } from '../compat.js';
import { MODULE_ID, MODULE_PATH, THEMES } from '../constants.js';
import { applyTheme, defaultOverlay, trackApp, untrackApp } from '../theme.js';

/** Themes with their own images (Follow Foundry uses Light's or Dark's). */
const IMAGE_THEMES = ['light', 'dark', 'scifi', 'gothic', 'ledger'];

/**
 * GM window, from Module Settings: overlay images per theme. Each theme has a top wash (stretched over
 * the quest header and list toolbar) and a lower wash (pinned to the bottom of the sheet and list).
 * An empty field uses the default; "No images" turns both off for that theme.
 */
export class TextureImagesApp extends HandlebarsApp
{
   static DEFAULT_OPTIONS = {
      id: 'fhql-texture-images',
      tag: 'form',
      classes: ['fhql-app', 'fhql-texture-images'],
      window: { title: 'FHQL.TextureImages.Title', icon: 'fa-solid fa-image', resizable: true },
      position: { width: 560, height: 'auto' },
      form: { handler: TextureImagesApp.#onSubmit, closeOnSubmit: true },
      actions: { browse: TextureImagesApp.#onBrowse, clearImage: TextureImagesApp.#onClear }
   };

   static PARTS = {
      body: { template: `${MODULE_PATH}/templates/texture-images.hbs`, scrollable: ['.fhql-texture-images-list'] }
   };

   /** @override */
   async _prepareContext(options)
   {
      const context = await super._prepareContext(options);
      const saved = game.settings.get(MODULE_ID, 'textureImages') ?? {};
      const none = game.i18n.localize('FHQL.TextureImages.NoDefault');
      const themes = IMAGE_THEMES.map((key) =>
      {
         const chosen = saved[key] ?? {};
         const fallback = defaultOverlay(THEMES[key]);
         const slot = (which) => ({
            name: `${key}.${which}`,
            value: chosen[which] ?? '',
            placeholder: fallback[which] ? game.i18n.format('FHQL.TextureImages.Default', { path: fallback[which] }) : none
         });
         return {
            key,
            label: game.i18n.localize(`FHQL.Settings.Theme.${key === 'scifi' ? 'Scifi' : key.charAt(0).toUpperCase() + key.slice(1)}`),
            top: slot('top'),
            bottom: slot('bottom'),
            off: !!chosen.off
         };
      });
      return { ...context, themes };
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

   /** @this {TextureImagesApp} */
   static #onBrowse(event, target)
   {
      const input = this.element.querySelector(`input[name="${target.dataset.field}"]`);
      if (!input) { return; }
      browseImage(input.value, (path) => { input.value = path; });
   }

   /** @this {TextureImagesApp} */
   static #onClear(event, target)
   {
      const input = this.element.querySelector(`input[name="${target.dataset.field}"]`);
      if (input) { input.value = ''; }
   }

   /** @this {TextureImagesApp} */
   static async #onSubmit(event, form, formData)
   {
      const values = foundry.utils.expandObject(formData.object);
      const images = {};
      for (const key of IMAGE_THEMES)
      {
         const row = values[key] ?? {};
         const entry = { top: String(row.top ?? '').trim(), bottom: String(row.bottom ?? '').trim(), off: !!row.off };
         if (entry.top || entry.bottom || entry.off) { images[key] = entry; }
      }
      await game.settings.set(MODULE_ID, 'textureImages', images);
   }
}
