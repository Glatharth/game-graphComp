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
// Removed GLTFLoader import as it will be handled by ObjectLoader

/**
 * Creates the player entity.
 * @param {import('../core/Game.js').default} game - The main game instance.
 * @param {THREE.Scene} scene - The scene where the player will exist.
 * @param {THREE.Vector3} position - The initial position of the player.
 * @param {object} animationData - The data for the animation component.
 * @returns {Entity}
 */
export function createPlayer(game, scene, position, animationData) {
    const player = new Entity(game, scene);

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
    const portal = new Entity(game, scene);

    const geometry = new THREE.CylinderGeometry(1, 1, 0.2, 32);
    const material = new THREE.MeshStandardMaterial({
        color: 0x8a2be2,
        metalness: 0.8,
        roughness: 0.2,
    });
    portal.addComponent(new RenderComponent(portal, geometry, material));

    portal.sceneObject.position.copy(position);

    portal.addComponent(
        new PortalComponent(portal, targetState, playerEntity, 2.0),
    );

    return portal;
}

/**
 * Creates a static object from a GLB model.
 * This function handles loading the GLB, setting its properties, and optimizing materials.
 * Materials are cached globally via the ObjectLoader to reduce the number of unique WebGL textures,
 * preventing 'texture units count exceeds' errors when many objects are present.
 *
 * @param {import('../core/Game.js').default} game - The main game instance.
 * @param {THREE.Scene} scene - The scene where the object will exist.
 * @param {object} objectData - The data for the object, including path, position, rotation, and scale.
 * @param {string} objectData.path - The path to the GLB model.
 * @param {string} objectData.model - The name of the model.
 * @param {object} [objectData.position] - The initial position {x, y, z}.
 * @param {object} [objectData.rotation] - The initial rotation {x, y, z}.
 * @param {object} [objectData.scale] - The initial scale {x, y, z}.
 * @param {import('../loaders/ObjectLoader.js').default} loader - The object loader instance.
 * @returns {Promise<Entity>} A promise that resolves with the created Entity.
 */
export async function createStaticObject(game, scene, objectData, loader) {
    const entity = new Entity(game, scene);
    // const gltfLoader = new GLTFLoader(); // REMOVED: Use loader.getOrCreateGLTF instead

    const correctedModelPath = objectData.path;
    const modelName = objectData.model;
    
    const properties = loader.getPropertiesData(modelName);
    const animationData = loader.getAnimationData(modelName);

    // Use the provided loader to get the GLTF model
    const model = await loader.getOrCreateGLTF(correctedModelPath);

    // if (scene) { // REMOVED: Model should only be added to entity.sceneObject
    //     scene.add(model);
    // }
    entity.sceneObject.add(model); // Correct: Add model to entity's sceneObject

    entity.sceneObject.userData.model = modelName;
    model.userData.entity = entity;

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
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;

            // Use the ObjectLoader's material cache
            if (!(c.material instanceof THREE.MeshStandardMaterial)) {
                c.material = loader.getOrCreateStandardMaterial(c.material);
            }
        }
    });

    if (animationData) {
        const animComponent = new AnimationComponent(entity, scene, {
            path: correctedModelPath,
            animations: animationData.animations
        });
        entity.addComponent(animComponent);
    }

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
                light.position.set(0, 2, 0); // Lift point light 2 units above object origin
                break;
            case 'spot':
                light = new THREE.SpotLight( // Corrected to SpotLight
                    lightData.color,
                    lightData.intensity,
                    lightData.distance,
                    lightData.angle, // Added angle
                    lightData.penumbra, // Added penumbra
                    lightData.decay,
                );
                light.position.set(0, 2, 0); // Lift spot light 2 units above object origin
                // Create a target for the spot light and position it below the light
                const spotTarget = new THREE.Object3D();
                spotTarget.position.set(0, -2, 0); // Target is 2 units below the light, effectively at object origin
                light.add(spotTarget); // Add target as a child of the light
                light.target = spotTarget; // Set the target
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

    // Add interaction data to sceneObject.userData if available in properties
    if (properties && properties.interactionId) {
        entity.sceneObject.userData.interactionId = properties.interactionId;
        entity.sceneObject.userData.interactionData = properties.interactionData || {};
    }

    return entity;
}
