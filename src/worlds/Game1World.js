import * as THREE from 'three';

export default class Game1World {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      window.innerWidth / -2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      window.innerHeight / -2,
      1,
      1000
    );
    this.camera.position.z = 10;

    const geometry = new THREE.PlaneGeometry(100, 100);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const plane = new THREE.Mesh(geometry, material);
    this.scene.add(plane);
  }

  update() {
    // Game 1 logic
  }
}
