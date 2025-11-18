/**
 * @file Allows an entity (the player) to interact with objects in the world.
 * @module components/PlayerInteractionComponent
 */

import { Object3D } from 'three';
import BaseComponent from './BaseComponent.js';

/**
 * Handles detecting and triggering interactions with nearby objects.
 */
export default class PlayerInteractionComponent extends BaseComponent {
    /**
     * @param {import('../entities/Entity.js').default} owner - The entity that owns this component.
     * @param {Object3D[]} interactableObjects - A list of objects that can be interacted with.
     * @param {import('../core/InteractionManager.js').default} interactionManager - The interaction manager instance.
     */
    constructor(owner, interactableObjects = [], interactionManager) {
        super(owner);
        this.interactableObjects = interactableObjects;
        this.interactionManager = interactionManager;
        this.interactionRadius = 2; // How close the player needs to be to interact
        this.closestInteractable = null;

        // Properties for 'F' key hold detection
        this.isFKeyPressed = false;
        this.fKeyPressStartTime = 0;
        this.fKeyHoldThreshold = 500; // milliseconds to consider a 'hold'

        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
    }

    /**
     * Finds the closest interactable object within the interaction radius.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        const playerPosition = this.owner.sceneObject.position;
        this.closestInteractable = null;
        let minDistance = this.interactionRadius;

        for (const object of this.interactableObjects) {
            // Ensure the object has an interactionId and is not the player itself
            if (object.userData.interactionId && object !== this.owner.sceneObject) {
                const distance = playerPosition.distanceTo(object.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    this.closestInteractable = object;
                }
            }
        }
    }

    /**
     * Handles the keydown event for interaction.
     * @param {KeyboardEvent} event
     */
    onKeyDown(event) {
        if (event.key.toLowerCase() === 'f' && !this.isFKeyPressed) {
            this.isFKeyPressed = true;
            this.fKeyPressStartTime = performance.now();
            console.log('PlayerInteractionComponent: F key pressed.');
        }
    }

    /**
     * Handles the keyup event for interaction, triggering different actions based on hold duration.
     * @param {KeyboardEvent} event
     */
    onKeyUp(event) {
        if (event.key.toLowerCase() === 'f') {
            this.isFKeyPressed = false;
            console.log('PlayerInteractionComponent: F key released.');

            if (!this.closestInteractable) {
                console.log('PlayerInteractionComponent: No interactable object nearby.');
                return;
            }

            if (!this.interactionManager) {
                console.error("InteractionManager not provided to PlayerInteractionComponent.");
                return;
            }

            const holdDuration = performance.now() - this.fKeyPressStartTime;
            const { interactionId, interactionData } = this.closestInteractable.userData;

            console.log(`PlayerInteractionComponent: Hold duration: ${holdDuration}ms.`);
            console.log(`PlayerInteractionComponent: Closest interactable - ID: ${interactionId}, Data:`, interactionData);

            // If the interaction is to change the world, always execute it regardless of tap/hold
            if (interactionId === 'changeWorld' && interactionData && interactionData.targetState) {
                console.log(`PlayerInteractionComponent: Arcade Machine interaction detected. Changing world to ${interactionData.targetState}.`);
                this.interactionManager.execute(interactionId, interactionData);
                return; // Exit after handling changeWorld
            }

            if (holdDuration >= this.fKeyHoldThreshold) {
                console.log('PlayerInteractionComponent: F key held. Triggering showAnimationSelection.');
                // 'F' was held, trigger animation selection
                this.interactionManager.execute('showAnimationSelection', {
                    target: this.closestInteractable,
                    allAnimationData: this.owner.game.loader.getAnimationData(this.closestInteractable.userData.model)
                });
            } else {
                console.log('PlayerInteractionComponent: F key tapped. Triggering default interaction.');
                // 'F' was tapped, trigger default interaction (e.g., toggleAnimation)
                this.interactionManager.execute(interactionId, {
                    ...interactionData,
                    target: this.closestInteractable,
                });
            }
        }
    }

    /**
     * Cleans up the event listeners when the component is destroyed.
     */
    destroy() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
    }
}
