import BaseComponent from './BaseComponent.js';
import { AnimationAction, AnimationMixer, LoopOnce, LoopRepeat, Scene } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { inputHandler } from '../core/InputHandler.js';
import PlayerInputComponent from './PlayerInputComponent.js';

/**
 * Manages animations for the owner entity's 3D model.
 */
export default class AnimationComponent extends BaseComponent {
    /**
     * @param {import('../entities/Entity.js').default} owner - The entity that owns this component.
     * @param {Scene} scene - The Three.js scene (used for initial model loading, though model is added to owner.sceneObject).
     * @param {object} animationData - The animation data for the model, typically from animations.json.
     * @param {string} animationData.path - The path to the GLB model file.
     * @param {Array<object>} animationData.animations - An array of animation definitions.
     * @param {string} animationData.animations[].name - The name of the animation clip.
     * @param {number} [animationData.animations[].index] - The index of the animation clip in the GLB file (deprecated, prefer name).
     * @param {string} [animationData.animations[].loop='repeat'] - 'once' or 'repeat'.
     * @param {boolean} [animationData.animations[].enabled=false] - Whether the animation should start enabled.
     */
    constructor(owner, scene, animationData) {
        super(owner);
        this.mixer = null;
        /** @type {Object.<string, AnimationAction>} */
        this.actions = {};
        /** @type {Array<object>} */
        this.animationClipsData = animationData.animations || [];
        /** @type {AnimationAction | null} */
        this.currentAction = null;

        const loader = new GLTFLoader();
        loader.load(
            animationData.path,
            (gltf) => {
                const model = gltf.scene;
                this.owner.sceneObject.add(model);
                this.mixer = new AnimationMixer(model);

                this.animationClipsData.forEach((animData) => {
                    let clip = gltf.animations.find(clip => clip.name === animData.name);

                    // Fallback to index if name not found and index is provided
                    if (!clip && typeof animData.index === 'number' && gltf.animations[animData.index]) {
                        clip = gltf.animations[animData.index];
                        // Assign the name from animData to the clip if it was found by index
                        // This ensures consistency when referencing by name later
                        clip.name = animData.name; 
                    }

                    if (clip) {

                        this.actions[animData.name] = this.mixer.clipAction(clip);

                        if (animData.enabled) {
                            this.playAnimation(animData.name);
                        }
                    } else {
                        console.warn(`Animation clip "${animData.name}" (index: ${animData.index}) not found in ${animationData.path}`);
                    }
                });

                model.traverse((c) => {
                    c.castShadow = true;
                    c.receiveShadow = true;
                });
            },
            undefined,
            (error) => {
                console.error(
                    `An error happened while loading model ${animationData.path}:`,
                    error,
                );
            },
        );
    }

    /**
     * Returns a list of all animation names managed by this component.
     * @returns {string[]} An array of animation names.
     */
    getAnimationNames() {
        return Object.keys(this.actions);
    }

    /**
     * Plays a specific animation by name. Stops any currently playing animation.
     * @param {string} animationName - The name of the animation to play.
     * @param {boolean} [force=false] - If true, forces the animation to restart even if already playing.
     */
    playAnimation(animationName, force = false) {
        const action = this.actions[animationName];
        if (!action) {
            console.warn(`Animation "${animationName}" not found for model.`);
            return;
        }

        if (action === this.currentAction && action.isRunning() && !force) {
            return;
        }

        if (this.currentAction && this.currentAction !== action) {
            this.currentAction.stop();
        }

        const clipData = this.animationClipsData.find(a => a.name === animationName);
        if (clipData) {
            if (clipData.loop === 'once') {
                action.setLoop(LoopOnce);
                action.clampWhenFinished = true;
                this.mixer.addEventListener('finished', (e) => {
                    if (e.action === action) {
                        action.stop();
                        if (this.currentAction === action) {
                            this.currentAction = null;
                        }
                    }
                }, { once: true });
            } else {
                action.setLoop(LoopRepeat);
            }
            if (clipData.duration) {
                action.setDuration(clipData.duration);
            }
        } else {
            action.setLoop(LoopRepeat);
        }

        action.reset().play();
        this.currentAction = action;
    }

    /**
     * Stops a specific animation by name.
     * @param {string} animationName - The name of the animation to stop.
     */
    stopAnimation(animationName) {
        const action = this.actions[animationName];
        if (action && action.isRunning()) {
            action.stop();
            if (this.currentAction === action) {
                this.currentAction = null;
            }
        }
    }

    /**
     * Toggles the playback of a specific animation. If it's playing, it stops; otherwise, it plays.
     * @param {string} animationName - The name of the animation to toggle.
     */
    toggleAnimation(animationName) {
        const action = this.actions[animationName];
        if (!action) {
            console.warn(`Animation "${animationName}" not found for toggling.`);
            return;
        }

        if (action.isRunning()) {
            this.stopAnimation(animationName);
        } else {
            this.playAnimation(animationName);
        }
    }

    /**
     * Updates the animation mixer.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Player-specific animation logic
        if (this.owner.getComponent(PlayerInputComponent)) {
            const isMoving =
                inputHandler.isKeyDown('w') ||
                inputHandler.isKeyDown('s') ||
                inputHandler.isKeyDown('a') ||
                inputHandler.isKeyDown('d');

            if (isMoving && this.actions.walk && this.currentAction !== this.actions.walk) {
                this.playAnimation('walk');
            } else if (!isMoving && this.actions.idle && this.currentAction !== this.actions.idle) {
                this.playAnimation('idle');
            }
        }
    }

    /**
     * Cleans up the animation mixer and actions.
     */
    destroy() {
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer.uncacheRoot(this.mixer.getRoot());
            this.mixer = null;
        }
        this.actions = {};
        this.animationClipsData = [];
        this.currentAction = null;
    }
}
