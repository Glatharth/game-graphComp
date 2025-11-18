/**
 * @file Defines the state for the world editor.
 * @module states/EditorState
 * @description This state provides a comprehensive UI for creating, editing, and testing worlds.
 * It manages object placement, properties, and world data persistence using browser local storage.
 */

import * as THREE from 'three';
import BaseState from './BaseState.js';
import AssetManager from '../core/AssetManager.js';

const LOCAL_STORAGE_KEY = 'editor_worlds';

/**
 * Manages the entire editor functionality, including UI, input handling,
 * object placement, and scene manipulation.
 * @extends BaseState
 */
export default class EditorState extends BaseState {
    /**
     * @param {import('../core/Game.js').default} game - The main game instance.
     */
    constructor(game) {
        super(game);

        this.assetManager = new AssetManager();
        this.uiContainer = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.editableObjects = [];
        this.occupiedGridCells = new Map();
        this.editorMode = 'select';
        this.currentStampAsset = null;
        this.lastStampedPosition = new THREE.Vector2(Infinity, Infinity);
        this.isLeftMouseButtonDown = false;
        this.isDrawingShape = false;
        this.shapeStartPosition = new THREE.Vector2();
        this.previewObjects = [];
        this.previewObject = null;
        /** @type {THREE.Object3D | null} */
        this.selectedObject = null; // Single selected object for primary interaction
        /** @type {Array<THREE.Object3D>} */
        this.selectedObjects = []; // Array for multi-selection
        this.isDraggingObject = false;
        this.dragOffset = new THREE.Vector3();
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this.highlightActive = true;
        this.isPanning = false;
        this.panPreviousPoint = new THREE.Vector3();
        this.zoomLevel = 15;
        this.thumbnailRenderer = null;
        this.thumbnailCache = new Map();
        this.gridSize = 1;
        this.gridHelper = null;

        // Drag selection variables
        this.isDraggingSelection = false;
        this.selectionRect = { startX: 0, startY: 0, currentX: 0, currentY: 0 };
        this.selectionDiv = null;

        // Bind the context of 'this' for event handlers
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.onContextMenu = (e) => e.preventDefault();
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onWheel = this.onWheel.bind(this);
    }

    // --- State Lifecycle ---

    async enter(params = {}) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x2b2b2b);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(-aspect * this.zoomLevel, aspect * this.zoomLevel, this.zoomLevel, -this.zoomLevel, 1, 1000);
        this.updateCameraProjection();
        this.camera.position.set(25, 25, 25);
        this.camera.lookAt(this.scene.position);

        this.editorFloor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ visible: false }));
        this.editorFloor.rotation.x = -Math.PI / 2;
        this.editorFloor.name = 'editorFloor';
        this.scene.add(this.editorFloor);

        this.gridHelper = new THREE.GridHelper(100, 100 / this.gridSize, 0x888888, 0x444444);
        this.scene.add(this.gridHelper);

        this.createUI();
        this.populateAssetBrowser();
        this.setupInputListeners();
        await this.loadWorldList();

        if (params.worldData) {
            await this.loadWorldData(params.worldData, params.worldName);
        }

        window.addEventListener('keydown', this.handleKeyDown);
    }

    exit() {
        this.clearScene();
        if (this.gridHelper) this.scene.remove(this.gridHelper);
        if (this.editorFloor) this.scene.remove(this.editorFloor);
        if (this.thumbnailRenderer) this.thumbnailRenderer.dispose();
        this.thumbnailCache.clear();
        this.assetManager.dispose();
        if (this.uiContainer) this.uiContainer.remove();
        this.removeInputListeners();
        window.removeEventListener('keydown', this.handleKeyDown);
        this.scene = null;
        this.camera = null;
        this.selectedObject = null;
        this.selectedObjects = [];
        if (this.selectionDiv) {
            this.selectionDiv.remove();
            this.selectionDiv = null;
        }
    }

    // --- UI Methods ---

    createUI() {
        this.uiContainer = document.createElement('div');
        this.uiContainer.id = 'editor-ui';
        document.body.appendChild(this.uiContainer);

        this.uiContainer.innerHTML = `
            <div class="toast-container" id="toast-container"></div>
            <div class="header-bar">
                <h3><span class="material-icons">build_circle</span>Editor</h3>
                <button id="test-world-btn" class="control-btn test" title="Test World (Ctrl+E)"><span class="material-icons">science</span></button>
            </div>
            <div class="tab-bar">
                <button class="tab-btn active" data-tab="editor-tab" title="Editor"><span class="material-icons">edit</span></button>
                <button class="tab-btn" data-tab="world-tab" title="World Management"><span class="material-icons">public</span></button>
                <button class="tab-btn" data-tab="assets-tab" title="Assets"><span class="material-icons">category</span></button>
                <button class="tab-btn" data-tab="commands-tab" title="Commands"><span class="material-icons">help_outline</span></button>
            </div>

            <div id="editor-tab" class="tab-content active">
                <h4><span class="material-icons">construction</span>Tools</h4>
                <div class="tool-bar">
                    <button class="tool-btn active" data-mode="select" title="Select"><span class="material-icons">touch_app</span></button>
                    <button class="tool-btn" data-mode="stamp" title="Stamp"><span class="material-icons">place</span></button>
                    <button class="tool-btn" data-mode="line" title="Line"><span class="material-icons">timeline</span></button>
                    <button class="tool-btn" data-mode="square" title="Square"><span class="material-icons">check_box_outline_blank</span></button>
                </div>
                <div id="properties-panel" style="display: none;">
                    <h4><span class="material-icons">tune</span>Properties</h4>
                    <label for="interaction-id-input">Interaction ID</label>
                    <input type="text" id="interaction-id-input" class="property-input" placeholder="e.g., showMessage">
                    <label for="interaction-data-input">Interaction Data (JSON)</label>
                    <textarea id="interaction-data-input" class="property-input"></textarea>
                </div>
            </div>

            <div id="world-tab" class="tab-content">
                <h4><span class="material-icons">save</span>Save & Load</h4>
                <div class="world-controls">
                    <button id="new-world-btn" class="control-btn"><span class="material-icons">add_circle</span>New World</button>
                    <hr>
                    <label for="world-name-input">World Name</label>
                    <input type="text" id="world-name-input" placeholder="Enter world name...">
                    <button id="save-world-btn" class="control-btn success"><span class="material-icons">save</span>Save to Browser</button>
                    <button id="export-world-btn" class="control-btn"><span class="material-icons">download</span>Export to File</button>
                    <hr>
                    <h4><span class="material-icons">folder_open</span>Load World</h4>
                    <div id="world-list-container"></div>
                </div>
            </div>

            <div id="assets-tab" class="tab-content">
                <h4><span class="material-icons">widgets</span>Assets</h4>
                <div id="asset-browser">
                    <select id="asset-category-select"></select>
                    <input type="text" id="asset-search-input" placeholder="Search assets...">
                    <div class="asset-list" id="asset-list-container"></div>
                </div>
            </div>

            <div id="commands-tab" class="tab-content">
                <h4><span class="material-icons">keyboard</span>Commands</h4>
                <div class="commands-list">
                    <div class="command-item">
                        <span class="command-key">Mouse Wheel</span>
                        <span class="command-description">Zoom Camera</span>
                    </div>
                    <div class="command-item">
                        <span class="command-key">Right Click + Drag</span>
                        <span class="command-description">Pan Camera</span>
                    </div>
                    <div class="command-item">
                        <span class="command-key">Left Click</span>
                        <span class="command-description">Select Object / Place Stamp</span>
                    </div>
                    <div class="command-item">
                        <span class="command-key">Shift + Left Click</span>
                        <span class="command-description">Multi-Select Object</span>
                    </div>
                    <div class="command-item">
                        <span class="command-key">Y</span>
                        <span class="command-description">Rotate Selected Object</span>
                    </div>
                    <div class="command-item">
                        <span class="command-key">H</span>
                        <span class="command-description">Toggle Highlight</span>
                    </div>
                    <div class="command-item">
                        <span class="command-key">Delete</span>
                        <span class="command-description">Delete Selected Object</span>
                    </div>
                    <div class="command-item">
                        <span class="command-key">Ctrl + E</span>
                        <span class="command-description">Test World / Return to Editor</span>
                    </div>
                </div>
            </div>
            <div id="coords-display" class="footer-bar">X: 0, Z: 0</div>
        `;

        this.uiContainer.style.display = 'block';

        // Create selection div
        this.selectionDiv = document.createElement('div');
        this.selectionDiv.id = 'selection-box';
        document.body.appendChild(this.selectionDiv);

        // Event Listeners
        document.getElementById('test-world-btn').addEventListener('click', () => this.testWorld());
        this.uiContainer.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.uiContainer.querySelector('.tab-btn.active').classList.remove('active');
                this.uiContainer.querySelector('.tab-content.active').classList.remove('active');
                button.classList.add('active');
                this.uiContainer.querySelector(`#${button.dataset.tab}`).classList.add('active');
            });
        });
        this.uiContainer.querySelectorAll('.tool-btn').forEach(b => b.addEventListener('click', (e) => this.setEditorMode(e.currentTarget.dataset.mode)));
        document.getElementById('interaction-id-input').addEventListener('input', (e) => this.updateSelectedObjectInteraction('id', e.target.value));
        document.getElementById('interaction-data-input').addEventListener('input', (e) => this.updateSelectedObjectInteraction('data', e.target.value));
        document.getElementById('new-world-btn').addEventListener('click', () => this.createNewWorld());
        document.getElementById('save-world-btn').addEventListener('click', () => this.saveWorldToLocalStorage());
        document.getElementById('export-world-btn').addEventListener('click', () => this.exportWorldToFile());
        document.getElementById('asset-category-select').addEventListener('change', (e) => this.filterAssets(e.target.value, document.getElementById('asset-search-input').value));
        document.getElementById('asset-search-input').addEventListener('input', (e) => this.filterAssets(document.getElementById('asset-category-select').value, e.target.value));
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        // Only show toast if the UI container still exists
        if (!toastContainer) {
            console.warn("Attempted to show toast but toastContainer is null. State might be exiting.");
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="material-icons">${type}</span> ${message}`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 500);
            }, 3000);
        }, 100);
    }

    updatePropertiesPanel() {
        const panel = document.getElementById('properties-panel');
        if (this.selectedObjects.length > 1) {
            panel.style.display = 'block';
            document.getElementById('interaction-id-input').value = 'Multiple Objects Selected';
            document.getElementById('interaction-data-input').value = 'Multiple Objects Selected';
        } else if (this.selectedObject) {
            panel.style.display = 'block';
            document.getElementById('interaction-id-input').value = this.selectedObject.userData.interactionId || '';
            document.getElementById('interaction-data-input').value = this.selectedObject.userData.interactionData ? JSON.stringify(this.selectedObject.userData.interactionData, null, 2) : '{}';
        } else {
            panel.style.display = 'none';
        }
    }

    updateSelectedObjectInteraction(type, value) {
        if (this.selectedObjects.length === 0) return;

        this.selectedObjects.forEach(obj => {
            if (type === 'id') {
                obj.userData.interactionId = value;
            } else if (type === 'data') {
                try {
                    obj.userData.interactionData = value ? JSON.parse(value) : {};
                } catch (e) {
                    // Handle error for individual object if needed, or just let it fail
                }
            }
        });
        // Update the panel for the primary selected object or show generic message
        this.updatePropertiesPanel();
    }

    setEditorMode(mode) {
        if (this.editorMode === mode) return;
        this.uiContainer.querySelector('.tool-btn.active').classList.remove('active');
        this.uiContainer.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        this.editorMode = mode;
        if (mode !== 'select') this.deselectAllObjects();
        this.updatePreviewObjectVisibility();
    }

    // --- Asset & Thumbnail Management ---

    getObjectType(modelPath) {
        if (modelPath.includes('floor')) return 'floor';
        if (modelPath.includes('wall')) return 'wall';
        return 'prop';
    }

    populateAssetBrowser() {
        this.assetData = {
            arcade: { path: 'assets/arcade', assets: [ 'wall.glb', 'floor.glb', 'column.glb', 'prizes.glb', 'pinball.glb', 'air-hockey.glb', 'prize-wheel.glb', 'wall-corner.glb', 'wall-window.glb', 'claw-machine.glb', 'cash-register.glb', 'dance-machine.glb', 'arcade-machine.glb', 'ticket-machine.glb', 'basketball-game.glb', 'character-gamer.glb', 'vending-machine.glb', 'gambling-machine.glb', 'wall-door-rotate.glb', 'character-employee.glb' ] },
            characters: { path: 'assets/characters', assets: [ 'aid-cane.glb', 'aid-mask.glb', 'aid-crutch.glb', 'wheelchair.glb', 'aid-glasses.glb', 'aid_hearing.glb', 'aid-cane-blind.glb', 'aid-sunglasses.glb', 'character-male-a.glb', 'character-male-b.glb', 'character-male-c.glb', 'character-male-d.glb', 'character-male-e.glb', 'character-male-f.glb', 'wheelchair-power.glb', 'wheelchair-deluxe.glb', 'character-female-a.glb', 'character-female-b.glb', 'character-female-c.glb', 'character-female-d.glb', 'character-female-e.glb', 'character-female-f.glb', 'aid-cane-low-vision.glb', 'aid-defibrillator-red.glb', 'aid-defibrillator-green.glb', 'wheelchair-power-deluxe.glb' ] },
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
                assetItem.title = itemName;

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
            const model = await this.assetManager.getAsset(this.currentStampAsset);
            this.previewObject = model.clone();
            this.previewObject.traverse(child => {
                if (child.isMesh) {
                    child.material = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true, wireframe: true });
                }
            });
            // Only add to scene if scene is still active
            if (this.scene) {
                this.scene.add(this.previewObject);
            }
            this.updatePreviewObjectVisibility();
        } catch (e) {
            console.error(`Failed to load preview asset: ${this.currentStampAsset}`, e);
            this.previewObject = null;
        }
    }

    updatePreviewObjectVisibility() {
        if (!this.previewObject) return;
        this.previewObject.visible = ['stamp', 'line', 'square'].includes(this.editorMode);
    }

    async generateThumbnail(modelPath) {
        if (this.thumbnailCache.has(modelPath)) return this.thumbnailCache.get(modelPath);
        if (!this.thumbnailRenderer) {
            this.thumbnailRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            this.thumbnailRenderer.setSize(128, 128);
        }
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
        try {
            const model = await this.assetManager.getAsset(modelPath);
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
        canvas.addEventListener('wheel', this.onWheel, { passive: false });
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
        // Apply to all selected objects
        const targets = this.selectedObjects.length > 0 ? this.selectedObjects : (this.selectedObject ? [this.selectedObject] : []);
        if (targets.length === 0) return;

        switch (event.key.toLowerCase()) {
            case 'y': targets.forEach(obj => obj.rotation.y += Math.PI / 2); break;
            case 'h': this.toggleHighlight(targets); break;
            case 'delete': targets.forEach(obj => this.deleteObject(obj)); this.deselectAllObjects(); break;
        }
    }

    onPointerDown(event) {
        if (event.target.closest('#editor-ui')) return;
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        if (event.button === 2) { // Right mouse button for panning
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            if (this.raycaster.ray.intersectPlane(plane, this.panPreviousPoint)) {
                this.isPanning = true;
            }
            return;
        }

        if (event.button === 0) { // Left mouse button
            this.isLeftMouseButtonDown = true;
            
            if (this.editorMode === 'select') {
                const intersects = this.raycaster.intersectObjects(this.editableObjects, true);
                if (intersects.length > 0) {
                    let topLevelObject = intersects[0].object;
                    while (topLevelObject.parent && !this.editableObjects.includes(topLevelObject)) topLevelObject = topLevelObject.parent;
                    
                    if (event.shiftKey) {
                        // Shift + Click for multi-selection
                        if (this.selectedObjects.includes(topLevelObject)) {
                            this.deselectObject(topLevelObject); // Deselect if already selected
                        } else {
                            this.selectObject(topLevelObject, true); // Add to selection
                        }
                    } else {
                        // Single click for single selection
                        if (!this.selectedObjects.includes(topLevelObject)) {
                            this.deselectAllObjects();
                            this.selectObject(topLevelObject);
                        }
                    }
                    
                    this.isDraggingObject = true;
                    // Remove all selected objects from grid for dragging
                    this.selectedObjects.forEach(obj => this.removeObjectFromGrid(obj));

                    const intersectionPoint = new THREE.Vector3();
                    this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint);
                    this.dragOffset.subVectors(this.selectedObject.position, intersectionPoint); // Drag offset relative to primary selected object
                } else {
                    // Clicked on empty space
                    if (event.shiftKey) { // Only start drag selection if Shift is held
                        this.deselectAllObjects();
                        this.isDraggingSelection = true;
                        this.selectionRect.startX = event.clientX;
                        this.selectionRect.startY = event.clientY;
                        this.selectionDiv.style.left = `${event.clientX}px`;
                        this.selectionDiv.style.top = `${event.clientY}px`;
                        this.selectionDiv.style.width = '0px';
                        this.selectionDiv.style.height = '0px';
                        this.selectionDiv.style.display = 'block';
                    } else {
                        // If not shift and no object clicked, just clear selection
                        this.deselectAllObjects();
                    }
                }
            } else {
                // Other editor modes (stamp, line, square)
                switch (this.editorMode) {
                    case 'stamp': this.handleStampModePointerMove(); break;
                    case 'line':
                    case 'square': this.handleShapeModePointerDown(); break;
                }
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

        if (this.isLeftMouseButtonDown && this.isDraggingSelection) { // Only update selection div if drag selection is active
            this.selectionRect.currentX = event.clientX;
            this.selectionRect.currentY = event.clientY;
            this.updateSelectionDiv();
        }

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.editorFloor);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const gridX = Math.round(point.x / this.gridSize);
            const gridZ = Math.round(point.z / this.gridSize);
            const coordsDisplay = document.getElementById('coords-display');
            if (coordsDisplay) {
                coordsDisplay.innerText = `X: ${gridX}, Z: ${gridZ}`;
            }

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
            if (this.isDraggingSelection) {
                this.processDragSelection(event);
                this.isDraggingSelection = false;
                this.selectionDiv.style.display = 'none';
            } else if (this.isDrawingShape) {
                this.handleShapeModePointerUp();
            } else if (this.isDraggingObject) {
                this.handleSelectModePointerUp();
            }
            this.isLeftMouseButtonDown = false;
            this.isDrawingShape = false;
            this.isDraggingObject = false;
            this.lastStampedPosition.set(Infinity, Infinity);
        }
    }

    updateSelectionDiv() {
        const minX = Math.min(this.selectionRect.startX, this.selectionRect.currentX);
        const minY = Math.min(this.selectionRect.startY, this.selectionRect.currentY);
        const maxX = Math.max(this.selectionRect.startX, this.selectionRect.currentX);
        const maxY = Math.max(this.selectionRect.startY, this.selectionRect.currentY);

        this.selectionDiv.style.left = `${minX}px`;
        this.selectionDiv.style.top = `${minY}px`;
        this.selectionDiv.style.width = `${maxX - minX}px`;
        this.selectionDiv.style.height = `${maxY - minY}px`;
    }

    /**
     * Converts screen coordinates to a 3D point on the editorFloor plane.
     * @param {number} screenX - X coordinate on screen.
     * @param {number} screenY - Y coordinate on screen.
     * @returns {THREE.Vector3 | null} 3D point on the plane, or null if no intersection.
     */
    screenToWorldPlane(screenX, screenY) {
        const mouse = new THREE.Vector2();
        mouse.x = (screenX / window.innerWidth) * 2 - 1;
        mouse.y = -(screenY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const intersects = raycaster.intersectObject(this.editorFloor);
        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    }

    processDragSelection(event) {
        const startPoint = this.screenToWorldPlane(this.selectionRect.startX, this.selectionRect.startY);
        const endPoint = this.screenToWorldPlane(this.selectionRect.currentX, this.selectionRect.currentY);

        if (!startPoint || !endPoint) {
            this.showToast('Could not determine selection area in 3D.', 'warning');
            return;
        }

        const minX = Math.min(startPoint.x, endPoint.x);
        const maxX = Math.max(startPoint.x, endPoint.x);
        const minZ = Math.min(startPoint.z, endPoint.z);
        const maxZ = Math.max(startPoint.z, endPoint.z);

        const selectedDuringDrag = [];
        this.editableObjects.forEach(obj => {
            const objX = obj.position.x;
            const objZ = obj.position.z;

            if (objX >= minX && objX <= maxX && objZ >= minZ && objZ <= maxZ) {
                selectedDuringDrag.push(obj);
            }
        });

        if (!event.shiftKey) {
            this.deselectAllObjects();
        }

        selectedDuringDrag.forEach(obj => {
            if (!this.selectedObjects.includes(obj)) {
                this.selectObject(obj, true);
            }
        });
        this.updatePropertiesPanel();
    }

    onWheel(event) {
        if (event.target.closest('#editor-ui')) return;
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
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.ray.intersectPlane(plane, currentPoint);
        const delta = new THREE.Vector3().subVectors(this.panPreviousPoint, currentPoint);
        this.camera.position.add(delta);
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.ray.intersectPlane(plane, this.panPreviousPoint);
    }

    // --- Mode-Specific Logic ---

    handleSelectModePointerDown(event) {
        const intersects = this.raycaster.intersectObjects(this.editableObjects, true);
        if (intersects.length > 0) {
            let topLevelObject = intersects[0].object;
            while (topLevelObject.parent && !this.editableObjects.includes(topLevelObject)) topLevelObject = topLevelObject.parent;
            
            if (event.shiftKey) {
                // Shift + Click for multi-selection
                if (this.selectedObjects.includes(topLevelObject)) {
                    this.deselectObject(topLevelObject); // Deselect if already selected
                } else {
                    this.selectObject(topLevelObject, true); // Add to selection
                }
            } else {
                // Single click for single selection
                if (!this.selectedObjects.includes(topLevelObject)) {
                    this.deselectAllObjects();
                    this.selectObject(topLevelObject);
                }
            }
            
            this.isDraggingObject = true;
            // Remove all selected objects from grid for dragging
            this.selectedObjects.forEach(obj => this.removeObjectFromGrid(obj));

            const intersectionPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlane, intersectionPoint);
            this.dragOffset.subVectors(this.selectedObject.position, intersectionPoint); // Drag offset relative to primary selected object
        } else {
            // Clicked on empty space
            if (event.shiftKey) { // Only start drag selection if Shift is held
                this.deselectAllObjects();
                this.isDraggingSelection = true;
                this.selectionRect.startX = event.clientX;
                this.selectionRect.startY = event.clientY;
                this.selectionDiv.style.left = `${event.clientX}px`;
                this.selectionDiv.style.top = `${event.clientY}px`;
                this.selectionDiv.style.width = '0px';
                this.selectionDiv.style.height = '0px';
                this.selectionDiv.style.display = 'block';
            } else {
                // If not shift and no object clicked, just clear selection
                this.deselectAllObjects();
            }
        }
    }

    handleSelectModePointerMove() {
        if (this.isDraggingObject && this.selectedObjects.length > 0) {
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
                const newPosition = new THREE.Vector3().copy(intersectPoint).add(this.dragOffset);
                const delta = new THREE.Vector3().subVectors(newPosition, this.selectedObject.position);
                
                this.selectedObjects.forEach(obj => {
                    obj.position.add(delta);
                });
            }
        }
    }

    handleSelectModePointerUp() {
        if (this.selectedObjects.length > 0) {
            this.selectedObjects.forEach(obj => {
                // Snap to grid and update occupied cell on drop
                const gridX = Math.round(obj.position.x / this.gridSize);
                const gridZ = Math.round(obj.position.z / this.gridSize);
                obj.position.x = gridX * this.gridSize;
                obj.position.z = gridZ * this.gridSize;
                this.addObjectToGrid(obj);
            });
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
            const isOccupied = this.isCellOccupied(cellKey, this.getObjectType(this.currentStampAsset));
            const color = isOccupied ? 0xff0000 : 0x00ff00;
            const previewMesh = new THREE.Mesh(new THREE.BoxGeometry(this.gridSize, 0.1, this.gridSize), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: true }));
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
            for (let x = Math.min(startX, endX); x <= Math.max(startX, endX); x++) {
                for (let z = Math.min(startZ, endZ); z <= Math.max(startZ, endZ); z++) {
                    positions.push({ x, y: z });
                }
            }
        }
        return positions;
    }

    // --- Object Placement & Manipulation ---

    isCellOccupied(cellKey, newObjectType) {
        const cellObjects = this.occupiedGridCells.get(cellKey) || [];
        if (newObjectType === 'floor') {
            return cellObjects.some(obj => obj.type === 'floor');
        }
        return cellObjects.some(obj => obj.type !== 'floor');
    }

    addObjectToGrid(object) {
        const gridX = Math.round(object.position.x / this.gridSize);
        const gridZ = Math.round(object.position.z / this.gridSize);
        const cellKey = `${gridX},${gridZ}`;
        object.userData.gridKey = cellKey;

        const cellObjects = this.occupiedGridCells.get(cellKey) || [];
        cellObjects.push({
            type: this.getObjectType(object.userData.modelPath),
            object: object
        });
        this.occupiedGridCells.set(cellKey, cellObjects);
    }

    removeObjectFromGrid(object) {
        const cellKey = object.userData.gridKey;
        if (!cellKey) return;

        const cellObjects = this.occupiedGridCells.get(cellKey);
        if (cellObjects) {
            const newCellObjects = cellObjects.filter(obj => obj.object !== object);
            if (newCellObjects.length > 0) {
                this.occupiedGridCells.set(cellKey, newCellObjects);
            } else {
                this.occupiedGridCells.delete(cellKey);
            }
        }
    }

    async placeObject(modelPath, x, z, rotationY = 0, scale = {x:1, y:1, z:1}, interactionId = null, interactionData = null) {
        // Normalize modelPath if it's coming from an old save format
        let correctedModelPath = modelPath;
        if (modelPath.startsWith('public/worlds/arcade/')) {
            correctedModelPath = modelPath.replace('public/worlds/arcade/', 'assets/arcade/');
        } else if (modelPath.startsWith('public/characters/')) {
            correctedModelPath = modelPath.replace('public/characters/', 'assets/characters/');
        }

        const gridX = Math.round(x / this.gridSize);
        const gridZ = Math.round(z / this.gridSize);
        const cellKey = `${gridX},${gridZ}`;
        const newObjectType = this.getObjectType(correctedModelPath);

        if (this.isCellOccupied(cellKey, newObjectType)) return;

        try {
            const model = await this.assetManager.getAsset(correctedModelPath);
            const modelInstance = model.clone();

            const bbox = new THREE.Box3().setFromObject(modelInstance);
            const center = bbox.getCenter(new THREE.Vector3());
            const size = bbox.getSize(new THREE.Vector3());

            modelInstance.position.set(gridX * this.gridSize, 0, gridZ * this.gridSize);
            modelInstance.position.y -= (center.y - size.y / 2);
            modelInstance.rotation.y = rotationY;
            modelInstance.scale.set(scale.x, scale.y, scale.z);
            modelInstance.userData = { modelPath: correctedModelPath, type: 'staticObject', isEditableAsset: true, interactionId, interactionData };

            // Only add to scene if scene is still active
            if (this.scene) {
                this.scene.add(modelInstance);
            }
            this.editableObjects.push(modelInstance);
            this.addObjectToGrid(modelInstance);
        } catch (error) {
            console.error(`Error placing object from ${correctedModelPath}:`, error);
            this.showToast(`Failed to place asset: ${correctedModelPath.split('/').pop()}`, 'error');
        }
    }

    /**
     * Selects a single object, clearing any previous selection.
     * @param {THREE.Object3D} object - The object to select.
     * @param {boolean} [addToSelection=false] - If true, adds to current selection instead of clearing.
     */
    selectObject(object, addToSelection = false) {
        if (!addToSelection) {
            this.deselectAllObjects();
        }
        if (!this.selectedObjects.includes(object)) {
            this.selectedObjects.push(object);
            this.applyHighlight(object);
        }
        this.selectedObject = object; // Keep track of the last selected object as primary
        this.updatePropertiesPanel();
    }

    /**
     * Deselects a single object or all objects.
     * @param {THREE.Object3D} [object] - The object to deselect. If not provided, all objects are deselected.
     */
    deselectObject(object) {
        if (object) {
            this.removeHighlight(object);
            this.selectedObjects = this.selectedObjects.filter(obj => obj !== object);
        } else {
            this.selectedObjects.forEach(obj => this.removeHighlight(obj));
            this.selectedObjects = [];
        }
        this.selectedObject = this.selectedObjects.length > 0 ? this.selectedObjects[this.selectedObjects.length - 1] : null;
        this.updatePropertiesPanel();
    }

    /**
     * Deselects all currently selected objects.
     */
    deselectAllObjects() {
        this.selectedObjects.forEach(obj => this.removeHighlight(obj));
        this.selectedObjects = [];
        this.selectedObject = null;
        this.updatePropertiesPanel();
    }

    deleteSelectedObject() {
        // Delete all selected objects
        this.selectedObjects.forEach(obj => {
            this.removeObjectFromGrid(obj);
            this.disposeObject(obj);
            const index = this.editableObjects.indexOf(obj);
            if (index > -1) this.editableObjects.splice(index, 1);
        });
        this.deselectAllObjects();
    }

    /**
     * Applies a highlight material to the given object(s).
     * @param {THREE.Object3D | Array<THREE.Object3D>} [objects=this.selectedObjects] - Object(s) to highlight.
     */
    applyHighlight(objects = this.selectedObjects) {
        const targets = Array.isArray(objects) ? objects : [objects];
        targets.forEach(obj => {
            if (!obj || !this.highlightActive) return;
            obj.traverse((child) => {
                if (child.isMesh) {
                    if (!child.userData.originalMaterial) child.userData.originalMaterial = child.material;
                    child.material = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
                }
            });
        });
    }

    /**
     * Removes the highlight material from the given object(s).
     * @param {THREE.Object3D | Array<THREE.Object3D>} [objects=this.selectedObjects] - Object(s) to remove highlight from.
     */
    removeHighlight(objects = this.selectedObjects) {
        const targets = Array.isArray(objects) ? objects : [objects];
        targets.forEach(obj => {
            if (!obj) return;
            obj.traverse((child) => {
                if (child.isMesh && child.userData.originalMaterial) {
                    child.material.dispose();
                    child.material = child.userData.originalMaterial;
                    delete child.userData.originalMaterial;
                }
            });
        });
    }

    toggleHighlight(objects = this.selectedObjects) {
        const targets = Array.isArray(objects) ? objects : [objects];
        targets.forEach(obj => {
            if (!obj) return;
            // Check if any part of the object is currently highlighted
            let isHighlighted = false;
            obj.traverse(child => {
                if (child.isMesh && child.material.isMeshBasicMaterial && child.material.wireframe) {
                    isHighlighted = true;
                }
            });

            if (isHighlighted) {
                this.removeHighlight(obj);
            } else {
                this.applyHighlight(obj);
            }
        });
    }

    rotateSelectedObject() {
        this.selectedObjects.forEach(obj => {
            obj.rotation.y += Math.PI / 2;
        });
    }

    disposeObject(obj) {
        if (!obj) return;
        this.scene.remove(obj);
    }

    clearScene() {
        this.deselectAllObjects();
        if (this.editableObjects) {
            this.editableObjects.forEach(obj => this.disposeObject(obj));
        }
        this.editableObjects = [];
        this.occupiedGridCells.clear();
        if (this.previewObject) this.disposeObject(this.previewObject);
        if (this.previewObjects) {
            this.previewObjects.forEach(obj => this.disposeObject(obj));
        }
        this.previewObjects = [];
    }

    // --- World Management ---

    createNewWorld() {
        this.clearScene();
        document.getElementById('world-name-input').value = '';
        this.showToast('New world created', 'info');
    }

    async loadWorldList() {
        const container = document.getElementById('world-list-container');
        container.innerHTML = '';

        try {
            // Add cache-busting to prevent loading old index.json
            const response = await fetch(`/public/worlds/index.json?v=${Date.now()}`, { cache: 'no-store' });
            if (response.ok) {
                const manifestWorlds = await response.json();
                const projectGroup = this.createWorldListGroup('Project Worlds', manifestWorlds, 'project');
                container.appendChild(projectGroup);
            }
        } catch (error) {
            console.warn('Could not load worlds manifest.', error);
        }

        const localWorlds = this.getLocalStorageWorlds();
        const localWorldNames = Object.keys(localWorlds);
        if (localWorldNames.length > 0) {
            const localGroup = this.createWorldListGroup('Browser Worlds', localWorldNames, 'local');
            container.appendChild(localGroup);
        }
    }

    createWorldListGroup(title, worldNames, source) {
        const group = document.createElement('div');
        group.className = 'world-list-group';
        const h5 = document.createElement('h5');
        h5.textContent = title;
        group.appendChild(h5);

        worldNames.forEach(worldName => {
            const item = document.createElement('button');
            item.className = 'world-list-item';
            item.title = `Load ${worldName}`;
            item.addEventListener('click', () => this.loadWorld(source, worldName));

            const icon = document.createElement('span');
            icon.className = 'material-icons';
            icon.textContent = source === 'local' ? 'storage' : 'folder';
            
            const text = document.createElement('span');
            text.textContent = worldName;

            item.appendChild(icon);
            item.appendChild(text);
            group.appendChild(item);
        });
        return group;
    }


    async loadWorld(source, worldName) {
        try {
            let worldData;
            if (source === 'local') {
                const localWorlds = this.getLocalStorageWorlds();
                worldData = localWorlds[worldName];
                if (!worldData) {
                    const message = `Local world '${worldName}' not found.`;
                    this.showToast(message, 'error');
                    console.error(message);
                    return;
                }
            } else {
                const response = await fetch(`/public/worlds/${worldName}.json?v=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) {
                    const message = `Project world '${worldName}' not found.`;
                    this.showToast(message, 'error');
                    console.error(message);
                    return;
                }
                worldData = await response.json();
            }
            await this.loadWorldData(worldData, worldName);
            this.showToast(`'${worldName}' loaded`, 'success');
        } catch (error) {
            console.error('Error loading world:', error);
            this.showToast(`Failed to load world: ${error.message}`, 'error');
        }
    }

    async loadWorldData(worldData, worldName) {
        this.clearScene();
        document.getElementById('world-name-input').value = worldName;
        // Use Promise.all to place objects in parallel
        await Promise.all(worldData.objects.map(objData => this.placeObject(
            objData.path,
            objData.position.x,
            objData.position.z,
            objData.rotation.y,
            objData.scale,
            objData.interactionId,
            objData.interactionData
        )));
    }

    getLocalStorageWorlds() {
        try {
            const worlds = localStorage.getItem(LOCAL_STORAGE_KEY);
            return worlds ? JSON.parse(worlds) : {};
        } catch (e) {
            console.error('Could not parse worlds from local storage.', e);
            return {};
        }
    }

    saveWorldToLocalStorage() {
        const worldName = document.getElementById('world-name-input').value.trim();
        if (!worldName) {
            this.showToast('Please enter a world name', 'warning');
            return;
        }

        const worldData = this.serializeWorld();
        const localWorlds = this.getLocalStorageWorlds();
        localWorlds[worldName] = worldData;

        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localWorlds));
            this.showToast(`'${worldName}' saved to browser`, 'success');
            this.loadWorldList();
        } catch (e) {
            console.error('Failed to save world to local storage:', e);
            this.showToast('Error saving to browser', 'error');
        }
    }

    exportWorldToFile() {
        const worldName = document.getElementById('world-name-input').value.trim();
        if (!worldName) {
            this.showToast('Please enter a world name', 'warning');
            return;
        }

        const worldData = this.serializeWorld();
        const worldJson = JSON.stringify(worldData, null, 4);
        const blob = new Blob([worldJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${worldName}.json`; // Changed to worldName.json
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast(`Exported '${worldName}' as ${worldName}.json`, 'info');
    }

    serializeWorld() {
        const worldData = { objects: [] };
        if (this.editableObjects) {
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
        }
        return worldData;
    }

    testWorld() {
        const worldData = this.serializeWorld();
        const worldName = document.getElementById('world-name-input').value.trim() || 'Test World';
        this.game.stateManager.setState('CustomWorld', { worldData, worldName, isTest: true });
    }
}
