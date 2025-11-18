/**
 * @file Defines the base Entity class for the component-based architecture.
 * @module entities/Entity
 */

import { Group, Scene, Texture } from 'three';

/**
 * Represents an object in the game (player, enemy, item, portal, etc.).
 * Acts as a container for Components. The logic and data of an entity
 * are defined by the components it possesses.
 */
export default class Entity {
    /**
     * @param {import('../core/Game.js').default} game - The main game instance.
     * @param {Scene} scene - The Three.js scene where the entity (or its representation) exists.
     */
    constructor(game, scene) {
        /** @type {import('../core/Game.js').default} */
        this.game = game; // Store the game instance
        /** @type {Scene} */
        this.scene = scene;
        /** @type {import('../components/BaseComponent.js').default[]} */
        this.components = [];
        /** @type {string} */
        this.id = Math.random().toString(36).substring(2, 9); // Unique ID for debugging

        /**
         * The root 3D object for this entity in the scene.
         * Visual components should add their meshes/objects to this group.
         * @type {Group}
         */
        this.sceneObject = new Group();
        this.sceneObject.userData.entity = this; // Store a reference to this Entity
        if (this.scene) {
            this.scene.add(this.sceneObject);
        } else {
            console.error("Entity constructor: 'scene' is null. Cannot add sceneObject to scene.");
            // Depending on desired behavior, you might throw an error here:
            // throw new Error("Cannot create Entity: Scene is null.");
        }
    }

    /**
     * Adds a component to the entity.
     * @param {import('../components/BaseComponent.js').default} component - The component instance to add.
     */
    addComponent(component) {
        this.components.push(component);
        component.owner = this; // Ensure back-reference
    }

    /**
     * Finds and returns the first component of a given class type.
     * @template {import('../components/BaseComponent.js').default} T
     * @param {{new(...args: any[]): T}} ComponentClass - The class of the component to find (e.g., RenderComponent).
     * @returns {T|null} The component instance, or null if not found.
     */
    getComponent(ComponentClass) {
        return this.components.find((c) => c instanceof ComponentClass) || null;
    }

    /**
     * Called every frame by the State that manages this entity.
     * Delegates the update call to all its components.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        for (const component of this.components) {
            component.update(deltaTime);
        }
    }

    /**
     * Removes the entity's scene object and all its children from the scene.
     * Disposes of geometries and materials that are not cached.
     */
    destroy() {
        // Recursively dispose of geometries and materials
        this.sceneObject.traverse((object) => {
            if (object.isMesh) {
                if (object.geometry) {
                    object.geometry.dispose();
                }

                const disposeMaterial = (material) => {
                    if (material && material.isMaterial && !material.userData.isCachedMaterial) {
                        // Dispose of textures associated with the material
                        for (const key in material) {
                            const value = material[key];
                            if (value instanceof Texture) {
                                value.dispose();
                            }
                        }
                        material.dispose();
                    }
                };

                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(disposeMaterial);
                    } else {
                        disposeMaterial(object.material);
                    }
                }
            }
        });
        // Ensure the scene exists before trying to remove from it
        if (this.scene) {
            this.scene.remove(this.sceneObject);
        }
    }
}
