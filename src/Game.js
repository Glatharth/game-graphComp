import * as THREE from 'three';
import EventEmitter from './utils/EventEmitter.js';

export default class Game extends EventEmitter {
    constructor() {
        super();

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.activeWorld = null;

        window.addEventListener('resize', this.onWindowResize.bind(this));

        this.animate();
    }

    setWorld(world) {
        if (this.activeWorld) {
            // Optional: clean up the old world
        }
        this.activeWorld = world;
        this.emit('worldChanged', world);
    }

    onWindowResize() {
        if (this.activeWorld) {
            this.activeWorld.camera.aspect =
                window.innerWidth / window.innerHeight;
            this.activeWorld.camera.updateProjectionMatrix();
        }
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));

        if (this.activeWorld) {
            this.activeWorld.update();
            this.renderer.render(
                this.activeWorld.scene,
                this.activeWorld.camera,
            );
        }
    }
}
