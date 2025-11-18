import * as THREE from 'three';
import BaseState from './BaseState.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { eventBus } from '../core/EventBus.js'; //

/**
 * Represents the Solar System game state, where players can explore a model of our solar system.
 * This state features celestial bodies with textures, orbital mechanics, camera controls,
 * and interactive elements like zooming to Earth and returning to the Hub.
 */
export default class SolarSystemState extends BaseState {
    /**
     * Constructs the SolarSystemState.
     * @param {import('../core/Game.js').default} game - The main game instance.
     */
    constructor(game) {
        super(game);
        /** @type {Array<Object>} An array to hold all celestial bodies (planets, moons). */
        this.celestialBodies = [];
        /** @type {THREE.PointLight | null} Reference to the sun's light source. */
        this.sun = null;
        /** @type {THREE.TextureLoader} Loader for all textures. */
        this.textureLoader = new THREE.TextureLoader();
        /** @type {OrbitControls | null} Controls for orbiting the camera. */
        this.controls = null;
        /** @type {Function} Bound keydown event handler. */
        this.handleKeyDown = this.handleKeyDown.bind(this);

        // Camera animation properties for "Go to Earth" feature
        /** @type {THREE.Object3D | null} Reference to Earth's orbital pivot. */
        this.earthOrbit = null;
        /** @type {THREE.Mesh | null} Reference to Earth's mesh. */
        this.earthMesh = null;
        /** @type {boolean} Flag indicating if camera is currently animating. */
        this.isAnimatingCamera = false;
        /** @type {number} Timestamp when camera animation started. */
        this.cameraAnimationStartTime = 0;
        /** @type {number} Duration of the camera animation in milliseconds. */
        this.cameraAnimationDuration = 3000; // 3 seconds for animation
        /** @type {THREE.Vector3} Starting position of the camera for animation. */
        this.cameraStartPos = new THREE.Vector3();
        /** @type {THREE.Vector3} Starting target of the camera for animation. */
        this.cameraStartTarget = new THREE.Vector3();
        /** @type {THREE.Vector3} Ending position of the camera for animation. */
        this.cameraEndPos = new THREE.Vector3();
        /** @type {THREE.Vector3} Ending target of the camera for animation. */
        this.cameraEndTarget = new THREE.Vector3();

        /** @type {HTMLDivElement | null} Reference to the command UI element. */
        this.commandUI = null;
    }

    /**
     * Initializes the Solar System scene, camera, lights, and celestial bodies.
     * Sets up camera controls and event listeners.
     */
    enter() {
        this.scene = new THREE.Scene();

        // --- Star Background ---
        // Load the Milky Way texture and set it as the scene's background for a space-like feel.
        this.scene.background = this.textureLoader.load('assets/solar/8k_stars_milky_way.jpg',);
        console.log("SolarSystemState: Star background texture loaded and set."); // Debug log

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            2000, // Increased far clipping plane to see distant planets
        );
        this.camera.position.set(0, 150, 300); // Initial camera position, looking at the center
        this.camera.lookAt(0, 0, 0);
        console.log("SolarSystemState: Camera initialized."); // Debug log

        // --- OrbitControls for camera movement ---
        // Allow the user to orbit, pan, and zoom the camera around the scene.
        this.controls = new OrbitControls(this.camera, this.game.renderer.domElement);
        this.controls.enableDamping = true; // For smoother camera movement
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 0, 0); // Focus the controls on the origin (where the Sun is)
        this.controls.update();
        console.log("SolarSystemState: OrbitControls initialized."); // Debug log

        // Lights
        // Add a soft ambient light to ensure all parts of the scene are somewhat visible.
        const ambientLight = new THREE.AmbientLight(0x333333);
        this.scene.add(ambientLight);
        console.log("SolarSystemState: Ambient light added."); // Debug log

        // Sun (light source)
        // The sun acts as the primary light source, illuminating the planets and casting shadows.
        const sunLight = new THREE.PointLight(0xffffff, 2, 1000); // White, intense, long reach
        sunLight.castShadow = true; // Enable shadow casting from the sun
        sunLight.shadow.mapSize.width = 1024; // High-resolution shadows
        sunLight.shadow.mapSize.height = 1024;
        sunLight.shadow.camera.near = 0.5; // Near plane for the shadow camera frustum
        sunLight.shadow.camera.far = 1000; // Far plane for the shadow camera frustum
        this.scene.add(sunLight);
        this.sun = sunLight; // Store reference to the light
        console.log("SolarSystemState: Sun PointLight created and added to scene. castShadow:", sunLight.castShadow); // Debug log

        // Sun (mesh)
        // A visible sphere representing the sun. It should not cast shadows as it is the light.
        const sunGeometry = new THREE.SphereGeometry(20, 32, 32); // A large sphere for the sun
        const sunTexture = this.textureLoader.load('assets/solar/2k_sun.jpg');
        const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture }); // Basic material as it emits light
        const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        sunMesh.castShadow = false; // The sun mesh itself doesn't cast shadows
        this.scene.add(sunMesh);
        console.log("SolarSystemState: Sun mesh created and added to scene."); // Debug log

        // --- Celestial Bodies Data ---
        // Define properties for all planets and their textures.
        const celestialBodiesData = [
            { name: 'Mercury', size: 2, distance: 40, speed: 0.08, texture: 'assets/solar/2k_mercury.jpg', color: 0x888888 },
            { name: 'Venus', size: 4, distance: 60, speed: 0.05, texture: 'assets/solar/2k_venus_surface.jpg' },
            { name: 'Earth', size: 5, distance: 80, speed: 0.03, texture: 'assets/solar/2k_earth_daymap.jpg', hasMoon: true },
            { name: 'Mars', size: 3, distance: 100, speed: 0.02, texture: 'assets/solar/2k_mars.jpg' },
            { name: 'Jupiter', size: 12, distance: 150, speed: 0.01, texture: 'assets/solar/2k_jupiter.jpg' },
            { name: 'Saturn', size: 10, distance: 200, speed: 0.008, texture: 'assets/solar/2k_saturn.jpg' },
            { name: 'Uranus', size: 8, distance: 250, speed: 0.006, texture: 'assets/solar/2k_uranus.jpg' },
            { name: 'Neptune', size: 8, distance: 300, speed: 0.004, texture: 'assets/solar/2k_neptune.jpg' },
        ];

        // Create and position each celestial body
        celestialBodiesData.forEach(data => {
            const geometry = new THREE.SphereGeometry(data.size, 32, 32);
            const material = new THREE.MeshStandardMaterial(); // Standard material for lighting interaction
            if (data.texture) {
                material.map = this.textureLoader.load(data.texture);
            } else if (data.color) {
                material.color.set(data.color);
            }
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true; // Planets cast shadows
            mesh.receiveShadow = true; // Planets receive shadows
            console.log(`SolarSystemState: Planet ${data.name} mesh created. castShadow: ${mesh.castShadow}, receiveShadow: ${mesh.receiveShadow}`); // Debug log

            // Create an empty object to serve as the planet's orbital pivot around the sun
            const planetOrbit = new THREE.Object3D();
            this.scene.add(planetOrbit);

            planetOrbit.add(mesh);
            mesh.position.x = data.distance; // Position the planet away from the sun

            this.celestialBodies.push({
                name: data.name,
                mesh: planetOrbit, // The orbital pivot for the planet
                planetMesh: mesh, // The actual planet mesh
                speed: data.speed, // Orbital speed around the sun
                children: [] // To hold moons or rings
            });

            // Store Earth references for the camera animation feature
            if (data.name === 'Earth') {
                this.earthOrbit = planetOrbit;
                this.earthMesh = mesh;
                console.log("SolarSystemState: Earth references stored for animation."); // Debug log
            }

            // --- Earth's Moon ---
            // If this is Earth, create and add its moon.
            if (data.name === 'Earth' && data.hasMoon) {
                const moonGeometry = new THREE.SphereGeometry(1.5, 32, 32); // Smaller sphere for the moon
                const moonTexture = this.textureLoader.load('assets/solar/2k_moon.jpg');
                const moonMaterial = new THREE.MeshStandardMaterial({ map: moonTexture });
                const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
                moonMesh.castShadow = true; // Moon casts shadows
                moonMesh.receiveShadow = true; // Moon receives shadows
                console.log("SolarSystemState: Moon mesh created. castShadow:", moonMesh.castShadow, ", receiveShadow:", moonMesh.receiveShadow); // Debug log

                // Create an empty object for the Moon's orbit around Earth
                const moonOrbit = new THREE.Object3D();
                mesh.add(moonOrbit); // The moon orbits Earth, so its pivot is a child of Earth's mesh
                moonOrbit.add(moonMesh);
                moonMesh.position.x = data.size + 8; // Position the moon away from Earth

                // Store moon data for animation
                const earthEntry = this.celestialBodies.find(body => body.name === 'Earth');
                if (earthEntry) {
                    earthEntry.children.push({
                        mesh: moonOrbit, // The moon's orbital pivot
                        speed: 0.1 // Moon's orbital speed around Earth
                    });
                }
            }
        });

        // --- Command UI Display ---
        // Create and append a UI element to show available commands to the user.
        this.commandUI = document.createElement('div');
        this.commandUI.id = 'solar-system-commands';
        Object.assign(this.commandUI.style, {
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            fontFamily: 'monospace',
            fontSize: '14px',
            zIndex: '1000',
            // Temporarily removed pointerEvents: 'none' for debugging
        });
        this.commandUI.innerHTML = `
            <div><b>Commands:</b></div>
            <div>ESC: Return to Hub</div>
            <div>Mouse: Move Camera</div>
            <div>E: Go to Earth</div>
        `;
        document.body.appendChild(this.commandUI);
        console.log("SolarSystemState: Command UI element created and appended to body. Display style:", this.commandUI.style.display, "Parent:", this.commandUI.parentNode); // Debug log

        // Add event listeners
        window.addEventListener('resize', this.onWindowResize.bind(this));
        window.addEventListener('keydown', this.handleKeyDown); // Listen for Escape and 'E'
        console.log("SolarSystemState: Event listeners for resize and keydown added."); // Debug log
    }

    /**
     * Updates the state logic each frame. Handles celestial body animations and camera animation.
     * @param {number} deltaTime - The time elapsed since the last frame in seconds.
     */
    update(deltaTime) {
        // Rotate the sun mesh on its axis
        if (this.sun && this.sun.parent.children[0]) { // Assuming sunMesh is the first child of scene
            this.sun.parent.children[0].rotation.y += 0.005; // Slower sun rotation for visual effect
        }

        // Animate celestial bodies: orbit around the sun and rotate on their own axes
        this.celestialBodies.forEach(body => {
            body.mesh.rotation.y += body.speed * deltaTime * 10; // Orbit around the sun
            body.planetMesh.rotation.y += 0.05; // Rotate on its own axis

            // Animate moons orbiting their parent planet
            body.children.forEach(child => {
                child.mesh.rotation.y += child.speed * deltaTime * 10; // Orbit around parent
            });
        });

        // --- Camera Animation Update ---
        // If camera is animating towards Earth, interpolate its position and target.
        if (this.isAnimatingCamera) {
            const elapsedTime = performance.now() - this.cameraAnimationStartTime;
            const progress = Math.min(elapsedTime / this.cameraAnimationDuration, 1);

            // Smoothly move camera position and target
            this.camera.position.lerpVectors(this.cameraStartPos, this.cameraEndPos, progress);
            this.controls.target.lerpVectors(this.cameraStartTarget, this.cameraEndTarget, progress);
            this.camera.lookAt(this.controls.target); // Ensure camera always looks at the interpolated target

            // When animation is complete
            if (progress === 1) {
                this.isAnimatingCamera = false;
                this.controls.enabled = true; // Re-enable OrbitControls
                this.controls.update(); // Update controls to reflect the new position/target
                window.open('https://maps.app.goo.gl/knXF5cQkk1iNKn7g7', '_blank'); // Open Google Maps link
            }
        } else if (this.controls) {
            // Only update OrbitControls if not in a custom animation
            this.controls.update();
        }
    }

    /**
     * Handles keydown events for the SolarSystemState.
     * @param {KeyboardEvent} event - The keyboard event.
     */
    handleKeyDown(event) {
        // Pressing 'Escape' returns to the HubWorld
        if (event.key === 'Escape') {
            console.log("SolarSystemState: Escape key pressed. Returning to HubWorld.");
            eventBus.emit('change-state', 'HubWorld'); // Emit event to change state
        }
        // Pressing 'E' initiates camera animation to Earth, if not already animating
        else if (event.key.toLowerCase() === 'e' && !this.isAnimatingCamera) {
            if (this.earthOrbit && this.earthMesh) {
                console.log("SolarSystemState: 'E' key pressed. Initiating camera animation to Earth.");
                this.isAnimatingCamera = true;
                this.cameraAnimationStartTime = performance.now();
                this.controls.enabled = false; // Disable OrbitControls during animation

                // Store current camera state
                this.cameraStartPos.copy(this.camera.position);
                this.cameraStartTarget.copy(this.controls.target);

                // Calculate Earth's current world position for target
                const earthWorldPosition = new THREE.Vector3();
                this.earthMesh.getWorldPosition(earthWorldPosition);

                // Define target camera position: slightly above and behind Earth
                const targetCameraOffset = new THREE.Vector3(0, 20, 40); // Adjust these values for desired view
                this.cameraEndPos.copy(earthWorldPosition).add(targetCameraOffset);
                this.cameraEndTarget.copy(earthWorldPosition); // Look directly at Earth's center
            } else {
                console.warn("SolarSystemState: Earth mesh or orbit not found for camera animation.");
            }
        }
    }

    /**
     * Handles window resize events, updating camera aspect ratio and renderer size.
     */
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.game.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    /**
     * Cleans up resources and event listeners when exiting the state.
     */
    exit() {
        // Dispose geometries, materials, and textures for all celestial bodies
        this.celestialBodies.forEach(body => {
            body.planetMesh.geometry.dispose();
            if (Array.isArray(body.planetMesh.material)) {
                body.planetMesh.material.forEach(m => {
                    if (m.map) m.map.dispose();
                    m.dispose();
                });
            } else {
                if (body.planetMesh.material.map) body.planetMesh.material.map.dispose();
                body.planetMesh.material.dispose();
            }
            this.scene.remove(body.mesh); // Remove the orbital pivot from the scene

            // Dispose moons' resources if any
            body.children.forEach(child => {
                child.mesh.children[0].geometry.dispose();
                if (Array.isArray(child.mesh.children[0].material)) {
                    child.mesh.children[0].material.forEach(m => {
                        if (m.map) m.map.dispose();
                        m.dispose();
                    });
                } else {
                    if (child.mesh.children[0].material.map) child.mesh.children[0].material.map.dispose();
                    child.mesh.children[0].material.dispose();
                }
            });
        });
        this.celestialBodies = []; // Clear the array

        // Dispose sun light and mesh resources
        if (this.sun) {
            this.scene.remove(this.sun);
            this.sun.dispose();
            // The sun mesh material is a MeshBasicMaterial, which has a map property.
            // We need to dispose of the texture if it exists.
            this.scene.traverse((object) => {
                if (object.isMesh && object.material && object.material.map) {
                    object.material.map.dispose();
                }
            });
            this.sun = null;
        }

        // Dispose background texture
        if (this.scene.background instanceof THREE.Texture) {
            this.scene.background.dispose();
        }
        this.scene.background = null;

        // Dispose any remaining scene objects
        this.scene.traverse((object) => {
            if (object.isMesh) {
                object.geometry.dispose();
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => {
                        if (m.map) m.map.dispose();
                        m.dispose();
                    });
                } else {
                    if (object.material.map) object.material.map.dispose();
                    object.material.dispose();
                }
            }
        });
        this.scene = null;
        this.camera = null;

        // Dispose OrbitControls
        if (this.controls) {
            this.controls.dispose();
            this.controls = null;
        }

        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
        window.removeEventListener('keydown', this.handleKeyDown);

        // Remove command UI from DOM
        if (this.commandUI && this.commandUI.parentNode) {
            this.commandUI.parentNode.removeChild(this.commandUI);
            this.commandUI = null;
        }
    }
}