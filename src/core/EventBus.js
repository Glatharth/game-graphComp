/**
 * @file Manages a singleton event bus for decoupled communication.
 * @module core/EventBus
 */

/**
 * A singleton publish/subscribe system for decoupled communication.
 * This prevents components and systems from needing direct references to each other.
 */
class EventBus {
    constructor() {
        if (EventBus.instance) {
            return EventBus.instance;
        }
        this.events = {};
        EventBus.instance = this;
    }

    /**
     * Subscribes to an event.
     * @param {string} eventName - The name of the event.
     * @param {Function} listener - The callback function to execute.
     */
    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }

    /**
     * Dispatches (emits) an event.
     * @param {string} eventName - The name of the event.
     * @param {*} data - The data to pass to the listeners.
     */
    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach((listener) => listener(data));
        }
    }

    /**
     * Unsubscribes from an event.
     * @param {string} eventName - The name of the event.
     * @param {Function} listenerToRemove - The specific callback to remove.
     */
    off(eventName, listenerToRemove) {
        if (!this.events[eventName]) {
            return;
        }
        this.events[eventName] = this.events[eventName].filter(
            (listener) => listener !== listenerToRemove,
        );
    }
}

/**
 * The singleton instance of the EventBus.
 * @type {EventBus}
 */
export const eventBus = new EventBus();
