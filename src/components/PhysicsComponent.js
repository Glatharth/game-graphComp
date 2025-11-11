/**
 * @file Defines the component responsible for the physics of an entity, including movement and rotation.
 * @module components/PhysicsComponent
 */

import * as THREE from 'three';
import BaseComponent from './BaseComponent.js';

/**
 * Manages the position, velocity, rotation, and movement of an entity.
 * It updates the position and rotation of the entity's main sceneObject.
 */
export default class PhysicsComponent extends BaseComponent {
  /**
   * @param {import('../entities/Entity.js').default} owner - The entity to which this component belongs.
   * @param {number} [speed=5] - The movement speed of the entity.
   */
  constructor(owner, speed = 2) {
    super(owner);
    /**
     * The movement speed of the entity.
     * @type {number}
     */
    this.speed = speed;
    /**
     * The current velocity of the entity.
     * @type {THREE.Vector3}
     */
    this.velocity = new THREE.Vector3(0, 0, 0);
    /**
     * The intended direction of movement.
     * @type {THREE.Vector3}
     */
    this.movementDirection = new THREE.Vector3(0, 0, 0);
    /**
     * The current rotation of the entity in degrees.
     * @type {number}
     */
    this.rotation = 0;
  }

  /**
   * Sets the intended direction of movement, usually from an InputComponent.
   * The direction is normalized to ensure consistent speed.
   * @param {number} x - Direction on the X axis.
   * @param {number} z - Direction on the Z axis.
   */
  setMovementDirection(x, z) {
    this.movementDirection.set(x, 0, z).normalize();
  }

  /**
   * Sets the rotation of the entity's sceneObject around the Y axis.
   * @param {number} y - The new rotation value in degrees.
   */
  setMovementRotation(y) {
    if (this.rotation !== y) {
      this.rotation = y;
      this.owner.sceneObject.rotation.y = this.rotation * Math.PI / 180;
    }
  }

  /**
   * Updates the entity's position based on its velocity and the time elapsed.
   * @param {number} deltaTime - The time elapsed since the last frame, in seconds.
   */
  update(deltaTime) {
    this.velocity.copy(this.movementDirection).multiplyScalar(this.speed);

    if (this.owner.sceneObject) {
      const moveDistance = this.velocity.clone().multiplyScalar(deltaTime);
      this.owner.sceneObject.position.add(moveDistance);
    }
  }
}
