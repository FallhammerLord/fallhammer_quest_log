import { MODULE_ID, THEMES } from './constants.js';
import { refreshOpenApps } from './theme.js';
import { availableFonts } from './compat.js';
import { refreshQuestBeacon } from './ui/QuestBeacon.js';
import { TextureImagesApp } from './apps/TextureImagesApp.js';

/** Registers module settings. Called on `init`. */
export function registerSettings()
{
   const themeChoices = {
      [THEMES.auto]: 'FHQL.Settings.Theme.Auto',
      [THEMES.light]: 'FHQL.Settings.Theme.Light',
      [THEMES.dark]: 'FHQL.Settings.Theme.Dark',
      [THEMES.scifi]: 'FHQL.Settings.Theme.Scifi',
      [THEMES.gothic]: 'FHQL.Settings.Theme.Gothic',
      [THEMES.cabaret]: 'FHQL.Settings.Theme.Cabaret',
      [THEMES.hopefear]: 'FHQL.Settings.Theme.Hopefear',
      [THEMES.noir]: 'FHQL.Settings.Theme.Noir',
      [THEMES.ledger]: 'FHQL.Settings.Theme.Ledger'
   };
   const restyle = () =>
   {
      refreshOpenApps();
      refreshQuestBeacon();
   };

   game.settings.register(MODULE_ID, 'worldTheme', {
      name: 'FHQL.Settings.WorldTheme.Name',
      hint: 'FHQL.Settings.WorldTheme.Hint',
      scope: 'world',
      config: true,
      type: String,
      choices: themeChoices,
      default: THEMES.auto,
      onChange: restyle
   });

   game.settings.register(MODULE_ID, 'theme', {
      name: 'FHQL.Settings.Theme.Name',
      hint: 'FHQL.Settings.Theme.Hint',
      scope: 'client',
      config: true,
      type: String,
      choices: { world: 'FHQL.Settings.Theme.World', ...themeChoices },
      default: 'world',
      onChange: restyle
   });

   game.settings.register(MODULE_ID, 'easterEggs', {
      name: 'FHQL.Settings.EasterEggs.Name',
      hint: 'FHQL.Settings.EasterEggs.Hint',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
   });

   game.settings.register(MODULE_ID, 'portraitFrame', {
      name: 'FHQL.Settings.PortraitFrame.Name',
      hint: 'FHQL.Settings.PortraitFrame.Hint',
      scope: 'world',
      config: true,
      type: String,
      choices: { round: 'FHQL.Settings.PortraitFrame.Round', square: 'FHQL.Settings.PortraitFrame.Square' },
      default: 'round',
      onChange: restyle
   });

   // Texture strength: the GM sets the table's, each player may override it on their own device.
   // 0 means smooth panels; 50 shows each theme as designed.
   game.settings.register(MODULE_ID, 'worldTextureStrength', {
      name: 'FHQL.Settings.TextureStrength.World.Name',
      hint: 'FHQL.Settings.TextureStrength.World.Hint',
      scope: 'world',
      config: true,
      type: Number,
      range: { min: 0, max: 100, step: 5 },
      default: 50,
      onChange: restyle
   });
   const strengthChoices = { world: 'FHQL.Settings.TextureStrength.UseWorld', 0: 'FHQL.Settings.TextureStrength.Smooth' };
   for (let n = 10; n <= 100; n += 10) { strengthChoices[n] = `${n}%`; }
   game.settings.register(MODULE_ID, 'textureStrength', {
      name: 'FHQL.Settings.TextureStrength.Own.Name',
      hint: 'FHQL.Settings.TextureStrength.Own.Hint',
      scope: 'client',
      config: true,
      type: String,
      choices: strengthChoices,
      default: 'world',
      onChange: restyle
   });
   // Before 0.3.0's texture strength: an on/off switch. Kept only to carry "off" over (see migrateTextureSetting).
   game.settings.register(MODULE_ID, 'textures', { scope: 'client', config: false, type: Boolean, default: true });

   // Overlay images per theme (GM): { [theme]: { top, bottom, off } }. Empty paths use the default.
   game.settings.register(MODULE_ID, 'textureImages', {
      scope: 'world',
      config: false,
      type: Object,
      default: {},
      onChange: restyle
   });
   game.settings.registerMenu(MODULE_ID, 'textureImagesMenu', {
      name: 'FHQL.TextureImages.MenuName',
      label: 'FHQL.TextureImages.MenuLabel',
      hint: 'FHQL.TextureImages.MenuHint',
      icon: 'fa-solid fa-image',
      type: TextureImagesApp,
      restricted: true
   });

   // Font choices are filled on ready, once uploaded fonts are known. The same objects are kept, so
   // the settings window lists them.
   const worldFontChoices = { '': 'FHQL.Settings.Font.ThemeDefault' };
   const ownFontChoices = { world: 'FHQL.Settings.Font.World', '': 'FHQL.Settings.Font.ThemeDefault' };
   Hooks.once('ready', () =>
   {
      for (const [family, label] of Object.entries(availableFonts()))
      {
         worldFontChoices[family] = label;
         ownFontChoices[family] = label;
      }
   });
   for (const role of ['Heading', 'Body'])
   {
      game.settings.register(MODULE_ID, `world${role}Font`, {
         name: `FHQL.Settings.Font.World${role}.Name`,
         hint: 'FHQL.Settings.Font.WorldHint',
         scope: 'world',
         config: true,
         type: String,
         choices: worldFontChoices,
         default: '',
         onChange: restyle
      });
   }
   for (const role of ['heading', 'body'])
   {
      game.settings.register(MODULE_ID, `${role}Font`, {
         name: `FHQL.Settings.Font.Own${role === 'heading' ? 'Heading' : 'Body'}.Name`,
         hint: 'FHQL.Settings.Font.OwnHint',
         scope: 'client',
         config: true,
         type: String,
         choices: ownFontChoices,
         default: 'world',
         onChange: restyle
      });
   }


   game.settings.register(MODULE_ID, 'showInProgress', {
      name: 'FHQL.Settings.ShowInProgress.Name',
      hint: 'FHQL.Settings.ShowInProgress.Hint',
      scope: 'client',
      config: true,
      type: Boolean,
      default: true,
      onChange: () => refreshQuestBeacon()
   });

   game.settings.register(MODULE_ID, 'showNextObjective', {
      name: 'FHQL.Settings.ShowNextObjective.Name',
      hint: 'FHQL.Settings.ShowNextObjective.Hint',
      scope: 'client',
      config: true,
      type: Boolean,
      default: true,
      onChange: () => refreshQuestBeacon()
   });

   const worldToggle = (key, fallback, onChange) => game.settings.register(MODULE_ID, key, {
      name: `FHQL.Settings.${key}.Name`,
      hint: `FHQL.Settings.${key}.Hint`,
      scope: 'world',
      config: true,
      type: Boolean,
      default: fallback,
      requiresReload: false,
      onChange
   });
   const refreshAccess = () =>
   {
      refreshQuestBeacon();
      ui.sidebar?.render?.();
      ui.controls?.render?.({ reset: true });
   };
   worldToggle('hideFromPlayers', false, refreshAccess);
   worldToggle('playerJournalButton', true, refreshAccess);
   worldToggle('playerSceneControl', true, refreshAccess);
   worldToggle('playersCanAccept', false);
   worldToggle('playersCanCreate', false);
   worldToggle('trustedCanChangeStatus', false);
   worldToggle('playersEditNotes', false);

   game.settings.register(MODULE_ID, 'autoUnlockRewards', {
      name: 'FHQL.Settings.AutoUnlockRewards.Name',
      hint: 'FHQL.Settings.AutoUnlockRewards.Hint',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
   });

   const levels = CONST.DOCUMENT_OWNERSHIP_LEVELS;
   game.settings.register(MODULE_ID, 'followerOwnership', {
      name: 'FHQL.Settings.FollowerOwnership.Name',
      hint: 'FHQL.Settings.FollowerOwnership.Hint',
      scope: 'world',
      config: true,
      type: Number,
      choices: {
         [levels.OWNER]: 'FHQL.Settings.FollowerOwnership.Owner',
         [levels.OBSERVER]: 'FHQL.Settings.FollowerOwnership.Observer'
      },
      default: levels.OWNER
   });

   game.settings.register(MODULE_ID, 'listFilter', {
      scope: 'client',
      config: false,
      type: Object,
      default: { statuses: [], collapsed: [] }
   });

   game.settings.register(MODULE_ID, 'announceOutcomes', {
      name: 'FHQL.Settings.AnnounceOutcomes.Name',
      hint: 'FHQL.Settings.AnnounceOutcomes.Hint',
      scope: 'world',
      config: true,
      type: Boolean,
      default: true
   });

   game.settings.register(MODULE_ID, 'windowMemory', {
      scope: 'client',
      config: false,
      type: Object,
      default: {}
   });

   game.settings.register(MODULE_ID, 'hideDoneObjectives', {
      scope: 'client',
      config: false,
      type: Boolean,
      default: false
   });

   game.settings.register(MODULE_ID, 'gmNotesOpen', {
      scope: 'client',
      config: false,
      type: Boolean,
      default: false
   });

   const { LIMITED, OBSERVER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;
   game.settings.register(MODULE_ID, 'defaultOwnership', {
      name: 'FHQL.Settings.DefaultOwnership.Name',
      hint: 'FHQL.Settings.DefaultOwnership.Hint',
      scope: 'world',
      config: true,
      type: Number,
      choices: {
         [LIMITED]: 'FHQL.Settings.DefaultOwnership.Limited',
         [OBSERVER]: 'FHQL.Settings.DefaultOwnership.Observer'
      },
      default: OBSERVER
   });
}

/** A player who had turned textures off keeps smooth panels under the new strength setting. Runs on ready. */
export async function migrateTextureSetting()
{
   if (game.settings.get(MODULE_ID, 'textures') !== false) { return; }
   if (game.settings.get(MODULE_ID, 'textureStrength') === 'world') { await game.settings.set(MODULE_ID, 'textureStrength', '0'); }
   await game.settings.set(MODULE_ID, 'textures', true);
}
