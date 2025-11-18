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
        this.plane = null; // To store the plane mesh
        this.geometry = null; // To store the plane geometry
        this.material = null; // To store the plane material
        this.texture = null; // To store the canvas texture
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

        this.texture = new THREE.CanvasTexture(canvas);
        this.material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
        });
        this.geometry = new THREE.PlaneGeometry(2, 1);
        this.plane = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.plane);

        this.returnTimer = 5;
    }

    update(deltaTime) {
        this.returnTimer -= deltaTime;
        if (this.returnTimer <= 0) {
            eventBus.emit('change-state', 'HubWorld');
        }
    }

    dispose() {
        this.exit();
    }

    exit() {
        // Dispose of the plane's geometry, material, and texture
        if (this.plane) {
            this.scene.remove(this.plane);
            this.plane = null;
        }
        if (this.geometry) {
            this.geometry.dispose();
            this.geometry = null;
        }
        if (this.material) {
            this.material.dispose();
            this.material = null;
        }
        if (this.texture) {
            this.texture.dispose();
            this.texture = null;
        }

        // Dispose of scene objects and render targets
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.isMesh) {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach((material) =>
                                material.dispose(),
                            );
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });
            this.scene = null;
        }

        // Dispose of cached assets in the loader if it exists
        if (this.game.loader) {
            this.game.loader.dispose();
        }

        this.camera = null;
    }
}
