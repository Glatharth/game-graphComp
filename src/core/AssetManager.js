import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Manages loading and caching of game assets.
 * This includes models, textures, and other resources.
 */
export default class AssetManager {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
        /**
         * Cache for resolved original assets (THREE.Group for GLTF, THREE.Texture for images).
         * @type {Map<string, THREE.Group | THREE.Texture>}
         */
        this.assetCache = new Map();
        /**
         * Cache for promises of assets currently being loaded, to prevent duplicate requests.
         * @type {Map<string, Promise<THREE.Group | THREE.Texture>>}
         */
        this.loadingPromises = new Map();
    }

    /**
     * Retrieves an asset from the cache or loads it if not present.
     * For GLTF models, it returns a clone of the cached original scene.
     * For textures, it returns the cached original texture.
     * Applies cache-busting to the network request to ensure fresh assets.
     * @param {string} path - The original path to the asset.
     * @returns {Promise<THREE.Group | THREE.Texture>} A promise that resolves with the loaded asset (or its clone for GLTF).
     */
    async getAsset(path) {
        // If the asset is already loaded and cached, return it (or a clone for GLTF)
        if (this.assetCache.has(path)) {
            const asset = this.assetCache.get(path);
            return asset instanceof THREE.Group ? asset.clone() : asset;
        }

        // If the asset is currently being loaded, return the existing promise
        if (this.loadingPromises.has(path)) {
            // The promise resolves to the original asset, so we need to clone if it's a GLTF
            return this.loadingPromises.get(path).then(asset => {
                return asset instanceof THREE.Group ? asset.clone() : asset;
            });
        }

        const fileExtension = path.split('.').pop().toLowerCase();
        const requestUrl = `${path}?v=${Date.now()}`; // Apply cache-busting

        let loadFunction;
        switch (fileExtension) {
            case 'glb':
            case 'gltf':
                loadFunction = () => this.loadGltf(requestUrl);
                break;
            case 'png':
            case 'jpg':
            case 'jpeg':
                loadFunction = () => this.loadTexture(requestUrl);
                break;
            default:
                return Promise.reject(new Error(`Unsupported asset type: ${fileExtension} for path ${path}`));
        }

        // Create a new promise for loading the asset
        const loadPromise = loadFunction().then(originalAsset => {
            this.assetCache.set(path, originalAsset); // Cache the original asset
            this.loadingPromises.delete(path); // Remove from loading promises
            return originalAsset instanceof THREE.Group ? originalAsset.clone() : originalAsset; // Return clone for GLTF, original for texture
        }).catch(error => {
            console.error(`Failed to load asset at ${path}:`, error);
            this.loadingPromises.delete(path); // Remove from loading promises on failure
            throw error; // Re-throw to propagate the error
        });

        this.loadingPromises.set(path, loadPromise); // Store the promise
        return loadPromise;
    }

    /**
     * Loads a GLTF/GLB model and returns its original scene (THREE.Group).
     * @param {string} path - The path to the model file (already cache-busted).
     * @returns {Promise<THREE.Group>}
     */
    async loadGltf(path) {
        const gltf = await this.gltfLoader.loadAsync(path);
        return gltf.scene; // Return the original scene, not a clone
    }

    /**
     * Loads a texture.
     * @param {string} path - The path to the texture file (already cache-busted).
     * @returns {Promise<THREE.Texture>}
     */
    async loadTexture(path) {
        return this.textureLoader.loadAsync(path);
    }

    /**
     * Disposes of all cached original assets to free up GPU memory.
     * This should be called when assets are no longer needed, e.g., when changing worlds.
     */
    dispose() {
        this.assetCache.forEach((asset) => {
            if (asset instanceof THREE.Group) {
                // Dispose of geometries and materials within the GLTF scene
                asset.traverse(child => {
                    if (child.isMesh) {
                        if (child.geometry) {
                            child.geometry.dispose();
                        }
                        if (child.material) {
                            // Handle array of materials
                            if (Array.isArray(child.material)) {
                                child.material.forEach(material => {
                                    this._disposeMaterial(material);
                                });
                            } else {
                                this._disposeMaterial(child.material);
                            }
                        }
                    }
                });
            } else if (asset instanceof THREE.Texture) {
                asset.dispose();
            }
            // console.log(`Disposed asset: ${path}`);
        });
        this.assetCache.clear();
        this.loadingPromises.clear(); // Clear any pending loads
        console.log('AssetManager disposed all cached assets.');
    }

    /**
     * Helper to dispose of a single material and its associated textures.
     * @param {THREE.Material} material - The material to dispose.
     */
    _disposeMaterial(material) {
        if (material.isMaterial) {
            // Dispose of textures associated with the material
            for (const key in material) {
                const value = material[key];
                if (value instanceof THREE.Texture) {
                    value.dispose();
                }
            }
            material.dispose();
        }
    }
}
