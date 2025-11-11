/**
 * @file Manages user input (keyboard, mouse) and provides a queryable state.
 * @module core/InputHandler
 */

/**
 * A singleton InputHandler that listens to DOM input events (keyboard) and maintains their state.
 * Other parts of the game can query this state instead of adding their own listeners.
 */
class InputHandler {
  constructor() {
    if (InputHandler.instance) {
      return InputHandler.instance;
    }
    this.keys = {};
    this.previousKeys = {};

    window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);

    InputHandler.instance = this;
  }

  /**
   * Checks if a specific key is currently pressed down.
   * @param {string} key - The key to check (e.g., 'w', 'a', ' '). Case-insensitive.
   * @returns {boolean} True if the key is down, false otherwise.
   */
  isKeyDown(key) {
    return this.keys[key.toLowerCase()] || false;
  }

  /**
   * Checks if a specific key was just pressed in the current frame.
   * @param {string} key - The key to check.
   * @returns {boolean} True if the key was just pressed, false otherwise.
   */
  wasKeyJustPressed(key) {
    const lowerKey = key.toLowerCase();
    return this.isKeyDown(lowerKey) && !this.previousKeys[lowerKey];
  }
}

/**
 * The singleton instance of the InputHandler.
 * @type {InputHandler}
 */
export const inputHandler = new InputHandler();
