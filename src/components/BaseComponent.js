/**
 * @file Defines the base class for all components.
 * @module components/BaseComponent
 */

/**
 * The base class for all components. It defines the interface that all components must follow.
 * Each component is a "building block" that adds a behavior or data to an entity.
 */
export default class BaseComponent {
    /**
     * @param {import('../entities/Entity.js').default} owner - The entity to which this component belongs.
     */
    constructor(owner) {
        /**
         * The entity that owns this component.
         * @type {import('../entities/Entity.js').default}
         */
        this.owner = owner;
    }

    /**
     * Update method, called every frame by the entity's loop.
     * The component's specific logic (movement, rendering, etc.) goes here.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        // To be implemented by subclasses
    }
}
