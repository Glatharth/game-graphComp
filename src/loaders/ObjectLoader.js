import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'; // Adicionado: Importar GLTFLoader

/**
 * ObjectLoader is responsible for loading asset definitions from manifest files.
 * It provides templates for objects and data for worlds, but does not
 * instantiate the objects themselves. This allows each world to control
 * how and when objects are created.
 */
export default class ObjectLoader {
    constructor() {
        this.objectTemplates = new Map();
        this.animationData = new Map();
        this.propertiesData = new Map();
        /**
         * Cache for processed THREE.MeshStandardMaterial instances.
         * Stores materials keyed by a unique identifier derived from their properties,
         * ensuring that identical materials are reused across different meshes and models
         * to optimize WebGL texture unit usage.
         * @type {Map<string, THREE.MeshStandardMaterial>}
         */
        this.materialCache = new Map();
        /**
         * Cache for loaded GLTF scenes.
         * Stores the original GLTF scene object for each model path,
         * allowing for efficient cloning and reuse of geometries and textures.
         * @type {Map<string, THREE.Group>}
         */
        this.gltfCache = new Map();
    }

    /**
     * Loads the main asset manifest file. This file contains the templates
     * for all reusable objects in the game.
     * @param {string} path - The path to the manifest.json file.
     */
    async loadManifest(path) {
        try {
            const response = await fetch(path);
            const manifest = await response.json();
            for (const key in manifest.objects) {
                this.objectTemplates.set(key, manifest.objects[key]);
            }
        } catch (error) {
            console.error('Error loading asset manifest:', error);
        }
    }

    /**
     * Loads the animation data from the given path.
     * @param {string} path - The path to the animations.json file.
     */
    async loadAnimationData(path) {
        try {
            const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
            const animationFile = await response.json();
            for (const category in animationFile) {
                for (const key in animationFile[category]) {
                    this.animationData.set(key, animationFile[category][key]);
                }
            }
        } catch (error) {
            console.error('Error loading animation data:', error);
        }
    }

    /**
     * Loads the properties data from the given path.
     * @param {string} path - The path to the properties.json file.
     */
    async loadPropertiesData(path) {
        try {
            const response = await fetch(`${path}?v=${Date.now()}`, { cache: 'no-store' });
            const propertiesFile = await response.json();
            for (const category in propertiesFile) {
                for (const key in propertiesFile[category]) {
                    this.propertiesData.set(key, propertiesFile[category][key]);
                }
            }
        } catch (error) {
            console.error('Error loading properties data:', error);
        }
    }

    /**
     * Retrieves a pre-loaded object template.
     * @param {string} type - The type of the object (e.g., "player").
     * @returns {object | undefined} The object template.
     */
    getObjectTemplate(type) {
        return this.objectTemplates.get(type);
    }

    /**
     * Retrieves the animation data for a specific model.
     * @param {string} name - The name of the model (e.g., "character-female-a").
     * @returns {object | undefined} The animation data for the model.
     */
    getAnimationData(name) {
        return this.animationData.get(name);
    }

    /**
     * Retrieves the properties data for a specific model.
     * @param {string} name - The name of the model (e.g., "pinball").
     * @returns {object | undefined} The properties data for the model.
     */
    getPropertiesData(name) {
        return this.propertiesData.get(name);
    }

    /**
     * Generates a unique key for a material based on its properties.
     * This key is used for caching MeshStandardMaterials to ensure reuse.
     * @param {THREE.Material} material - The original material.
     * @returns {string} A JSON string representing the material's unique properties.
     */
    _generateMaterialKey(material) {
        // Include properties that define the visual uniqueness of the material
        // UUIDs of textures are crucial for uniqueness
        return JSON.stringify({
            name: material.name,
            color: material.color ? material.color.getHex() : null,
            map: material.map ? material.map.uuid : null,
            normalMap: material.normalMap ? material.normalMap.uuid : null,
            roughnessMap: material.roughnessMap ? material.roughnessMap.uuid : null,
            metalnessMap: material.metalnessMap ? material.metalnessMap.uuid : null,
            emissive: material.emissive ? material.emissive.getHex() : null,
            emissiveMap: material.emissiveMap ? material.emissiveMap.uuid : null,
            lightMap: material.lightMap ? material.lightMap.uuid : null,
            aoMap: material.aoMap ? material.aoMap.uuid : null,
            transparent: material.transparent,
            opacity: material.opacity,
            alphaMap: material.alphaMap ? material.alphaMap.uuid : null,
            side: material.side, // Include side property
            // Add other relevant properties that define material uniqueness
        });
    }

    /**
     * Returns a cached THREE.MeshStandardMaterial or creates a new one if not found in cache.
     * This ensures that materials with identical properties are reused, reducing WebGL texture unit usage.
     * @param {THREE.Material} originalMaterial - The material to convert/cache.
     * @returns {THREE.MeshStandardMaterial} A THREE.MeshStandardMaterial instance.
     */
    getOrCreateStandardMaterial(originalMaterial) {
        const materialKey = this._generateMaterialKey(originalMaterial);

        if (this.materialCache.has(materialKey)) {
            return this.materialCache.get(materialKey);
        }

        const newMaterial = new THREE.MeshStandardMaterial();

        // Copy properties from original material to new material
        if (originalMaterial.color) newMaterial.color.copy(originalMaterial.color);
        if (originalMaterial.map) newMaterial.map = originalMaterial.map;
        if (originalMaterial.normalMap) newMaterial.normalMap = originalMaterial.normalMap;
        if (originalMaterial.roughnessMap) newMaterial.roughnessMap = originalMaterial.roughnessMap;
        if (originalMaterial.metalnessMap) newMaterial.metalnessMap = originalMaterial.metalnessMap;
        if (originalMaterial.emissive) newMaterial.emissive.copy(originalMaterial.emissive);
        if (originalMaterial.emissiveMap) newMaterial.emissiveMap = originalMaterial.emissiveMap;
        if (originalMaterial.lightMap) newMaterial.lightMap = originalMaterial.lightMap;
        if (originalMaterial.aoMap) newMaterial.aoMap = originalMaterial.aoMap;

        // Ensure roughness and metalness are set for MeshStandardMaterial
        newMaterial.roughness = originalMaterial.roughness !== undefined ? originalMaterial.roughness : 0.5;
        newMaterial.metalness = originalMaterial.metalness !== undefined ? originalMaterial.metalness : 0.5;

        // Handle transparency
        newMaterial.transparent = originalMaterial.transparent;
        newMaterial.opacity = originalMaterial.opacity;
        newMaterial.alphaMap = originalMaterial.alphaMap;
        newMaterial.side = originalMaterial.side; // Important for double-sided materials

        // Mark this material as cached so it's not disposed by individual entities
        newMaterial.userData.isCachedMaterial = true;

        // Dispose of the original material to free up memory, if it's not already disposed
        // This is crucial to prevent memory leaks and ensure textures are properly released
        if (originalMaterial.dispose) {
            originalMaterial.dispose();
        }

        this.materialCache.set(materialKey, newMaterial);
        return newMaterial;
    }

    /**
     * Returns a cached GLTF scene or loads it if not found in cache.
     * This ensures that GLTF models are loaded only once, and subsequent requests
     * receive a clone of the original scene, optimizing memory and load times.
     * @param {string} path - The path to the GLTF model.
     * @returns {Promise<THREE.Group>} A promise that resolves with a cloned GLTF scene.
     */
    async getOrCreateGLTF(path) {
        if (this.gltfCache.has(path)) {
            return this.gltfCache.get(path).clone();
        }

        const gltfLoader = new GLTFLoader();
        const gltf = await gltfLoader.loadAsync(path);
        const model = gltf.scene;

        this.gltfCache.set(path, model);
        return model.clone();
    }

    /**
     * Loads the specific data for a world, including which objects to place
     * and where, and definitions for portals.
     * @param {string} worldName - The name of the world to load (e.g., "hub").
     * @returns {Promise<object | null>} A promise that resolves with the world data.
     */
    async loadWorldData(worldName) {
        try {
            const response = await fetch(`/public/worlds/${worldName}.json?v=${Date.now()}`, { cache: 'no-store' });
            return await response.json();
        } catch (error) {
            console.error(`Error loading world data for ${worldName}:`, error);
            return null;
        }
    }

    /**
     * Disposes of all cached materials and GLTF scenes to free up GPU memory.
     * This should be called when the game or a significant part of it is being torn down,
     * or when switching between worlds that use entirely different asset sets.
     */
    dispose() {
        // Dispose of cached materials
        this.materialCache.forEach((material) => {
            material.dispose();
            // Dispose of textures associated with the material
            for (const key in material) {
                const value = material[key];
                if (value instanceof THREE.Texture) {
                    value.dispose();
                }
            }
        });
        this.materialCache.clear();

        // Dispose of cached GLTF scenes (geometries and materials within them)
        this.gltfCache.forEach((gltfScene) => {
            gltfScene.traverse((object) => {
                if (object.isMesh) {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach((material) => {
                                material.dispose();
                                for (const key in material) {
                                    const value = material[key];
                                    if (value instanceof THREE.Texture) {
                                        value.dispose();
                                    }
                                }
                            });
                        } else {
                            object.material.dispose();
                            for (const key in object.material) {
                                const value = object.material[key];
                                if (value instanceof THREE.Texture) {
                                    value.dispose();
                                }
                            }
                        }
                    }
                }
            });
        });
        this.gltfCache.clear();

        // Clear other data if necessary
        this.objectTemplates.clear();
        this.animationData.clear();
        this.propertiesData.clear();
    }
}
