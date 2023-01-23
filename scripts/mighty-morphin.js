import { MorphinChanges } from './morphin-changes.js';
import { MorphinBeastShape } from './morphin-beast-shape.js';
import { MorphinElementalBody } from './morphin-elemental-body.js';
import { MorphinPlantShape } from './morphin-plant-shape.js';
import { enlargePerson } from './morphs/enlarge-person.js';
import { animalGrowth } from './morphs/animal-growth.js';
import { legendaryProportions } from './morphs/legendary-proportions.js';
import { frightfulAspect } from './morphs/frightful-aspect.js';
import { reducePerson } from './morphs/reduce-person.js';
import { getSingleActor } from './helpers/index.js';

/**
 * Class for functions exposed to users of pf1 system and helpers
 */
export class MightyMorphinApp {

    /**
     * Applies Enlarge Person buff and effects to selected actor
     */
    static async enlargePerson() { await enlargePerson(); }

    /**
     * Applies Animal Growth buff and effects to selected actor
     */
    static async animalGrowth() { await animalGrowth(); }

    /**
     * Applies Legendary Proportions buff and effects to selected actor
     */
    static async legendaryProportions() { await legendaryProportions(); }

    /**
     * Applies Frightful Aspect buff and effects to selected actor
     */
    static async frightfulAspect() { await frightfulAspect(); }

    /**
     * Applies Reduce Person buff and effects to selected actor
     */
    static async reducePerson() { await reducePerson(); }

    // todo add buff name as optional arg to revert specific buff
    /**
     * Reverts changes applied by this module to the selected actor
     */
    static async revert() {
        let shifter = getSingleActor(); // Ensure only a single actor is being processed

        // Only continue if a single actor and it is already under any effects provided by this module
        if (!!shifter && !!shifter.data.flags.mightyMorphin) {
            // Get flags from the actor with the changes applied to it
            let changes = duplicate(shifter.data.flags.mightyMorphin);

            // Undo listed buffs
            if (['Enlarge Person', 'Reduce Person', 'Legendary Proportions', 'Frightful Aspect', 'Animal Growth'].includes(changes.source)) {
                // Revert all armor changes that exist
                if (!!shifter.data.flags.mightyMorphin.armor.length) {
                    let armorFlag = shifter.data.flags.mightyMorphin.armor;
                    let armorExisting = [];
                    let armorItem;
                    armorFlag.forEach(a => {
                        armorItem = shifter.items.get(a._id);
                        if (!!armorItem) {
                            armorExisting.push(a);
                        }
                    });
                    await shifter.updateEmbeddedDocuments('Item', armorExisting);
                }

                // Revert all actor data to its original and remove the flags
                if (!!changes.data) {
                    await shifter.update({ 'system': changes.system, 'system.traits.size': changes.size, 'flags.-=mightyMorphin': null });
                }
                else {
                    await shifter.update({ 'system.traits.size': changes.size, 'flags.-=mightyMorphin': null });
                }
                // Turn off the buff
                await shifter.items.find(o => o.type === 'buff' && o.name === changes.buffName).update({ 'data.active': false });
            }
            // Undo listed buffs
            else if (['Beast Shape', 'Elemental Body', 'Plant Shape', 'Wild Shape'].includes(changes.source)) {
                // Reverse any changes to armor
                if (!!shifter.data.flags.mightyMorphin.armor.length) {
                    let armorFlag = shifter.data.flags.mightyMorphin.armor;
                    let armorExisting = [];
                    let armorItem;
                    armorFlag.forEach(a => {
                        armorItem = shifter.items.get(a._id);
                        if (!!armorItem) {
                            armorExisting.push(a);
                        }
                    });
                    await shifter.updateEmbeddedDocuments('Item', armorExisting);
                }

                if (!!shifter.data.flags.mightyMorphin.tokenImg) {
                    let token = canvas.tokens.ownedTokens.find(o => o.data.actorId === shifter.id);
                    await token.document.update(shifter.data.flags.mightyMorphin.tokenImg);
                }

                // Revert all data that was replaced to its original and remove the flags
                let updates = {};
                if (!!changes.data.token) {
                    updates = { data: changes.system, token: changes.data.token, 'flags.-=mightyMorphin': null };
                }
                else {
                    updates = { data: changes.system, 'flags.-=mightyMorphin': null };
                }

                await shifter.update(updates);

                // Remove any attacks or other features created by the effect
                let itemsOnActor = shifter.items.filter(o => changes.itemsCreated.includes(o.id)).map(o => o.id);
                await shifter.deleteEmbeddedDocuments('Item', itemsOnActor);

                canvas.tokens.releaseAll();
                canvas.tokens.ownedTokens.find(o => o.data.actorId === shifter.id).control();
            }
        }
        else if (!!shifter && !shifter.data.flags.mightyMorphin) {
            ui.notifications.warn(shifter.name + ' is not under any change effects');
        }
    }

    /**
     * Creates the Beast Shape buff and effects on the actor using the MorphinBeastShape class
     * 
     * @param {number} level The level of beast shape spell being cast (1-4)
     * @param {string} [source='Beast Shape'] The source of the beast shape spell effect
     */
    static async beastShape(level, source = 'Beast Shape') {
        let shifter = MightyMorphinApp.getSingleActor();

        // Create beast shape form if a single actor chosen not already under effects from this mod
        if (!!shifter && !shifter.data.flags.mightyMorphin) {
            new MorphinBeastShape(level, shifter.id, source)
                .render(true);
        }
        else if (!!shifter?.data.flags.mightyMorphin) {
            ui.notifications.warn(shifter.name + ' is already under the effects of a change from ' + shifter.data.flags.mightyMorphin.source);
        }

    }

    /**
     * Creates the Elemental Body buff and effects on the actor using the MorphinElementalBody class
     * 
     * @param {number} level The level of elemental body spell being cast (1-4)
     * @param {string} [source='Elemental Body'] The source of the elemental body spell effect
     */
    static async elementalBody(level, source = 'Elemental Body') {
        let shifter = MightyMorphinApp.getSingleActor();

        // Create elemental body form if a single actor chosen not already under effects from this mod
        if (!!shifter && !shifter.data.flags.mightyMorphin) {
            new MorphinElementalBody(level, shifter.id, source)
                .render(true);
        }
        else if (!!shifter?.data.flags.mightyMorphin) {
            ui.notifications.warn(shifter.name + ' is already under the effects of a change from ' + shifter.data.flags.mightyMorphin.source);
        }
    }

    /**
     * Creates the Plant Shape buff and effects on the actor using the MorphinElementalBody class
     * 
     * @param {number} level The level of plant shape spell being cast (1-3)
     * @param {string} [source='Plant Shape'] The source of the splant shape spell effect
     */
    static async plantShape(level, source = 'Plant Shape') {
        let shifter = MightyMorphinApp.getSingleActor();

        // Create plant shape form if a single actor chosen not already under effects from this mod
        if (!!shifter && !shifter.data.flags.mightyMorphin) {
            new MorphinPlantShape(level, shifter.id, source)
                .render(true);
        }
        else if (!!shifter?.data.flags.mightyMorphin) {
            ui.notifications.warn(shifter.name + ' is already under the effects of a change from ' + shifter.data.flags.mightyMorphin.source);
        }
    }
}
