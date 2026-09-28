/**
 * The compatibility boundary. Every version-sensitive Foundry API we touch is reached through this file,
 * so a new Foundry major means editing here first. See docs/SCOPE.md section 5.5.
 */

/** ApplicationV2 base class and Handlebars mixin. */
export const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Base class for every fhql window. */
export const HandlebarsApp = HandlebarsApplicationMixin(ApplicationV2);
