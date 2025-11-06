import Game from './core/Game.js';
import HubWorldState from './states/HubWorldState.js';
import MiniGame1State from './states/MiniGame1State.js';

// 1. Initialize the main game engine
const game = new Game();

// 2. Create instances of all available game states
const hubWorld = new HubWorldState(game);
const miniGame1 = new MiniGame1State(game);

// 3. Add the states to the state manager
game.stateManager.addState('HubWorld', hubWorld);
game.stateManager.addState('MiniGame1', miniGame1);

// 4. Set the initial state to start the game
game.stateManager.setState('HubWorld');
