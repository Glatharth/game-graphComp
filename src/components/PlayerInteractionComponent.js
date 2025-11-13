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

        this.handleInteraction = this.handleInteraction.bind(this);
        window.addEventListener('keydown', this.handleInteraction);
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
            if (object.userData.interactionId) {
                const distance = playerPosition.distanceTo(object.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    this.closestInteractable = object;
                }
            }
        }
    }

    /**
     * Handles the key press for interaction.
     * @param {KeyboardEvent} event
     */
    handleInteraction(event) {
        if (event.key.toLowerCase() === 'f' && this.closestInteractable) {
            if (!this.interactionManager) {
                console.error("InteractionManager not provided to PlayerInteractionComponent.");
                return;
            }
            const { interactionId, interactionData } = this.closestInteractable.userData;
            this.interactionManager.execute(interactionId, interactionData);
        }
    }

    /**
     * Cleans up the event listener when the component is destroyed.
     */
    destroy() {
        window.removeEventListener('keydown', this.handleInteraction);
    }
}
