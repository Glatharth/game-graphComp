/**
 * @file Defines the main hub world of the game.
 * @module states/HubWorldState
 */

import * as THREE from 'three';
import BaseState from './BaseState.js';
import { createPlayer, createPortal } from '../entities/factories.js';

/**
 * The main hub world of the game, featuring an isometric camera view.
 */
export default class HubWorldState extends BaseState {
  constructor(game) {
    super(game);
    /** 
     * A list of all entities in this state.
     * @type {import('../entities/Entity.js').default[]} 
     */
    this.entities = [];
  }

  enter() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    // --- Isometric Camera ---
    const aspect = window.innerWidth / window.innerHeight;
    const d = 20; // Camera distance
    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    this.camera.position.set(20, 20, 20); // Diagonal position
    this.camera.lookAt(this.scene.position); // Look at the origin

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 5);
    this.scene.add(directionalLight);

    // --- Floor ---
    const floorGeometry = new THREE.PlaneGeometry(50, 50);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Lay the plane flat
    this.scene.add(floor);

    // --- Entities ---
    const player = createPlayer(this.scene, new THREE.Vector3(0, 1, 0));
    const portalToGame1 = createPortal(this.scene, new THREE.Vector3(10, 0.1, -5), 'MiniGame1', player);

    this.entities.push(player);
    this.entities.push(portalToGame1);
  }

  update(deltaTime) {
    for (const entity of this.entities) {
      entity.update(deltaTime);
    }
  }

  exit() {
    // Clean up scene and entities to free memory
    this.entities.forEach(entity => entity.destroy());
    this.entities = [];
    this.scene = null;
    this.camera = null;
  }
}
