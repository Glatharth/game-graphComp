/**
 * @file Defines the base class for all game states.
 * @module states/BaseState
 */

import { Scene, Camera } from 'three';

/**
 * Base class (or "interface") for all game states (HubWorld, MiniGame, etc.).
 * It defines the essential methods that the StateManager expects each state to have.
 */
export default class BaseState {
    /**
     * @param {import('../core/Game.js').default} game - The main game instance.
     */
    constructor(game) {
        /**
         * The main game instance.
         * @type {import('../core/Game.js').default}
         */
        this.game = game;
        /**
         * The Three.js scene for this state.
         * @type {Scene|null}
         */
        this.scene = null;
        /**
         * The Three.js camera for this state.
         * @type {Camera|null}
         */
        this.camera = null;
    }

    /**
     * Called by the StateManager when this state becomes active.
     * Ideal for setting up the scene, camera, lights, and instantiating entities.
     */
    enter() {
        // To be implemented by subclasses
    }

    /**
     * Called by the StateManager before switching to a new state.
     * Ideal for cleaning up the scene, removing state-specific event listeners, etc.
     */
    exit() {
        // To be implemented by subclasses
    }

    /**
     * Called every frame by the StateManager.
     * Ideal for updating all entities and state-specific logic.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        // To be implemented by subclasses
    }
}
