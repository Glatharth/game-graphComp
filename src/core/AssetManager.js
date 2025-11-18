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
        /** @type {Map<string, Promise<any>>} */
        this.cache = new Map(); // Cache stores Promises to avoid race conditions
    }

    /**
     * Retrieves an asset from the cache or loads it if not present.
     * Applies cache-busting to the network request to ensure fresh assets.
     * @param {string} path - The original path to the asset.
     * @returns {Promise<any>} A promise that resolves with the loaded asset.
     */
    async getAsset(path) {
        if (this.cache.has(path)) {
            return this.cache.get(path);
        }

        const fileExtension = path.split('.').pop().toLowerCase();
        // Apply cache-busting only to the URL for the network request
        const requestUrl = `${path}?v=${Date.now()}`;

        let loadPromise;
        switch (fileExtension) {
            case 'glb':
            case 'gltf':
                loadPromise = this.loadGltf(requestUrl);
                break;
            case 'png':
            case 'jpg':
            case 'jpeg':
                loadPromise = this.loadTexture(requestUrl);
                break;
            default:
                loadPromise = Promise.reject(new Error(`Unsupported asset type: ${fileExtension} for path ${path}`));
                break;
        }

        // Store the promise in the cache immediately to prevent duplicate requests
        this.cache.set(path, loadPromise);

        return loadPromise.catch(error => {
            console.error(`Failed to load asset at ${path}:`, error);
            this.cache.delete(path); // Remove from cache on failure to allow retries
            throw error; // Re-throw to propagate the error
        });
    }

    /**
     * Loads a GLTF/GLB model.
     * @param {string} path - The path to the model file (already cache-busted).
     * @returns {Promise<THREE.Scene>}
     */
    async loadGltf(path) {
        const gltf = await this.gltfLoader.loadAsync(path);
        // We clone the scene so that each placed object is a unique instance.
        // This prevents all instances from changing when one is modified.
        const scene = gltf.scene || gltf;
        return scene.clone();
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
     * Disposes of all cached assets to free up memory.
     */
    dispose() {
        this.cache.forEach((assetPromise) => {
            assetPromise.then(asset => {
                if (asset) {
                    if (asset.traverse) { // Likely a THREE.Object3D
                        asset.traverse(child => {
                            if (child.isMesh) {
                                child.geometry?.dispose();
                                if (child.material) {
                                    if (Array.isArray(child.material)) {
                                        child.material.forEach(m => m.dispose());
                                    } else {
                                        child.material.dispose();
                                    }
                                }
                            }
                        });
                    } else if (asset.dispose) { // Likely a texture or material
                        asset.dispose();
                    }
                }
            }).catch(() => {
                // Ignore errors for assets that failed to load
            });
        });
        this.cache.clear();
        console.log('AssetManager disposed all cached assets.');
    }
}
