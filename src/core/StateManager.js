/**
 * @file Manages the game's finite state machine, handling transitions between different game states (worlds/scenes).
 * @module core/StateManager
 */

import { eventBus } from './EventBus.js';
import HubWorldState from '../states/HubWorldState.js'; // Assuming HubWorldState is also managed here
import SolarSystemState from '../states/SolarSystemState.js'; // Import SolarSystemState

/**
 * Manages the game's finite state machine. Each state represents a "world" or "scene"
 * (e.g., Main Menu, Hub, Minigame). It is responsible for transitioning between states,
 * ensuring the old state is cleaned up (exit) and the new one is initialized (enter).
 */
export default class StateManager {
    /**
     * @param {import('./Game.js').default} game - The main game instance.
     */
    constructor(game) {
        this.game = game;
        this.states = {};
        this.currentState = null;

        // Register states
        this.addState('HubWorld', new HubWorldState(game));
        this.addState('SolarSystem', new SolarSystemState(game));
        console.log("StateManager: All states registered in constructor:", this.states); // Added log

        eventBus.on('change-state', this.setState.bind(this));
    }

    /**
     * Adds a state to the list of available states.
     * @param {string} name - The name of the state (e.g., 'HubWorld').
     * @param {import('../states/BaseState.js').default} state - The state class instance.
     */
    addState(name, state) {
        console.log(`StateManager: Attempting to add state '${name}':`, state); // Added log
        this.states[name] = state;
        console.log(`StateManager: State '${name}' added. Current states map:`, this.states); // Added log
    }

    /**
     * Sets the active game state.
     * @param {string} name - The name of the state to activate.
     */
    setState(name) {
        if (this.currentState) {
            console.log(`Exiting state: ${this.currentState.constructor.name}`);
            this.currentState.exit();
        }

        const newState = this.states[name];
        if (newState) {
            console.log(`Entering state: ${name}`);
            this.currentState = newState;
            this.currentState.enter();
        } else {
            console.error(`State '${name}' not found.`);
        }
    }

    /**
     * Called every frame by the main game loop.
     * Delegates the update logic to the currently active state.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        if (this.currentState) {
            this.currentState.update(deltaTime);
        }
    }
}
