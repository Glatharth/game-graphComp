/**
 * @file Defines the main hub world of the game.
 * @module states/HubWorldState
 */

import * as THREE from 'three';
import BaseState from './BaseState.js';
import {
    createPlayer,
    createPortal,
    createStaticObject,
} from '../entities/factories.js';
import ObjectLoader from '../loaders/ObjectLoader.js';
import PlayerInteractionComponent from '../components/PlayerInteractionComponent.js';
import InteractionManager from '../core/InteractionManager.js';

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
        /**
         * The player entity.
         * @type {import('../entities/Entity.js').default | null}
         */
        this.player = null;
        /**
         * The interaction manager for handling player interactions.
         * @type {InteractionManager}
         */
        this.interactionManager = new InteractionManager(game);

        // Initialize the loader if it doesn't exist on the game object
        if (!this.game.loader) {
            this.game.loader = new ObjectLoader();
        }
    }

    async enter() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        // --- Isometric Camera ---
        const aspect = window.innerWidth / window.innerHeight;
        const d = 3; // Camera distance || also change in core/Game.js
        this.camera = new THREE.OrthographicCamera(
            -d * aspect,
            d * aspect,
            d,
            -d,
            1,
            1000,
        );
        this.camera.position.set(20, 20, 20); // Initial position
        this.camera.lookAt(this.scene.position); // Look at the origin

        // --- Floor ---
        this.floorGeometry = new THREE.PlaneGeometry(50, 50);
        this.floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
        });
        const floor = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
        floor.rotation.x = -Math.PI / 2; // Lay the plane flat
        this.scene.add(floor);

        // --- Load Assets ---
        await this.game.loader.loadAnimationData('assets/animations.json');
        await this.game.loader.loadPropertiesData('assets/properties.json');
        const worldData = await this.game.loader.loadWorldData('hub');

        const interactableObjects = []; // Array to hold sceneObjects that are interactable

        // --- World Scenery ---
        if (worldData && worldData.objects) {
            for (const objectData of worldData.objects) {
                if (objectData.type === 'staticObject') {
                    console.log("HubWorldState: Calling createStaticObject with scene:", this.scene); // Debug log
                    const entity = await createStaticObject(this.game, this.scene, objectData, this.game.loader);
                    this.entities.push(entity);
                    // Collect interactable objects
                    if (entity.sceneObject.userData.interactionId) { // Check entity.sceneObject.userData.interactionId which is set by factories.js
                        interactableObjects.push(entity.sceneObject);
                    }
                }
            }
        }

        // --- Player and Portals ---
        const animationData =
            this.game.loader.getAnimationData('character-female-a');
        const player = createPlayer(
            this.game,
            this.scene,
            new THREE.Vector3(0, 1, 0),
            animationData,
        );
        this.player = player;

        // Add PlayerInteractionComponent to the player
        console.log("HubWorldState: Interactable objects being passed to PlayerInteractionComponent:", interactableObjects); // Added log
        player.addComponent(new PlayerInteractionComponent(player, interactableObjects, this.interactionManager));


        const portalToGame1 = createPortal(
            this.game,
            this.scene,
            new THREE.Vector3(10, 0.1, -5),
            'MiniGame1',
            player,
        );

        this.entities.push(player);
        this.entities.push(portalToGame1);
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

    dispose() {
        this.exit();
    }

    exit() {
        // Clean up scene and entities to free memory
        this.entities.forEach((entity) => entity.destroy());
        this.entities = [];

        // Dispose of floor geometry and material
        if (this.floorGeometry) {
            this.floorGeometry.dispose();
            this.floorGeometry = null;
        }
        if (this.floorMaterial) {
            this.floorMaterial.dispose();
            this.floorMaterial = null;
        }

        // Dispose of scene objects and render targets
        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.isMesh) {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        // In case of an array of materials
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

        // Dispose of cached assets in the loader
        if (this.game.loader) {
            this.game.loader.dispose();
        }

        this.player = null;
        this.camera = null;
        this.interactionManager = null; // Clean up interaction manager
    }
}
