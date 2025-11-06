/**
 * @file Defines a component that handles entity movement and position.
 * @module components/PhysicsComponent
 */

import * as THREE from 'three';
import BaseComponent from './BaseComponent.js';
import RenderComponent from './RenderComponent.js';

/**
 * Manages the position, velocity, and movement of an entity.
 * It updates the position of the corresponding RenderComponent's mesh.
 */
export default class PhysicsComponent extends BaseComponent {
  /**
   * @param {import('../entities/Entity.js').default} owner - The entity to which this component belongs.
   * @param {number} [speed=5] - The movement speed of the entity.
   */
  constructor(owner, speed = 5) {
    super(owner);
    this.speed = speed;
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.movementDirection = new THREE.Vector3(0, 0, 0);
  }

  /**
   * Sets the intended direction of movement, usually from an InputComponent.
   * @param {number} x - Direction on the X axis.
   * @param {number} z - Direction on the Z axis.
   */
  setMovementDirection(x, z) {
    this.movementDirection.set(x, 0, z).normalize();
  }

  update(deltaTime) {
    this.velocity.copy(this.movementDirection).multiplyScalar(this.speed);

    const renderComponent = this.owner.getComponent(RenderComponent);
    if (renderComponent && renderComponent.mesh) {
      const moveDistance = this.velocity.clone().multiplyScalar(deltaTime);
      renderComponent.mesh.position.add(moveDistance);
    }
  }
}
