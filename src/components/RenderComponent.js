/**
 * @file Defines a component that gives an entity a visual 3D representation.
 * @module components/RenderComponent
 */

import * as THREE from 'three';
import BaseComponent from './BaseComponent.js';

/**
 * Adds a visual 3D representation (a THREE.Mesh) to an entity.
 * It is responsible for creating and managing the mesh within the entity's scene object.
 */
export default class RenderComponent extends BaseComponent {
  /**
   * @param {import('../entities/Entity.js').default} owner - The entity to which this component belongs.
   * @param {THREE.BufferGeometry} geometry - The geometry for the mesh.
   * @param {THREE.Material} material - The material for the mesh.
   * @param {THREE.Vector3} [position=new THREE.Vector3()] - The initial local position of the mesh relative to the entity's scene object.
   * @param {THREE.Euler} [rotation=new THREE.Euler()] - The initial local rotation of the mesh.
   */
  constructor(owner, geometry, material, position = new THREE.Vector3(), rotation = new THREE.Euler()) {
    super(owner);
    /** 
     * The Three.js mesh for this component.
     * @type {THREE.Mesh} 
     */
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.mesh.rotation.copy(rotation);
    
    // Add the mesh to the entity's sceneObject, not the global scene
    this.owner.sceneObject.add(this.mesh);
  }

  /**
   * The update method for RenderComponent is typically empty, as rendering is handled
   * by the main Game loop. However, it can be used for animations or dynamic visual updates.
   * @param {number} deltaTime - The time elapsed since the last frame.
   */
  update(deltaTime) {
    // Example: this.mesh.rotation.y += 0.5 * deltaTime;
  }
}
