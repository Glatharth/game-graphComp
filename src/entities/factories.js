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
import AnimationComponent from '../components/AnimationComponent.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Creates the player entity.
 * @param {import('../core/Game.js').default} game - The main game instance.
 * @param {THREE.Scene} scene - The scene where the player will exist.
 * @param {THREE.Vector3} position - The initial position of the player.
 * @param {object} animationData - The data for the animation component.
 * @returns {Entity}
 */
export function createPlayer(game, scene, position, animationData) {
    const player = new Entity(game, scene); // Pass game instance

    // Set the initial position on the entity's main scene object
    player.sceneObject.position.copy(position);

    player.addComponent(new PhysicsComponent(player, 5));
    player.addComponent(new PlayerInputComponent(player));
    player.addComponent(new AnimationComponent(player, scene, animationData));

    return player;
}

/**
 * Creates a portal entity.
 * @param {import('../core/Game.js').default} game - The main game instance.
 * @param {THREE.Scene} scene - The scene where the portal will exist.
 * @param {THREE.Vector3} position - The position of the portal.
 * @param {string} targetState - The name of the state the portal leads to.
 * @param {Entity} playerEntity - The player entity to check for collision.
 * @returns {Entity}
 */
export function createPortal(game, scene, position, targetState, playerEntity) {
    const portal = new Entity(game, scene); // Pass game instance

    const geometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0x8a2be2,
        metalness: 0.8,
        roughness: 0.2,
    });
    portal.addComponent(new RenderComponent(portal, geometry, material));

    // Set the position on the entity's main scene object
    portal.sceneObject.position.copy(position);

    portal.addComponent(
        new PortalComponent(portal, targetState, playerEntity, 2.0),
    );

    return portal;
}

/**
 * Creates a static object from a GLB model.
 * @param {import('../core/Game.js').default} game - The main game instance.
 * @param {THREE.Scene} scene - The scene where the object will exist.
 * @param {object} objectData - The data for the object, including path, position, rotation, and scale.
 * @param {import('../loaders/ObjectLoader.js').default} loader - The object loader instance.
 * @returns {Promise<Entity>}
 */
export async function createStaticObject(game, scene, objectData, loader) {
    const entity = new Entity(game, scene); // Pass game instance
    const gltfLoader = new GLTFLoader();

    // Normalize modelPath if it's coming from an old save format
    let correctedModelPath = objectData.path;
    const modelName = objectData.model; // Use objectData.model directly for consistency
    
    // Get properties data (including light)
    const properties = loader.getPropertiesData(modelName);
    // Get animation data
    const animationData = loader.getAnimationData(modelName);

    const gltf = await gltfLoader.loadAsync(correctedModelPath);
    const model = gltf.scene;
    // Only add to scene if scene is still active
    if (scene) {
        scene.add(model);
    }
    entity.sceneObject.add(model);

    // Store model name in userData for easier lookup
    entity.sceneObject.userData.model = modelName;
    // Store a reference to the entity on the model itself for interaction lookup
    model.userData.entity = entity;


    // Set position, rotation, and scale from the object data
    if (objectData.position) {
        entity.sceneObject.position.set(
            objectData.position.x,
            objectData.position.y,
            objectData.position.z,
        );
    }
    if (objectData.rotation) {
        entity.sceneObject.rotation.set(
            objectData.rotation.x,
            objectData.rotation.y,
            objectData.rotation.z,
        );
    }
    if (objectData.scale) {
        entity.sceneObject.scale.set(
            objectData.scale.x,
            objectData.scale.y,
            objectData.scale.z,
        );
    }

    model.traverse((c) => {
        c.castShadow = true;
        c.receiveShadow = true;
    });

    // Add AnimationComponent if animation data exists
    if (animationData) {
        const animComponent = new AnimationComponent(entity, scene, {
            path: correctedModelPath,
            animations: animationData.animations
        });
        entity.addComponent(animComponent);
    } else {
        // console.log(`factories.js: createStaticObject - No animation data found for "${modelName}".`);
    }

    // Add Light if properties data exists
    if (properties && properties.light) {
        const lightData = properties.light;
        let light;
        switch (lightData.type) {
            case 'point':
                light = new THREE.PointLight(
                    lightData.color,
                    lightData.intensity,
                    lightData.distance,
                    lightData.decay,
                );
                break;
            case 'spot':
                light = new THREE.PointLight( // Changed to PointLight for simplicity, SpotLight requires target
                    lightData.color,
                    lightData.intensity,
                    lightData.distance,
                    lightData.decay,
                );
                // If you need a SpotLight, you'll need to define its target
                // light.target.position.set(targetX, targetY, targetZ);
                // entity.sceneObject.add(light.target);
                break;
            case 'rectArea':
                light = new THREE.RectAreaLight(
                    lightData.color,
                    lightData.intensity,
                    lightData.width,
                    lightData.height,
                );
                break;
        }
        if (light) {
            light.castShadow = lightData.castShadow;
            entity.sceneObject.add(light);
        }
    }

    return entity;
}
