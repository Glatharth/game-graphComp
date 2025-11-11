import BaseComponent from './BaseComponent.js';
import { inputHandler } from '../core/InputHandler.js';
import { AnimationMixer, LoopOnce } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export default class AnimationComponent extends BaseComponent {
    constructor(owner, scene, path) {
        super(owner);
        this.mixer = null;
        this.actions = {};

        const loader = new GLTFLoader();
        loader.load(
            path,
            (gltf) => {
                const model = gltf.scene;
                this.owner.sceneObject.add(model);
                this.mixer = new AnimationMixer(model);

                const idleAction = this.mixer.clipAction(gltf.animations[1]);
                idleAction.setDuration(4).play();
                this.actions['idle'] = idleAction;

                const runAction = this.mixer.clipAction(gltf.animations[2]);
                runAction.setDuration(0.5).play();
                this.actions['walk'] = runAction;

                const interactAction = this.mixer.clipAction(
                    gltf.animations[24],
                );
                interactAction.setLoop(LoopOnce);
                interactAction.clampWhenFinished = true;
                this.actions['interact'] = interactAction;

                this.actions.walk.enabled = false;
                this.actions.interact.enabled = false;

                model.traverse((c) => {
                    c.castShadow = true;
                    c.receiveShadow = true;
                });
            },
            undefined,
            (error) => {
                console.error(
                    'An error happened while loading the model:',
                    error,
                );
            },
        );
    }

    update(deltaTime) {
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        const isMoving =
            inputHandler.isKeyDown('w') ||
            inputHandler.isKeyDown('s') ||
            inputHandler.isKeyDown('a') ||
            inputHandler.isKeyDown('d');

        if (isMoving && this.actions.walk && !this.actions.walk.enabled) {
            this.actions.walk.enabled = true;
            this.actions.idle.enabled = false;
        } else if (
            !isMoving &&
            this.actions.idle &&
            !this.actions.idle.enabled
        ) {
            this.actions.walk.enabled = false;
            this.actions.idle.enabled = true;
        }

        if (inputHandler.wasKeyJustPressed('f') && this.actions.interact) {
            this.actions.interact.reset().play();
            this.actions.interact.enabled = true;
            this.actions.idle.enabled = false;
            this.actions.walk.enabled = false;

            this.mixer.addEventListener('finished', (e) => {
                if (e.action === this.actions.interact) {
                    this.actions.interact.enabled = false;
                    this.actions.idle.enabled = true;
                }
            });
        }
    }
}
