/**
 * @file Defines a game state that loads a custom world with interactive objects.
 * @module states/CustomWorldState
 */

import * as THREE from 'three';
import BaseState from './BaseState.js';
import { createPlayer, createStaticObject } from '../entities/factories.js';
import ObjectLoader from '../loaders/ObjectLoader.js';
import PlayerInteractionComponent from '../components/PlayerInteractionComponent.js';
import InteractionManager from '../core/InteractionManager.js';

/**
 * A state for loading and managing a custom world defined in a JSON file.
 */
export default class CustomWorldState extends BaseState {
    constructor(game) {
        super(game);
        this.entities = [];
        this.player = null;
        this.interactionManager = new InteractionManager(game); // Create instance

        if (!this.game.loader) {
            this.game.loader = new ObjectLoader();
        }
    }

    async enter() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        // --- Camera ---
        const aspect = window.innerWidth / window.innerHeight;
        const d = 10;
        this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
        this.camera.position.set(10, 10, 10);
        this.camera.lookAt(this.scene.position);

        // --- Lighting ---
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(10, 15, 5);
        this.scene.add(directionalLight);

        // --- Floor ---
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50),
            new THREE.MeshStandardMaterial({ color: 0x555555 })
        );
        floor.rotation.x = -Math.PI / 2;
        this.scene.add(floor);

        // --- Load World Data ---
        await this.game.loader.loadAnimationData('assets/animations.json');
        const worldData = await this.game.loader.loadWorldData('custom');

        // --- Create World Objects ---
        const interactableObjects = [];
        if (worldData && worldData.objects) {
            for (const objectData of worldData.objects) {
                const entity = createStaticObject(this.scene, objectData);
                this.entities.push(entity);

                if (objectData.interactionId) {
                    entity.sceneObject.userData.interactionId = objectData.interactionId;
                    entity.sceneObject.userData.interactionData = objectData.interactionData || {};
                    interactableObjects.push(entity.sceneObject);
                }
            }
        }

        // --- Create Player with Interaction Component ---
        const animationData = this.game.loader.getAnimationData('character-female-a');
        const player = createPlayer(this.scene, new THREE.Vector3(0, 1, 0), animationData);
        
        // Pass the state's interactionManager to the component
        const interactionComponent = new PlayerInteractionComponent(player, interactableObjects, this.interactionManager);
        player.addComponent(interactionComponent);

        this.player = player;
        this.entities.push(player);
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
        this.entities.forEach((entity) => {
            entity.components.forEach(component => {
                if (typeof component.destroy === 'function') {
                    component.destroy();
                }
            });
            entity.destroy();
        });
        this.entities = [];
        this.player = null;
        this.scene = null;
        this.camera = null;
    }
}
