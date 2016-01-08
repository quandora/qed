

function ListenerRegistration(listeners, listener) {
	this.listeners = listeners;
	this.listener = listener;
	this.remove = function() {
		var i = this.listeners.indexOf(this.listener);
		if (i > -1) {
			this.listeners.splice(i, 1);
			return this.listener;
		}
		return null;
	}
	this.get = function() {
		return this.listener;
	}
}

function ListenerRegistry(ctx) {
	this.listeners = [];
	this.allowCancelation = false;
	this.ctx = ctx || null;

	this.add = function(listener) {
		var i = this.listeners.indexOf(listener);
		if (i === -1) {
			this.listeners.push(listener);
			return new ListenerRegistration(this.listeners, listener);
		} else {
			return new ListenerRegistration(this.listeners, listener);
		}
	}

	this.remove = function(listener) {
		var i = this.listeners.indexOf(this.listener);
		if (i > -1) {
			return this.listeners.splice(i, 1)[0];
		}
		return null;
	}

	this.fire = function() {
		// does apply support arguments instead of array? If yes use directly the 'arguments'
		var args = Array.prototype.slice.call(arguments);
		//var args = arguments; 
		var listeners = this.listeners;
		var ctx = this.ctx;
		if (this.allowCancelation) {
			for (var i=0,len=listeners.length; i<len; i++) {
				if (listeners[i].apply(ctx, args) === false) {
					return;
				}
			}			
		} else {
			for (var i=0,len=listeners.length; i<len; i++) {
				listeners[i].apply(ctx, args);
			}
		}
	}

	this.fireAsync = function() {
		if (this.asyncTimer !== null) {
			window.clearTimeout(this.asyncTimer);
			this.asyncTimer = null;
		}
		var self = this;
		this.asyncTimer = window.setTimeout(function() {
			try {
				
			} finally {
				self.asyncTimer = null;
			}
		}, this.timeout);
	}
}


function AsyncListenerRegistry(ctx, timeout) {
	this.listeners = [];
	this.ctx = ctx;
	this.timeout = timeout || 0;
	this.timer = null;

	this.add = function(listener) {
		var i = this.listeners.indexOf(listener);
		if (i === -1) {
			this.listeners.push(listener);
			return new ListenerRegistration(this.listeners, listener);
		} else {
			return new ListenerRegistration(this.listeners, listener);
		}
	}

	this.remove = function(listener) {
		var i = this.listeners.indexOf(this.listener);
		if (i > -1) {
			return this.listeners.splice(i, 1)[0];
		}
		return null;
	}

	this.fireNow = function() {
		//var args = arguments; 
		var listeners = this.listeners;
		var ctx = this.ctx;	
		for (var i=0,len=listeners.length; i<len; i++) {
			listeners[i].apply(ctx);
		}
	}

	/**
	 * Fire the listeners after the timeout and when no more events are fired
	 * The fire method doesn't take any argument. 
	 * If you need to share an execution context with your listeners 
	 * then specify a ctx object as the first argument when creating this registry
	 */
	this.fireWhenIdle = function() {
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
		var self = this;
		this.timer = window.setTimeout(function() {
			try {
				self.fireNow();
			} finally {
				self.timer = null;
			}
		}, this.timeout);
	}

	this.fire = function() {
		if (this.timer !== null) {
			return;
		}
		var self = this;
		this.timer = window.setTimeout(function() {
			try {
				self.fireNow();
			} finally {
				self.timer = null;
			}
		}, this.timeout);
	}
}

