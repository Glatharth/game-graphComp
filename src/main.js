import Game from './core/Game.js';
import HubWorldState from './states/HubWorldState.js';
import MiniGame1State from './states/MiniGame1State.js';
import EditorState from './states/EditorState.js';
import CustomWorldState from './states/CustomWorldState.js';

// 1. Initialize the main game engine
const game = new Game();

// 2. Create instances of all available game states
const hubWorld = new HubWorldState(game);
const miniGame1 = new MiniGame1State(game);
const editor = new EditorState(game);
const customWorld = new CustomWorldState(game);

// 3. Add the states to the state manager
game.stateManager.addState('HubWorld', hubWorld);
game.stateManager.addState('MiniGame1', miniGame1);
game.stateManager.addState('Editor', editor);
game.stateManager.addState('CustomWorld', customWorld);

// 4. Set the initial state to start the game
game.stateManager.setState('HubWorld');

// 5. Add a key listener to switch to the editor
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        const currentState = game.stateManager.currentState;
        if (currentState !== editor) {
            game.stateManager.setState('Editor');
        } else {
            game.stateManager.setState('CustomWorld');
        }
    }
});
