import { MightyMorphinApp } from './mighty-morphin.js';
import { MorphinChanges } from './morphin-changes.js';
import { MorphinOptions } from './morphin-options.js';
import { MorphinPolymorphDialog } from './morphin-polymorph-dialog.js';

/**
 * Application for selecting a shape from the Plant Shape spell to change into and then applying that shape to an actor
 */
export class MorphinPlantShape extends MorphinPolymorphDialog {
    /**
     * @inheritdoc
     * @param {number} level The level of beast shape to use 1 - 4
     * @param {string} actorId The id of the actor that will change shape
     * @param {string} source The source of the beast shape effect
     */
    constructor(level, durationLevel, actorId, source, {planarType = null, energizedTypes = null, mutatedType = null} = {}) {
        super(level, durationLevel, actorId, source, {planarType: planarType, energizedTypes: energizedTypes, mutatedType: mutatedType});
        this.spell = 'plantShape';

        // Add all possible sizes for the given spell level
        switch (level) {
            case 3:
                this.sizes.plant = ['sm', 'med', 'lg', 'huge'];
                break;
            case 2:
                this.sizes.plant = ['sm', 'med', 'lg'];
                break;
            case 1:
                this.sizes.plant = ['sm', 'med'];
                break;
        }

        this.shapeOptions = {};
        // Find options to shapeshift into based on the valid size choices above and sort them alphabetically
        this.shapeOptions.plant = MorphinOptions.plant.filter(o => this.sizes.plant.includes(o.size));
        this.shapeOptions.plant.sort((a, b) => { return a.name > b.name ? 1 : -1; });
    }

    /** @inheritdoc */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ['mightyMorphinDialog'],
            popOut: true,
            template: 'modules/pf1-mighty-morphin/templates/plantShapeDialog.html',
            id: 'mighty-morphin-plantShape',
            title: game.i18n.localize('MMMOD.UI.PlantDialogName'),
            resizable: false,
            width: 550
        });
    }

    /** @inheritdoc */
    async getData() {
        const data = await super.getData();

        // Set the default size to the largest available plant
        let defaultSize = this.sizes.plant[this.sizes.plant.length - 1];
        data.plantOptions = this.shapeOptions.plant.filter(o => o.size === defaultSize);

        // Create radio button data for plant sizes, set the one for the default size as the default checked button
        data.plantSizes = this.sizes.plant.map(o => { return o === defaultSize ? { label: o, size: CONFIG.PF1.actorSizes[o], default: true } : { label: o, size: CONFIG.PF1.actorSizes[o] }; });

        // Get the plant that will be the first shown in the form dropdown and build the preview of the changes the form will provide
        data.defaultChoice = data.plantOptions[0];
        data.previewHtml = await this.buildPreviewTemplate(data.defaultChoice.name, 'plant');

        return data;
    }

    /**
     * Processes and applies all changes from the passed form to the actor
     * 
     * @param {object} event The clicked button event
     * @param {string} chosenForm The name of the form chosen
     */
    async applyChanges(event, chosenForm) {
        super.applyChanges(event, chosenForm);
    }

    /**
     * Updates the options in the formSelect select input based on the type radio and the size clicked by the user in the event
     * 
     * @param {object} event listener event from sizeSelect radio buttons
     * @param {object} formSelect The select html object
     */
    async updateFormChoices(event, formSelect) {
        let newOptions = this.shapeOptions.plant.filter(o => o.size === event.target.value);

        let newHtml = newOptions.map(o => `<option value="${ o.name }">${ o.name }</option>`);
        formSelect.innerHTML = newHtml;
    }

    /**
     * Processes the changes from the selected plant form into a readable preview display html. In the process it validates the changes based on the level of the spell
     * 
     * @param {string} chosenForm The name of the form chosen in the dropdown
     * @returns {string} HTML containing preview of all the changes to be made to the actor
     */
    async buildPreviewTemplate(chosenForm) {
        let data = {};
        this.chosenForm = this.shapeOptions.plant.find(o => o.name === chosenForm);

        // Process stat changes for polymorphing smaller than small or larger than medium
        data.polymorphBase = '';
        this.polymorphChanges = MorphinChanges.changes.polymorphSize[this.actorSize] || {};
        if (!!this.polymorphChanges) {
            for (let i = 0; i < this.polymorphChanges.length; i++) {
                const change = this.polymorphChanges[i];
                if (!!change.target && change.target === 'ability') {
                    if (data.polymorphBase.length > 0) data.polymorphBase += ', '; // comma between entries
                    // text output of the stat (capitalized), and a + in front of positive numbers
                    data.polymorphBase += `${ game.i18n.localize('MMMOD.UI.' + change.subTarget.charAt(0).toUpperCase() + change.subTarget.slice(1)) } ${ (change.value > 0 ? '+' : '') }${ change.value }`;
                }
            }
        }

        // Process stat changes from the spell based on spell level
        data.scoreChanges = '';
        this.changes = MorphinChanges.changes.plantShape.plant[this.chosenForm.size].changes;
        for (let i = 0; i < this.changes.length; i++) {
            const change = this.changes[i];

            if (!!change.target && change.target === 'ability') { // stat change
                if (data.scoreChanges.length > 0) data.scoreChanges += ', ';
                data.scoreChanges += `${ game.i18n.localize('MMMOD.UI.' + change.subTarget.charAt(0).toUpperCase() + change.subTarget.slice(1)) } ${ (change.value > 0 ? '+' : '') }${ change.value }`;
            }
            else if (!change.target && change.subTarget == 'nac') { // natural AC change
                if (data.scoreChanges.length > 0) data.scoreChanges += ', ';
                data.scoreChanges += `${ game.i18n.localize('MMMOD.UI.NaturalAC') } ${ (change.value > 0 ? '+' : '') }${ change.value }`;
            }
        }

        // Process changes to speed, limited by maximum the spell level allows
        data.speedChanges = '';
        this.speeds = duplicate(MorphinChanges.changes[this.chosenForm.name].speed);
        for (let i = 0; i < Object.keys(this.speeds).length; i++) {
            const element = Object.keys(this.speeds)[i];

            if (data.speedChanges.length > 1) data.speedChanges += ', ';
            data.speedChanges += `${ game.i18n.localize('MMMOD.UI.' + element) } ${ element === 'fly' ? this.speeds[element].base : this.speeds[element] } ${ game.i18n.localize('MMMOD.UI.ft') }${ element === 'fly' ? ' (' + game.i18n.localize('MMMOD.UI.' + this.speeds[element].maneuverability) + ')' : '' }`;
        }

        // Process the natural attacks
        data.attacks = '';
        let attackList = MorphinChanges.changes[this.chosenForm.name].attacks;
        for (let i = 0; i < attackList.length; i++) {
            const element = attackList[i];

            let attackSpecial = '';
            if (!!element.special) { // process any specials associated with the attack
                for (let j = 0; j < element.special.length; j++) {
                    const specialName = element.special[j];
                    if (MorphinChanges.allowedSpecials[this.spell][this.level].includes(specialName)) {
                        if (attackSpecial.length > 0) attackSpecial += ', ';
                        attackSpecial += game.i18n.localize('MMMOD.Attacks.' + specialName);
                    }
                }
            }

            let damageDice = element.diceSize === 0 ? '' : `${ element.diceCount }d${ element.diceSize }`;
            if (element.nonCrit) damageDice += (!!damageDice.length ? ` ${ game.i18n.localize('MMMOD.UI.Plus') } ` : '') + `${ element.nonCrit.formula } ${!!element.nonCrit.type.values.toString() ? 
                game.i18n.localize('MMMOD.DamageTypes.' + element.nonCrit.type.values.toString()) : game.i18n.localize('MMMOD.DamageTypes.' + element.nonCrit.type.custom)}`;
            if (data.attacks.length > 0) data.attacks += ', ';
            data.attacks += `${ element.count > 1 ? element.count + ' ' : '' }${ game.i18n.localize('MMMOD.Attacks.' + element.name) } (${ !!damageDice ? damageDice : '0' }${ !!attackSpecial ? ` ${ game.i18n.localize('MMMOD.UI.Plus') } ` + attackSpecial : '' })`;
        }
        if (!data.attacks.length) data.attacks = game.i18n.localize('MMMOD.UI.None');

        // Process special attacks
        data.specialAttacks = '';
        let specialAttackList = MorphinChanges.changes[this.chosenForm.name].specialAttack || [];
        for (let i = 0; i < specialAttackList.length; i++) {
            const element = specialAttackList[i];

            // Make sure the special attack is allowed at this level of spell before processing it
            let valid = true;
            for (let j = 0; j < (element.special?.length || 0); j++) {
                const special = element.special[j];

                if (!MorphinChanges.allowedSpecials[this.spell][this.level].includes(special)) valid = false;
            }

            if (valid) {
                let attackSpecial = '';
                if (!!element.special) {
                    for (let j = 0; j < element.special.length; j++) {
                        const specialName = element.special[j];
                        if (MorphinChanges.allowedSpecials[this.spell][this.level].includes(specialName)) {
                            if (attackSpecial.length > 0) attackSpecial += ', ';
                            attackSpecial += game.i18n.localize('MMMOD.Attacks.' + specialName);
                        }
                    }
                }

                let damageDice = element.diceSize === 0 ? '' : `${ element.diceCount }d${ element.diceSize }`;
                if (element.nonCrit) damageDice += (!!damageDice.length ? ` ${ game.i18n.localize('MMMOD.UI.Plus') } ` : '') + `${ element.nonCrit.formula } ${!!element.nonCrit.type.values.toString() ? 
                    game.i18n.localize('MMMOD.DamageTypes.' + element.nonCrit.type.values.toString()) : game.i18n.localize('MMMOD.DamageTypes.' + element.nonCrit.type.custom)}`;
                if (data.specialAttacks.length > 0) data.specialAttacks += ', ';
                data.specialAttacks += `${ element.count > 1 ? element.count + ' ' : '' }${ game.i18n.localize('MMMOD.Attacks.' + element.name) } (${ !!damageDice ? damageDice : '0' }${ !!attackSpecial ? ` ${ game.i18n.localize('MMMOD.UI.Plus') } ` + attackSpecial : '' })`;
            }
        }
        if (!data.specialAttacks.length) data.specialAttacks = game.i18n.localize('MMMOD.UI.None');

        // Process changes in senses limited by the spell level
        const formSenses = duplicate(MorphinChanges.changes[this.chosenForm.name].senses);
        this.senses = [];
        data.senses = !!formSenses.length ? '' : game.i18n.localize('MMMOD.UI.None');
        for (let i = 0; i < formSenses.length; i++) {
            let senseEnumValue = formSenses[i];
            const senseKey = Object.keys(MorphinChanges.SENSES[Object.keys(MorphinChanges.SENSES)[senseEnumValue - 1]].setting)[0];
            const senseValue = MorphinChanges.SENSES[Object.keys(MorphinChanges.SENSES)[senseEnumValue - 1]].setting[senseKey];
            
            const allowedSenses = MorphinChanges.allowedSenses[this.spell][this.level];
            if (!allowedSenses[senseKey]) continue;

            if (senseValue > allowedSenses[senseKey].value) {
                senseEnumValue = MorphinChanges.SENSES[allowedSenses[senseKey].static + allowedSenses[senseKey].value].value;
            }
            this.senses.push(senseEnumValue);
            
            if (!!senseEnumValue && !!MorphinChanges.allowedSenses[this.spell][this.level][senseKey]) {
                if (data.senses.length > 0) data.senses += ', ';
                data.senses += `${ game.i18n.localize('MMMOD.Senses.' + MorphinChanges.SENSES[Object.keys(MorphinChanges.SENSES)[senseEnumValue - 1]].name) }`; // enum value 1 = SENSES[0] = LOWLIGHT
            }
        }
        if (!data.senses.length) data.senses = game.i18n.localize('MMMOD.UI.None');

        // Process special qualities
        data.special = game.i18n.localize('MMMOD.UI.None');
        this.special = !!MorphinChanges.changes[this.chosenForm.name].special ? duplicate(MorphinChanges.changes[this.chosenForm.name].special) : [];
        for (let i = 0; i < this.special.length; i++) {
            const specialName = this.special[i];

            // Check just the first word of the special text, so something like 'jet 200ft' matches 'jet'
            if (!MorphinChanges.allowedSpecials[this.spell][this.level].includes(specialName.split(' ')[0])) {
                delete (this.special[i]);
                continue;
            }
            else {
                if (data.special === game.i18n.localize('MMMOD.UI.None')) data.special = '';
                if (data.special.length > 0) data.special += ', ';
                data.special += game.i18n.localize('MMMOD.Attacks.' + specialName);
            }
        }

        const elementTypes = ['acid', 'cold', 'electric', 'fire', 'sonic'];

        if (this.level >= 2) {
            const eres = MorphinChanges.changes[this.chosenForm.name].eres?.filter(o => elementTypes.includes(o.types[0])) || [];
            data.eres = '';
            
            const di = MorphinChanges.changes[this.chosenForm.name].di?.filter(o => elementTypes.includes(o)) || [];
            for (const entry of di) {
                eres.push({ amount: 20, operator: true, types: [entry, ''] });
            }
    
            for (const entry of eres) {
                if (data.eres.length > 0) data.eres += ', ';
                if (typeof(entry) === 'string') {
                    data.eres += entry;
                }
                else {
                    data.eres += game.i18n.localize('MMMOD.DamageTypes.' + entry.types[0].charAt(0).toUpperCase() + entry.types[0].slice(1)) + ' ' + Math.min(entry.amount, 20);
                }
            }
            if (data.eres.length === 0) data.eres = game.i18n.localize('MMMOD.UI.None');
            this.eres = eres;
        }

        const dv = MorphinChanges.changes[this.chosenForm.name].dv?.filter(o => elementTypes.includes(o)) || [];
        data.dv = dv.map(o => game.i18n.localize('MMMOD.DamageTypes.' + o.replace(/[^A-Za-z0-9]+/g, ''))).join(', ') || game.i18n.localize('MMMOD.UI.None');
        this.dv = dv;

        if (this.level === 3) {
            const dr = MorphinChanges.changes[this.chosenForm.name].dr || [];
            data.dr = '';
            for (const entry of dr) {
                if (data.dr.length > 0) data.dr += ', ';
                if (typeof(entry) === 'string') {
                    let splitDr = entry.split('/');
                    data.dr += splitDr[0] + '/' + game.i18n.localize('MMMOD.DamageTypes.' + splitDr[1].replace(/[^A-Za-z0-9]+/g, ''));
                }
                else {
                    data.dr += entry.amount + '/';
                    if (entry.types[0].length === 0) {
                        data.dr += '-';
                    }
                    else {
                        data.dr += game.i18n.localize('MMMOD.DamageTypes.' + entry.types[0].charAt(0).toUpperCase() + entry.types[0].slice(1));
                    }
                    if (entry.types[1].length > 0) data.dr += ' ' + (entry.operator ? game.i18n.localize('MMMOD.UI.or') : game.i18n.localize('MMMOD.UI.and')) + ' ' + game.i18n.localize('MMMOD.DamageTypes.' + entry.types[1].charAt(0).toUpperCase() + entry.types[1].slice(1));
                }
            }
            if (data.dr.length === 0) data.dr = game.i18n.localize('MMMOD.UI.None');
            this.dr = dr;

            const regen = MorphinChanges.changes[this.chosenForm.name].regen || [];
            data.regen = regen.map(o => '' + o.value + ' (' + o.counter.map(c => game.i18n.localize('MMMOD.DamageTypes.' + c)).join(' ' + game.i18n.localize('MMMOD.UI.or') + ' ') + ')').join(', ') || game.i18n.localize('MMMOD.UI.None');
            this.regen = regen.map(o => '' + o.value + ' (' + o.counter.map(c => game.i18n.localize('MMMOD.DamageTypes.' + c)).join(' ' + game.i18n.localize('MMMOD.UI.or') + ' ') + ')').join('; ') || '';
        }

        // Build the html preview
        let newHtml = `${ !!data.polymorphBase ? '<p><span class="previewLabel">' + game.i18n.localize('MMMOD.UI.BaseSizeAdjust') + ': </span><span id="polymorphScores">' + data.polymorphBase + '</span></p>' : '' }
        <p><span class="previewLabel">${ game.i18n.localize('MMMOD.UI.AbilityScores') }: </span><span id="abilityScores">${ data.scoreChanges }</span></p>
        <p><span class="previewLabel">${ game.i18n.localize('MMMOD.UI.Attacks') }: </span><span id="attacks">${ data.attacks }</span></p>
        <p><span class="previewLabel">${ game.i18n.localize('MMMOD.UI.SpecialAttacks') }: </span><span id="specialAttacks">${ data.specialAttacks }</span></p>
        <p><span class="previewLabel">${ game.i18n.localize('MMMOD.UI.Speeds') }: </span><span id="speeds">${ data.speedChanges }</span></p>
        <p><span class="previewLabel">${ game.i18n.localize('MMMOD.UI.Senses') }: </span><span id="senses">${ data.senses }</span></p>
        <p><span class="previewLabel">${ game.i18n.localize('MMMOD.UI.SpecialAbilities') }: </span><span id="specials">${ data.special }</span></p>
        <p><span class="previewLabel">${ game.i18n.localize('MMMOD.UI.Vulnerabilities') }: </span><span id="dv">${ data.dv }</span></p>
        ${ this.level >= 2 ? '<p><span class="previewLabel">' + game.i18n.localize('MMMOD.UI.EnergyResistances') + ': </span><span id="di">' + data.eres + '</span></p>' : '' }
        ${ this.level === 3 ? '<p><span class="previewLabel">' + game.i18n.localize('MMMOD.UI.DamageResistances') + ': </span><span id="dr">' + data.dr + '</span></p>' : '' }
        ${ this.level === 3 ? '<p><span class="previewLabel">' + game.i18n.localize('MMMOD.UI.Regeneration') + ': </span><span id="dr">' + data.regen + '</span></p>' : '' }`;

        return newHtml;
    }

    /** @inheritdoc */
    processDr(dr) {
        if (this.level === 3) return super.processDr(dr);
        else return { value: [], custom: '' };
    }
    
    /** @inheritdoc */
     processEres(eres) {
        if (this.level >= 2) return super.processEres(eres);
        else return { value: [], custom: '' };
    }

    /** @inheritdoc */
    processDv(dv) {
        return dv;
    }

    /** @inheritdoc */
    processDi(di) {
        return { value: [], custom: '' };
    }


    /** @inheritdoc */
    processRegen(regen) {
        if (this.level === 3) return regen;
        else return '';
    }

    /** @inheritdoc */
    activateListeners(html) {
        super.activateListeners(html);
    }
}
