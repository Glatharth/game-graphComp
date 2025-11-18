/**
 * @file Manages all custom interactions in the game.
 * @module core/InteractionManager
 */

import AnimationComponent from '../components/AnimationComponent.js'; // Import AnimationComponent
import { eventBus } from './EventBus.js'; // Ensure eventBus is imported

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

        this.animationSelectionUI = null;
        this.currentAnimationTarget = null; // Stores the entity whose animations are being selected

        // Bind methods
        this.hideAnimationSelectionUI = this.hideAnimationSelectionUI.bind(this);

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
            } else {
                console.warn("teleportPlayer interaction called without valid x and z coordinates.");
            }
        });

        this.register('toggleAnimation', (data) => {
            if (!data.target) {
                console.error('toggleAnimation interaction called without a target.');
                return;
            }
            
            // Correctly retrieve the entity from the target's userData
            const entity = data.target.userData.entity;
            const animComponent = entity ? entity.getComponent(AnimationComponent) : null;


            if (entity && animComponent) {
                animComponent.toggleAnimation(data.animationName);
            } else {
                console.warn(`toggleAnimation: Target entity or AnimationComponent not found for model "${data.target.userData.model}".`);
            }
        });

        this.register('showAnimationSelection', (data) => {
            if (!data.target) {
                console.error('showAnimationSelection interaction called without a target.');
                return;
            }

            // Correctly retrieve the entity from the target's userData
            const entity = data.target.userData.entity;
            const animComponent = entity ? entity.getComponent(AnimationComponent) : null;

            if (entity && animComponent) {
                this.currentAnimationTarget = entity;
                const animationNames = animComponent.getAnimationNames();
                this.displayAnimationSelectionUI(animationNames);
            } else {
                console.warn(`showAnimationSelection: Target entity or AnimationComponent not found for model "${data.target.userData.model}".`);
            }
        });

        // New interaction to change the game state (world)
        this.register('changeWorld', (data) => {
            if (data && data.targetState) {
                console.log(`InteractionManager: Attempting to change state to: ${data.targetState}`);
                eventBus.emit('change-state', data.targetState);
            } else {
                console.warn("changeWorld interaction called without a targetState.");
            }
        });
    }

    /**
     * Displays a UI overlay with a list of animations to choose from.
     * @param {string[]} animationNames - An array of animation names.
     */
    displayAnimationSelectionUI(animationNames) {
        if (this.animationSelectionUI) {
            this.hideAnimationSelectionUI(); // Hide any existing UI
        }

        this.animationSelectionUI = document.createElement('div');
        this.animationSelectionUI.id = 'animation-selection-ui';
        this.animationSelectionUI.style.position = 'absolute';
        this.animationSelectionUI.style.top = '50%';
        this.animationSelectionUI.style.left = '50%';
        this.animationSelectionUI.style.transform = 'translate(-50%, -50%)';
        this.animationSelectionUI.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.animationSelectionUI.style.padding = '20px';
        this.animationSelectionUI.style.borderRadius = '10px';
        this.animationSelectionUI.style.color = 'white';
        this.animationSelectionUI.style.zIndex = '1000';
        this.animationSelectionUI.style.display = 'flex';
        this.animationSelectionUI.style.flexDirection = 'column';
        this.animationSelectionUI.style.gap = '10px';
        this.animationSelectionUI.style.maxHeight = '80%';
        this.animationSelectionUI.style.overflowY = 'auto';

        const title = document.createElement('h3');
        title.textContent = 'Select Animation:';
        this.animationSelectionUI.appendChild(title);

        if (animationNames.length === 0) {
            const noAnimText = document.createElement('p');
            noAnimText.textContent = 'No animations found for this object.';
            this.animationSelectionUI.appendChild(noAnimText);
        } else {
            animationNames.forEach(name => {
                const button = document.createElement('button');
                button.textContent = name;
                button.style.padding = '10px 15px';
                button.style.backgroundColor = '#61dafb';
                button.style.color = '#282c34';
                button.style.border = 'none';
                button.style.borderRadius = '5px';
                button.style.cursor = 'pointer';
                button.style.fontSize = '1em';
                button.style.transition = 'background-color 0.2s';
                button.onmouseover = () => button.style.backgroundColor = '#21a1f1';
                button.onmouseout = () => button.style.backgroundColor = '#61dafb';
                button.onclick = () => {
                    if (this.currentAnimationTarget) {
                        const targetAnimComponent = this.currentAnimationTarget.getComponent(AnimationComponent);
                        if (targetAnimComponent) {
                            targetAnimComponent.playAnimation(name, true); // Force play selected animation
                        }
                    }
                    this.hideAnimationSelectionUI();
                };
                this.animationSelectionUI.appendChild(button);
            });
        }

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.marginTop = '10px';
        closeButton.style.padding = '10px 15px';
        closeButton.style.backgroundColor = '#f44336';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontSize = '1em';
        closeButton.onmouseover = () => closeButton.style.backgroundColor = '#d32f2f';
        closeButton.onmouseout = () => closeButton.style.backgroundColor = '#f44336';
        closeButton.onclick = this.hideAnimationSelectionUI;
        this.animationSelectionUI.appendChild(closeButton);


        document.body.appendChild(this.animationSelectionUI);
    }

    /**
     * Hides the animation selection UI.
     */
    hideAnimationSelectionUI() {
        if (this.animationSelectionUI && this.animationSelectionUI.parentNode) {
            this.animationSelectionUI.parentNode.removeChild(this.animationSelectionUI);
            this.animationSelectionUI = null;
            this.currentAnimationTarget = null;
        }
    }
}
