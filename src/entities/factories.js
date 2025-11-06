/**
 * @file Contains factory functions for creating complex, pre-configured entities.
 * @module entities/factories
 */

import * as THREE from 'three';
import Entity from './Entity.js';
import RenderComponent from '../components/RenderComponent.js';
import PlayerInputComponent from '../components/PlayerInputComponent.js';
import PhysicsComponent from '../components/PhysicsComponent.js';
import PortalComponent from '../components/PortalComponent.js';

/**
 * Creates the player entity.
 * @param {THREE.Scene} scene - The scene where the player will exist.
 * @param {THREE.Vector3} position - The initial position of the player.
 * @returns {Entity}
 */
export function createPlayer(scene, position) {
  const player = new Entity(scene);

  const geometry = new THREE.BoxGeometry(1, 2, 1); // Slightly taller
  const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
  player.addComponent(new RenderComponent(player, geometry, material, position));

  player.addComponent(new PhysicsComponent(player, 5));
  player.addComponent(new PlayerInputComponent(player));

  return player;
}

/**
 * Creates a portal entity.
 * @param {THREE.Scene} scene - The scene where the portal will exist.
 * @param {THREE.Vector3} position - The position of the portal.
 * @param {string} targetState - The name of the state the portal leads to.
 * @param {Entity} playerEntity - The player entity to check for collision.
 * @returns {Entity}
 */
export function createPortal(scene, position, targetState, playerEntity) {
  const portal = new Entity(scene);

  const geometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);
  const material = new THREE.MeshStandardMaterial({ color: 0x8A2BE2, metalness: 0.8, roughness: 0.2 });
  portal.addComponent(new RenderComponent(portal, geometry, material, position));

  portal.addComponent(new PortalComponent(portal, targetState, playerEntity, 2.0));

  return portal;
}
