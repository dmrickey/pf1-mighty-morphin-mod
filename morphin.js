import { MightyMorphinApp } from './scripts/mighty-morphin.js';
import DirectoryPicker from './scripts/DirectoryPicker.js';
import { Settings } from './scripts/settings.js';

// Expose functions to users
Hooks.once('init', () => {
    game.mightyMorphin = MightyMorphinApp;
});

Hooks.once('ready', async () => {
    initializeSettings();
});

Hooks.once('init', function () {
    registerSettings();
});

/**
 * Registers module settings with Foundry menu
 */
export const registerSettings = function () {
    game.settings.register('pf1-mighty-morphin', 'imagePath', {
        name: 'Form Token Image Path',
        hint: 'Set path to a folder to search for form token images to change to. Images must be an exact match to form name with only letters (no spaces or non-letter/number characters, case sensitive)',
        default: '[data]',
        scope: 'world',
        type: DirectoryPicker.Directory,
        config: true
    });
};

/**
 * Initializes module settings from values in menu
 */
export const initializeSettings = function () {
    // hit getter to cache current directory data
    Settings.imageDirectory;
};
