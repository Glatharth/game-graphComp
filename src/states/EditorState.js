/**
 * @file Defines the state for the terrain editor.
 * @module states/EditorState
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import BaseState from './BaseState.js';

/**
 * Manages the entire editor functionality, including UI, input handling,
 * object placement, and scene manipulation.
 */
export default class EditorState extends BaseState {
    constructor(game) {
        super(game);

        // --- Core Components ---
        this.uiContainer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.gltfLoader = new GLTFLoader();

        // --- Scene & World Objects ---
        this.editableObjects = [];
        this.occupiedGridCells = new Set();

        // --- Editor State & Modes ---
        this.editorMode = 'select';
        this.currentStampAsset = null;
        this.lastStampedPosition = new THREE.Vector2(Infinity, Infinity);
        this.isLeftMouseButtonDown = false;

        // --- Shape Drawing ---
        this.isDrawingShape = false;
        this.shapeStartPosition = new THREE.Vector2();
        this.previewObjects = [];
        this.previewObject = null;

        // --- Object Selection & Manipulation ---
        this.selectedObject = null;
        this.isDraggingObject = false; // Explicitly track object dragging
        this.dragOffset = new THREE.Vector3();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.highlightActive = true;

        // --- Camera Controls ---
        this.isPanning = false;
        this.panPreviousPoint = new THREE.Vector3();
        this.zoomLevel = 15;

        // --- Thumbnail Generation ---
        this.thumbnailRenderer = null;
        this.thumbnailCache = new Map();

        // --- Grid ---
        this.gridSize = 1;
        this.gridHelper = null;

        // Bind the context of 'this' for event handlers
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.onContextMenu = (e) => e.preventDefault();
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
    }

    // --- State Lifecycle ---

    async enter() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-aspect * this.zoomLevel, aspect * this.zoomLevel, this.zoomLevel, -this.zoomLevel, 1, 1000);
        this.updateCameraProjection();

        this.camera.position.set(25, 25, 25);
        this.camera.lookAt(this.scene.position);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(10, 15, 5);
        this.scene.add(directionalLight);

        this.editorFloor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ visible: false }));
        this.editorFloor.rotation.x = -Math.PI / 2;
        this.editorFloor.name = 'editorFloor';
        this.scene.add(this.editorFloor);

        this.gridHelper = new THREE.GridHelper(100, 100 / this.gridSize, 0x888888, 0x444444);
        this.scene.add(this.gridHelper);

        this.createUI();
        this.populateAssetBrowser();
        this.setupInputListeners();
        window.addEventListener('keydown', this.handleKeyDown);
    }

    exit() {
        this.editableObjects.forEach(obj => this.disposeObject(obj));
        this.editableObjects = [];
        this.occupiedGridCells.clear();

        if (this.previewObject) this.disposeObject(this.previewObject);
        this.previewObjects.forEach(obj => this.disposeObject(obj));
        this.previewObjects = [];

        if (this.gridHelper) this.scene.remove(this.gridHelper);
        if (this.editorFloor) this.scene.remove(this.editorFloor);

        if (this.thumbnailRenderer) {
            this.thumbnailRenderer.dispose();
            this.thumbnailRenderer = null;
        }
        this.thumbnailCache.clear();

        if (this.uiContainer) this.uiContainer.remove();
        this.removeInputListeners();
        window.removeEventListener('keydown', this.handleKeyDown);

        this.scene = null;
        this.camera = null;
        this.selectedObject = null;
    }

    // --- UI Methods ---

    createUI() {
        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'editor-ui';
        document.body.appendChild(this.uiContainer);
        this.uiContainer.innerHTML = `
            <h3>Editor</h3>
            <div class="tool-bar">
                <h4>Mode</h4>
                <button class="tool-btn active" data-mode="select">Select</button>
                <button class="tool-btn" data-mode="stamp">Stamp</button>
                <button class="tool-btn" data-mode="line">Line</button>
                <button class="tool-btn" data-mode="square">Square</button>
            </div>
            <div id="properties-panel" style="display: none;">
                <h4>Properties</h4>
                <label for="interaction-id-input">Interaction ID</label>
                <input type="text" id="interaction-id-input" class="property-input" placeholder="e.g., showMessage">
                <label for="interaction-data-input">Interaction Data (JSON)</label>
                <textarea id="interaction-data-input" class="property-input"></textarea>
            </div>
            <div id="asset-browser">
                <h4>Assets</h4>
                <select id="asset-category-select"></select>
                <input type="text" id="asset-search-input" placeholder="Search assets...">
                <div class="asset-list" id="asset-list-container"></div>
            </div>
            <div class="editor-controls">
                <h4>Controls</h4>
                <div id="coords-display">X: 0, Z: 0</div>
                <div class="controls-hint"><b>Zoom:</b> Mouse Wheel</div>
                <div class="controls-hint"><b>Pan Camera:</b> Right Mouse</div>
                <div class="controls-hint"><b>Rotate:</b> Y</div>
                <div class="controls-hint"><b>Highlight:</b> H</div>
                <div class="controls-hint"><b>Delete:</b> Delete</div>
            </div>
            <button id="save-world-btn">Save World</button>`;
        this.uiContainer.style.display = 'block';

        document.getElementById('save-world-btn').addEventListener('click', () => this.saveWorld());
        this.uiContainer.querySelectorAll('.tool-btn').forEach(b => b.addEventListener('click', (e) => this.setEditorMode(e.target.dataset.mode)));
        document.getElementById('asset-category-select').addEventListener('change', (e) => this.filterAssets(e.target.value, document.getElementById('asset-search-input').value));
        document.getElementById('asset-search-input').addEventListener('input', (e) => this.filterAssets(document.getElementById('asset-category-select').value, e.target.value));
        
        document.getElementById('interaction-id-input').addEventListener('input', (e) => this.updateSelectedObjectInteraction('id', e.target.value));
        document.getElementById('interaction-data-input').addEventListener('input', (e) => this.updateSelectedObjectInteraction('data', e.target.value));
    }

    updatePropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        const idInput = document.getElementById('interaction-id-input');
        const dataInput = document.getElementById('interaction-data-input');

        if (this.selectedObject) {
            panel.style.display = 'block';
            idInput.value = this.selectedObject.userData.interactionId || '';
            dataInput.value = this.selectedObject.userData.interactionData ? JSON.stringify(this.selectedObject.userData.interactionData, null, 2) : '{}';
        } else {
            panel.style.display = 'none';
        }
    }

    updateSelectedObjectInteraction(type, value) {
        if (!this.selectedObject) return;
        if (type === 'id') {
            this.selectedObject.userData.interactionId = value;
        } else if (type === 'data') {
            const dataInput = document.getElementById('interaction-data-input');
            try {
                this.selectedObject.userData.interactionData = value ? JSON.parse(value) : {};
                dataInput.classList.remove('invalid');
            } catch (e) {
                dataInput.classList.add('invalid');
            }
        }
    }

    setEditorMode(mode) {
        if (this.editorMode === mode) return;
        this.uiContainer.querySelector(`.tool-btn.active`).classList.remove('active');
        this.uiContainer.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        this.editorMode = mode;
        if (mode !== 'select') this.deselectObject();
        this.updatePreviewObjectVisibility();
    }

    // --- Asset & Thumbnail Management ---

    populateAssetBrowser() {
        this.assetData = {
            arcade: { path: 'public/worlds/arcade', assets: [ 'wall.glb', 'floor.glb', 'column.glb', 'prizes.glb', 'pinball.glb', 'air-hockey.glb', 'prize-wheel.glb', 'wall-corner.glb', 'wall-window.glb', 'claw-machine.glb', 'cash-register.glb', 'dance-machine.glb', 'arcade-machine.glb', 'ticket-machine.glb', 'basketball-game.glb', 'character-gamer.glb', 'vending-machine.glb', 'gambling-machine.glb', 'wall-door-rotate.glb', 'character-employee.glb' ] },
            characters: { path: 'public/characters', assets: [ 'aid-cane.glb', 'aid-mask.glb', 'aid-crutch.glb', 'wheelchair.glb', 'aid-glasses.glb', 'aid_hearing.glb', 'aid-cane-blind.glb', 'aid-sunglasses.glb', 'character-male-a.glb', 'character-male-b.glb', 'character-male-c.glb', 'character-male-d.glb', 'character-male-e.glb', 'character-male-f.glb', 'wheelchair-power.glb', 'wheelchair-deluxe.glb', 'character-female-a.glb', 'character-female-b.glb', 'character-female-c.glb', 'character-female-d.glb', 'character-female-e.glb', 'character-female-f.glb', 'aid-cane-low-vision.glb', 'aid-defibrillator-red.glb', 'aid-defibrillator-green.glb', 'wheelchair-power-deluxe.glb' ] },
            // terrain: { path: 'public/terrain', assets: [] }
        };

        const categorySelect = document.getElementById('asset-category-select');
        const assetListContainer = document.getElementById('asset-list-container');

        for (const category in this.assetData) {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            categorySelect.appendChild(option);

            this.assetData[category].assets.forEach(fileName => {
                const modelPath = `${this.assetData[category].path}/${fileName}`;
                const itemName = fileName.replace('.glb', '');
                const assetItem = document.createElement('div');
                assetItem.className = 'asset-item';
                assetItem.dataset.modelPath = modelPath;
                assetItem.dataset.category = category;
                assetItem.dataset.name = itemName.toLowerCase();
                
                const img = document.createElement('img');
                img.src = `public/thumbnails/${category}/${itemName}.png`;
                img.alt = itemName;
                img.onerror = () => { img.onerror = null; this.generateThumbnail(modelPath).then(dataUrl => { img.src = dataUrl; }); };
                
                const nameSpan = document.createElement('span');
                nameSpan.textContent = itemName;

                assetItem.appendChild(img);
                assetItem.appendChild(nameSpan);
                assetItem.addEventListener('click', () => this.selectStampAsset(assetItem));
                assetListContainer.appendChild(assetItem);
            });
        }
        this.filterAssets(categorySelect.value, '');
    }

    filterAssets(category, searchTerm) {
        const assetItems = document.querySelectorAll('.asset-item');
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        assetItems.forEach(item => {
            const isCategoryMatch = item.dataset.category === category;
            const isSearchMatch = item.dataset.name.includes(lowerCaseSearchTerm);
            item.style.display = isCategoryMatch && isSearchMatch ? 'flex' : 'none';
        });
    }

    async selectStampAsset(assetItem) {
        const currentSelected = this.uiContainer.querySelector('.asset-item.selected');
        if (currentSelected) currentSelected.classList.remove('selected');
        assetItem.classList.add('selected');
        this.currentStampAsset = assetItem.dataset.modelPath;

        if (this.previewObject) this.disposeObject(this.previewObject);
        
        try {
            const gltf = await this.gltfLoader.loadAsync(this.currentStampAsset);
            this.previewObject = gltf.scene;
            this.previewObject.traverse(child => {
                if (child.isMesh) {
                    child.material = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true, wireframe: true });
                }
            });
            this.scene.add(this.previewObject);
            this.updatePreviewObjectVisibility();
        } catch (e) { this.previewObject = null; }
    }

    updatePreviewObjectVisibility() {
        if (!this.previewObject) return;

        this.previewObject.visible =
            this.editorMode === 'stamp' ||
            this.editorMode === 'line' ||
            this.editorMode === 'square';
    }

    async generateThumbnail(modelPath) {
        if (this.thumbnailCache.has(modelPath)) return this.thumbnailCache.get(modelPath);
        if (!this.thumbnailRenderer) {
            this.thumbnailRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            this.thumbnailRenderer.setSize(128, 128);
        }
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);
        try {
            const gltf = await this.gltfLoader.loadAsync(modelPath);
            const model = gltf.scene;
            scene.add(model);
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;
            camera.position.set(center.x, center.y, center.z + cameraZ);
            camera.lookAt(center);
            this.thumbnailRenderer.render(scene, camera);
            const dataUrl = this.thumbnailRenderer.domElement.toDataURL('image/png');
            this.thumbnailCache.set(modelPath, dataUrl);
            this.disposeObject(model);
            return dataUrl;
        } catch (error) { return 'about:blank'; }
    }

    // --- Input & Mode Handlers ---

    setupInputListeners() {
        const canvas = this.game.renderer.domElement;
        canvas.addEventListener('pointerdown', this.onPointerDown);
        canvas.addEventListener('pointermove', this.onPointerMove);
        canvas.addEventListener('pointerup', this.onPointerUp);
        canvas.addEventListener('contextmenu', this.onContextMenu);
        canvas.addEventListener('wheel', this.onWheel);
    }

    removeInputListeners() {
        const canvas = this.game.renderer.domElement;
        canvas.removeEventListener('pointerdown', this.onPointerDown);
        canvas.removeEventListener('pointermove', this.onPointerMove);
        canvas.removeEventListener('pointerup', this.onPointerUp);
        canvas.removeEventListener('contextmenu', this.onContextMenu);
        canvas.removeEventListener('wheel', this.onWheel);
    }

    handleKeyDown(event) {
        if (this.selectedObject) {
            switch (event.key.toLowerCase()) {
                case 'y': this.rotateSelectedObject(); break;
                case 'h': this.toggleHighlight(); break;
                case 'delete': this.deleteSelectedObject(); break;
            }
        }
    }

    onPointerDown(event) {
        if (event.target.closest('#editor-ui')) return;
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
    
        if (event.button === 2) { // Right mouse button
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersects = this.raycaster.ray.intersectPlane(plane, this.panPreviousPoint);
            
            if (intersects) {
                this.isPanning = true;
            }
            return;
        }
    
        if (event.button === 0) {
            this.isLeftMouseButtonDown = true;
            switch (this.editorMode) {
                case 'select': this.handleSelectModePointerDown(); break;
                case 'stamp': this.handleStampModePointerMove(); break;
                case 'line':
                case 'square': this.handleShapeModePointerDown(); break;
            }
        }
    }
    
    onPointerMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
        if (this.isPanning) {
            this.handleCameraPan();
            return;
        }
    
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.editorFloor);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridX = Math.round(point.x / this.gridSize);
            const gridZ = Math.round(point.z / this.gridSize);
            document.getElementById('coords-display').innerText = `X: ${gridX}, Z: ${gridZ}`;
    
            if (this.previewObject && this.previewObject.visible) {
                this.previewObject.position.set(gridX * this.gridSize, 0, gridZ * this.gridSize);
            }
        }
    
        if (!this.isLeftMouseButtonDown) return;
    
        switch (this.editorMode) {
            case 'select': this.handleSelectModePointerMove(); break;
            case 'stamp': this.handleStampModePointerMove(); break;
            case 'line':
            case 'square': this.handleShapeModePointerMove(); break;
        }
    }

    onPointerUp(event) {
        if (event.button === 2) this.isPanning = false;
        if (event.button === 0) {
            if (this.isDrawingShape) this.handleShapeModePointerUp();
            if (this.isDraggingObject) this.handleSelectModePointerUp();
            this.isLeftMouseButtonDown = false;
            this.isDrawingShape = false;
            this.isDraggingObject = false;
            this.lastStampedPosition.set(Infinity, Infinity);
        }
    }

    onWheel(event) {
        event.preventDefault();
        const zoomAmount = event.deltaY * 0.007;
        this.zoomLevel = Math.max(2, Math.min(50, this.zoomLevel + zoomAmount));
        this.updateCameraProjection();
    }

    updateCameraProjection() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.left = -this.zoomLevel * aspect;
        this.camera.right = this.zoomLevel * aspect;
        this.camera.top = this.zoomLevel;
        this.camera.bottom = -this.zoomLevel;
        this.camera.updateProjectionMatrix();
    }

    handleCameraPan() {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const currentPoint = new THREE.Vector3();
    
        // 1. Get the world point under the mouse with the current camera position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.ray.intersectPlane(plane, currentPoint);
    
        // 2. Calculate the delta between the last point and the current point
        const delta = new THREE.Vector3().subVectors(this.panPreviousPoint, currentPoint);
    
        // 3. Move the camera by that delta
        this.camera.position.add(delta);
    
        // 4. Update the previous point for the next frame.
        // This is the crucial step to prevent the feedback loop. We find where the
        // mouse is pointing in the world *after* the camera has moved.
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.ray.intersectPlane(plane, this.panPreviousPoint);
    }

    // --- Mode-Specific Logic ---

    handleSelectModePointerDown() {
        const intersects = this.raycaster.intersectObjects(this.editableObjects, true);
        if (intersects.length > 0) {
            let topLevelObject = intersects[0].object;
            while (topLevelObject.parent && !this.editableObjects.includes(topLevelObject)) topLevelObject = topLevelObject.parent;
            if (this.selectedObject !== topLevelObject) { this.deselectObject(); this.selectObject(topLevelObject); }
            
            this.isDraggingObject = true;
            // Free up the grid cell when starting to drag
            if (this.selectedObject.userData.gridKey) {
                this.occupiedGridCells.delete(this.selectedObject.userData.gridKey);
            }

            const intersectionPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint);
            this.dragOffset.subVectors(this.selectedObject.position, intersectionPoint);
        } else { this.deselectObject(); }
    }

    handleSelectModePointerMove() {
        if (this.isDraggingObject && this.selectedObject) {
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
                this.selectedObject.position.copy(intersectPoint).add(this.dragOffset);
            }
        }
    }

    handleSelectModePointerUp() {
        if (this.selectedObject) {
            // Snap to grid and update occupied cell on drop
            const gridX = Math.round(this.selectedObject.position.x / this.gridSize);
            const gridZ = Math.round(this.selectedObject.position.z / this.gridSize);
            this.selectedObject.position.x = gridX * this.gridSize;
            this.selectedObject.position.z = gridZ * this.gridSize;

            const newGridKey = `${gridX},${gridZ}`;
            this.occupiedGridCells.add(newGridKey);
            this.selectedObject.userData.gridKey = newGridKey;
        }
    }

    handleStampModePointerMove() {
        if (!this.currentStampAsset) return;
        const intersects = this.raycaster.intersectObject(this.editorFloor);
        if (intersects.length > 0) {
            const gridX = Math.round(intersects[0].point.x / this.gridSize);
            const gridZ = Math.round(intersects[0].point.z / this.gridSize);
            if (gridX !== this.lastStampedPosition.x || gridZ !== this.lastStampedPosition.y) {
                this.placeObject(this.currentStampAsset, gridX * this.gridSize, gridZ * this.gridSize);
                this.lastStampedPosition.set(gridX, gridZ);
            }
        }
    }

    handleShapeModePointerDown() {
        if (!this.currentStampAsset) return;
        const intersects = this.raycaster.intersectObject(this.editorFloor);
        if (intersects.length > 0) {
            this.isDrawingShape = true;
            this.shapeStartPosition.x = Math.round(intersects[0].point.x / this.gridSize);
            this.shapeStartPosition.y = Math.round(intersects[0].point.z / this.gridSize);
        }
    }

    handleShapeModePointerMove() {
        if (!this.isDrawingShape || !this.currentStampAsset) return;
        const intersects = this.raycaster.intersectObject(this.editorFloor);
        if (intersects.length > 0) {
            const currentGridX = Math.round(intersects[0].point.x / this.gridSize);
            const currentGridZ = Math.round(intersects[0].point.z / this.gridSize);
            this.updateShapePreview(this.shapeStartPosition.x, this.shapeStartPosition.y, currentGridX, currentGridZ);
        }
    }

    handleShapeModePointerUp() {
        this.previewObjects.forEach(obj => this.scene.remove(obj));
        this.previewObjects = [];
        const intersects = this.raycaster.intersectObject(this.editorFloor);
        if (intersects.length > 0) {
            const endGridX = Math.round(intersects[0].point.x / this.gridSize);
            const endGridZ = Math.round(intersects[0].point.z / this.gridSize);
            const gridPositions = this.getGridPositionsForShape(this.shapeStartPosition.x, this.shapeStartPosition.y, endGridX, endGridZ);
            gridPositions.forEach(pos => this.placeObject(this.currentStampAsset, pos.x * this.gridSize, pos.y * this.gridSize));
        }
    }

    updateShapePreview(startX, startZ, endX, endZ) {
        this.previewObjects.forEach(obj => this.scene.remove(obj));
        this.previewObjects = [];
        const gridPositions = this.getGridPositionsForShape(startX, startZ, endX, endZ);
        gridPositions.forEach(pos => {
            const cellKey = `${pos.x},${pos.y}`;
            const isOccupied = this.occupiedGridCells.has(cellKey);
            const color = isOccupied ? 0xff0000 : 0x00ff00;
            const previewMesh = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, 0.1, this.gridSize), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
            previewMesh.position.set(pos.x * this.gridSize, 0.05, pos.y * this.gridSize);
            this.scene.add(previewMesh);
            this.previewObjects.push(previewMesh);
        });
    }

    getGridPositionsForShape(startX, startZ, endX, endZ) {
        const positions = [];
        if (this.editorMode === 'line') {
            let x = startX, z = startZ;
            const dx = Math.abs(endX - startX), sx = startX < endX ? 1 : -1;
            const dz = -Math.abs(endZ - startZ), sz = startZ < endZ ? 1 : -1;
            let err = dx + dz, e2;
            for (;;) {
                positions.push({ x: x, y: z });
                if (x === endX && z === endZ) break;
                e2 = 2 * err;
                if (e2 >= dz) { err += dz; x += sx; }
                if (e2 <= dx) { err += dx; z += sz; }
            }
        } else if (this.editorMode === 'square') {
            const minX = Math.min(startX, endX);
            const maxX = Math.max(startX, endX);
            const minZ = Math.min(startZ, endZ);
            const maxZ = Math.max(startZ, endZ);
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    positions.push({ x, y: z });
                }
            }
        }
        return positions;
    }

    // --- Object Placement & Manipulation ---

    async placeObject(modelPath, x, z) {
        const cellKey = `${x / this.gridSize},${z / this.gridSize}`;
        if (this.occupiedGridCells.has(cellKey)) return;

        try {
            const gltf = await this.gltfLoader.loadAsync(modelPath);
            const model = gltf.scene;
            const bbox = new THREE.Box3().setFromObject(model);
            const center = bbox.getCenter(new THREE.Vector3());
            const size = bbox.getSize(new THREE.Vector3());
            model.position.set(x, 0, z);
            model.position.y -= (center.y - size.y / 2);
            model.userData = { modelPath, type: 'staticObject', isEditableAsset: true, gridKey: cellKey };
            this.scene.add(model);
            this.editableObjects.push(model);
            this.occupiedGridCells.add(cellKey);
        } catch (error) { console.error(`Error loading GLB model ${modelPath}:`, error); }
    }

    selectObject(object) {
        if (this.selectedObject === object) return;
        this.deselectObject();
        this.selectedObject = object;
        this.highlightActive = true;
        this.applyHighlight();
        this.updatePropertiesPanel();
    }

    deselectObject() {
        if (this.selectedObject) {
            this.removeHighlight();
            this.selectedObject = null;
        }
        this.updatePropertiesPanel();
    }

    deleteSelectedObject() {
        if (!this.selectedObject) return;
        if (this.selectedObject.userData.gridKey) {
            this.occupiedGridCells.delete(this.selectedObject.userData.gridKey);
        }
        this.disposeObject(this.selectedObject);
        const index = this.editableObjects.indexOf(this.selectedObject);
        if (index > -1) this.editableObjects.splice(index, 1);
        this.selectedObject = null;
        this.updatePropertiesPanel();
    }

    applyHighlight() {
        if (!this.selectedObject || !this.highlightActive) return;
        this.selectedObject.traverse((child) => {
            if (child.isMesh) {
                if (!child.userData.originalMaterial) child.userData.originalMaterial = child.material;
                child.material = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
            }
        });
    }

    removeHighlight() {
        if (!this.selectedObject) return;
        this.selectedObject.traverse((child) => {
            if (child.isMesh && child.userData.originalMaterial) {
                child.material.dispose();
                child.material = child.userData.originalMaterial;
                delete child.userData.originalMaterial;
            }
        });
    }

    toggleHighlight() {
        if (!this.selectedObject) return;
        this.highlightActive = !this.highlightActive;
        if (this.highlightActive) this.applyHighlight();
        else this.removeHighlight();
    }

    rotateSelectedObject() {
        if (this.selectedObject) this.selectedObject.rotation.y += Math.PI / 2;
    }

    disposeObject(obj) {
        if (!obj) return;
        obj.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            }
        });
        this.scene.remove(obj);
    }

    // --- Save & Exit ---

    async saveWorld() {
        const worldData = { objects: [] };
        this.editableObjects.forEach(obj => {
            if (obj.userData.isEditableAsset) {
                worldData.objects.push({
                    type: 'staticObject',
                    model: obj.userData.modelPath.split('/').pop().replace('.glb', ''),
                    path: obj.userData.modelPath,
                    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                    rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                    scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
                    interactionId: obj.userData.interactionId,
                    interactionData: obj.userData.interactionData
                });
            }
        });
        const worldJson = JSON.stringify(worldData, null, 4);
        const blob = new Blob([worldJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'editor_world.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('World data saved to editor_world.json!');
    }
}
