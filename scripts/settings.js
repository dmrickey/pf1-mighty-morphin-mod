import { MODULE_NAME } from "./consts";

export class Settings {

    pathMapping = {};
    static get imageDirectory() {
        const currentPath = Settings.#getSetting('imagePath');
        if (pathMapping[currentPath]) {
            return pathMapping.currentPath
        }

        const dir = DirectoryPicker.parse(path);
        DirectoryPicker.verifyPath(dir);
        MightyMorphinApp.imageFolder = dir;
        return dir;
    }

    static #getSetting(key) {
        return game.settings.get(MODULE_NAME, key);
    }
}