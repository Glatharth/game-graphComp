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

        // --- Lighting ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 15, 5);
        this.scene.add(directionalLight);

        // --- Floor ---
        const floorGeometry = new THREE.PlaneGeometry(50, 50);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2; // Lay the plane flat
        this.scene.add(floor);

        // --- Load Assets ---
        await this.game.loader.loadAnimationData('assets/animations.json');
        const worldData = await this.game.loader.loadWorldData('hub');

        // --- World Scenery ---
        if (worldData && worldData.objects) {
            for (const objectData of worldData.objects) {
                if (objectData.type === 'staticObject') {
                    const entity = createStaticObject(this.scene, objectData);
                    this.entities.push(entity);
                }
            }
        }

        // --- Player and Portals ---
        const animationData =
            this.game.loader.getAnimationData('character-female-a');
        const player = createPlayer(
            this.scene,
            new THREE.Vector3(0, 1, 0),
            animationData,
        );
        this.player = player;
        const portalToGame1 = createPortal(
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

    exit() {
        // Clean up scene and entities to free memory
        this.entities.forEach((entity) => entity.destroy());
        this.entities = [];
        this.player = null;
        this.scene = null;
        this.camera = null;
    }
}
