/**
 * ObjectLoader is responsible for loading asset definitions from manifest files.
 * It provides templates for objects and data for worlds, but does not
 * instantiate the objects themselves. This allows each world to control
 * how and when objects are created.
 */
export default class ObjectLoader {
    constructor() {
        this.objectTemplates = new Map();
        this.animationData = new Map();
    }

    /**
     * Loads the main asset manifest file. This file contains the templates
     * for all reusable objects in the game.
     * @param {string} path - The path to the manifest.json file.
     */
    async loadManifest(path) {
        try {
            const response = await fetch(path);
            const manifest = await response.json();
            for (const key in manifest.objects) {
                this.objectTemplates.set(key, manifest.objects[key]);
            }
        } catch (error) {
            console.error('Error loading asset manifest:', error);
        }
    }

    /**
     * Loads the animation data from the given path.
     * @param {string} path - The path to the animations.json file.
     */
    async loadAnimationData(path) {
        try {
            const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
            const animationFile = await response.json();
            for (const category in animationFile) {
                for (const key in animationFile[category]) {
                    this.animationData.set(key, animationFile[category][key]);
                }
            }
        } catch (error) {
            console.error('Error loading animation data:', error);
        }
    }

    /**
     * Retrieves a pre-loaded object template.
     * @param {string} type - The type of the object (e.g., "player").
     * @returns {object | undefined} The object template.
     */
    getObjectTemplate(type) {
        return this.objectTemplates.get(type);
    }

    /**
     * Retrieves the animation data for a specific model.
     * @param {string} name - The name of the model (e.g., "character-female-a").
     * @returns {object | undefined} The animation data for the model.
     */
    getAnimationData(name) {
        return this.animationData.get(name);
    }

    /**
     * Loads the specific data for a world, including which objects to place
     * and where, and definitions for portals.
     * @param {string} worldName - The name of the world to load (e.g., "hub").
     * @returns {Promise<object | null>} A promise that resolves with the world data.
     */
    async loadWorldData(worldName) {
        try {
            const response = await fetch(`/public/worlds/${worldName}.json?v=${Date.now()}`, { cache: 'no-store' });
            return await response.json();
        } catch (error) {
            console.error(`Error loading world data for ${worldName}:`, error);
            return null;
        }
    }
}
