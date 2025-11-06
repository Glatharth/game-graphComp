/**
 * @file Defines the base Entity class for the component-based architecture.
 * @module entities/Entity
 */

import RenderComponent from '../components/RenderComponent.js';

/**
 * Represents an object in the game (player, enemy, item, portal, etc.).
 * Acts as a container for Components. The logic and data of an entity
 * are defined by the components it possesses.
 */
export default class Entity {
  /**
   * @param {THREE.Scene} scene - The Three.js scene where the entity (or its representation) exists.
   */
  constructor(scene) {
    /** @type {THREE.Scene} */
    this.scene = scene;
    /** @type {import('../components/BaseComponent.js').default[]} */
    this.components = [];
    /** @type {string} */
    this.id = Math.random().toString(36).substring(2, 9); // Unique ID for debugging
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
   * @template {import('../components/BaseComponent.js').default}
   * @param {new(...args: any[]) => T} ComponentClass - The class of the component to find (e.g., RenderComponent).
   * @returns {T|null} The component instance, or null if not found.
   */
  getComponent(ComponentClass) {
    return this.components.find(c => c instanceof ComponentClass) || null;
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
   * Removes the entity and its visual representation from the scene.
   */
  destroy() {
    const renderComponent = this.getComponent(RenderComponent);
    if (renderComponent && renderComponent.mesh) {
      this.scene.remove(renderComponent.mesh);
      // Also dispose of geometry and material to free GPU memory
      renderComponent.mesh.geometry.dispose();
      renderComponent.mesh.material.dispose();
    }
  }
}
