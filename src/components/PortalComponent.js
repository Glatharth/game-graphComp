/**
 * @file Defines a component that allows an entity to act as a portal to another state.
 * @module components/PortalComponent
 */

import BaseComponent from './BaseComponent.js';
import { eventBus } from '../core/EventBus.js';
import RenderComponent from './RenderComponent.js';

/**
 * Makes an entity function as a portal to another state (world).
 * It checks for proximity to a target entity (usually the player) and fires
 * a 'change-state' event if a collision occurs.
 */
export default class PortalComponent extends BaseComponent {
  /**
   * @param {import('../entities/Entity.js').default} owner - The entity to which this component belongs.
   * @param {string} targetStateName - The name of the state this portal leads to.
   * @param {import('../entities/Entity.js').default} targetEntity - The entity that can activate the portal (the player).
   * @param {number} [triggerRadius=1.5] - The distance at which to activate the portal.
   */
  constructor(owner, targetStateName, targetEntity, triggerRadius = 1.5) {
    super(owner);
    this.targetStateName = targetStateName;
    this.targetEntity = targetEntity;
    this.triggerRadius = triggerRadius;
    this.cooldown = 0;
  }

  update(deltaTime) {
    if (this.cooldown > 0) {
      this.cooldown -= deltaTime;
      return;
    }

    const renderSelf = this.owner.getComponent(RenderComponent);
    const renderTarget = this.targetEntity.getComponent(RenderComponent);

    if (renderSelf && renderTarget) {
      const distance = renderSelf.mesh.position.distanceTo(renderTarget.mesh.position);

      if (distance < this.triggerRadius) {
        console.log(`Portal activated! Changing to state: ${this.targetStateName}`);
        eventBus.emit('change-state', this.targetStateName);
        this.cooldown = 2; // Add a 2-second cooldown to prevent immediate re-triggering
      }
    }
  }
}
