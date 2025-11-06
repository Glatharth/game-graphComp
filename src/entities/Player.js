import * as THREE from 'three';

export default class Player {
  constructor(scene) {
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    scene.add(this.mesh);

    this.velocity = new THREE.Vector3();
    this.speed = 5;

    this.keys = {};
    document.addEventListener('keydown', (e) => (this.keys[e.key] = true));
    document.addEventListener('keyup', (e) => (this.keys[e.key] = false));
  }

  update(deltaTime) {
    this.velocity.set(0, 0, 0);

    if (this.keys['w']) {
      this.velocity.z = -this.speed;
    }
    if (this.keys['s']) {
      this.velocity.z = this.speed;
    }
    if (this.keys['a']) {
      this.velocity.x = -this.speed;
    }
    if (this.keys['d']) {
      this.velocity.x = this.speed;
    }

    this.mesh.position.addScaledVector(this.velocity, deltaTime);
  }
}
