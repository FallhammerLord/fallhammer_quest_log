import { TypeDataModel, fields } from '../compat.js';
import { DEPOSIT_MODES, OBJECTIVE_STATES, REWARD_TYPES, STATUSES } from '../constants.js';

/**
 * System data for the `fhql.quest` journal page subtype. See docs/SCOPE.md section 4.1.
 *
 * Objectives and rewards are keyed objects, not arrays, so edits update single fields and two people
 * editing different objectives never collide (section 5.7). GM notes are deliberately absent: they
 * will live on a separate GM-only page so they never reach player clients.
 */
export class QuestData extends TypeDataModel
{
   static defineSchema()
   {
      const { ArrayField, BooleanField, HTMLField, IntegerSortField, NumberField, ObjectField, SchemaField, StringField,
       TypedObjectField } = fields;

      const text = () => new StringField({ required: true, blank: true, initial: '' });
      const timestamp = () => new NumberField({ required: true, nullable: true, integer: true, initial: null });

      return {
         status: new StringField({
            required: true, blank: false, choices: Object.keys(STATUSES), initial: 'hidden'
         }),
         inProgress: new BooleanField({ initial: false }),
         image: text(),
         giver: new SchemaField({ uuid: text(), name: text(), img: text() }),
         description: new HTMLField({ required: true, blank: true, initial: '' }),
         playerNotes: new HTMLField({ required: true, blank: true, initial: '' }),

         objectives: new TypedObjectField(new SchemaField({
            name: text(),
            state: new StringField({ required: true, blank: false, choices: OBJECTIVE_STATES, initial: 'open' }),
            hidden: new BooleanField({ initial: false }),
            parent: text(),
            sort: new IntegerSortField(),
            /** An item players must hand over or show. No `uuid` means no requirement. See SCOPE 5.11. */
            requirement: new SchemaField({
               uuid: text(),
               name: text(),
               img: text(),
               count: new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 1 }),
               mode: new StringField({ required: true, blank: false, choices: DEPOSIT_MODES, initial: 'give' })
            }),
            /** What players have handed over or shown. `item` keeps a handed-over item's data so Undo can return it. */
            deposits: new ArrayField(new SchemaField({
               userId: text(),
               actorUuid: text(),
               actorName: text(),
               itemUuid: text(),
               qty: new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 1 }),
               at: timestamp(),
               item: new ObjectField({ required: false, nullable: true, initial: null })
            }))
         })),

         rewards: new TypedObjectField(new SchemaField({
            type: new StringField({ required: true, blank: false, choices: REWARD_TYPES, initial: 'text' }),
            uuid: text(),
            name: text(),
            img: text(),
            hidden: new BooleanField({ initial: false }),
            /** Locked rewards can't be claimed yet. Unlocked by the GM, or on quest completion. */
            locked: new BooleanField({ initial: true }),
            /** 'once': one claim total. 'perPlayer': each player may claim once. */
            claimLimit: new StringField({ required: true, blank: false, choices: ['once', 'perPlayer'], initial: 'once' }),
            claims: new ArrayField(new SchemaField({
               userId: text(),
               actorUuid: text(),
               itemUuid: text(),
               /** Actor name at claim time, so a label survives the actor being renamed or deleted. */
               actorName: text(),
               /** Stack size handed over, so Undo can take back exactly that from a merged stack. */
               qty: new NumberField({ required: true, nullable: true, integer: true, initial: null }),
               prevLevel: new NumberField({ required: true, nullable: true, integer: true, initial: null }),
               at: timestamp()
            })),
            sort: new IntegerSortField()
         })),

         /** JournalEntry ID of the parent quest. Subquests are derived from this, never stored twice. */
         parent: text(),

         dates: new SchemaField({ created: timestamp(), started: timestamp(), ended: timestamp() }),

         /** Import provenance. `fqlId` is set when imported from Forien's Quest Log. */
         source: new SchemaField({ fqlId: text() })
      };
   }

   /** @returns {object[]} Objectives as an array with IDs, sorted. */
   get objectiveList()
   {
      return Object.entries(this.objectives)
       .map(([id, objective]) => ({ id, ...objective }))
       .sort((a, b) => a.sort - b.sort);
   }
}
