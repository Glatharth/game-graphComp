/**
 * @file Defines a component that processes player input for movement.
 * @module components/PlayerInputComponent
 */

import BaseComponent from './BaseComponent.js';
import { inputHandler } from '../core/InputHandler.js';
import PhysicsComponent from './PhysicsComponent.js';

/**
 * Listens to the InputHandler and translates pressed keys into a movement direction.
 * It then commands the PhysicsComponent of the same entity to apply the force.
 */
export default class PlayerInputComponent extends BaseComponent {
    constructor(owner) {
        super(owner);
        this.moveDirection = { x: 0, z: 0 };
        this.rotation = 0;
    }

    update(deltaTime) {
        this.moveDirection.x = 0;
        this.moveDirection.z = 0;

        // In an isometric environment, 'w' moves up-left on screen, 's' moves down-right.
        if (inputHandler.isKeyDown('w')) {
            this.moveDirection.z -= 1;
            this.rotation = 180;
        }
        if (inputHandler.isKeyDown('s')) {
            this.moveDirection.z += 1;
            this.rotation = 0;
        }
        if (inputHandler.isKeyDown('a')) {
            this.moveDirection.x -= 1;
            this.rotation = -90;
        }
        if (inputHandler.isKeyDown('d')) {
            this.moveDirection.x += 1;
            this.rotation = 90;
        }

        const physicsComponent = this.owner.getComponent(PhysicsComponent);
        if (physicsComponent) {
            physicsComponent.setMovementDirection(
                this.moveDirection.x,
                this.moveDirection.z,
            );
            physicsComponent.setMovementRotation(this.rotation);
        }
    }
}
