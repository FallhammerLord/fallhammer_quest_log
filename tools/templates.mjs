/**
 * Loads every template under templates/ into Handlebars as a partial named by its Foundry path
 * (modules/fhql/templates/...), as preloadTemplates does in Foundry, with an English `localize`.
 * The offline checks import this before the module code, so chat cards and panels really render.
 */
import Handlebars from 'handlebars';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const lang = JSON.parse(readFileSync(`${root}lang/en.json`, 'utf8'));

/** @returns {string} The English text for a key, or the key. */
export const localize = (key) => key.replace(/^FHQL\./, '').split('.').reduce((o, p) => o?.[p], lang.FHQL) ?? key;

Handlebars.registerHelper('localize', (key) => localize(key));
for (const file of readdirSync(`${root}templates`, { recursive: true }).filter((f) => f.endsWith('.hbs')))
{
   Handlebars.registerPartial(`modules/fhql/templates/${file}`, readFileSync(`${root}templates/${file}`, 'utf8'));
}
globalThis.Handlebars = Handlebars;

export { Handlebars };
