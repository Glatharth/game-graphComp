/**
 * @file Manages all custom interactions in the game.
 * @module core/InteractionManager
 */

/**
 * A centralized system for registering and executing game interactions.
 * This allows decoupling the interaction logic from the objects themselves.
 */
export default class InteractionManager {
    /**
     * @param {import('./Game.js').default} game The main game instance.
     */
    constructor(game) {
        this.game = game;
        /**
         * A map where keys are interaction IDs and values are the functions to execute.
         * @type {Map<string, Function>}
         */
        this.interactions = new Map();

        // Register default interactions
        this.registerDefaults();
    }

    /**
     * Registers a new interaction function.
     * @param {string} id - The unique identifier for the interaction.
     * @param {Function} action - The function to execute. It will receive `interactionData` as an argument.
     */
    register(id, action) {
        if (this.interactions.has(id)) {
            console.warn(`Interaction with ID "${id}" is already registered. Overwriting.`);
        }
        this.interactions.set(id, action);
    }

    /**
     * Executes an interaction by its ID.
     * @param {string} id - The ID of the interaction to execute.
     * @param {object} [data={}] - The data payload from the world JSON to pass to the action.
     */
    execute(id, data = {}) {
        const action = this.interactions.get(id);
        if (action) {
            action(data);
        } else {
            console.error(`No interaction registered with ID "${id}".`);
        }
    }

    /**
     * Registers the default interactions available in the game.
     */
    registerDefaults() {
        // Interaction to show a browser alert.
        this.register('showMessage', (data) => {
            if (data && data.message) {
                alert(data.message);
            } else {
                console.warn("showMessage interaction called without a message.");
            }
        });

        this.register('teleportPlayer', (data) => {
            const player = this.game.stateManager.currentState?.player;
            if (!player) {
                console.error("Cannot teleport: Player not found in the current state.");
                return;
            }
            if (data && typeof data.x === 'number' && typeof data.z === 'number') {
                // We also check for y, but default to player's current y if not provided.
                const y = typeof data.y === 'number' ? data.y : player.sceneObject.position.y;
                player.sceneObject.position.set(data.x, y, data.z);
                console.log(`Player teleported to ${data.x}, ${y}, ${data.z}`);
            } else {
                console.warn("teleportPlayer interaction called without valid x and z coordinates.");
            }
        });
    }
}
