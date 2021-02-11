/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module engine/view/observer/bubblingobserver
 */

import EventInfo from '@ckeditor/ckeditor5-utils/src/eventinfo';
import EmitterMixin from '@ckeditor/ckeditor5-utils/src/emittermixin';

import Observer from './observer';

/**
 * Abstract base bubbling observer class. Observers are classes which listen to events, do the preliminary
 * processing and fire events on the {@link module:engine/view/document~Document} objects.
 *
 * Bubbling observers are triggering events in the context of specified {@link module:engine/view/element~Element view element} name,
 * predefined `'$text'` and `'$root'` contexts, and context matchers provided as a function.
 *
 * The bubbling starts from the deeper selection position (by firing event on the `'$text'` context) and propagates
 * the view document tree up to the `'$root'`.
 *
 * Examples:
 *
 *		// Listeners registered in the context of the view element names:
 *		this.listenTo( viewDocument, 'enter', ( evt, data ) => {
 *			// ...
 *		}, { context: 'blockquote' } );
 *
 *		this.listenTo( viewDocument, 'enter', ( evt, data ) => {
 *			// ...
 *		}, { context: 'li' } );
 *
 *		// Listeners registered in the context of the '$text' and '$root' nodes.
 *		this.listenTo( view.document, 'arrowkey', ( evt, data ) => {
 *			// ...
 *		}, { context: '$text', priority: 'high' } );
 *
 *		this.listenTo( view.document, 'arrowkey', ( evt, data ) => {
 *			// ...
 *		}, { context: '$root' } );
 *
 *		// Listeners registered in the context of custom callback function.
 *		this.listenTo( view.document, 'arrowkey', ( evt, data ) => {
 *			// ...
 *		}, { context: isWidget } );
 *
 *		this.listenTo( view.document, 'arrowkey', ( evt, data ) => {
 *			// ...
 *		}, { context: isWidget, priority: 'high' } );
 *
 * The bubbling observer itself is listening on the `'high'` priority so there could be listeners that are triggered
 * no matter the context on lower or higher priorities. For example `'enter'` and `'delete'` commands are triggered
 * on the `'normal'` priority without checking the context.
 *
 * Example flow for selection in text:
 *
 *		<blockquote><p>Foo[]bar</p></blockquote>
 *
 * Fired events on contexts:
 * * `'$text'`
 * * `'p'`
 * * `'blockquote'`
 * * `'$root'`
 *
 * Example flow for selection on element (i.e., Widget):
 *
 *		<blockquote><p>Foo[<widget/>]bar</p></blockquote>
 *
 * Fired events on contexts:
 * * *widget* (custom matcher)
 * * `'p'`
 * * `'blockquote'`
 * * `'$root'`
 *
 * There could be multiple listeners registered for the same context and at different priority levels:
 *
 *		<p>Foo[]bar</p>
 *
 * * `'$text'` at priorities:
 *   * `'highest'`
 *   * `'high'`
 *   * `'normal'`
 *   * `'low'`
 *   * `'lowest'`
 * * `'p'` at priorities:
 *   * `'highest'`
 *   * `'high'`
 *   * `'normal'`
 *   * `'low'`
 *   * `'lowest'`
 * * `'$root'` at priorities:
 *   * `'highest'`
 *   * `'high'`
 *   * `'normal'`
 *   * `'low'`
 *   * `'lowest'`
 *
 * @abstract
 */
export default class BubblingObserver extends Observer {
	/**
	 * Creates an instance of the bubbling observer.
	 *
	 * @param {module:engine/view/view~View} view
	 * @param {String} eventType The type of the event the observer should listen to.
	 * @param {String} [firedEventType=eventType] The type of the event the observer will fire.
	 */
	constructor( view, eventType, firedEventType = eventType ) {
		super( view );

		/**
		 * The type of the event the observer should listen to.
		 *
		 * @readonly
		 * @member {String}
		 */
		this.eventType = eventType;

		/**
		 * The type of the event the observer will fire.
		 *
		 * @readonly
		 * @member {String}
		 */
		this.firedEventType = firedEventType;

		/**
		 * Map of context definitions to emitters.
		 *
		 * @private
		 * @member {Map.<String|Function, module:utils/emittermixin~Emitter>}
		 */
		this._listeners = new Map();

		this._setupListenerInterception();
		this._setupEventListener();
	}

	/**
	 * @inheritDoc
	 */
	destroy() {
		for ( const listener of this._listeners.values() ) {
			listener.stopListening();
		}

		super.destroy();
	}

	/**
	 * @inheritDoc
	 */
	observe() {}

	/**
	 * TODO
	 *
	 * @protected
	 */
	_addEventListener( event, callback, options ) {
		let listener = this._listeners.get( options.context );

		if ( !listener ) {
			listener = Object.create( EmitterMixin );
			this._listeners.set( options.context, listener );
		}

		this.listenTo( listener, event, callback, options );
	}

	/**
	 * TODO
	 *
	 * @protected
	 */
	_removeEventListener( event, callback ) {
		for ( const listener of this._listeners.values() ) {
			this.stopListening( listener, event, callback );
		}
	}

	/**
	 * TODO
	 *
	 * @protected
	 * @param {...*} [args]
	 * @returns {Array.<*>|Boolean} False if event should not be handled. TODO
	 */
	_translateEvent( ...args ) {
		return args;
	}

	/**
	 * Intercept adding listeners for view document for bubbling observers.
	 *
	 * @private
	 */
	_setupListenerInterception() {
		this.listenTo( this.document, '_addEventListener', ( evt, [ event, callback, options ] ) => {
			if ( !options.context || event != this.firedEventType ) {
				return;
			}

			// Prevent registering a default listener.
			evt.stop();

			this.document.listenTo( this, event, callback, options );
		}, { priority: 'high' } );

		this.listenTo( this.document, '_removeEventListener', ( evt, [ event, callback ] ) => {
			if ( event != this.firedEventType ) {
				return;
			}

			// We don't want to prevent removing a default listener - remove it if it's registered.

			this.document.stopListening( this, event, callback );
		}, { priority: 'high' } );
	}

	/**
	 * TODO
	 *
	 * @private
	 */
	_setupEventListener() {
		const selection = this.document.selection;

		this.listenTo( this.document, this.eventType, ( event, ...args ) => {
			if ( !this.isEnabled || !this._listeners.size ) {
				return;
			}

			const eventInfo = new EventInfo( this, this.firedEventType );
			let eventArgs = this._translateEvent( ...args );

			if ( eventArgs === false ) {
				return;
			}

			if ( !Array.isArray( eventArgs ) ) {
				eventArgs = [ eventArgs ];
			}

			const selectedElement = selection.getSelectedElement();
			const isCustomContext = Boolean( selectedElement && this._getCustomContext( selectedElement ) );

			// For the not yet bubbling event trigger for $text node if selection can be there and it's not a custom context selected.
			if ( !isCustomContext && this._fireListenerFor( '$text', eventInfo, ...eventArgs ) ) {
				// Stop the original event.
				event.stop();

				return;
			}

			let node = selectedElement || getDeeperSelectionParent( selection );

			while ( node ) {
				// Root node handling.
				if ( node.is( 'rootElement' ) ) {
					if ( this._fireListenerFor( '$root', eventInfo, ...eventArgs ) ) {
						break;
					}
				}

				// Element node handling.
				else if ( node.is( 'element' ) ) {
					if ( this._fireListenerFor( node.name, eventInfo, ...eventArgs ) ) {
						break;
					}
				}

				// Check custom contexts (i.e., a widget).
				if ( this._fireListenerFor( node, eventInfo, ...eventArgs ) ) {
					break;
				}

				node = node.parent;
			}

			// Stop the event if generic handler stopped it.
			if ( eventInfo.stop.called ) {
				event.stop();
			}
		}, { priority: 'high' } );
	}

	/**
	 * TODO
	 *
	 * @private
	 * @param {String|module:engine/view/node~Node} context
	 * @param {module:utils/eventinfo~EventInfo} eventInfo The `EventInfo` object.
	 * @param {...*} [eventArgs] Additional arguments to be passed to the callbacks.
	 * @returns {Boolean} True if event stop was called.
	 */
	_fireListenerFor( context, eventInfo, ...eventArgs ) {
		const listener = typeof context == 'string' ? this._listeners.get( context ) : this._getCustomContext( context );

		if ( !listener ) {
			return false;
		}

		listener.fire( eventInfo, ...eventArgs );

		return eventInfo.stop.called;
	}

	/**
	 * TODO
	 *
	 * @param {module:engine/view/node~Node} node
	 * @returns {module:utils/emittermixin~Emitter|null}
	 * @private
	 */
	_getCustomContext( node ) {
		for ( const [ context, listener ] of this._listeners ) {
			if ( typeof context == 'function' && context( node ) ) {
				return listener;
			}
		}

		return null;
	}
}

// TODO
function getDeeperSelectionParent( selection ) {
	const focusParent = selection.focus.parent;
	const anchorParent = selection.anchor.parent;

	const focusPath = focusParent.getPath();
	const anchorPath = anchorParent.getPath();

	return focusPath.length > anchorPath.length ? focusParent : anchorParent;
}