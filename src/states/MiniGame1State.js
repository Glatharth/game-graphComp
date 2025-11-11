/**
 * @file Defines a simple example of a minigame state.
 * @module states/MiniGame1State
 */

import * as THREE from 'three';
import BaseState from './BaseState.js';
import { eventBus } from '../core/EventBus.js';

/**
 * An example of a secondary game state. This one uses a simple 2D orthographic camera
 * and displays a message. It includes a timer to automatically return to the hub.
 */
export default class MiniGame1State extends BaseState {
    constructor(game) {
        super(game);
        this.returnTimer = 5; // 5 seconds
    }

    enter() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x004080);

        // Orthographic camera for a 2D-like view
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        this.camera.position.z = 1;

        // Simple text display (using a canvas texture)
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 256;
        context.font = 'Bold 30px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText('Welcome to Minigame 1', 256, 100);
        context.font = '24px Arial';
        context.fillText('Returning to Hub shortly...', 256, 150);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
        });
        const geometry = new THREE.PlaneGeometry(2, 1);
        const plane = new THREE.Mesh(geometry, material);
        this.scene.add(plane);

        this.returnTimer = 5;
    }

    update(deltaTime) {
        this.returnTimer -= deltaTime;
        if (this.returnTimer <= 0) {
            eventBus.emit('change-state', 'HubWorld');
        }
    }

    exit() {
        this.scene = null;
        this.camera = null;
    }
}
