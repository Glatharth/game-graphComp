/**
 * @file Defines a game state that loads and manages a playable world.
 * @module states/CustomWorldState
 * @description This state can be entered in two ways:
 * 1. From a menu, to load a world from a file (`/public/worlds/{worldName}.json`).
 * 2. From the EditorState, for playtesting. In this mode, it receives the world data
 *    directly, bypassing file loading, and provides a UI to return to the editor.
 */

import * as THREE from 'three';
import BaseState from './BaseState.js';
import { createPlayer, createStaticObject } from '../entities/factories.js';
import ObjectLoader from '../loaders/ObjectLoader.js';
import PlayerInteractionComponent from '../components/PlayerInteractionComponent.js';
import InteractionManager from '../core/InteractionManager.js';

/**
 * A state for loading and managing a custom world, either from a file or
 * from data passed for playtesting.
 * @extends BaseState
 */
export default class CustomWorldState extends BaseState {
    /**
     * @param {import('../core/Game.js').default} game - The main game instance.
     */
    constructor(game) {
        super(game);
        this.scene = null;
        this.entities = [];
        this.player = null;
        this.interactionManager = new InteractionManager(game);
        this.worldData = null;
        this.worldName = 'custom';
        this.isTest = false;

        if (!this.game.loader) {
            this.game.loader = new ObjectLoader();
        }
    }

    /**
     * Initializes the state, scene, and entities.
     * @param {object} [params={}] - Parameters passed from the previous state.
     * @param {object} [params.worldData] - The world data to load directly for playtesting.
     * @param {string} [params.worldName] - The name of the world.
     * @param {boolean} [params.isTest] - Flag to indicate if this is a playtest session.
     */
    async enter(params = {}) {
        this.worldData = params.worldData;
        this.worldName = params.worldName || 'custom';
        this.isTest = params.isTest || false;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x3a4c5a);

        const aspect = window.innerWidth / window.innerHeight;
        const d = 10;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
        this.camera.position.set(10, 10, 10);
        this.camera.lookAt(this.scene.position);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 })
        );
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);

        // Load all necessary data
        await this.game.loader.loadPropertiesData('assets/properties.json');
        const worldData = this.worldData || await this.loadWorldFromFile(this.worldName);

        const interactableObjects = [];
        if (worldData && worldData.objects) {
            for (const objectData of worldData.objects) {
                const entity = await createStaticObject(this.scene, objectData, this.game.loader);
                this.entities.push(entity);

                if (objectData.interactionId) {
                    entity.sceneObject.userData.interactionId = objectData.interactionId;
                    entity.sceneObject.userData.interactionData = objectData.interactionData || {};
                    interactableObjects.push(entity.sceneObject);
                }
            }
        }

        await this.game.loader.loadAnimationData('assets/animations.json');
        const animationData = this.game.loader.getAnimationData('character-female-a');
        const player = createPlayer(this.scene, new THREE.Vector3(0, 1, 0), animationData);
        const interactionComponent = new PlayerInteractionComponent(player, interactableObjects, this.interactionManager);
        player.addComponent(interactionComponent);
        this.player = player;
        this.entities.push(player);

        if (this.isTest) {
            this.createTestUI();
        }
    }

    /**
     * Loads world data from a JSON file.
     * @param {string} worldName - The name of the world to load.
     * @returns {Promise<object>} The loaded world data.
     */
    async loadWorldFromFile(worldName) {
        // Add cache-busting to prevent loading old world.json
        const response = await fetch(`/public/worlds/${worldName}.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Could not find world data for '${worldName}'.`);
        }
        return response.json();
    }

    /**
     * Creates the UI elements specific to the playtest mode.
     */
    createTestUI() {
        const testUI = document.createElement('div');
        testUI.id = 'test-ui';
        testUI.innerHTML = `<button id="return-to-editor-btn"><span class="material-icons">exit_to_app</span>Return to Editor</button>`;
        document.body.appendChild(testUI);

        document.getElementById('return-to-editor-btn').addEventListener('click', () => {
            this.game.stateManager.setState('Editor', {
                worldData: this.worldData,
                worldName: this.worldName
            });
        });
    }

    update(deltaTime) {
        for (const entity of this.entities) {
            entity.update(deltaTime);
        }

        if (this.player && this.camera) {
            const playerPosition = this.player.sceneObject.position;
            this.camera.position.x = playerPosition.x + 10;
            this.camera.position.y = playerPosition.y + 10;
            this.camera.position.z = playerPosition.z + 10;
            this.camera.lookAt(playerPosition);
        }
    }

    exit() {
        const testUI = document.getElementById('test-ui');
        if (testUI) {
            testUI.remove();
        }

        this.entities.forEach((entity) => {
            if (entity.components) {
                entity.components.forEach(component => {
                    if (typeof component.destroy === 'function') {
                        component.destroy();
                    }
                });
            }
            if (typeof entity.destroy === 'function') {
                entity.destroy();
            }
        });

        this.entities = [];
        this.player = null;
        this.scene = null;
        this.camera = null;
        this.worldData = null;
    }
}
