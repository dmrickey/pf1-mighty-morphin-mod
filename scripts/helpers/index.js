import { MightyMorphinApp } from "../mighty-morphin";
import { Settings } from "../settings";

const sizes = Object.keys(CONFIG.PF1.actorSizes);

/**
 * Gets selected actors or the actor owned by the player
 * 
 * @returns {Array.Actor} The list of actors chosen
 */
export const getActors = () => {
    const tokens = canvas.tokens.controlled;
    let actors = tokens.map(o => o.actor);
    if (!actors.length) {
        actors = game.actors.contents.filter(o => o.hasPlayerOwner && o.testUserPermission(game.user, 'OWNER'));
    }
    return actors.filter(o => o.testUserPermission(game.user, 'OWNER'));
}

/**
 * Verifies that only a single actor is chosen and returns it. Warns user if anything but a single actor is chosen
 * 
 * @returns {Actor} A single actor, or null if the number of actors was not exactly 1
 */
export const getSingleActor = () => {
    let actors = getActors();
    if (!actors.length) {
        ui.notifications.warn('No token selected');
        return null;
    }
    else if (actors.length > 1) {
        ui.notifications.warn('Too many actors selected. Choose one token.');
        return null;
    }
    return actors[0];
}

/**
 * Calculates the size to change the actor to based on current size and number of steps to change it
 * 
 * @param {string} currentSize The actor's current size
 * @param {number} mod The number of steps to change size, positive for up in size, negative for down in size
 * @returns {string} size in the pf1 system for use in system.traits.size
 */
export const getNewSize = (currentSize, mod) => {
    let sizeIndex = sizes.indexOf(currentSize);

    // limit size change to minimum fine (0) and maximum colossal (7)
    let newSizeIndex = mod < 0 ? Math.max(0, sizeIndex + mod) : Math.min(sizes.length - 1, sizeIndex + mod);

    return sizes[newSizeIndex];
}

/**
 * Calculates encumbrance bonus/penalty needed to maintain current encumbrance when size changes
 * 
 * @param {Object} shifter The actor that is changing sizes
 * @param {string} newSize The system-defined abbreviation of the size the actor is changing to
 * @param {number} strChange The amount of strength the actor is gaining (negative number is strength loss)
 * @returns {Array.Object} Array of Changes targeting carry strength bonus and carry multiplier
 */
export const generateCapacityChange = (shifter, newSize, strChange) => {
    // Set up adjustments to strength carry bonus and carry multiplier so actor's encumbrance doesn't change
    // Subtract the buff strength change from current carry bonus, decreasing carry strength if buff adds or increasing carry strength if buff subtracts
    let carryBonusChange = (shifter.system.details.carryCapacity.bonus.user || 0) - strChange;
    // Counteract the size change's natural increase or decrease to carry multiplier
    let carryMultChange = (shifter.system.details.carryCapacity.multiplier.total * CONFIG.PF1.encumbranceMultipliers.normal[shifter.system.traits.size] / CONFIG.PF1.encumbranceMultipliers.normal[newSize]) - shifter.system.details.carryCapacity.multiplier.total;
    let changes = [
        { formula: carryBonusChange.toString(), operator: 'add', subTarget: 'carryStr', modifier: 'untyped', priority: 0, value: carryBonusChange },
        { formula: carryMultChange.toString(), operator: 'add', subTarget: 'carryMult', modifier: 'untyped', priority: 0, value: carryMultChange }
    ];
    return changes;
}

export const isTinyOrSmaller = (currentSize) => sizes.indexOf(currentSize) < 3;

// Attack data used by createAttacks function
const naturalAttacks = {
    'Bite': { img: 'systems/pf1/icons/items/inventory/monster-head.jpg', type: ['bludgeoning', 'piercing', 'slashing'], primaryAttack: true },
    'Claw': { img: 'systems/pf1/icons/skills/blood_06.jpg', type: ['bludgeoning', 'slashing'], primaryAttack: true },
    'Gore': { img: 'systems/pf1/icons/items/inventory/monster-horn.jpg', type: ['piercing'], primaryAttack: true },
    'Hoof': { img: 'systems/pf1/icons/items/inventory/monster-hoof.jpg', type: ['bludgeoning'], primaryAttack: false },
    'Tentacle': { img: 'systems/pf1/icons/items/inventory/monster-octopus.jpg', type: ['bludgeoning'], primaryAttack: false },
    'Wing': { img: 'systems/pf1/icons/skills/blue_02.jpg', type: ['bludgeoning'], primaryAttack: false },
    'Pincers': { img: 'systems/pf1/icons/items/inventory/monster-claw.jpg', type: ['bludgeoning'], primaryAttack: false },
    'Tail Slap': { img: 'systems/pf1/icons/items/inventory/monster-tail.jpg', type: ['bludgeoning'], primaryAttack: false },
    'Slam': { img: 'systems/pf1/icons/items/inventory/monster-forearm.jpg', type: ['bludgeoning'], primaryAttack: true },
    'Sting': { img: 'systems/pf1/icons/items/inventory/monster-scorpion.jpg', type: ['piercing'], primaryAttack: true },
    'Talons': { img: 'systems/pf1/icons/items/inventory/monster-talon-green.jpg', type: ['slashing'], primaryAttack: true }
};

/**
 * Creates an attack and returns it
 * 
 * @param {string} actorId id of the actor that is changing shape
 * @param {string} formSize The size of the form being changed to in the format matching system.traits.size
 * @param {Object} attack Attack object containing name, dice details, attack count, and associated special (e.g. trip) if there is one
 * @param {boolean} onlyAttack True if this will be the only natural attack (providing 1.5x stat to damage)
 * @param {Object} [effects={}] Object containing data for effects that may be associated with special properties of this attack
 * @param {string} [source=' The source of the attack to add to the name
 * @param {string} [type='natural The type of attack for categorization on the sheet
 * @returns {Item} natural attack item
 */
export const createAttack = (actorId, formSize, attack, onlyAttack, effects = {}, source = '', type = 'natural') => {
    let attackData = { data: {} };

    const actorData = game.actors.get(actorId).data; // get actor's data for reference

    // Create attack Item template
    for (const template of game.data.system.template.Item.attack.templates) {
        mergeObject(attackData.data, duplicate(game.data.system.template.Item.templates[template]));
    }
    mergeObject(attackData.data, duplicate(game.data.system.template.Item.attack));
    delete attackData.data.templates;

    // Begin filling in data
    attackData.name = attack.name + (!!source ? ` (${source})` : ''); // Add source to the attack name if there is a source
    attackData.type = 'attack';

    // If attack is labeled as a a primary attack or that attack type is usually primary, or it is the only attack, it is primary
    attackData.data.enh = attack.enh || null;
    attackData.data.primaryAttack = ((attack.primaryAttack || (!!naturalAttacks[attack.name] && naturalAttacks[attack.name].primaryAttack)) || onlyAttack);
    attackData.data.attackType = type; // weapon, natural, misc, class ability, etc

    let subAction = game.pf1.documentComponents.ItemAction.defaultData;

    subAction.actionType = attack.attackType || 'mwak'; // melee, ranged, save, combat man., etc
    subAction.activation.type = 'attack';
    subAction.duration.units = 'inst';
    subAction.range.value = '' + (attack.range ?? '');
    subAction.range.units = attack.attackType === 'rwak' ? 'ft' : 'melee'; // if ranged attack, range in feet. Else melee
    subAction.ability.critRange = attack.crit || 20;
    subAction.ability.critMult = attack.critMult || 2;
    subAction.range.maxIncrements = attack.increment || '';
    subAction.uses.per = attack.charges ? 'day' : '';
    subAction.uses.maxFormula = '' + (attack.charges ?? '');
    subAction.uses.value = attack.charges || 0;
    subAction.name = attack.name;

    // Create extra attacks if the attack count is over 1, label the extras starting at 2 (Claw 2)
    let extraAttacks = [];
    for (let i = 1; i < attack.count; i++) {
        extraAttacks = extraAttacks.concat([['', `${attack.name} ${i + 1}`]]);
    }
    if (!!extraAttacks.length) {
        subAction.attackParts = extraAttacks;
        subAction.attackName = `${attack.name} 1`;
    }

    // set attack notes for each special
    if (!!attack.special) {
        for (let i = 0; i < attack.special.length; i++) {
            const specialName = attack.special[i];

            // Make sure the special hasn't been deleted (if it was invalid for this level of the spell)
            if (!!specialName) {
                // If there's details about this special in the effects object, process it. Otherwise the note is just the special name
                if (!!effects[specialName]) {
                    subAction.effectNotes.push(effects[specialName].note);
                    // Set the save if it exists
                    if (effects[specialName].saveDesc) {
                        subAction.save.type = effects[specialName].type;
                        subAction.save.dc = '10';
                        subAction.save.description = effects[specialName].saveDesc;
                    }
                }
                else {
                    subAction.effectNotes.push(specialName);
                }

                // Set the description for the whole attack if there is a description
                attackData.data.description.value = effects[specialName]?.description || '';
            }
        }
    }

    // Set attack ability to dex if weapon finesse feat and dex >= str or it's a ranged attack. Otherwise it's the actor's normal melee stat or strength
    if (!!attack.attackAbility) {
        subAction.ability.attack = attack.attackAbility;
    }
    else if ((!!actorData.items.find(o => o.type === 'feat' && o.name === 'Weapon Finesse') && actorData.data.abilities.dex.total >= actorData.data.abilities.str.total) || attack.attackType === 'rwak') {
        subAction.ability.attack = 'dex';
    }
    else {
        subAction.ability.attack = getProperty(actorData, 'system.attributes.attack.meleeAbility') || 'str';
    }

    // ability damage is strength unless it's a ranged attack
    subAction.ability.damage = attack.type === 'rwak' ? '' : 'str';

    // ability damage multiplier is the passed multiplier or 1.5 for an only attack, 1 for a primary attack, .5 secondary
    subAction.ability.damageMult = attack.mult || (onlyAttack ? 1.5 : attackData.data.primaryAttack ? 1 : 0.5);

    // Create attack sizeRoll with the passed dice stats, the actor's size, and the attack type's damage type (or '' if attack name not in naturalAttacks)
    if (attack.diceSize !== 0) {
        subAction.damage.parts = [[`sizeRoll(${attack.diceCount}, ${attack.diceSize}, @size, ${sizes.indexOf(formSize)})`, { values: ((attack.type || naturalAttacks[attack.name]?.type) || []), custom: '' }]];

        // Create non-crit bonus damage
        if (attack.nonCrit) {
            subAction.damage.nonCritParts = [attack.nonCrit];
        }
    }
    else {
        // use the data from nonCrit as the primary damage when diceSize is 0, because it's damage that doesn't scale from size
        if (attack.nonCrit) {
            subAction.damage.parts = [attack.nonCrit];
        }
    }

    // Get the image for this attack name
    attackData.img = naturalAttacks[attack.name]?.img || 'systems/pf1/icons/items/inventory/monster-paw-bear.jpg';
    subAction.img = naturalAttacks[attack.name]?.img || 'systems/pf1/icons/items/inventory/monster-paw-bear.jpg';

    attackData.data.actions = [subAction];

    return attackData;
}

/**
 * Searches for an image matching the passed form in the configured folder
 * 
 * @param {string} formName The name of the form chosen to change into
 * @returns string containing the path to the image matching the form
 */
export const findImage = (formName) => {
    let imageDir = Settings.imageDirectory;
    let foundImage = '';
    try {
        let imageList = await FilePicker.browse(imageDir.activeSource, imageDir.current);
        let sanitizedFormName = formName.replace(/[^a-zA-Z0-9]/gm, '');
        for (const image of imageList.files) {
            let imageName = image.split('/').pop();
            for (const ext of Object.keys(CONST.IMAGE_FILE_EXTENSIONS)) {
                if (imageName === `${sanitizedFormName}.${ext}`) {
                    foundImage = image;
                    break;
                }
            }
            if (!!foundImage) {
                break;
            }
        }
    }
    catch (e) {
        console.error('Mighty Morphin Mod: ', e);
        console.warn('Mighty Morphin Mod: To enable token image switching, player must have Foundry permission to "Use File Browser"');
    }

    return foundImage;
}