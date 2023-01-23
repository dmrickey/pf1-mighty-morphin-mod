import { generateCapacityChange, getSingleActor, isTinyOrSmaller } from '../helpers/index.js';
import { MorphinChanges } from '../morphin-changes.js';

export const frightfulAspect = async (cl = 0) => {
    let shifter = getSingleActor(); // Ensure only a single actor is being processed
    let changeData = MorphinChanges.changes.frightfulAspect; // get buff data

    // Only continue if a single actor and it is not already under any effects provided by this module
    if (!!shifter && !shifter.data.flags.mightyMorphin) {
        let buff = shifter.items.find(o => o.type === 'buff' && o.name === 'Frightful Aspect');
        let shifterSize = shifter.data.data.traits.size;

        let newSize = changeData.size;

        // Get caster level from user for effect scaling
        let casterLevel = cl || await Dialog.prompt({
            content: '<label>Input Caster Level</label><input type="number">',
            callback: (html) => html.find('input').val()
        });

        // Create the buff if it doesn't exist, otherwise toggle it on
        if (!buff) {
            // Create template buff Item
            let buffData = duplicate(game.data.system.template.Item.buff);
            for (let t of buffData.templates) {
                mergeObject(buffData, duplicate(game.system.template.Item.templates[t]));
            }
            delete buffData.templates;
            buff = await Item.create({ name: 'Frightful Aspect', type: 'buff', data: buffData }, { temporary: true });

            let strChange = 0;
            for (let i = 0; i < changeData.changes.length; i++) {
                const change = changeData.changes[i];

                if (change.target === 'ability' && change.subTarget === 'str') {
                    strChange += parseInt(change.formula);
                }
            }

            let carryBonusChanges = generateCapacityChange(shifter, newSize, strChange);
            let changes = changeData.changes.concat(carryBonusChanges);

            // Create the buff on the actor, change the icon, populate the changes, turn it on
            let buffAdded = await shifter.createEmbeddedDocuments('Item', [buff.data]);
            await buffAdded[0].update({ 'img': 'systems/pf1/icons/skills/affliction_08.jpg', 'data.changes': changes, 'data.active': true });
        }
        else {
            let oldChanges = buff.data.data.changes;
            let newChanges = [];

            let strChange = 0;
            for (const change of oldChanges) {
                if (change.target === 'ability' && change.subTarget === 'str') {
                    strChange += parseInt(change.formula);
                }
                if (!!change.subTarget && change.subTarget !== 'carryStr' && change.subTarget !== 'carryMult') {
                    newChanges.push(change);
                }
            }

            let carryBonusChanges = generateCapacityChange(shifter, newSize, strChange);
            newChanges = newChanges.concat(carryBonusChanges);

            buff.update({ 'data.active': true, 'data.changes': newChanges });
        }

        let armorChangeFlag = [];
        let armorToChange = [];
        // Double armor and shield AC when moving from tiny or smaller (tiny and below armor AC is half normal)
        if (isTinyOrSmaller(shifterSize)) {
            let armorAndShields = shifter.items.filter(o => o.data.type === 'equipment' && (o.data.data.equipmentType === 'armor' || o.data.data.equipmentType === 'shield'));

            for (let item of armorAndShields) {
                armorChangeFlag.push({ _id: item.id, data: { armor: { value: item.data.data.armor.value } } }); // store original armor data in flags
                armorToChange.push({ _id: item.id, data: { armor: { value: (item.data.data.armor.value * 2) } } }); // change to push to actor's item
            }
        }

        // Update all items that were found to need updates
        if (!!armorToChange.length) {
            await shifter.updateEmbeddedDocuments('Item', armorToChange);
        }

        // Add effect DR to existing (if any), and store old DR
        let oldDR = shifter.data.data.traits.dr;
        let newDR = (!!oldDR ? oldDR + '; ' : '') + '10/magic';

        // Replace old spell resistance if new is higher, store old
        let oldSR = shifter.data.data.attributes.sr.formula;
        let faSR = 10 + Math.floor(parseInt(casterLevel) / 2);
        let newSR = shifter.data.data.attributes.sr.total > faSR ? oldSR : faSR;

        // Update the actor data and store flags
        await shifter.update({ 'data.traits.size': newSize, 'data.traits.dr': newDR, 'data.attributes.sr.formula': `${newSR}`, 'flags.mightyMorphin': { source: 'Frightful Aspect', buffName: 'Frightful Aspect', size: shifterSize, armor: armorChangeFlag, data: { traits: { dr: oldDR }, attributes: { sr: { formula: oldSR } } } } });
    }
    else if (!!shifter?.data.flags.mightyMorphin) {
        ui.notifications.warn(shifter.name + ' is already under the effects of a change from ' + shifter.data.flags.mightyMorphin.source);
    }
}