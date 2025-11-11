/**
 * @file The main game class that initializes all core systems and runs the game loop.
 * @module core/Game
 */

import { WebGLRenderer, Clock } from 'three'
import StateManager from './StateManager.js';

/**
 * The main class that orchestrates the entire game.
 * It is responsible for:
 * - Initializing the Three.js renderer.
 * - Running the main game loop (requestAnimationFrame).
 * - Housing the StateManager instance.
 */
export default class Game {
  constructor() {
    /** @type {WebGLRenderer} */
    this.renderer = new WebGLRenderer({ antialias: true });
    /** @type {Clock} */
    this.clock = new Clock();
    /** @type {StateManager} */
    this.stateManager = new StateManager(this);

    this.setupRenderer();
    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.animate();
  }

  /**
   * Configures and appends the Three.js renderer to the DOM.
   * @private
   */
  setupRenderer() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    document.body.appendChild(this.renderer.domElement);
  }

  /**
   * The main game loop.
   * @private
   */
  animate() {
    const deltaTime = this.clock.getDelta();

    this.stateManager.update(deltaTime);

    const activeState = this.stateManager.currentState;
    if (activeState && activeState.scene && activeState.camera) {
      this.renderer.render(activeState.scene, activeState.camera);
    }

    requestAnimationFrame(this.animate.bind(this));
  }

  /**
   * Handles window resize events to keep the camera and renderer updated.
   * @private
   */
  onWindowResize() {
    const activeState = this.stateManager.currentState;
    if (activeState && activeState.camera) {
        // Handle both camera types
        if (activeState.camera.isPerspectiveCamera) {
            activeState.camera.aspect = window.innerWidth / window.innerHeight;
        } else if (activeState.camera.isOrthographicCamera) {
            const aspect = window.innerWidth / window.innerHeight;
            const d = 7; // Match the value in HubWorldState
            activeState.camera.left = -d * aspect;
            activeState.camera.right = d * aspect;
            activeState.camera.top = d;
            activeState.camera.bottom = -d;
        }
        activeState.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
