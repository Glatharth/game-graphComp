import * as THREE from 'three';
import Player from '../entities/Player.js';

export default class HubWorld {
    constructor(game) {
        this.game = game;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000,
        );
        this.camera.position.z = 5;

        this.player = new Player(this.scene);

        const light = new THREE.AmbientLight(0xcccccc, 0.5);
        this.scene.add(light);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.scene.add(directionalLight);

        this.lastTime = performance.now();
    }

    update() {
        const time = performance.now();
        const deltaTime = (time - this.lastTime) / 1000;

        this.player.update(deltaTime);

        this.lastTime = time;
    }
}
