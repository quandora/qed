/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
// @version 0.7.7
if (typeof WeakMap === "undefined") {
  (function() {
    var defineProperty = Object.defineProperty;
    var counter = Date.now() % 1e9;
    var WeakMap = function() {
      this.name = "__st" + (Math.random() * 1e9 >>> 0) + (counter++ + "__");
    };
    WeakMap.prototype = {
      set: function(key, value) {
        var entry = key[this.name];
        if (entry && entry[0] === key) entry[1] = value; else defineProperty(key, this.name, {
          value: [ key, value ],
          writable: true
        });
        return this;
      },
      get: function(key) {
        var entry;
        return (entry = key[this.name]) && entry[0] === key ? entry[1] : undefined;
      },
      "delete": function(key) {
        var entry = key[this.name];
        if (!entry || entry[0] !== key) return false;
        entry[0] = entry[1] = undefined;
        return true;
      },
      has: function(key) {
        var entry = key[this.name];
        if (!entry) return false;
        return entry[0] === key;
      }
    };
    window.WeakMap = WeakMap;
  })();
}

(function(global) {
  var registrationsTable = new WeakMap();
  var setImmediate;
  if (/Trident|Edge/.test(navigator.userAgent)) {
    setImmediate = setTimeout;
  } else if (window.setImmediate) {
    setImmediate = window.setImmediate;
  } else {
    var setImmediateQueue = [];
    var sentinel = String(Math.random());
    window.addEventListener("message", function(e) {
      if (e.data === sentinel) {
        var queue = setImmediateQueue;
        setImmediateQueue = [];
        queue.forEach(function(func) {
          func();
        });
      }
    });
    setImmediate = function(func) {
      setImmediateQueue.push(func);
      window.postMessage(sentinel, "*");
    };
  }
  var isScheduled = false;
  var scheduledObservers = [];
  function scheduleCallback(observer) {
    scheduledObservers.push(observer);
    if (!isScheduled) {
      isScheduled = true;
      setImmediate(dispatchCallbacks);
    }
  }
  function wrapIfNeeded(node) {
    return window.ShadowDOMPolyfill && window.ShadowDOMPolyfill.wrapIfNeeded(node) || node;
  }
  function dispatchCallbacks() {
    isScheduled = false;
    var observers = scheduledObservers;
    scheduledObservers = [];
    observers.sort(function(o1, o2) {
      return o1.uid_ - o2.uid_;
    });
    var anyNonEmpty = false;
    observers.forEach(function(observer) {
      var queue = observer.takeRecords();
      removeTransientObserversFor(observer);
      if (queue.length) {
        observer.callback_(queue, observer);
        anyNonEmpty = true;
      }
    });
    if (anyNonEmpty) dispatchCallbacks();
  }
  function removeTransientObserversFor(observer) {
    observer.nodes_.forEach(function(node) {
      var registrations = registrationsTable.get(node);
      if (!registrations) return;
      registrations.forEach(function(registration) {
        if (registration.observer === observer) registration.removeTransientObservers();
      });
    });
  }
  function forEachAncestorAndObserverEnqueueRecord(target, callback) {
    for (var node = target; node; node = node.parentNode) {
      var registrations = registrationsTable.get(node);
      if (registrations) {
        for (var j = 0; j < registrations.length; j++) {
          var registration = registrations[j];
          var options = registration.options;
          if (node !== target && !options.subtree) continue;
          var record = callback(options);
          if (record) registration.enqueue(record);
        }
      }
    }
  }
  var uidCounter = 0;
  function JsMutationObserver(callback) {
    this.callback_ = callback;
    this.nodes_ = [];
    this.records_ = [];
    this.uid_ = ++uidCounter;
  }
  JsMutationObserver.prototype = {
    observe: function(target, options) {
      target = wrapIfNeeded(target);
      if (!options.childList && !options.attributes && !options.characterData || options.attributeOldValue && !options.attributes || options.attributeFilter && options.attributeFilter.length && !options.attributes || options.characterDataOldValue && !options.characterData) {
        throw new SyntaxError();
      }
      var registrations = registrationsTable.get(target);
      if (!registrations) registrationsTable.set(target, registrations = []);
      var registration;
      for (var i = 0; i < registrations.length; i++) {
        if (registrations[i].observer === this) {
          registration = registrations[i];
          registration.removeListeners();
          registration.options = options;
          break;
        }
      }
      if (!registration) {
        registration = new Registration(this, target, options);
        registrations.push(registration);
        this.nodes_.push(target);
      }
      registration.addListeners();
    },
    disconnect: function() {
      this.nodes_.forEach(function(node) {
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          var registration = registrations[i];
          if (registration.observer === this) {
            registration.removeListeners();
            registrations.splice(i, 1);
            break;
          }
        }
      }, this);
      this.records_ = [];
    },
    takeRecords: function() {
      var copyOfRecords = this.records_;
      this.records_ = [];
      return copyOfRecords;
    }
  };
  function MutationRecord(type, target) {
    this.type = type;
    this.target = target;
    this.addedNodes = [];
    this.removedNodes = [];
    this.previousSibling = null;
    this.nextSibling = null;
    this.attributeName = null;
    this.attributeNamespace = null;
    this.oldValue = null;
  }
  function copyMutationRecord(original) {
    var record = new MutationRecord(original.type, original.target);
    record.addedNodes = original.addedNodes.slice();
    record.removedNodes = original.removedNodes.slice();
    record.previousSibling = original.previousSibling;
    record.nextSibling = original.nextSibling;
    record.attributeName = original.attributeName;
    record.attributeNamespace = original.attributeNamespace;
    record.oldValue = original.oldValue;
    return record;
  }
  var currentRecord, recordWithOldValue;
  function getRecord(type, target) {
    return currentRecord = new MutationRecord(type, target);
  }
  function getRecordWithOldValue(oldValue) {
    if (recordWithOldValue) return recordWithOldValue;
    recordWithOldValue = copyMutationRecord(currentRecord);
    recordWithOldValue.oldValue = oldValue;
    return recordWithOldValue;
  }
  function clearRecords() {
    currentRecord = recordWithOldValue = undefined;
  }
  function recordRepresentsCurrentMutation(record) {
    return record === recordWithOldValue || record === currentRecord;
  }
  function selectRecord(lastRecord, newRecord) {
    if (lastRecord === newRecord) return lastRecord;
    if (recordWithOldValue && recordRepresentsCurrentMutation(lastRecord)) return recordWithOldValue;
    return null;
  }
  function Registration(observer, target, options) {
    this.observer = observer;
    this.target = target;
    this.options = options;
    this.transientObservedNodes = [];
  }
  Registration.prototype = {
    enqueue: function(record) {
      var records = this.observer.records_;
      var length = records.length;
      if (records.length > 0) {
        var lastRecord = records[length - 1];
        var recordToReplaceLast = selectRecord(lastRecord, record);
        if (recordToReplaceLast) {
          records[length - 1] = recordToReplaceLast;
          return;
        }
      } else {
        scheduleCallback(this.observer);
      }
      records[length] = record;
    },
    addListeners: function() {
      this.addListeners_(this.target);
    },
    addListeners_: function(node) {
      var options = this.options;
      if (options.attributes) node.addEventListener("DOMAttrModified", this, true);
      if (options.characterData) node.addEventListener("DOMCharacterDataModified", this, true);
      if (options.childList) node.addEventListener("DOMNodeInserted", this, true);
      if (options.childList || options.subtree) node.addEventListener("DOMNodeRemoved", this, true);
    },
    removeListeners: function() {
      this.removeListeners_(this.target);
    },
    removeListeners_: function(node) {
      var options = this.options;
      if (options.attributes) node.removeEventListener("DOMAttrModified", this, true);
      if (options.characterData) node.removeEventListener("DOMCharacterDataModified", this, true);
      if (options.childList) node.removeEventListener("DOMNodeInserted", this, true);
      if (options.childList || options.subtree) node.removeEventListener("DOMNodeRemoved", this, true);
    },
    addTransientObserver: function(node) {
      if (node === this.target) return;
      this.addListeners_(node);
      this.transientObservedNodes.push(node);
      var registrations = registrationsTable.get(node);
      if (!registrations) registrationsTable.set(node, registrations = []);
      registrations.push(this);
    },
    removeTransientObservers: function() {
      var transientObservedNodes = this.transientObservedNodes;
      this.transientObservedNodes = [];
      transientObservedNodes.forEach(function(node) {
        this.removeListeners_(node);
        var registrations = registrationsTable.get(node);
        for (var i = 0; i < registrations.length; i++) {
          if (registrations[i] === this) {
            registrations.splice(i, 1);
            break;
          }
        }
      }, this);
    },
    handleEvent: function(e) {
      e.stopImmediatePropagation();
      switch (e.type) {
       case "DOMAttrModified":
        var name = e.attrName;
        var namespace = e.relatedNode.namespaceURI;
        var target = e.target;
        var record = new getRecord("attributes", target);
        record.attributeName = name;
        record.attributeNamespace = namespace;
        var oldValue = e.attrChange === MutationEvent.ADDITION ? null : e.prevValue;
        forEachAncestorAndObserverEnqueueRecord(target, function(options) {
          if (!options.attributes) return;
          if (options.attributeFilter && options.attributeFilter.length && options.attributeFilter.indexOf(name) === -1 && options.attributeFilter.indexOf(namespace) === -1) {
            return;
          }
          if (options.attributeOldValue) return getRecordWithOldValue(oldValue);
          return record;
        });
        break;

       case "DOMCharacterDataModified":
        var target = e.target;
        var record = getRecord("characterData", target);
        var oldValue = e.prevValue;
        forEachAncestorAndObserverEnqueueRecord(target, function(options) {
          if (!options.characterData) return;
          if (options.characterDataOldValue) return getRecordWithOldValue(oldValue);
          return record;
        });
        break;

       case "DOMNodeRemoved":
        this.addTransientObserver(e.target);

       case "DOMNodeInserted":
        var changedNode = e.target;
        var addedNodes, removedNodes;
        if (e.type === "DOMNodeInserted") {
          addedNodes = [ changedNode ];
          removedNodes = [];
        } else {
          addedNodes = [];
          removedNodes = [ changedNode ];
        }
        var previousSibling = changedNode.previousSibling;
        var nextSibling = changedNode.nextSibling;
        var record = getRecord("childList", e.target.parentNode);
        record.addedNodes = addedNodes;
        record.removedNodes = removedNodes;
        record.previousSibling = previousSibling;
        record.nextSibling = nextSibling;
        forEachAncestorAndObserverEnqueueRecord(e.relatedNode, function(options) {
          if (!options.childList) return;
          return record;
        });
      }
      clearRecords();
    }
  };
  global.JsMutationObserver = JsMutationObserver;
  if (!global.MutationObserver) global.MutationObserver = JsMutationObserver;
})(this);
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.Qed = factory();
    }
}(this, function() {

"use strict";

var MACOS = navigator.userAgent.indexOf('Mac OS X') != -1;
var ID_GEN=0; // increment used by components who eneed to generate ids
var noop = function(){}

var Qed = {
    resolve: function(selectorOrElem) {
        if (typeof selectorOrElem === 'string') {
            return document.querySelector(selectorOrElem);
        } else {
            return selectorOrElem;
        }
    },
    create: function(selector, settings) {
        return new EditorContainer().create(Qed.resolve(selector), settings);
    }
};

//@include ie8.js

// ============ child index =================

/*
	- use parent.children for getElementByIndex (IE9, IE<9 support it but also include comment nodes) for 
	- use next/previousElementSibling instead of nextSibling with element test - much faster (IE9)
	- use firstElementChild ...(IE9 - not supported on docfragment)
	- childElementCount for no of lines (IE9 like children)
	- use classList (IE10)
*/

// normalize event 'which' property
function normalizeKeyEvent(event) {
	if (event.which == null) {
		event.which = event.charCode != null ? event.charCode : event.keyCode;
	}
}


function indexOfChildElement(elem) {
    var i = 0;
    var node = elem.previousElementSibling;
    while (node) {
        i++;
        node = node.previousElementSibling;
    }
    return i;
}

function indexOfChildNode(node) {
    var i = 0;
    var node = elem.previousSibling;
    while (node) {
        i++;
        node = node.previousSibling;
    }
    return i;
}

function getChildElement(parent, index) {
	return parent.children[index];
}

function getChildNode(parent, index) {
	return parent.childNodes[index];
}

// ------------------- escape ------------

function escapeTagMarkers(text) {
	return text ? text.replace(/[<>]/g, function(ch) { return ch === '<' ? "&lt;" : "&gt;"}) : '';
}

function selectParent(elem, root, selectFn) {
	var node = elem;
	while (node && node != root) {
		if (selectFn(node)) {
			return node;
		}
	}
	return null;
}

function closest(elem, tagName) {
	if (elem.closest) {
		return elem.closest(tagName);
	}
	var p = elem;
	var tagName = tagName.toUpperCase();
	while (p && p.tagName.toUpperCase() !== tagName) {
		p = p.parentNode;
	}
	return p;
}

function getScrollX() {
	return (window.pageXOffset !== undefined) ? window.pageXOffset : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
}

function getScrollY() {
	return (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
}

function absX(viewportX) {
	return viewportX+getScrollX();
}

function absY(viewportY) {
	return viewportY+getScrollY();
}

// ---------------------------- class manipulation --------------------------------

/**
 * Add the given class and return back the element
 */
function addClass(elem, className) {	
	var classList = elem.classList;
	if (classList === undefined) {		
		var classes = elem.className ? elem.className.trim().split(/\s+/) : [];
		var i = classes.indexOf(className);
		if (i === -1) {
			classes.push(className);
			elem.className = classes.join(' ');
		}
	} else {
		classList.add(className);
	}
	return elem;
}

/**
 * Remove the given class and return back the element
 */
function removeClass(elem, className) {
	var classList = elem.classList;
	if (classList === undefined) {
		var classes = elem.className ? elem.className.trim().split(/\s+/) : [];
		var i = classes.indexOf(className);
		if (i > -1) {
			classes.splice(i, 1);
			elem.className = classes.join(' ');
		}
	} else {
		classList.remove(className);
	}
	return elem;
}

function hasClass(elem, className) {
	var classList = elem.classList;
	if (classList === undefined) {
		var classes = elem.className ? elem.className.trim().split(/\s+/) : [];
		var i = classes.indexOf(className);
		return i > -1;
	} else {
		return classList.contains(className);
	}
}

/** 
 * Remove or add the given class depending on the condition param
 * If condition is true then add the class otherwise remove the class
 * @return back the element
 */
function toggleClass(elem, className, addIt) {
	return addIt ? addClass(elem, className) : removeClass(elem, className);
}

// ----------------- dom helpers ---------------------

// return the first element found in the html string.
function parseElement(html) {
	var newElement = document.createElement("DIV");
	newElement.innerHTML = html;
	var node = newElement.firstChild;
	while (node && node.nodeType !== 1) {
		node = node.nextSibling;
	}
	return node;
}


/**
 * Remove a range of sibling elements starting with firstElement and ending with lastElement (the start and end elements will be removed too).
 * If firstLine is the same as newLine then it remove firstLine.
 * Returns back the next sibling element of lastElement.
 */
function removeSiblingElements(firstElement, lastElement) {
	var parent = firstElement.parentNode;
	var elem = firstElement;
	var next = firstElement.nextElementSibling;
	
	while (elem && elem !== lastElement) {
		next = elem.nextElementSibling;
		parent.removeChild(elem);
		elem = next;
	}
	if (elem) {
		next = elem.nextElementSibling;
		parent.removeChild(elem);
	}

	return next;
}

function emptyElement(elem) {
	var node = elem;
	while (node.lastChild) {
		node.removeChild(node.lastChild);
	}
}

// show or hide the element. return true if element became visible or false if element was hidden.
function toggleElement(elem) {
	if (elem.style.display === 'none') {
		elem.style.display = "";
		return true;
	} else {
		elem.style.display = "none";
		return false;
	}
}

function showElement(elem) {
	elem.style.display = '';
}

function hideElement(elem) {
	elem.style.display = 'none';
}


function scrollTo(view, elem) {
	var rect = elem.getBoundingClientRect();
	if (rect.bottom > view.clientHeight) {
		view.scrollTop += (rect.bottom - view.clientHeight);
	}
}

function nextNode(root, node, skipChildren) {
	if (!skipChildren && node.firstChild) {
		return node.firstChild;
	}
	if (node === root) {
		return null;
	}
	if (node.nextSibling) {
		return node.nextSibling;
	}
	// go up into the parent until a next sibling is found
	var parent = node.parentNode;
	while (parent && root !== parent) {
		if (parent.nextSibling) {
			return parent.nextSibling;
		}
		parent = parent.parentNode;
	}
	return null;
}

function nextTextNode(root, node) {
	node = nextNode(root, node, true);
	while (node && node.nodeType !== 3) {
		node = nextNode(root, node);
	}
	return node;
}

function nextElement(root, node) {
	node = nextNode(root, node, true);
	while (node && node.nodeType !== 1) {
		node = nextNode(root, node);
	}
	return node;
}

function findFirstTextNode(root) {
	var node = nextNode(root, root);
	while (node && node.nodeType !== 3) {
		node = nextNode(root, node);
	}
	return node;	
}

function previousNode(root, node, skipChildren) {
	if (!skipChildren && node.lastChild) {
		return node.lastChild;
	}
	if (node === root) {
		return null;
	}
	if (node.previousSibling) {
		return node.previousSibling;
	}
	// go up into the parent until a next sibling is found
	var parent = node.parentNode;
	while (parent && root !== parent) {
		if (parent.previousSibling) {
			return parent.previousSibling;
		}
		parent = parent.parentNode;
	}
	return null;
}


/**
 * Get the previous text node relative to the given 'node' node. 
 * If the given 'node' node is an element then its children elements are not traversed
 */
function previousTextNode(root, node) {
	node = previousNode(root, node, true);
	while (node && node.nodeType !== 3) {
		node = previousNode(root, node);
	}
	return node;
}

/**
 * Get the previous element relative to the given 'node' node.
 * If the given 'node' node is an element then its children are not traversed
 */
function previousElement(root, node) {
	node = previousNode(root, node, true);
	while (node && node.nodeType !== 1) {
		node = previousNode(root, node);
	}
	return node;
}


function findLastTextNode(root) {
	var node = previousNode(root, root);
	while (node && node.nodeType !== 3) {
		node = previousNode(root, node);
	}
	return node;
}

// given a root element and an absolute text offset find the text node and the local offset corresponding to the absolute offset
// the result is returned as an array [textNode, offsetInTextNode]
function findTextNodeAt(root, offset) {
	var i = 0;
	var node = findFirstTextNode(root);
	while (node) {
		var len = node.nodeValue.length;
		if (offset <= len + i) {
			return [node, offset - i];
		}
		i += len;
		node = nextTextNode(root, node);
	}
	return null;
}

function getAbsoluteOffset(root, focusNode, focusOffset) {
	var i = 0;
	var node = findFirstTextNode(root);
	while (node) {
		if (node === focusNode) {
			return i + focusOffset;
		}
		i += node.nodeValue.length;
		node = nextTextNode(root, node);
	}
	return -1;
}

/**
 * Return an array [rootStartOffset, rootEndOffset] or null if offsets was not resolved. 
 * The resulting array has a property backwards if the endNode. endOffset is before startNode, startOffset in the document flow.
 */
function getAbsoluteOffsets(root, startNode, startOffset, endNode, endOffset) {
	var i = 0;
	var node = findFirstTextNode(root);
	var result = [];
	if (startNode === endNode) {
		// treat the case when start and end node are the same
		result.backwards = startOffset > endOffset;		
		while (node) {
			if (node === startNode) {
				result.push(i+startOffset);
				result.push(i+endOffset);
				return result;
			}
			i += node.nodeValue.length;
			node = nextTextNode(root, node);
		}
		return null;
	}
	// start and end node are not the same nodes
	// find the first node occurring in the docuemnt flow.
	var lastNode = null;
	var lastOffset = 0;
	while (node) {
		if (node === startNode) {
			result.push(i+startOffset);
			result.backwards = false;
			lastNode = endNode;
			lastOffset = endOffset;
			break;		
		} else if (node === endNode) {
			result.push(i+endOffset);
			result.backwards = true;
			lastNode = startNode;
			lastOffset = startOffset;
			break;
		}
		i += node.nodeValue.length;
		node = nextTextNode(root, node);
	}
	
	if (lastNode === null) {
		return null;
	}

	node = nextTextNode(root, node);
	while (node) {
		if (node === lastNode) {
			result.push(i+lastOffset);
			return result;
		}
		node = nextTextNode(root, node);
	}

	return null;
}

function getRangeFromOffsets(root, startOffset, endOffset) {
	// trivial case
	if (startOffset === endOffset) {
		var result = findTextNodeAt(root, startOffset);
		if (result) {
			result.backwards = false;
			result.push(result[0]);
			result.push(result[1]);
		}
		return result;
	}

	var result = [];
	var offset, lastOffset;
	if (startOffset < endOffset) {
		result.backwards = false;
		offset = startOffset;
		lastOffset = endOffset;
	} else {
		result.backwards = true;
		offset = endOffset;
		lastOffset = startOffset;
	}	

	var i = 0, len = 0;
	var node = findFirstTextNode(root);
	while (node) {
		len = node.nodeValue.length;
		if (offset <= len + i) {
			result.push(node);
			result.push(offset - i);
			if (result.length === 4) {
				return result;
			}
			offset = lastOffset;
		}
		i += len;
		node = nextTextNode(root, node);
	}
	return null;
}



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



function __getSelection() {
	return window.getSelection();
}

function __createRange() {
	return document.createRange();
}

// ------------------- regexes for remove next / previous word ----------------------
// see http://stackoverflow.com/questions/7576945/javascript-regular-expression-for-punctuation-international
// punct = \u2000-\u206F\u2E00-\u2E7F\s\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~
// /^[punct]*([^punct]+)/

var firstWordWithPunctRE = /^[\u2000-\u206F\u2E00-\u2E7F\s\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]*([^\u2000-\u206F\u2E00-\u2E7F\s\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]*)/;
// /([^punct]+)[punct]*$/
var lastWordWithPunctRE = /([^\u2000-\u206F\u2E00-\u2E7F\s\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]*)[\u2000-\u206F\u2E00-\u2E7F\s\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]*$/;

// ja: \u3000-\u303f
//var firstWordWithPunctRE = /^[\u3000-\u303f\u2000-\u206F\u2E00-\u2E7F\s\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]*([^\u3000-\u303f\u2000-\u206F\u2E00-\u2E7F\s\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]*)/;
// /([^punct]+)[punct]*$/
//var lastWordWithPunctRE = /([^\u3000-\u303f\u2000-\u206F\u2E00-\u2E7F\s\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]*)[\u3000-\u303f\u2000-\u206F\u2E00-\u2E7F\s\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]*$/;

/**
 * Find the occurrence of the last word in the given text with any trialing punctuation. 
 * Return an array with the offset of the match start on position 0 and the matched word (without any punctuation) on position 1.
 * If only punctuation was found (i.e. word is empty) the item as position 1 will be empty or null.
 * If the text is empty or null it will return [0, null]
 */
function __findLastWord(text) {
  if (!text) {
    return [0, null];
  }
  var match = lastWordWithPunctRE.exec(text);
  if (!match) {
    return [0, null];
  }
  return [ match.index, match[1] ];
}

/**
 * Find the occurrence of the first word in the given text with any leading punctuation. 
 * Return an array with the offset of the match end on position 0 and the matched word (without any punctuation) on position 1.
 * If only punctuation was found (i.e. word is empty) the item as position 1 will be empty or null.
 * If the text is empty or null it will return [0, null]
 */
function __findFirstWord(text) {
  if (!text) {
    return [0, null];
  }
  var match = firstWordWithPunctRE.exec(text);
  if (!match) {
    return [0, null];
  }
  return [ match.index + match[0].length, match[1] ]; 
}

/**
 * Find the occurence of the next or previous word with any leading or trailing punctuation (as specified by backwards argument) starting from the given offset.
 * Return an array of 2 elements: 
 * 0. the offset in the text where the word ends (or starts if searching backwards)
 * 1. the word without any punctuation on null or "" if only punctuation or nothing was matched
 * If text is null or empty returns [0, null]
 */
function __findWord(text, offset, backwards) {
	if (backwards) {
		var left = text.substring(0, offset);
		return __findLastWord(left);
	} else {
		var right = text.substring(offset);
		var r = __findFirstWord(right);
		r[0] += offset;
		return r;
	}
}
// --------------------------------------------------------------------------------------

function LineRange(doc) {
	this.doc = doc;
	this.anchorLine = null;
	this.anchorOffset = 0;
	this.focusLine = null;
	this.focusOffset = 0;

	this.clone = function() {
		var clone = new LineRange(this.doc);
		clone.anchorLine = this.anchorLine;
		clone.anchorOffset = this.anchorOffset;
		clone.focusLine = this.focusLine;
		clone.focusOffset = this.focusOffset;
		return clone;
	}

	this.isCollapsed = function() {
		return this.anchorOffset === this.focusOffset && this.anchorLine.elem === this.focusLine.elem;
	}

	this.isMultiline = function() {
		return this.anchorLine.elem !== this.focusLine.elem;
	}

	this.isBackwards = function() {
		return this.anchorLine.elem === this.focusLine.elem ? this.anchorOffset > this.focusOffset : this.anchorLine.getLineIndex() > this.focusLine.getLineIndex();
	}

	this.isValid = function() {
		return this.anchorLine && this.focusLine;
	}

	this.save = function() {
		return [ this.anchorLine.getLineIndex(), this.anchorOffset, this.focusLine.getLineIndex(), this.focusOffset ];
	}

	this.restore = function(savedRange) {		
		this.anchorLine = this.doc.getLineAt(savedRange[0]);
		this.anchorOffset = savedRange[1];
		if (savedRange[0] === savedRange[2]) {
			this.focusLine = this.anchorLine;
		}
		this.focusLine = this.doc.getLineAt(savedRange[2]);
		this.focusOffset = savedRange[3];
		return this;
	}

	this.asDomRange = function() {
		if (!this.isValid()) {
			return null;
		}
		var focusPoint;
		var anchorPoint = findTextNodeAt(this.anchorLine.elem, this.anchorOffset);
		if (!anchorPoint) {
			return null;
		}
		if (!this.isCollapsed()) {
			focusPoint = findTextNodeAt(this.focusLine.elem, this.focusOffset);
			if (!focusPoint) {
				return null;
			}
		} else {
			focusPoint = anchorPoint;
		}
		//TODO creating backwards selection doesn't work ...
		// see http://stackoverflow.com/questions/4801464/is-there-no-way-to-create-a-reversed-i-e-right-to-left-selection-from-javascr
		// (a collapsed selection will be created for reversed ranges)
		var range = __createRange();
		if (anchorPoint[1] < 0) {
			console.error("anchor offset is negative", anchorPoint);
			anchorPoint[1] = 0;
		}
		if (focusPoint[1] < 0) {
			console.error("focus offset is negative", anchorPoint);
			focusPoint[1] = 0;
		}
		range.setStart(anchorPoint[0], anchorPoint[1]);
		range.setEnd(focusPoint[0], focusPoint[1]);
		
		return range;
	}

	this.select = function(sel) {
		var range = this.asDomRange();
		if (!range) {
			return this;
		}
		if (!sel) {
			sel = __getSelection();
		}
		sel.removeAllRanges();
		sel.addRange(range);
		this.doc.elem.focus(); // required by ff
		return this;
	}

	this.fromSelection = function(sel) {
		if (!sel) {
			sel = __getSelection();
		}
		if (!sel.anchorNode || !sel.focusNode) {
			return this; // invalid range
		}	
		if (sel.isCollapsed) {
			this.anchorLine = this.focusLine = this.doc.getLine(sel.anchorNode);
			if (this.anchorLine) {
				this.anchorOffset = this.focusOffset = getAbsoluteOffset(this.anchorLine.elem, sel.anchorNode, sel.anchorOffset);
			}			
			return this;
		}
		this.anchorLine = this.doc.getLine(sel.anchorNode);
		if (sel.anchorNode === sel.focusNode) {
			this.focusLine = this.anchorLine;
		} else {
			this.focusLine = this.doc.getLine(sel.focusNode);
		}
		if (this.anchorLine && this.focusLine) {
			this.anchorOffset = getAbsoluteOffset(this.anchorLine.elem, sel.anchorNode, sel.anchorOffset);
			this.focusOffset = getAbsoluteOffset(this.focusLine.elem, sel.focusNode, sel.focusOffset);
		}
		return this;
	}

	this.set = function(anchorLine, anchorOffset, focusLine, focusOffset) {
		if (focusLine === undefined) { // collapsed
			this.anchorLine = anchorLine;
			this.anchorOffset = anchorOffset;
			this.focusLine = anchorLine;
			this.focusOffset = anchorOffset;
		} else if (focusOffset === undefined) { // on the same line
			this.anchorLine = anchorLine;
			this.anchorOffset = anchorOffset;
			this.focusLine = anchorLine;
			this.focusOffset = focusLine;
		} else {
			this.anchorLine = anchorLine;
			this.anchorOffset = anchorOffset;
			this.focusLine = focusLine;
			this.focusOffset = focusOffset;
		}
		return this;
	}

	this.collapse = function(toAnchor) {
		if (toAnchor) {
			this.focusOffset = this.anchorOffset;
			this.focusLine = this.anchorLine;
		} else {
			this.anchorOffset = this.focusOffset;
			this.anchorLine = this.focusLine;
		}
		return this;
	}

	this.expandTo = function(focusLine, focusOffset) {
		this.focusLine = focusLine;
		this.focusOffset = focusOffset;
		return this;
	}

	this.expandToBoundingLines = function() {
		this.reverseIfBackwards();
		this.anchorOffset = 0;
		this.focusOffset = this.focusLine.getEndOfLineOffset();
		return this;
	}

// --- TODO: not sure the following 2 methods are usefull
	/**
	 * Move focus point one character to the left. 
	 * Returns true if successfull or false if no more characters exists at the right of the current focus point.
	 */
/*	 
	this.expandToNextCharacter = function() {
		var line = this.focusLine;
		var offset = this.focusOffset;
		var text = line.getText();
		if (offset < text.length-1) {
			this.focusOffset++;
			return true;
		} else {
			// expand to next line 
			var nextLine = line.next();
			if (!nextLine) {
				return false; // do nothing
			}
			this.expandTo(new Line(this.doc, nextLine), 0);
		}
		return true;
	}
*/
	/**
	 * Move focus point one character to the right
	 */
/*	 
	this.expandToPreviousCharacter = function() {
		var line = this.focusLine;
		var offset = this.focusOffset;
		var text = line.getText();
		if (offset > 0) {
			this.focusOffset--;
			return true;
		} else {
			// expand to prev line 
			var prevLine = line.previous();
			if (!prevLine) {
				return false; // do nothing
			}
			line = new Line(this.doc, prevLine);
			var prevText = line.getText();
			this.expandTo(line, prevText.length-1);
		}
		return true;
	}
*/

	this.collapseTo = function(line, offset) {
		this.anchorLine = this.focusLine = line;
		this.focusOffset = this.anchorOffset = offset;
		return this;
	}

	this.collapseToEnd = function(line) {
		return this.collapseTo(line, line.getEndOfLineOffset());
	}

	this.collapseToBegin = function(line) {
		return this.collapseTo(line, 0);
	}

	/**
	 * reverse the range direction. The anchor will become the focus and the focus the anchor
	 */
	this.reverse = function() {
		var line = this.focusLine;
		var offset = this.focusOffset;
		this.focusLine = this.anchorLine;
		this.anchorLine = line;		
		this.focusOffset = this.anchorOffset;
		this.anchorOffset = offset;
		return this;
	}

	/**
	 * Reverse the range direction if the range is backwards. If the range is reversed returns true false otherwise.
	 */
	this.reverseIfBackwards = function() {
		if (this.isBackwards()) {
			this.reverse();
			return true;
		}
		return false;
	}

	this.getFirstLine = function() {
		return this.isBackwards() ? this.focusLine : this.anchorLine;
	}

	this.getLastLine = function() {
		return this.isBackwards() ? this.focusLine : this.anchorLine;
	}

	this.getFirstLineOffset = function() {
		return this.isBackwards() ? this.focusOffset : this.anchorOffset;	
	}

	this.getLastLineOffset = function() {
		return this.isBackwards() ? this.focusLine : this.anchorLine;
	}

	this.getText = function() {
		if (!this.isValid() || this.isCollapsed()) {
			return "";
		} else if (!this.isMultiline()) {
			var from, to;
			if (this.focusOffset > this.anchorOffset) {
				from = this.anchorOffset;
				to = this.focusOffset;
			} else {
				from = this.focusOffset;
				to = this.anchorOffset;
			}
			var text =  this.focusLine.getText().substring(from, to);
			if (text.length > 0 && text.charCodeAt(text.length-1) === 10) {
				text = text.substring(0, text.length-1);
			}
			return text;
		} else {
			var startLine, endLine, startOffset, endOffset;
			if (this.isBackwards()) {
				startLine = this.focusLine;
				startOffset = this.focusOffset;
				endLine = this.anchorLine;
				endOffset = this.anchorOffset;
			} else {
				startLine = this.anchorLine;
				startOffset = this.anchorOffset;
				endLine = this.focusLine;
				endOffset = this.focusOffset;
			}
			var text = startLine.getText().substring(startOffset);
			var node = startLine.elem.nextElementSibling;
			var last = endLine.elem.previousElementSibling;
			while (node && node !== last) {
				text += node.textContent;
				node = node.nextElementSibling;
			}
			text += endLine.getText().substring(0, endOffset);
			return text;
		}
	}


	function getLinePrefix(text, offset) {
		if (offset === 0) {
			return "";
		}
		if (offset === text.length && text.length > 0 && text.charCodeAt(offset-1) === 10) {
			text = text.substring(0, offset-1); // remove the \n
		} else {
			text = text.substring(0, offset);
		}
		return text;
	}

	function getLineSuffix(text, offset) {
		if (offset >= text.length) {
			return "";
		}
		if (text.length > 0 && text.charCodeAt(text.length-1) === 10) {
			text = text.substring(offset, text.length-1);
		} else {
			text = text.substring(offset);
		}
		return text;
	}

	/**
	 * Get the text surrounding the range which is enclosed in the bounding lines (anchor and focus).
	 * The result is an array containing the left bounding text and the right bounding text. 
	 * The bounding text will never include the \n character.
	 *
	 * Examples:
	 * 1. for the following range: 123\nab[c\nde]f\n... the bounding text is ['ab', 'f']
	 * 2. fpr the followinf range: ..\n[abc]\n.. the nounding text is ['', '']
	 *
	 * Before calling his method make sure the range is not backwards, 
	 * otheriwse yoy may want to call this.reverseIfBackwards() to fix the range direction.
	 */
	this.getBoundingText = function() {
		return [ getLinePrefix(this.anchorLine.getText(), this.anchorOffset), getLineSuffix(this.focusLine.getText(), this.focusOffset) ];
	}

	/**
	 * Redraw all lines contained or intersecting the range.
	 * This method does not restore the selection - you need to call select() just after to restore the selection.
	 * @return this range instance
	 */
	this.refresh = function() {
		if (this.isMultiline()) {
			//TODO optimize - implement a refresh operation on formatter
			this.reverseIfBackwards();
			// refresh the anchor line
			this.anchorNode.setText(null);
			// refresh the lines between anchor and focus
			var formatter = this.doc.formatter;
			var elem = this.anchorNode.elem.nextElementSibling;
			var end = this.focusNode.elem;
			while (elem && elem !== end) {
				formatter.updateLine(elem);
			}
			// refresh the focus line 
			this.focusNode.setText(null); 			
		} else {
			this.focusLine.setText(null);
		}
		return this;
	}

	/**
	 * Remove all lines contained in the range or intersecting this range.
	 * After removing the lines the range is collpased to the beginning of the next line after the removed range.
	 * (if no rnext line exists an empty line will be appended to the document)
	 * @return this range instance
	 */
	this.removeLines = function() {
		this.reverseIfBackwards();
		var lineElem = this.doc.formatter.removeLines(firstLine, lastLine);
		return this.collapseTo(new Line(this.doc, lineElem), 0);
	}

	/**
	 * Remove the range text and then collapse the range to the focus point.
	 * If the range is collapsed do nothing.
	 * @return this range instance
	 */
	this.removeText = function() {
		if (this.isCollapsed()) {
			return this; // do nothing
		}
		this.reverseIfBackwards();
		var r = this.getBoundingText();
		var lineElem = this.doc.formatter.replaceLines(this.anchorLine.elem, this.focusLine.elem, [ r[0]+r[1] ] );
		return this.collapseTo(new Line(this.doc, lineElem), r[0].length);
	}

	/**
	 * Update the document by replacing the range text if any (if range is not collapsed) with the given text. 
	 * If the range is collapsed and 'textToInsert' is not empty then it will insert the text at the focus point.
	 * If both text to insert is empty and range content is empty then refresh the line.	 
	 * After the update is done the range is collapsed to the natural focus point as defined by the update operation 
	 * (i.e. at the end of the inserted text in case of an insert or on the focus point in case of a remove or refresh)
	 */
	this.insertText = function(textToInsert) {
		if (!textToInsert) {
			return this.removeText();
		}

		this.reverseIfBackwards();

		var focusOffset;
		var r = this.getBoundingText();
		var linesToInsert = normalizeLf(r[0]+textToInsert+r[1]).split('\n');
		var lineElem = this.doc.formatter.replaceLines(this.anchorLine.elem, this.focusLine.elem, linesToInsert);

		if (textToInsert.charCodeAt(textToInsert.length-1) === 10) {
			focusOffset = 0;
		} else {
			var lastLine = linesToInsert[linesToInsert.length-1];
			focusOffset = lastLine.length-r[1].length; 
		}
		return this.collapseTo(new Line(this.doc, lineElem), focusOffset);
	}

	/**
	 * Set the focusor anchor line text. If anchor is true then anchor line is used otherwise the fpcus line is used.
	 * If the selection is not collapsed it will be collapsed to focs or anchor point as s[ecified by the anchor argument
	 */
	this.setLineText = function(text, anchor) {
		this.collapse(anchor);
		this.focusLine.setText(text);
		if (this.focusOffset > text.length) {
			this.anchorOffset = this.focusOffset = text.length;
		}
		return this;
	}

	/**
	 * Replace a substring of the anchor or focus line. If charToRemove is 0 then the text is inserted otherwise 
	 * the substring starting at 'from' having 'charsToRemove' characters will be replaced by the given text.
	 * If the charsToRemove is negative then the replaced substring will be the one starting at from and ending at the end of the line.
	 */
	this.replaceLineText = function(text, from, charsToRemove, anchor) {
		this.collapse(anchor);
		var newText, offset = this.focusOffset, currentText = this.focusLine.getText();
		if (charsToRemove < 0) { // remove until the end of the line
			newText = currentText.substring(0, from) + text;
		} else  if (!charsToRemove) {
			newText = currentText.substring(0, from) + text + currentText.substring(from);
			if (offset >= from) {
				offset += text.length;
			}
		} else {
			newText = currentText.substring(0, from) + text + currentText.substring(from+charsToRemove);
			if (offset >= from) {
				if (offset < from + charsToRemove) {
					offset = from + text.length;
				} else {
					offset += text.length - charsToRemove;
				}
			}
		}

		if (offset < 0) {
			offset = 0;
		} else if (offset > newText.length) {
			offset = newText.length;
		}
		
		this.focusLine.setText(newText);
		this.anchorOffset = this.focusOffset = offset;
		
		return this;
	}

	this.split = function(hardBreak) {
		this.reverseIfBackwards();

		var r = this.getBoundingText();
		if (hardBreak && r[0].length > 0) {
			r[0] += '  ';
		}
		var lines = this.doc.formatter.split(this.anchorLine.elem, r[0], r[1], hardBreak);
		
		var lineElem = this.doc.formatter.replaceLines(this.anchorLine.elem, this.focusLine.elem, lines);
		if (lines.focusLine < lines.length-1) {
			// find the focus line
			var index = lines.focusLine;
			var i = lines.length-1;
			var line = lineElem;
			while (line && index < i) {
				line = line.previousElementSibling;
				i--;
			}
			if (line) {
				lineElem = line;
			}
		}

		return this.collapseTo(new Line(this.doc, lineElem), lines.focusOffset);
	}

	this.prefixLines = function(prefix) {
		this.reverseIfBackwards();
		if (!this.isCollapsed()) {
			var first = this.anchorLine.elem;
			var last = this.focusLine.elem;
			var end = last.nextElementSibling;
			var line = first;
			var linesToInsert = [];
			while (line && line !== end) {
				linesToInsert.push(prefix+line.textContent);
				line = line.nextElementSibling;
			}
			line = first.previousElementSibling;
			last = this.doc.formatter.replaceLines(first, last, linesToInsert);
			first = line ? line.nextElementSibling : last.parentNode.firstElementChild;
			this.anchorLine = new Line(this.doc, first);
			this.anchorOffset = 0;
			this.focusLine = new Line(this.doc, last);
			this.focusOffset = last.textContent.length-1;
		} else {
			var text = this.focusLine.getText();
			this.focusLine.setText(prefix+text);
			this.anchorOffset = this.focusOffset = this.focusOffset + prefix.length;
		}
		return this;
	}

	// return null if text doesn't starts with prefix, otherwise return the text without the prefix
	function removePrefix(text, prefix) {
		return text.substring(0, prefix.length) === prefix ? text.substring(prefix.length) : null;
	}

	this.unprefixLines = function(prefix) {
		this.reverseIfBackwards();
		if (!this.isCollapsed()) {
			var first = this.anchorLine.elem;
			var last = this.focusLine.elem;
			var end = last.nextElementSibling;
			var line = first;
			var linesToInsert = [];
			while (line && line !== end) {
				var text = line.textContent;
				var newText = removePrefix(text, prefix);
				if (newText === null) {
					newText = text;
				}
				linesToInsert.push(newText);
				line = line.nextElementSibling;
			}
			line = first.previousElementSibling;
			last = this.doc.formatter.replaceLines(first, last, linesToInsert);
			first = line ? line.nextElementSibling : last.parentNode.firstElementChild;
			this.anchorLine = new Line(this.doc, first);
			this.anchorOffset = 0;
			this.focusLine = new Line(this.doc, last);
			this.focusOffset = last.textContent.length-1;
		} else {
			var text = removePrefix(this.focusLine.getText(), prefix);
			if (text !== null) {
				this.focusLine.setText(text);
				this.anchorOffset = this.focusOffset = this.focusOffset < prefix.length ? 0 : this.focusOffset - prefix.length;
			}
		}
		return this;
	}

	this.removeNextCharacter = function() {
		if (!this.isCollapsed()) {					
			return this.removeText();
		}
		var text = this.focusLine.getText();
		if (this.focusOffset >= text.length-1) { // merge with next line
			var line = this.focusLine.next();
			if (line) {
				var nextText = line.getText();
				var lineElem = this.doc.formatter.replaceLines(this.focusLine.elem, line.elem, [removeTrailingLf(text) + nextText] );
				line._setElement(lineElem);
				this.collapseTo(line, this.focusOffset);
			}
		} else {
			//TODO setText is not undoable ...
			this.focusLine.setText(text.substring(0, this.focusOffset) + text.substring(this.focusOffset+1));
		}
		return this;
	}

	this.removePreviousCharacter = function() {
		if (!this.isCollapsed()) {
			return this.removeText();
		}
		var focusLine = this.focusLine;
		var text = focusLine.getText();
		if (!text || text === '\n') {
			// remove this line and put focus on end of previous line
			var line = focusLine.previous();
			if (line) {
				this.doc.formatter.removeLine(focusLine.elem);
				this.collapseToEnd(line);
			}			
		} else if (this.focusOffset === 0) {
			// merge with previous line
			var line = focusLine.previous();
			if (line) {
				var prevText = removeTrailingLf(line.getText());
				var lineElem = this.doc.formatter.replaceLines(line.elem, this.focusLine.elem, [prevText + text]);
				line._setElement(lineElem);
				this.collapseTo(line, prevText.length);
			}
		} else {
			//TODO setText is not undoable ...
			this.focusLine.setText(text.substring(0, this.focusOffset-1) + text.substring(this.focusOffset));
			this.anchorOffset = this.focusOffset = this.focusOffset-1;
		}

		return this;		
	}

	this.removeNextWord = function() {
		if (!this.isCollapsed()) {
			return this.removeText();
		}
		var text = this.focusLine.getText();
		var r = __findWord(text, this.focusOffset, false);
		if (!r[1] && r[0] === text.length) { 
			// no word found and we are at end of line - merge with next line
			var nextLine = this.focusLine.next();
			if (nextLine) {
				text = nextLine.getText();
				r = __findWord(text, 0, false);
				this.focusLine = nextLine;
				this.focusOffet = r[0];
				return this.removeText();
			}
		}
		// update the current line
		this.focusOffset = r[0];
		return this.removeText();
	}

	this.removePreviousWord = function() {
		if (!this.isCollapsed()) {
			return this.removeText();
		}
		var text = this.focusLine.getText();
		var r = __findWord(text, this.focusOffset, true);
		if (!r[1] && r[0] === 0) { 
			// no word found and we are at the beginning of line - merge with previous line
			var prevLine = this.focusLine.previous();
			if (prevLine) {
				text = prevLine.getText();
				r = __findWord(text, text.length, true);
				this.focusLine = prevLine;
				this.focusOffset = r[0];
				return this.removeText();
			}
		}
		// update the current line
		this.focusOffset = r[0];
		return this.removeText();
	}


	this.takeSnapshot = function() {
		var snapshot = new Snapshot();
		snapshot.focus = this.save();
		snapshot.text = this.doc.getText();
		return snapshot;
	}

	// get absolute coordinates 
	this.getCaretXY = function() {
		var focusPoint = findTextNodeAt(this.focusLine.elem, this.focusOffset);
		// insert temp element
		var node = focusPoint[0];
		var text = node.nodeValue;
		var leftText = text.substring(0, focusPoint[1]);
		var rightText = text.substring(focusPoint[1]) || "\u200b"; // use zero width space character
		var span = document.createElement('SPAN');
		span.appendChild(document.createTextNode(rightText));
		node.nodeValue = leftText;
		if (node.nextSibling) {
			node.nextSibling.insertBefore(span, node.nextSibling);
		} else {
			node.parentNode.appendChild(span);
		}
		// get span coordinates (IE>8)
		var rect = span.getBoundingClientRect();
		var xy = [rect.left + getScrollX(), rect.top + getScrollY()];
		// remove temp element
		span.parentNode.removeChild(span);
		node.nodeValue = text;
		// restore selection
		this.select();
		return xy;
	}

}

Qed.Range = Range;

//TOOD remove
console.trace = function() {};
//console.trace = console.log;

function MarkdownFormatter() {

	var REDRAW_ACTIONS = {	 
		' ': 'redrawActiveLine', // required by '1. '
		'\t':'redrawActiveLine',
		'#': 'redrawActiveLine',
		'`': 'redrawActiveLine',
		'*': 'redrawActiveLine', 
		'_': 'redrawActiveLine', 
		'~': 'redrawActiveLine',
		'<': 'redrawActiveLine',
		'>': 'redrawActiveLine',
		'=': 'redrawActiveLine',
		'-': 'redrawActiveLine',
		'[': 'redrawActiveLine',
		']': 'redrawActiveLine',
		'(': 'redrawActiveLine',
		')': 'redrawActiveLine',
		'!': 'redrawActiveLine'
	};



var SPLIT_TRANSFORMERS = {
	"li": function(lines) {
		var line0 = lines[0].trim();
		if (line0 === '*' || line0 === '-' || line0 === '+' || /^[0-9]+\.$/.test(line0)) {
			lines[0] = '';
			return;
		}
		var match = LI_BULLET.exec(lines[0]);
		if (match) {
			lines[1] = match[0] + lines[1];
			lines.focusOffset = match[0].length;
		} else {
			match = LI_NUMBER.exec(lines[0]);
			if (match) {
				var number = match[1];
				var prefix = match[0].replace(number, (parseInt(number)+1).toString());
				lines[1] = prefix + lines[1];
				lines.focusOffset = match[0].length;
			}
		}
	},
	"quote": function(lines, hardBreak) {
		var match = QUOTE_PREFIX.exec(lines[0]);
		if (match) {
			if (hardBreak && match[0].length === lines[0].length) { // close block quote
				lines[0] = '';
			} else {
				lines[1] = match[0] + lines[1];
				lines.focusOffset = match[0].length;
			}
		}
	},
	"code": function(lines, hardBreak) {
		var match = /^[ \t]+/.exec(lines[0]);
		if (match) {
			if (hardBreak && match[0].length === lines[0].length) { // close block quote
				lines[0] = '';
			} else {
				lines[1] = match[0] + lines[1];
				lines.focusOffset = match[0].length;
			}
		}
	},
	"alt-code": function(lines) {
		//TODO
	}
}

function createLineElement() {
	return document.createElement('DIV');
}

function createEmptyLineElement() {
	var line = document.createElement("DIV");
	line.appendChild(document.createTextNode("\n"));
	return line;
}

function isNextInCodeBlock(line) {
	if (!line) {
		return false;
	}
	var val = line.getAttribute('data-block');
	return val && val !== 'end';
}

function getLineType(line) {
	return line.getAttribute('data-line-type');
}

function isHeadingUnderline(line) {
	return line.getAttribute('data-line-type') === 'alt-heading';
}


function isNodeInMarker(root, node) {
	while (node && node !== root) {
		if (node.nodeName.toUpperCase() === "I") {
			return true;
		}
		node = node.parentNode;
	}
	return false;
}

/**
 * Adjust contextual formatting on line update/insertion.
 * Return true if the inserted line is part of a code block
 */
function lineUpdated(line, prevLine) {
	if (!prevLine) {
		return;
	}
	if (isLineEmpty(line)) {
		prevLine.removeAttribute('data-heading-title');
		var nextLine = line.nextElementSibling;		
		if (nextLine && isHeadingUnderline(nextLine)) {
			var level = nextLine.getAttribute('data-level') || '1';
			removeClass(nextLine, 'qed-h'+level+'-alt');
			//TODO if more than - then create a hr
		}
	} else if (isHeadingUnderline(line)) {
		if (!isLineEmpty(prevLine)) {
			var level = line.getAttribute('data-level') || '1';
			addClass(line, 'qed-h'+level+'-alt');
			prevLine.setAttribute('data-heading-title', level);
		}
	} else {
		// make sure the previous line is not a datat heading title.
		prevLine.removeAttribute('data-heading-title');
	}
}

function refreshLine(parent, line, prevLine) {
	var newLine = formatLine(prevLine, line.textContent);
	parent.replaceChild(newLine, line);
	return newLine;
}

/**
 * If code blocks are broken at the given line then reformat all the lines  starting with the given line (until the end of the document) using the correct block formatter.
 * Return back the line from were the fix started. That line instance may be different from the given line if the line was reformatted.
 */ 
function fixCodeBlocks(line, prevLine) {
	var codeBlock = isNextInCodeBlock(prevLine);
	var val = line.getAttribute('data-block');
	if (!!codeBlock === !!val) {
		return line; // nothing to do
	}
	var parent = line.parentNode;
	var markerLine = prevLine;
	do {
		line = refreshLine(parent, line, prevLine);
		lineUpdated(line, prevLine);
		prevLine = line;
		line = line.nextElementSibling;		
	} while (line);
	return markerLine ? markerLine.nextElementSibling : parent.firstElementChild;
}

// ---------------------------- Public API --------------------------------

/**
 * Iniialize the document (by appending an empty line if empty).
 * Return null if document is not empty or the appended empty line if empty.
 */
this.initDocument = function(docElem) {
	if (!docElem.firstElementChild) {
		emptyElement(docElem);
		var lineElem = createEmptyLineElement();
		docElem.appendChild(lineElem);
		return lineElem;
	}
}

/**
 * Return an array with the lines resulted from the split. 
 * The returned will contains 2 additional fields:
 * 1. focusLine - the line index (in the returned array) which should gain the focus.
 * 2. focusOffset - the offset inside the line where the caret should be moved. 
 * 
 * @param line - the line being split
 * @param prefix - the text prefix being split
 * @param suffix - the text suffix being split
 */
this.split = function(line, prefix, suffix, hardBreak) {
	var lineType = getLineType(line);
	var result = [prefix, suffix];
	result.focusLine = 1;
	result.focusOffset = 0;
	var transformer = SPLIT_TRANSFORMERS[lineType];
	if (transformer) {
		transformer(result, hardBreak);
	}
	return result;	
}

/** 
 * Update the given line element. If newText is not null then replace the line content with this text. 
 * If newText is null or undefined then the line is refreshed. 
 * Returns the updated line element.
 * 
 * @param line the line object to update
 * @param newText - optional: the new text to use as the line content
 * @return the updated line element
 */
this.updateLine = function(lineElem, newText) {
	if (newText == null) { // undefined or null
		newText = lineElem.textContent;
	}
	var prevLine = lineElem.previousElementSibling;
	var nextLine = lineElem.nextElementSibling;	
	var line = formatLine(prevLine, newText);
	lineUpdated(line, prevLine);
	// simulate lineUpdate on the next line if any
	if (nextLine) {
		lineUpdated(nextLine, line);
		fixCodeBlocks(nextLine, line);
	}
	// TODO should we replace the line now?
	// lineElem.parentNode.replaceChild(line, lineElem);
	return line;
}

/**
 * Insert the given lines before 'nextLine' line.
 * Returns the last inserted line. If no linesToInsert are given nothing is done and the nextLine is returned back.
 */
this.insertLines = function(nextLine, linesToInsert) {
	if (!linesToInsert || linesToInsert.length === 0) {
		return nextLine;
	}
	var parent = nextLine.parentNode;
	var prevLine = nextLine.previousElementSibling;
	for (var i=0,len=linesToInsert.length; i<len; i++) {
		var lineElem = formatLine(prevLine, linesToInsert[i]);
		parent.insertBefore(lineElem, nextLine);
		lineUpdated(lineElem, prevLine);		
		prevLine = lineElem;
	}
	// simulate lineUpdate on the 'nextLine'
	lineUpdated(nextLine, prevLine);
	fixCodeBlocks(nextLine, prevLine);
	return prevLine;
}

/**
 * Append the given lines and return the last appended line.
 * Returns null if no lines to insert was specified.
 */
this.appendLines = function(docElem, linesToInsert) {
	var prevLine = docElem.lastElementChild;	
	for (var i=0, len = linesToInsert.length; i<len; i++) {
		//TODO check headlines and code blocks context
		var lineElem = formatLine(prevLine, linesToInsert[i]);
		docElem.appendChild(lineElem);
		lineUpdated(lineElem, prevLine);
		prevLine = lineElem;
	}
	return prevLine;
}

/**
 * Replace a range of lines with the given markdown text. If no replacement is given then the lines are removed.
 * The lines to remove are a contigous range of lines starting with firstLine and ending with lastLine.
 * The method returns the last inserted line element or in the case when no insert was done the next line after the last removed line.
 * In the case where no lines exists after the last removed line then an empty line is appended and returned.
 * Thus, this method never returns null.
 * 
 * @param doc the document object
 * @param linesToRemove - an array of line elements that need to be removed from the document. 
 *        If null or empty no lines will be removed. This argument is never null
 * @param linesToInsert - if given or not null an array of lines in raw markdown text 
 *        to be inserted in the place of the removed lines.
 * @return the last inserted line element or in the case when no insert was done the next line after the last removed line. never returns null.
 */
this.replaceLines = function(firstLine, lastLine, linesToInsert) {
	var parent = firstLine.parentNode;
	var nextLine = removeSiblingElements(firstLine, lastLine);
	if (linesToInsert && linesToInsert.length > 0) {
		if (nextLine) {
			nextLine = this.insertLines(nextLine, linesToInsert);	
		} else {
			nextLine = this.appendLines(parent, linesToInsert);
		}		
	} else if (!nextLine) {
		nextLine = createEmptyLineElement();
		parent.appendChild(nextLine);
		// simulate lineUpdate on the 'nextLine'
		lineUpdated(nextLine, nextLine.previousElementSibling);		
	} else {
		// simulate lineUpdate on the 'nextLine'
		var prevElem = nextLine.previousElementSibling;
		lineUpdated(nextLine, prevElem);
		nextLine = fixCodeBlocks(nextLine, prevElem);
	}
	return nextLine;
}


/**
 * Update the whole document content and return the last line
 * If linesToInsert is null or empty then clear the document.
 */
this.updateDocument = function(docElem, linesToInsert) {
	emptyElement(docElem);
	if (!linesToInsert || linesToInsert.length === 0) {
		var line = createEmptyLineElement();
		docElem.appendChild(line);
		return line;
	}
	return this.appendLines(docElem, linesToInsert);
}

/**
 * Remove the given range of sibling lines and update surronding lines if needed
 * @returns the next line after the last removed line. If no next line exists (end of docuemnt) then an empty line 
 * is appended tot he docuemnt and returned.
 * Thus this method never returns null.
 */
this.removeLines = function(firstLine, lastLine) {
	return this.replaceLines(firstLine, lastLine, null);
}

/**
 * Remove the line and update surrounding lines if needed
 */
this.removeLine = function(line) {
	return this.replaceLines(line, line, null);
}


this.toHTML = function(text) {
	return marked(text); // marked must be included in the page 
}

this.isLineInvalidated = function(lineElem, sel, charCode) {
	if (REDRAW_ACTIONS[charCode]) {
		return true;
	}

	if (isNodeInMarker(lineElem, sel.focusNode)) {
		// redraw line: 
		// 1. text typed in markers must be moved outside. 
		// 2. f special char is typed in marked the line must be reformated
		return true;
	}

	// check surrounding context: if prev charCode or next char code is a redraw actions trigger redraw
	var nodeText = sel.focusNode.nodeValue;
	if (nodeText.length > 1) {
		if (REDRAW_ACTIONS[nodeText.charAt(sel.focusOffset)] || REDRAW_ACTIONS[nodeText.charAt(sel.focusOffset-2)]) {
			return true;				
		}
	} else { // only one char in text node - redraw since it is too difficult to check changes
		return true;
	}

	var lineType = getLineType(lineElem);
	if (lineType === "alt-heading") {
		return true;
	}

	return false;
}

// ------------------------- formatting implementation ------------------

	//var HEADING =  /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/;
	//var CODE = /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/;

	var ESCAPE = /^\\([\\`*{}\[\]()#+\-.!_>])/;
	var BOLD = /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/;
	var ITALIC = /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/;
	var CODE = /^`([^`]+)`/;
	var DEL = /^~~([^~]+)~~/;
	var LINK = /^!?\[([^\]]+)\]\(([^\)]+)\)/;
	var LINK_REF = /^\[([^\]]+)\](\s?)\[([^\]]*)\]/;
	var LINK_DEF = /^\[([^\]]+)\]: /;
	var URL=/^(https?:\/\/[^\s<"']+[^<.,:;"')\]\s])/;
	var TAG = /^<(\/?[A-Za-z]+)( +[^>]*)>/; //TODO
	var TEXT = /^[\s\S]+?(?=[\\<>!\[_*`~]|https?:\/\/| {2,}\n|$)/;


	// ====== line/block patterns =========
	var CODE_FENCE = /^``` *(?:\S+)? *(?=\n|$)/;
	var HEADING= /^ *(#{1,6})/;
	var LI_NUMBER = /^\s*([1-9]+[0-9]*)\. +/;
	var LI_BULLET = /^\s*([*+-]) +/;
	var QUOTE_PREFIX = /^ *> */;
	var REPLY = /^ *(?:> *)+/;
	var ALT_H1 = /^=+\n?$/;
	var ALT_H2 = /^-+\n?$/;

	var LT_GT_REPLACE = /[<>]/g;

	function printSpan(type, content) {
		return "<span data-token-type='"+type+"' class='qed-style-"+type+"'>"+content+"</span>";
	}

	function printMarker(content) {
		return "<i>"+content+"</i>";
	}

	function printTagEscape(marker) {
		return "<i>"+marker+"</i>"; // TODO use <var> ?
	}

	function printTag(name, content) {
		return "<i><var>&lt;"+name+"</var>"+content+"<var>&gt;</var></i>"; // TODO use <var> ?
	}

	function highlightEscape(ch) {
		return "<i>\\</i>"+ch;
	}

	function highlightStyle(name, marker, text) {	
		return printSpan(name, "<i>"+marker+"</i>"+text+"<i>"+marker+"</i>");
	}



	// skip all chars with code <= 32	
	function skipSpaces(text, offset) {
		var len = text.length;
		while (offset < len && text.charCodeAt(offset) <= 32) offset++;
		return offset;
	}

	function formatLine(prevLine, lineText) {
		//TODO
		var codeBlock = isNextInCodeBlock(prevLine);
		if (codeBlock) {
			var line = formatCodeBlockLine(lineText);
		} else {			
			var line = formatMarkdownLine(prevLine, lineText);
		}
		addClass(line, 'qed-line');
		return line;
	}

	// format code lines inside code blocks (```)
	function formatCodeBlockLine(lineText) {
		if (!lineText || lineText  === "\n") {
			var line = createEmptyLineElement();
			line.setAttribute("data-block", "line");
			return line;
		}				
		if (lineText.charCodeAt(lineText.length-1) !== 10) {
			lineText += '\n';
		}
		var line = createLineElement();

		// test if ```
		var match = CODE_FENCE.exec(lineText);
		if (match) {
			return formatCodeFence(line, lineText, true);
		} else {
			line.setAttribute("data-block", "line");
			line.innerHTML = formatCodeLineContent(lineText);
		}
		return line;
	}

	function formatMarkdownLine(prevLine, lineText) {
		if (!lineText || lineText  === "\n") {
			return createEmptyLineElement();
		}				
		if (lineText.charCodeAt(lineText.length-1) !== 10) {
			lineText += '\n';
		}
		
		var line = createLineElement();

		var  i = skipSpaces(lineText, 0);
		var code = lineText.charCodeAt(i);
		var isTab = lineText.charCodeAt(0) === 9;
		var isPrevLineBlank, prevLineType;
		if (prevLine) {
			isPrevLineBlank = isLineBlank(prevLine);
			prevLineType = prevLine.getAttribute('data-line-type');
		} else {
			isPrevLineBlank = true;
			prevLineType = null;
		}
		if (i >= 4 || isTab) { // handle line indentation
			// 0. IF no previous line => this is a code line
			// 1. ELSE IF previous line is a code line => this is a code line
			// 2. ELSE IF previous line is a heading => this is a code line
			// 3. ELSE IF previous line is an empty line => this is a code line (the first one)
			// 4. ELSE not a code line
			if (!prevLine // no previous line 
				|| prevLineType === 'code' // prev line is a code line
				|| prevLineType === 'heading' || prevLineType === 'alt-heading' // prev line is a code line
				|| isPrevLineBlank // prev line is blank
				) {
				// a code line (indended line)
				return formatCodeLine(line, lineText, i, isTab);
			}
		}

		switch (code) {
			case 35: // #
				var match = HEADING.exec(lineText);
				if (match) {
					return formatHeading(line, lineText, match[0].length, match[1].length)
				}
				break;
			case 45: // -
				var match;
				if (!isPrevLineBlank && prevLineType !== 'heading') {
					match = ALT_H2.exec(lineText);
					if (match) {
						return formatAltHeading(line, lineText, 2);
					}
				}
				if (lineText.charCodeAt(i+1) === 32) { // a space
					return formatListItem(line, lineText, i+2, '-');
				}
				break;
			case 42: // *
				if (lineText.charCodeAt(i+1) === 32) { // a space
					return formatListItem(line, lineText, i+2, '*');
				}
				break;
			case 43: // +
				if (lineText.charCodeAt(i+1) === 32) { // a space
					return formatListItem(line, lineText, i+2, '+');
				}		
				break;
			case 62: // >
				var match = REPLY.exec(lineText);
				if (match) {
					return formatQuoteItem(line, lineText, match[0].length);
				}
				break;
			case 96: // `
				var match = CODE_FENCE.exec(lineText);
				if (match) {
					return formatCodeFence(line, lineText);
				}
				break;
			case 61: // =
				if (!isPrevLineBlank && prevLineType !== 'heading') {
					var match = ALT_H1.exec(lineText);
					if (match) {
						return formatAltHeading(line, lineText, 1);
					}
				}
				break;
			default: 
				if (code < 58 && code > 48) {
					// may be an ordered list item
					var match = LI_NUMBER.exec(lineText);
					if (match) {
						return formatListItem(line, lineText, match[0].length, match[1]);
					}
				}
				break;
		}
		return formatStyledLine(line, lineText, null);
	}

	function formatCodeFence(line, lineText, endBlock) {
		line.setAttribute('data-line-type', 'alt-code');
		line.setAttribute('data-block', endBlock ? 'end' : 'start');
		line.innerHTML = printMarker(lineText.substring(0,3)) + formatCodeLineContent(lineText.substring(3));
		return line;
	}

	function formatCodeLine(line, lineText, offset, isTab) {
		var tab = isTab ? "tab" : "spaces";
		line.setAttribute('data-line-type', 'code');
		line.setAttribute('data-indent', tab);
		addClass(line, 'qed-code-line');
		line.innerHTML = printMarker(lineText.substring(0, offset)) + formatCodeLineContent(lineText.substring(offset));
		return line;
	}

	function formatAltHeading(line, lineText, level) {
		// the editor must add the  class='qed-h"+level+"' to activate head styling
		line.setAttribute('data-line-type', 'alt-heading');
		line.setAttribute('data-level', level);
		line.innerHTML = lineText;
		return line;
	}

	function formatHeading(line, lineText, offset, level) {
		line.setAttribute('data-line-type', 'heading');
		line.setAttribute('data-level', level);
		addClass(line, "qed-h"+level);
		line.innerHTML = printMarker(lineText.substring(0, offset)) + formatLineContent(lineText.substring(offset));
		return line;
	}

	function formatListItem(line, lineText, offset, marker) {
		// we include leading spaces and first trailing space in the marker to be able to invalidate the line when typing before the marker
		line.setAttribute('data-line-type', 'li');
		line.setAttribute('data-bullet', marker);
		line.innerHTML = printMarker(lineText.substring(0, offset)) + formatLineContent(lineText.substring(offset));
		return line;
	}

	function formatQuoteItem(line, lineText, offset) {
		line.setAttribute('data-line-type', 'quote');
		line.innerHTML = printMarker(lineText.substring(0, offset)) + formatLineContent(lineText.substring(offset));
		return line;
	}


	function formatStyledLine(line, lineText, style) {
		if (style) {
			addClass(line, style);
		}
		var html = formatLineContent(lineText);
		// handle hard brs
		var len = html.length;
		if (html.length > 2 && html.charCodeAt(len-3) === 32 && html.charCodeAt(len-2) === 32 && html.charCodeAt(len-1) === 10) {
			html = html.substring(0,len-3)+"<i class='qed-br'>  </i>\n";
		}
		line.innerHTML = html;
		return line;
	}

	function printLink(matchedText, text, data) {
		var type, marker;
		if (matchedText.charCodeAt(0) === 33) { // n image
			type = "image";
			marker = "![";		
		} else {
			type = "link";
			marker = "[";		
		}
		return "<span data-token-type='"+type+"'><i>"+marker+"</i><span class='qed-link-text'>"+text+"</span><i>](</i><span class='qed-link-url'>"+data+"</span><i>)</i></span>";
	}

	function printLinkRef(matchedText, text, spaces, data) {
		return "<span data-token-type='link-ref'><i>[</i><span class='qed-link-text'>"+text+"</span><i>]"+spaces+"[</i><span class='qed-link-url'>"+data+"</span><i>]</i></span>";
	}

	function printLinkDef(matchedText, key) {
		return "<span data-token-type='link-def'><i>[</i><span class='qed-link-key'>"+key+"</span><i>]: </i></span>";
	}

	function formatCodeLineContent(lineText) {
		// we only need to escape < and >
		//TODO
		//return escapeTagMarkers(lineText);
		return lineText.replace(LT_GT_REPLACE, function(match) {
			return printTagEscape(match);
		});
	}

	function formatLineContent(lineText) {	
		var out = '';
		var match = null;
		var matchedText = null;
		var input = lineText;

		while (true) {
			// text
			console.trace('TRYING', input);
			// tag support
			var firstChar = input.charCodeAt(0);
			if (firstChar ===  60 || firstChar === 62) { // < and >
				console.trace("TAG MARKER ->", input);
				/*
				// test if a tag
				if (match = TAG.exec(input)) {
					// a tag 
					matchedText = match[0];				
					out += printTag(match[1], match[2]);
					input = input.substring(matchedText.length);	
				} else {
					*/
					// a < or > symbol
					out += printTagEscape(firstChar ===  60 ? '<' : '>');			
					input = input.substring(1);
				//}
				continue;
			}
			// escape -> highlight the leading \
			if (match = ESCAPE.exec(input)) {
				matchedText = match[0];
				console.trace('ESCAPE MATCHED', matchedText);
				console.trace(input, input.length, match)
				out += highlightEscape(match[1]);
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);
				continue;
			}
			// bold
			if (match = BOLD.exec(input)) {			
				matchedText = match[0];
				console.trace('BOLD MATCHED', matchedText);
				out += highlightStyle('strong', match[1] ? '__' : '**', match[1] || match[2]);
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);
				continue;
			}
			// italic
			if (match = ITALIC.exec(input)) {
				matchedText = match[0];
				console.trace('ITALIC MATCHED', matchedText, match);
				out += highlightStyle('em', match[1] ? '_' : '*', match[1] || match[2]);
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);			
				continue;
			}
			// code		
			if (match = CODE.exec(input)) {
				matchedText = match[0];
				console.trace('CODE MATCHED', matchedText, match);
				// escape < and > in inline code!
				out += highlightStyle('code', '`', escapeTagMarkers(match[1]));
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);			
				continue;
			}
			// url
			if (match = URL.exec(input)) {
				matchedText = match[0];
				console.trace('URL MATCHED', matchedText, match);
				out += printSpan("url", matchedText);
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);			
				continue;
			}
			// link
			if (match = LINK.exec(input)) {
				matchedText = match[0];
				console.trace('LINK MATCHED', matchedText, match);
				out += printLink(matchedText, match[1], match[2]);
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);			
				continue;
			}
			// linkref
			if (match = LINK_REF.exec(input)) {
				matchedText = match[0];
				console.trace('LINK_REF MATCHED', matchedText, match);
				out += printLinkRef(matchedText, match[1], match[2], match[3]);
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);			
				continue;
			}
			// linkdef
			if (match = LINK_DEF.exec(input)) {
				matchedText = match[0];
				console.trace('LINK_DEF MATCHED', matchedText, match);
				out += printLinkDef(matchedText, match[1]);
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);			
				continue;
			}
			// del		
			if (match = DEL.exec(input)) {
				matchedText = match[0];
				console.trace('DEL MATCHED', matchedText, match);
				out += highlightStyle('del', '~~', match[1]);
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);			
				continue;
			}
			// fallback on text
			if (match = TEXT.exec(input)) {
				matchedText = match[0];
				console.trace('TEXT MATCHED', matchedText);
				out += matchedText;
				if (input.length === matchedText.length) {
					break;
				}
				input = input.substring(matchedText.length);
				console.trace("INPUT ->", input);
				continue;
			}

			if (input) {
				console.trace('ERROR', input);
					throw new Error("Infinite loop detected while higlighting inline styles on: \""+lineText
					+"\". Remaining input: \""+input+"\". Output: \""+out+"\"");
			}
		}

		return out;

	}

}



// ========================== Utilities =======================

function isLineEmpty(line) {
	var first = line.firstChild;
	if (!first.nextSibling && first.nodeType === 3) {
		var val = first.nodeValue;
		return !val || val === '\n';
	}
	return false;
}

// test if the line contains only white spaces
function isLineBlank(line) {
	var node = findFirstTextNode(line);
	while (node) {
		if ( node.nodeValue.trim() ) {
			// found a text node containing other characters than blanks
			return false;
		}
		node = nextTextNode(line, node);
	}
	return true;
}

function normalizeLf(text) {
	return text.replace(/\r\n?/g, '\n');
}

function removeTrailingLf(text) {
	if (text.charCodeAt(text.length-1) === 10) {
		text = text.substring(0, text.length-1);
	}
	return text;
}

function setCaretOffset(sel, root, offset) {
	if (offset >= 0) {
		var r = findTextNodeAt(root, offset);
		if (r) {
			sel.collapse(r[0], r[1]);
			return true;
		}
	}
	// set selection at end
	var textNode = findLastTextNode(root);
	if (textNode) {
		var text = textNode.nodeValue;
		if (text.length > 0) {
			var offset = text.length;
			if (text.charCodeAt(text.length-1) === 10) {
				offset--;
			}
			sel.collapse(textNode, offset);
		} else {
			sel.collapse(textNode, 0);
		}
		return true;
	}
	return false;
}


// =========================== Line API ========================



function Line(doc, elem) {
	this.doc = doc;
	this.elem = elem;
	this.lineIndex = -1;

	this.getLineIndex = function() {
		if (this.lineIndex < 0) {
			if (this.elem.parentNode) {
				this.lineIndex = indexOfChildElement(this.elem);
			}
		}
		return this.lineIndex;
	}

	this.next = function() {
		var node = this.elem.nextElementSibling;
		return node ? new Line(this.doc, node) : null;
	}

	this.previous = function() {
		var node = this.elem.previousElementSibling;
		return node ? new Line(this.doc, node) : null;
	}

	/**
	 * Get the offset in the document text where this line starts or -1 if it cannot be found
	 */
	this.getLineOffset = function() {
		var node = findFirstTextNode(this.elem);
		return node ? getAbsoluteOffset(this.doc.elem, node, 0) : -1;
	}

	/**
	 * Get the caret offset if this line has the focus otherwise returns -1
	 */
	this.getCaretOffset = function() {
		var sel = this.doc.getSelection();
		if (sel.focusNode) {
			return getAbsoluteOffset(this.elem, sel.focusNode, sel.focusOffset);
		} else {
			return -1;
		}
	}

    /**
     * Move the focus caret at the giuven text offset in that line. 
     * If offset is negative put the caret at the end of line (but before the \n charcater)
     */
	this.setCaretOffset = function(offset) {
		return setCaretOffset(this.doc.getSelection(), this.elem, offset);
	}
	
	/**
	 * return the \n offset in this line
	 */
	this.getEndOfLineOffset = function() {
		var text = this.getText();
		return text.charCodeAt(text.length-1) === 10 ? text.length-1 : text.length;
	}

	this.getText = function() {
		return this.elem.textContent;
	}

	this.attr = function(key, value) {
		switch(arguments.length) {
			case 1: return this.elem.getAttribute(key);
			case 2: 
			if (value == null) {
				this.elem.removeAttribute(key);
			} else {
				this.elem.setAttribute(key, value);
			}
		}	
		return this;
	}

	// Must not replace the element - should only set it and flush the cache!!!
	this._setElement = function(elem) {
		this.lineIndex = -1;
		if (this.elem.parentNode) {
			var oldElem = this.elem;
			this.elem.parentNode.replaceChild(elem, this.elem);
			this.elem = elem;
			return oldElem;
		} else {
			this.elem = elem;
			return null;
		}
	}	

	this.setText = function(text) {
		this._setElement(this.doc.formatter.updateLine(this.elem, text));
		return this;
	}

	this.scrollToReveal = function() {
		scrollTo(this.doc.elem, this.elem);
	}

}

function Document(elem, formatter) {
	this.elem = elem;
	this.formatter = formatter;

	/* ------------------------- INTERNAL API -------------------------- */

	/**
	 * Get the line element containing the given node.
	 * @return the line or null if the node is not located in a line.
	 */
	this.getLineElement = function(node) {
		var root = this.elem;
		var p = node;
		while (p && p.parentNode !== root) {
			p = p.parentNode;
		}
		return p && p.nodeType === 1 ? p : null;
	}

	this.getFirstLineElement = function() {
		return this.elem.firstElementChild;
	}

	this.getLastLineElement = function() {
		return this.elem.lastElementChild;
	}

	/* -------------------------- PUBLIC API --------------------------- */

	/**
	 * Get the current selection.
	 */
	this.getSelection = function() {
		return window.getSelection();
	}

	this.createRange = function() {
		return new LineRange(this);
	}

	this.getFocusRange = function() {
		return new LineRange(this).fromSelection(this.getSelection());
	}

	this.getFirstLine = function() {
		var elem = this.getFirstLineElement();
		return elem ? new Line(this, elem) : null;
	}

	this.getLastLine = function() {
		var elem = this.getLastLineElement();
		return elem ? new Line(this, elem) : null;
	}

	this.getLineAt = function(index) {
		var line = getChildElement(this.elem, index);
		return line ? new Line(this, line) : null;
	}

	/**
	 * Get the line containing the given node or null if none
	 */
	this.getLine = function(node) {
		node = this.getLineElement(node);
		return node ? new Line(this, node) : null;
	}

	this.getFocusLine = function() {
		var node = getSelection().focusNode;
		if (node) {
			node = this.getLineElement(node);
			return node ? new Line(this, node) : null;
		}
		return null;
	}

	/**
	 * Get the markdown text of the document. Similar to getElement().textContent
	 */
	this.getText = function() {
		return this.elem.textContent;
	}

	/**
	 * Set the markdown text of the document. Will trigger a redraw of all lines.
	 */
	this.setText = function(text) {
		// removeTrailingLf is needed to avoid appending an empty line at the end.
		// This way setText(getText()) will produce the same text (will refresh the document and will not change its content)
		var lines = text && text !== '\n' ? removeTrailingLf(normalizeLf(text)).split("\n") : null;
		this.formatter.updateDocument(this.elem, lines);
		return this;
	}

	/**
	 * Remove all content and set the caret on the first (and only) empty line at offset 0.	 
	 */
	this.clear = function() {
		this.setTex(null);
		this.getLastLine().setCaretOffset(0);
		return this;
	}


	function toTextSelectionPoint(root, element, offset) {		
		var node = getChildNode(element, offset);
		if (!node) {
			node = findLastTextNode(element);
			if (node) {
				return [ node, node.nodeValue.length ];
			}
			node = nextTextNode(root, element);
			if (node) {
				return [ node, 0 ];	
			}
			node = previousTextNode(root, element);
			if (node) {
				return [ node, node.nodeValue.length ];
			}
			return null;
		} else if (node.nodeType !== 3) { // not a text node
			element = node;
			node = findFirstTextNode(element);
			if (node) {
				return [ node, 0 ];
			}
			node = nextTextNode(root, element);
			if (node) {
				return [ node, 0 ];	
			}
			node = previousTextNode(root, element);
			if (node) {
				return [ node, node.nodeValue.length ];
			}
			return null;
		} else {
			return [ node, 0 ];
		}
	}

	/** 
	 * convert the given selection to a text selection if not already a tetx selection and return the new selection.
	 * If not converted the same selection is returned. 
	 * After calling this method the selection will be a text selection.
	 * Note that this emthod may clear the document if the doc is broken (no text node is found in the document)
	 */ 
	this.toTextSelection = function(sel) {
		var anchorPoint, focusPoint;
		if (sel.anchorNode.nodeType !== 3) {
			anchorPoint = toTextSelectionPoint(this.elem, sel.anchorNode, sel.anchorOffset);
			if (!anchorPoint) {
				console.error('broken document - no text node found', this.elem.innerHTML);
				this.clear();
				return this.getSelection();
			}
		}
		if (sel.anchorNode.nodeType !== 3) {
			focusPoint = toTextSelectionPoint(this.elem, sel.focusNode, sel.focusOffset);
			if (!focusPoint) {
				console.error('broken document - no text node found', this.elem.innerHTML);
				this.clear();
				return this.getSelection();
			}
		}

		if (anchorPoint || focusPoint) {
			var range = __createRange();
			if (anchorPoint) {
				range.setStart(anchorPoint[0], anchorPoint[1]);
			} else {
				range.setStart(sel.anchorNode, sel.anchorOffset);
			}
			if (focusPoint) {
				range.setEnd(focusPoint[0], focusPoint[1]);
			} else {
				range.setEnd(sel.focusNode, sel.focusOffset);
			}
			sel.removeAllRanges();
			sel.addRange(range);
		}
		return sel;
	}

	this.adjustFocus = function() {

		var sel = this.getSelection();
		if (!sel.focusNode || !sel.anchorNode) {
			return;
		}

		// on FF Select ALL is selecting the root element (not a text selection)
		// on IE we also may get non text selections
		// convert the current selection to a text selection
		sel = this.toTextSelection(sel);

		// now selection is a text selection.
		// if the selection is collapsed we need to 
		if (sel.isCollapsed) {
			// we need to treat 2 special cases
			// 1. the text node is direclty a child of the document -> move it into a line
			// 2. on FF or IE the caret may be after the \n character
			var focusNode = sel.focusNode;
			if (focusNode.parentNode == this.elem) {
				var nextLine = focusNode.nextElementSibling;
				if (nextLine) {
					new Line(this, nextLine).setCaretOffset(0);
					return;
				}
				var prevLine = focusNode.previousElementSibling;
				if (prevLine) {
					new Line(this, prevLine).setCaretOffset(-1);
					return;					
				}
				console.error("Broken doc: "+this.elem.textContent);
				this.clear(); // broken document
			}
			// focus is correct - check special case for FF: the caret may be after the \n character			
			var text = focusNode.nodeValue;
			if (sel.focusOffset === text.length && text.charCodeAt(text.length-1) === 10) {
				//console.log('== ADJUST FOCUS special case for FF');
				sel.collapse(focusNode, sel.focusOffset-1);
			}
		}
	}

	// ------------------------- INITIALIZATION ---------------------------

	this.formatter.initDocument(this.elem);

}

function Snapshot() {
	this.text;
	this.focus;
	this.apply = function(doc) {
		//TODO optimize by restoring only the diff
		doc.setText(this.text);
		doc.createRange().restore(this.focus).select();
	}
}

Qed.Line = Line;
Qed.Document = Document;
Qed.Snapshot = Snapshot;


// =========== prefix and suffix matching extracted from https://code.google.com/p/google-diff-match-patch ==============
//TODO Snapshot.apply must make diff to update only the impacted range and not the whole document

/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */
function diff_commonPrefix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) != text2.charAt(0)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;
  while (pointermin < pointermid) {
    if (text1.substring(pointerstart, pointermid) ==
        text2.substring(pointerstart, pointermid)) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */
function diff_commonSuffix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 ||
      text1.charAt(text1.length - 1) != text2.charAt(text2.length - 1)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerend = 0;
  while (pointermin < pointermid) {
    if (text1.substring(text1.length - pointermid, text1.length - pointerend) ==
        text2.substring(text2.length - pointermid, text2.length - pointerend)) {
      pointermin = pointermid;
      pointerend = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


function mergeSnapshot(previousSnapshot, snapshot) {
  if (!previousSnapshot) {
  	return false;
  }
  if (previousSnapshot.text === snapshot.text) {
    return true;
  }
  return false;
}


function UndoManager(editor, size) {
  this.editor = editor;
  this.undoStack = [];
  this.redoStack = [];
  this.size = size || 50;
  this.listeners = new ListenerRegistry(this);
  this.kcnt = 0; // the keystrokes count since the last snapshot

  this.addListener = function(undoRedoListener) {
    return this.listeners.add(undoRedoListener);
  }

  this.canUndo = function() {
    return this.undoStack.length > 1;
  }

  this.canRedo = function() {
    return this.redoStack.length > 0;
  }

  this.undo = function() { 
    if (!this.canUndo()) {
      return null;
    }

    // in case of a first undo - take a snapshot if current state is dirty and put it in the redo stack
    if (this.redoStack.length === 0) { // first undo
        // take a snapshot and put it on the redo stack
        var range = this.editor.doc.getFocusRange();
        if (range.isValid()) { //TODO when hiting undo button is the range valid?
          this.push(range.takeSnapshot());
        }      
    }

    // the undo stack contains on the top the snapshot as it is diplayed to the user.
    var snapshot = this.undoStack.pop();
    // move current state into the redo stack
    this.redoStack.push(snapshot);      
    // now apply the top snapshot if any
    var top = this.undoStack.length-1;
    this.undoStack[top].apply(this.editor.doc); 
    this.listeners.fire();
    return snapshot;
  }

  this.redo = function() {
    var snapshot = this.redoStack.pop();
    if (!snapshot) {
      return null;
    }
    snapshot.apply(this.editor.doc);
    this.undoStack.push(snapshot);
    this.listeners.fire();
    return snapshot;
  }  

  this.push = function(snapshot) {
    var stack = this.undoStack;
    var lastSnapshot = stack.length > 0 ? stack[stack.length-1] : null;

    this.kcnt = 0; // reset keystroke counter    
    this.redoStack.length = 0; // clear redo stack on push
    
    if (!mergeSnapshot(lastSnapshot, snapshot)) {
      if (stack.length > this.size) {
        stack.shift();
      }
      stack.push(snapshot);
    }

    this.listeners.fire();
  }

  this.init = function(text) {
    this.redoStack.length = 0;
    var s = new Snapshot();
    s.text = text || "\n";
    s.focus = [0,0,0,0];
    this.undoStack.length = 0;
    this.undoStack.push(s);
    this.listeners.fire();
  }

  /**
   * Decide whether or not a keystroke should trigger a snapshot.
   */
  this.shouldTakeSnapshot = function(charCode) {
    if (this.redoStack.length) {
      this.redoStack.length = 0; // clear redo stack on keypress
      this.listeners.fire();
    }
    this.kcnt++;
    return this.undoStack.length <=1 || this.kcnt > 32 || !charCode.trim() || " .,;!?".indexOf(charCode) > -1;
  }

}




/* ------------------ Actions & hot keys ------------------ */

/*
 * Get the action triggered by the given keydown event. Returns null if none was found
 */
function getHotKeyAction(e) {
	var hks = HK_BINDINGS[e.which];
	if (hks) {
		for (var i=0,len=hks.length; i<len; i++) {
			var hk = hks[i];
			if (hk.testModifiers(e)) {
				return ACTIONS[hk.id];
			}
		}
	}
	return null;
}

function parseHotKey(id, text) {
	var ar = text.toUpperCase().split('+');
	if (ar.length < 2) {
		return null;
	}	
	var modifiers = [];
	var modsMap = HotKey.mods;
	for (var i=0,len=ar.length-1; i<len; i++) {
		var m = modsMap[ar[i]];
		if (m != null) {
			modifiers.push(m);
		}
	}
	if (modifiers.length === 0) {
		return null;
	}
	var key = ar[ar.length-1];
	var code = key.length > 1 && key.charAt(0) === '#' ? parseInt(key.substring(1)) : key.charCodeAt(0);
	return new HotKey(id, code, modifiers);
}

/**
 * Create a hot key
 */
function bindHK(action, hotKey) {
	var hk = parseHotKey(action, hotKey);	
	if (!hk) {
		throw new Error('Invalid hot key: '+hotKey);
	}
	var hks = HK_BINDINGS[hk.key];
	if (!hks) {
		hks = [];
		HK_BINDINGS[hk.key] = hks;
	}
	hks.push(hk);
	return hk;	
}

function setHotKeys(action, hotKey, title) {
	if (typeof hotKey === 'string') {
		bindHK(action, hotKey);
		if (!title) {
			title = hotKey;
		}
	} else {
		for (var i=0, len=hotKey.length; i<len; i++) {
			bindHK(action, hotKey[i]);
		}
		if (!title) {
			title = hotKey[0];
		}		
	}
	HOT_KEYS[action] = title;
}

function loadHotKeys(bindings, reset) {
	if (reset) {
		HOT_KEYS = {};
		HK_BINDINGS = {};
	}
	for (var i=0,len=bindings.length; i<len; i++) {
		var binding = bindings[i];
		setHotKeys(binding.action, binding.key, binding.title);
	}
}


/* ------------------ hotkeys ------------------ */

function HotKey(id, key, modifiers) {
	this.id = id;
	this.key = key; // the key code
	this.mods = modifiers;

	this.test = function(e) {
		if (e.which !== this.key) {
			return false;
		}
		return this.testModifiers(e);
	}

	this.testModifiers = function(e) {
		var m = this.mods;
		for (var i=0,len=m.length; i<len; i++) {
			if (!m[i](e)) {
				return false;
			}
		}
		return true;		
	}	
}
HotKey.mods = {
	CTRL: function(e) { return e.ctrlKey; },
	ALT: function(e) { return e.altKey; },
	SHIFT: function(e) { return e.shiftKey; },
	META: function(e) { return e.metaKey; },
	APPLE: function(e) { return MACOS && e.metaKey; }
};

// ------------------- default actions and hotkeys -------------------

function _inlineStyleAction(editor, range, prefix, text, suffix) {
	var placeholder = true;	
	if (!range.isCollapsed() && !range.isMultiline()) {
		text = range.getText();			
		placeholder = false;
	}
	range.insertText(prefix+text+suffix);
	if (placeholder) {			
		range.focusOffset = range.focusOffset-suffix.length;
		range.anchorOffset = range.focusOffset-text.length;
	}
	range.select();
}

function _wrapLinesAction(editor, range, prefixLine, text, suffixLine) {
	var rangeText = range.expandToBoundingLines().getText();
	var prevLine = range.anchorLine.previous();
	if (rangeText.trim()) { // not empty text
		text = rangeText;
	}
	range.insertText(prefixLine+'\n'+text+'\n'+suffixLine);
	range.focusLine = range.focusLine.previous();
	range.anchorLine = prevLine ? prevLine.next().next() : editor.doc.getFirstLine().next();
	range.expandToBoundingLines().select();
}

function inlineStyleAction(editor, prefix, text, suffix) {
	var range = editor.getOrInitFocusRange();
	_inlineStyleAction(editor, range, prefix, text, suffix);
	editor.takeSnapshot(range);
}

function prefixLineAction(editor, prefix) {		
	var range = editor.getOrInitFocusRange();
	range.prefixLines(prefix).select();
	editor.takeSnapshot(range);
}

function toggleHeading(editor, headingLevel, headingMark) {
	var range = editor.getOrInitFocusRange();
	if (!range.isMultiline() && range.focusLine.attr('data-line-type') === 'heading') {		
		var line = range.focusLine;
		var level = parseInt(line.attr('data-level'));
		var text = line.getText();
		var i = text.indexOf('#');
		if (level === headingLevel) { // remove heading
			if (text.charCodeAt(i+level) <= 32) {
				level++;
			}
			range.replaceLineText('', i, level);
		} else { // change the heading level
			range.replaceLineText(headingMark, i, level);
		}
		range.select();
		editor.takeSnapshot(range);
	} else {
		prefixLineAction(editor, headingMark+" ");
	}
}

function unprefixOl(start, end) {
	var ar = [];
	var elt = start;
	var stop = end.nextElementSibling;
	while (elt !== stop) {
		var text = elt.textContent;
		var i = text.indexOf('. ');
		if (i > -1) {
			ar.push(text.substring(i+2));
		}
		elt = elt.nextElementSibling;		
	}
	return ar;
}

function prefixOl(lines, index) {
	var idx = index || 0;
	var ar = [];
	for (var i=0,len=lines.length;i<len;i++) {
		lines[i] = (++idx)+". "+lines[i];
	}
	return lines;
}

function unprefixUl(start, end, liMark) {
	var ar = [];
	var elt = start;
	var stop = end.nextElementSibling;
	liMark += ' ';
	while (elt !== stop) {
		var text = elt.textContent;
		var i = text.indexOf(liMark);
		if (i > -1) {
			ar.push(text.substring(i+liMark.length));
		}
		elt = elt.nextElementSibling;		
	}
	return ar;
}

function prefixUl(lines, liMark) {
	var ar = [];
	for (var i=0,len=lines.length;i<len;i++) {
		lines[i] = liMark+" "+lines[i];
	}
	return lines;	
}

function toggleList(editor, isOrdered) {
	var range = editor.getOrInitFocusRange();
	if (range.focusLine.attr('data-line-type') === 'li') {
		var listMark = range.focusLine.attr('data-bullet');
		var c = listMark.charCodeAt(0); 
		var existingIsOrdered = c < 58 && c > 47;
		if (isOrdered !== existingIsOrdered) {
			// change the list type			
			range.collapse();			
			// find the first and last list line
			var line = range.focusLine.elem;
			var start = line, end = line, lines = [];
			var elt = line.previousElementSibling;
			while (elt && elt.getAttribute('data-bullet')) {
				start = elt;
				elt = elt.previousElementSibling;
			}
			elt = line.nextElementSibling;
			while (elt && elt.getAttribute('data-bullet')) {
				end = elt;
				elt = elt.nextElementSibling;
			}
			var lines;
			if (existingIsOrdered) {				
				lines = prefixUl(unprefixOl(start, end), '*');
			} else {
				lines = prefixOl(unprefixUl(start, end, listMark), 0);
			}
			var srange = range.save();
			range.doc.formatter.replaceLines(start, end, lines);
			range.restore(srange).select();
		} else {
			// remove item and close list
			var text = range.focusLine.getText();
			var i = text.indexOf(listMark);
			if (i > -1) {
				i += listMark.length;
				if (text.charCodeAt(i+1) <= 32) {
					i++;
				}
				range.replaceLineText('', 0, i).select();
				// insert a new line before
				range.doc.formatter.insertLines(range.focusLine.elem, [ "" ]);
			}
		}
		editor.takeSnapshot(range);
	} else if (isOrdered) {
		prefixLineAction(editor, "1. "); //TODO compute number
	} else {
		prefixLineAction(editor, "* ");
	}
}

// internal hot key bindings used by the event listener. (key code -> [ hotKeys ])
var HK_BINDINGS = {}; 
// Hot key labels by action name. (string -> string))
var HOT_KEYS = {};
// Actions bindings (action name -> action handler)
var ACTIONS = {
	"undo": function(editor) {
		editor.undoMgr.undo();
	},
	"redo": function(editor) {
		editor.undoMgr.redo();
	},
	"bold": function(editor) {
		inlineStyleAction(editor, '**', 'type here', '**');
	},
	"italic": function(editor) {
		inlineStyleAction(editor, '_', 'type here', '_');
	},
	"strike": function(editor) {
		inlineStyleAction(editor, '~~', 'type here', '~~');
	},
	"link": function(editor) {
		var url = prompt('Enter link URL (must start with http:// or https://)');
		if (url) {
            if (url.indexOf('http://') === 0 || url.indexOf('https://') === 0) {
            	inlineStyleAction(editor, "[", "type a link title", "]("+url+")");
            } else {
                alert('Not a valid URL');
            }
        }
	},
	"image": function(editor) {
		if (editor.insertImage) {
			// pass the inline style action since it may be usefull to the implementation
			editor.insertImage(); 
		}
	},
	"code": function(editor) {
		var range = editor.getOrInitFocusRange();
		if (range.isMultiline() || (range.isCollapsed() && isLineEmpty(range.focusLine.elem))) {
			_wrapLinesAction(editor, range, "```", "type here", "```");
		} else {
			_inlineStyleAction(editor, range, '`', 'type here', '`');			
		}
		editor.takeSnapshot(range);
	},
	"h1": function(editor) {
		toggleHeading(editor, 1, "#");
	},
	"h2": function(editor) {
		toggleHeading(editor, 2, "##");
	},
	"h3": function(editor) {
		toggleHeading(editor, 3, "###");
	},
	"ul": function(editor) {
		toggleList(editor, false);
	},
	"ol": function(editor) {
		toggleList(editor, true);
	},
	"quote": function(editor) {
		prefixLineAction(editor, "> ");
	},
	"br": function(editor) {
		var range = editor.doc.getFocusRange();
		range.split(true).select();
		range.focusLine.scrollToReveal();
		editor.takeSnapshot(range);
	},
	"refresh": function(editor) {
		editor.doc.setText(editor.getText());
	}
};

loadHotKeys([
	{action: "undo", key: ["Ctrl+Z", "APPLE+Z"]},
	{action: "redo", key: ["Ctrl+Y", "APPLE+Y"]},
	{action: "bold", key: "Ctrl+B"},
	{action: "italic", key: "Ctrl+I"},
	{action: "strike", key: "Ctrl+D"},
	{action: "link", key: "Ctrl+L"},
	{action: "code", key: "Ctrl+K"},
	{action: "ul", key: "Ctrl+U"},
	{action: "ol", key: "Ctrl+O"},
	{action: "quote", key: "Ctrl+#190", title: "Ctrl+."}
]);

Qed.actions = ACTIONS;
Qed.loadHotKeys = loadHotKeys;
Qed.setHotKeys = setHotKeys;



/*
TODO: Put APIs in prototypes for light initialization of range, document, line etc.
*/
function Editor() {

	/**
	 * the keystroke type since the last processed keyup. Can have the following values:
	 * 0 - ignore, 
	 * 1 - printable character, 
	 * 2 - require snapshot, 
	 * 4 - invalidate line
	 */	 
	this.ktype = 0;
	this.textarea = null;
  	this.doc = null;
  	this.undoMgr = new UndoManager(this);
  	this.changeListeners = new AsyncListenerRegistry(this, 200);
  	this.observer = null;
  	this.savedFocusRange = null; // the focus range saved at editor blur

  	// extension points for insert image and autcompletion
  	this.insertImage = null;
  	this.suggest = null; // suggest support. A suggest object should implement the keydown(event) and a keypress(range) function
  	this.dropFiles = null;

  	this.element = function() {
  		return this.doc.elem;
  	}

  	this.focus = function() {
  		this.getOrInitFocusRange().select();
  	}

  	this.getOrInitFocusRange = function() {
		var range = this.doc.getFocusRange();
		if (!range.isValid()) {
			if (this.savedFocusRange) {
				range.restore(this.savedFocusRange);
				if (range.isValid()) {
					return range.select();
				}
			}
			return range.collapseTo(this.doc.getFirstLine(), 0).select();
		}
		return range;
  	}

  	this.installSuggest = function(impl, delay) {
  		this.suggest = new Qed.Suggest(this, impl);
  		return this;
  	}

	this._startObserver = function(selector) {
		var self = this;
		this.observer = new MutationObserver(function(records,observer) { self._onDomChange(records,observer); });
		this.observer.observe(this.doc.elem, {
			childList: true, attributes: false, characterData: true, subtree: true, characterDataOldValue: false 
		});		
	}

	this._stopObserver = function() {
		this.observer.disconnect();
		this.observer = null;
	}

  	this.takeSnapshot = function(range) {
  		this.undoMgr.push(range.takeSnapshot());
  	}

  	this.addChangeListener = function(listener) { 
  		if (!this.observer) {
  			this._startObserver();
  		}
  		return this.changeListeners.add(listener);  		
  	}

  	this.removeChangeListener = function(listener) {
  		var r = this.changeListeners.remove(listener);
  		if (this.changeListeners.listeners.length === 0) {
  			this._stopObserver();
  		}
  		return r;
  	}

  	/**
  	 *  Called in async mode when markdown document changed - if any change listener where registered
  	 */
  	this._onDomChange = function(records, observer) {
  		// notify change listeners
  		this.changeListeners.fire();
  	}

	this.handleEnter = function(e) {
		var range = this.doc.getFocusRange();
		range.split(!!e.ctrlKey).select();
		range.focusLine.scrollToReveal();
		this.takeSnapshot(range);
	}

	this.handleDelete = function(e) {
		var range = this.doc.getFocusRange();
		if (e.altKey) {				
			// special case - we need to support ALT + BS which is removing one word
			range.removeNextWord().select();		
		} else {
			range.removeNextCharacter().select();	
		}
		this.takeSnapshot(range);
		if (this.suggest) {
			this.suggest.keypress(range);
		}
		return false;
	}

	this.handleBackspace = function(e) {
		var range = this.doc.getFocusRange();
		if (e.altKey) {				
			// special case - we need to support ALT + BS which is removing one word
			range.removePreviousWord().select();
		} else {
			range.removePreviousCharacter().select();
		}
		this.takeSnapshot(range);
		if (this.suggest) {
			this.suggest.keypress(range);
		}
		return false;
	}

	this.handleTab = function(e) {
		var range = this.doc.getFocusRange();
		if (e.shiftKey) {			
			range.unprefixLines('\t');
		} else {
			range.prefixLines('\t');
		}				
		range.select();
		this.takeSnapshot(range);
	}	

	this.onCut = function(e) {
		e.preventDefault();
		e.stopPropagation();

		var selection = this.doc.getSelection();
		if (selection.isCollapsed) {
			return;			
		}		

		var text = selection.toString();
		var clipboard = null;
		var ctype = 'text/plain';
		if (window.clipboardData && e.clipboardData === undefined) { // IE
	        e.clipboardData = window.clipboardData;
	        ctype = "Text";
	    }
	    if (e.clipboardData && e.clipboardData.setData) {
	    	clipboard = e.clipboardData;
	    }
	    if (clipboard) {
	    	clipboard.setData(ctype, text);
	    	var range = this.doc.createRange().fromSelection(selection);
	    	range.removeText().select();
	    	this.takeSnapshot(range);
	    }
		
	}

	this.selectAndTakeSnapshot = function(range, timeout) {
		if (timeout == null) {
			range.select();
			this.takeSnapshot(range);	
		} else {
			var self = this;
			window.setTimeout(function() {
				range.select();
				self.takeSnapshot(range);
			}, timeout);
		}
		
	}

	this.onPaste = function(e) {
		e.preventDefault();
		e.stopPropagation();

		var pastedText = null;		
		var isIE = false;
	    if (window.clipboardData && e.clipboardData === undefined) {
	        e.clipboardData = window.clipboardData;
	        isIE = true;
	    }
	    if (e.clipboardData && e.clipboardData.getData) {
	    	if (Qed.toMarkdown) { // accept HTML paste
	    		try {
					var html = e.clipboardData.getData('text/html');
					if (html) {
						//console.log('pasted html:', html);	
						pastedText = Qed.toMarkdown(html);	
					}
				} catch(e) {
					// IE is not supporting text/html => ignore and fallback on text/plain
				}
	    	}
	    	if (!pastedText) {
	    		pastedText = e.clipboardData.getData('Text');
	    	}
	    }
	    if (pastedText == null) {
	    	// paste not supported
	    	pastedText = prompt('Paste is not supported on your browser.\nJust hit CTRL+V (or CMD+V on MacOs) to paste the content now and then hit the enter key', 'Paste text here');
		}
    	if (pastedText) {
    		var range = this.doc.getFocusRange().insertText(pastedText);
    		// if IE we need to update selection after the current event completes (setTimeout 0)
    		if (isIE) {
				this.selectAndTakeSnapshot(range, 0);
    		} else {
    			this.selectAndTakeSnapshot(range);
    		}    		    		
	    }
	}

	this.onDrop = function(e) {
		if (e.dataTransfer) {
			var files = e.dataTransfer.files;
			if (files && files.length > 0 && this.dropFiles) {
				this.dropFiles(files, e);
			} else {
				var text = e.dataTransfer.getData('Text');	
				if (text) {
	    			var range = this.doc.getFocusRange().insertText(text).select();
	    			this.takeSnapshot(range);
				}
			}
	    }				
		//TODO: allow droping files through an extension mechanism
	    // prevent default action (open as link for some elements)
	    e.preventDefault();
	    e.stopPropagation();
	}

	this.onDragOver = function(e) {
		if (e.dataTransfer) {
			var types = e.dataTransfer.types;
			if (types) {
				// types.indexOf is not defined in FF since the types object is a DOMStringList
				for (var i=0,len=types.length; i<len; i++) {
					var type = types[i];
					if (type === 'Files' || type === 'text/plain') {
						e.dataTransfer.dropEffect = 'copy';	
					}
				}
			}
		}
		// allow custom drop
		e.preventDefault();
	}

	this.onKeydown = function(e) {
		var code = e.which;
		if (code > 32 && code < 41) { // ignore navgation keys 
			return;
		}

		// ignore ctrl keys
		switch (code) {
			case 16: // shift
			case 17: // ctrl
			case 18: // alt
			case 91: // win left
			case 92: // win right
			// TODO macos cmd: FF: 224, Opera: 17, WebKit (Safari/Chrome): 91 (Left Apple) or 93 (Right Apple)
			return;
		}

		this.doc.adjustFocus();

		//console.log('keydown', code);
		var hkAction = getHotKeyAction(e);
		if (hkAction) {
			hkAction(this);
			return false;
		}

		if (code === 13) {
			this.handleEnter(e);
			return false;
		} else if (code === 9) {
			this.handleTab(e);
			return false;
		} else if (code === 8) { // bs
			return this.handleBackspace(e);
		} else if (code === 46) { // del
			return this.handleDelete(e);
		}

	}

	this.onKeypress = function(e) {		
		if (e.ctrlKey || e.metaKey) {
			return;
		}
		var code = e.which;
		// String.fromCharCode(0) is producing a non null char on ff
		var ch = code < 32 ? null : String.fromCharCode(code);
		if (ch) {
			//console.log('KEYPRESS ... '+ch);
			var doc = this.doc;
			var sel = doc.getSelection();

			this.ktype |= 1;

			if (this.undoMgr.shouldTakeSnapshot(ch)) {
				this.ktype |= 2;
			}

			// we need to removed ourselves the selected range if any exists to 
			// avoid the default behavior messing the editor content
  			if (!sel.isCollapsed) {
  				doc.getFocusRange().removeText().select();	
  				// TODO: is the selection object still valid after changing the selection?
  				sel = doc.getSelection(); 
  			}			

			var lineElem = doc.getLineElement(sel.anchorNode);
			if (lineElem && doc.formatter.isLineInvalidated(lineElem, sel, ch)) {
				this.ktype |= 4;
			}
		}
	}

	this.onKeyup = function(ktype) {
		var doc = this.doc;
		var sel = doc.getSelection();		

		// selection is fixed if a printable char was typed
  		if (!sel.focusNode || sel.focusNode.nodeType !== 3) {
  			//console.log("=========== TRY TO FIX FOCUS (IE) ==================");
  			// under IE9 the focus can go inside the DIV
  			var point = findTextNodeAt(sel.focusNode, sel.focusOffset);
  			if (point) {
  				sel.collapse(point[0], point[1]);
  				sel = doc.getSelection();
  			}
  			if (!sel.focusNode || sel.focusNode.nodeType !== 3) {
				console.error("Invalid editor context ", sel.focusNode, sel.focusOffset);
  				return;
  			}
  		}
  		var range = null;
		if ( ktype !== 1 ) { // ktype === 1 means a printable key which doesn't require further processing			
			range = doc.getFocusRange();
			if (!range.isValid()) {
				return;
			}  			

	  		if ( (ktype & 2) > 0 ) {
	  			this.takeSnapshot(range);
	  		}
	  		
	  		if ( (ktype & 4) > 0 ) {  			
	  			range.refresh().select();
	  		}
		}
		if (this.suggest) {
			this.suggest.keypress(range || doc.getFocusRange());
		}
	}

	this.create = function(editorElem) {
		editorElem.setAttribute("contenteditable", "true");
		this.doc = new Document(editorElem, new MarkdownFormatter());
		this.undoMgr.init();
		
		var self = this;

		editorElem.addEventListener("keydown", function(e) {
			normalizeKeyEvent(e);
			if (self.suggest && self.suggest.keydown(e)) {
				e.preventDefault();
				e.stopPropagation();					
				return;
			}			
			var r = self.onKeydown(e);
			if (r === false) {
				e.preventDefault();
				e.stopPropagation();
			}
  		});

  		editorElem.addEventListener("keypress", function(e) {
  			normalizeKeyEvent(e);
  			self.onKeypress(e);
  			//console.log('kp:', self.ktype, String.fromCharCode(e.which));
		});
		editorElem.addEventListener("keyup", function(e) {
			normalizeKeyEvent(e);
			//console.log('ku:', self.ktype);
			var ktype = self.ktype;
			self.ktype = 0;
			if (ktype > 0 && !e.ctrlKey && !e.metaKey) {
				self.onKeyup(ktype);
			}
		});
		editorElem.addEventListener("paste", function(e) {
			self.onPaste(e);
		});	
		editorElem.addEventListener("cut", function(e) {
			self.onCut(e);
		});
		editorElem.addEventListener("drop", function(e) {
			self.onDrop(e);
		});		
		editorElem.addEventListener("dragover", function(e) {
			self.onDragOver(e);
		});


		editorElem.addEventListener("blur", function() {
			var range = self.doc.getFocusRange();
			self.savedFocusRange = range.isValid() ? range.save() : null;
			self.sync();
		});

	  	return this;
	}

	/*
	 * TODO
	 */
	this.destroy = function() {
		if (this.textarea) {
			this.sync();
			this.doc.elem.parentNode.removeChild(this.doc.elem);
			this.textarea.style.display = 'none';
		}
	}

	/**
	 * Synchronize the editor text with the attached textarea if any
	 */
	this.sync = function() {
		if (this.textarea) {
			this.textarea.value = this.getText();
		}
		return this;
	}

	this.autosync = function(input) {
		this.textarea = input;
	}

	/**
     * Set the editor text without taking a snapshot of existing content (undos tack will not change)
     */
	this.setInitialText = function(text) {
		this.doc.setText(text);
		this.undoMgr.init(text);
	}

	this.setText = function(text) {
		this.doc.setText(text);
		this.takeSnapshot(this.getOrInitFocusRange());
	}

	this.getText = function() {
		return this.doc.getText();
	}

	// only if marked is present
	this.getTextAsHtml = function() {
		return marked(this.doc.getText());
	}

	this.exec = function(actionName) {
		var action = Qed.actions[actionName];
		if (action) {
			return action(this);
		}
		return null;
	}

	this.insertSelectedText = function(prefix, text, suffix) {
		inlineStyleAction(this, prefix, text, suffix);
	}

	this.insertText = function(text) {
		this.doc.getFocusRange().insertText(text).select();
	}

}

Qed.Editor = Editor;



function Preview(elem, transformers) {	
	this.elem = elem;
	this._reg = null;
	// a transformer is a function fn(previewElem, focusOnCaret)
	this.transformers = transformers || [];

	function showElement(view, elem) {
		var rect = elem.getBoundingClientRect();
		var viewRect = view.getBoundingClientRect();
		// compute relative top and bottom
		var top = rect.top - viewRect.top;
		var bottom = rect.bottom - viewRect.top;
		if (bottom > view.clientHeight) {
			view.scrollTop += (bottom - view.clientHeight)+50; // 50 pixels treshold
		} else if (top < 0) {
			view.scrollTop += top-500; // 50 pixels threshold
		}
	}

	this.connect = function(editor) {
		if (this._reg) {
			return this;
		}
		this.syncAndFocus(editor);
		var self = this;
		this._reg = editor.addChangeListener(function() {
			self.syncAndFocus(editor);
		});
		return this;
	}

	this.disconnect = function() {
		if (!this._reg) {
			return false;
		}
		this._reg.remove();
		this._reg = null;		
		return true;
	}

	this.isConnected = function() {
		return !!this._reg;
	}

	this._transform = function(focusOnCaret) {
		var tr = this.transformers;
		var elem = this.elem;
		for (var i=0, len=tr.length; i<len; i++) {
			tr[i](elem, focusOnCaret);
		}
	}

	this.sync = function(editor) {
		this.elem.innerHTML = editor.doc.formatter.toHTML(editor.doc.getText());
		this._transform(false);
		return this;
	}

	this.syncAndFocus = function(editor) {
		var doc = editor.doc; 
		var elem = this.elem;
  		var text = doc.getText();
  		var line = doc.getFocusLine();
  		
  		var marker = '$$$QED$CARET$MARKER$$$'; 

  		if (line) {
  			// insert at the end of line (before '\n' or '  \n')
  			var i = line.getLineOffset();
  			var k = text.indexOf('\n', i);
  			if (k > -1) { 
  				if (i > 0 && !text.substring(i, k).trim()) { // an empty line
  					// avoid breaking paragraph boundaries
  					var prevLine = line.previousElementSibling;
  					if (prevLine && prevLine.getAttribute('data-block') !== 'end') {
  						// avoid doing this after an end of code block - it breaks the code block
						k = i-1;
  					}  					
  				} else if (k > 1 && !text.substring(k-2, k) === '  ') { // ends in '  \n'
  					k -= 2;
  				}
  				text = text.substring(0, k) + ' '+marker + text.substring(k);
  			} else {
  				text += ' '+marker;
  			}
  			// the space inserted before the marker is needed when inserting the marker just after an URL (i.e. gfm autolink). 
  			// Without the space the marker will be part of the URL.
  		}
  		
		var html = doc.formatter.toHTML(text);
		var i = html.indexOf(marker);
		if (i > -1) {
			// replace the maker with an empty tag
			var markerId = "QED_CARET_MARKER_"+(ID_GEN++);
			elem.innerHTML = html.substring(0, i)+"<i id='"+markerId+"'></i>"+html.substring(i+marker.length);
			var markerElement = document.getElementById(markerId);
			if (markerElement) {
				showElement(elem, markerElement);
			}			
		} else {
			elem.innerHTML = html;	
		}
		this._transform(true);
	}

}

Qed.Preview = Preview;

/*
 * High level editor with toolbar, preview synchronization etc.
 */

 function EditorContainer() {
    this.elem = null;
    this.editor = null;
    this.preview = null;
    this.height = null;
    this.tbarItems = {};

    this.setText = function(text) {
    	this.editor.setText(text);
    	return this;
    }

    this.setInitialText = function(text) {
    	this.editor.setInitialText(text);
    	return this;
    }

    this.getText = function() {
    	return this.editor.getText();
    }

    this.getId = function() {
        return this.elem.getAttribute('id');
    }

    this._togglePreview = function() {
    	var r;
    	if (hasClass(this.elem, 'preview')) {
			removeClass(this.elem, 'preview');
            disableToolbarItems(this.tbarItems, false);
			this.editor.doc.elem.focus();
			r = false;
    	} else {
        	addClass(this.elem, 'preview');
            disableToolbarItems(this.tbarItems, true);
        	if (this.preview) {
        		this.preview.sync(this.editor);
        	}
        	// we need to put focus on a focusable child element so that the toggle preview hot key still works]
        	this.preview.elem.focus();
        	r = true;
    	}
        this._refreshUndoBar(); // we need this since the disableTollbarItems method may change modify te disable state
    	// update the toolbar item if any
    	var item = this.tbarItems['preview'];
    	if (item) {
    		item.refresh(this);
    	}    	
    	return r;    	
    }

    this._toggleFullScreen = function() {
    	var r;
    	if (hasClass(this.elem, 'fullscreen')) {
			removeClass(this.elem, 'fullscreen');
			this.preview.disconnect();
			this._adjustHeight();
			r = false;
    	} else {
        	addClass(this.elem, 'fullscreen');
        	if (this.preview) {        		
        		this.preview.sync(this.editor).connect(this.editor);
        	}
        	this._adjustHeight();        	
        	r = true;
    	}
    	this.editor.doc.elem.focus();
    	// update the toolbar item if any
    	var item = this.tbarItems['fullscreen'];
    	if (item) {
    		item.refresh(this);
    	}
    	return r;
    }

    this.isPreviewMode = function() {
        return hasClass(this.elem, "preview");
    }

    this.isFullScreen = function() {
        return hasClass(this.elem, "fullscreen");
    }

    this._adjustHeight = function() {
    	var h = this.height;
    	if (this.isFullScreen()) {
    		var toolbarElt = this.elem.querySelector('.qed-toolbar');
    		if (toolbarElt) { 
    			h = this.elem.clientHeight - toolbarElt.offsetHeight;
    		}
    	}    	
    	if (h) {
    		h += 'px';
    		this.editor.doc.elem.style.height = h;
    		if (this.preview) {
    			this.preview.elem.style.height = h;
    		}
    	}
    }

    this.create = function(element, settings) {
    	var tagName = element.tagName.toUpperCase();
    	var inputElt = null;
		var previewElt = null;
    	var toolbarElt = null;
    	var editorElt = null;    	
    	
    	if (tagName === 'TEXTAREA' || (tagName === 'INPUT' && element.getAttribute('type') === 'hidden') ) {    	
    		inputElt = element;
    		element = document.createElement('DIV');
    		toolbarElt = document.createElement('DIV');
    		previewElt = document.createElement('DIV');
    		editorElt = document.createElement('DIV');
    		var panelElt = document.createElement('DIV');
    		addClass(element, 'qed-container');
    		addClass(toolbarElt, 'qed-toolbar');
    		addClass(toolbarElt, 'clearfix');
    		addClass(previewElt, 'qed-preview');
    		addClass(editorElt, 'qed-editor');
    		addClass(panelElt, 'qed-panel');
    		addClass(panelElt, 'clearfix');
    		
    		hideElement(toolbarElt); // will be shown only if items are added inside

    		element.appendChild(toolbarElt);
    		element.appendChild(panelElt);

    		panelElt.appendChild(editorElt);
    		panelElt.appendChild(previewElt);    		
    	} else {
    		toolbarElt = element.querySelector('.qed-toolbar');
    		previewElt = element.querySelector('.qed-preview');
    		editorElt = element.querySelector('.qed-editor');
    	}

    	if (!editorElt) {
    		throw new Error("Didn't found any '.qed-editor' element");
    	}

    	this.elem = element;

		var id = element.getAttribute('id');
		if (!id) {
			id = 'qed-editor-'+(ID_GEN++);
		}
    	
    	this.editor = new Editor().create(editorElt);

    	if (previewElt) {
            var previewTransforms = settings ? settings.previewTransforms : null;
            previewElt.tabIndex = -1; // allow preview to receive focus
    		this.preview = new Preview(previewElt, previewTransforms);
    	}

    	if (inputElt) {
    		hideElement(inputElt);
    		inputElt.parentNode.insertBefore(element, inputElt);
    		this.editor.autosync(inputElt);
    		if (inputElt.value) {
    			this.editor.setInitialText(inputElt.value);
    		}
    	}

        var self = this;
    	var fullscreen = false;
    	if (settings) {
            if (settings.suggest) {
                this.editor.installSuggest(settings.suggest);
            }
            if (settings.insertImage) {
                this.editor.insertImage = settings.insertImage;
            }
            if (settings.dropFiles) {
                this.editor.dropFiles = settings.dropFiles;
            }
    		if (settings.height) {    			
    			this.height = settings.height;
    			this._adjustHeight();
    		}
    		if (toolbarElt) {
    			this._buildToolbar(toolbarElt, settings.leftBar, settings.rightBar);
    		}
    		fullscreen = !!settings.fullscreen;
			if (fullscreen) {
				this._toggleFullScreen();
			}
            if (settings.autofocus) {
                this.editor.getOrInitFocusRange().select();
            }
            if (settings.confirmOnLeave) {
                var submittingClass = settings.submittingClass || "submitting";
                window.onbeforeunload = function(e) {
                    var form = closest(self.elem, 'form');
                    // // a form flag that can be used to cancel this confirm dialog.
                    // // you should set it when form is submited to avoid prompting.
                    if ( self.submitting || (form && hasClass(form, submittingClass)) ) {
                      return;
                    }                    
                    if (self.editor.undoMgr.canUndo()) {
                        return settings.confirmOnLeave;
                    }
                };
            }
    		//TODO handle change timeout
    	}

    	this.elem.addEventListener('keydown', function(e) {
    		normalizeKeyEvent(e);
    		var r = false;
    		switch (e.which) {
    			case 27: // ESC
    			    if (!fullscreen && self.isFullScreen()) {
    					self._toggleFullScreen(); 
    					r = true;
    				}
    				break;
    			case 70: // F
                    if (e.ctrlKey && e.shiftKey) {
                            if (!fullscreen) {
                            self._toggleFullScreen();
                            r = true;
                        }
                    } else if (e.ctrlKey) {
                        self._togglePreview();
                        r = true;                            
                    }
    				break;
    		}
    		if (r) {
    			e.preventDefault();
				e.stopPropagation();
			}
    	});

    	return this;
    }

    this.destroy = function() {
    	//TODO
    }

    this._buildToolbar = function(toolbarElt, leftItems, rightItems) {
		if (leftItems && leftItems.length > 0) {
			toolbarElt.appendChild(this._buildBar('qed-toolbar-left', leftItems));
		}
		if (rightItems && rightItems.length > 0) {
			toolbarElt.appendChild(this._buildBar('qed-toolbar-right', rightItems));
		}
    	if (!toolbarElt.firstElementChild) {
    		return false;
    	}

    	var self = this;
		toolbarElt.addEventListener("click", function(e) {			
			var btn = findActionBtn(e.target);
			if (btn && !btn.disabled) {
				var action = btn.getAttribute('data-action');
				var item = self.tbarItems[action];
				if (item) {
					e.preventDefault();
					e.stopPropagation();
					item.exec(self);
				}
			}
		});
		this._refreshUndoBar();
		this.editor.undoMgr.addListener(function() {
			self._refreshUndoBar();
		})
		showElement(toolbarElt);
		return true;
    }

    this._refreshUndoBar = function() {
		var undoMgr = this.editor.undoMgr;
		var undo = this.tbarItems['undo'];
		var redo = this.tbarItems['redo'];
		if (undo) {            
            undo.elem.querySelector("button").disabled = !undoMgr.canUndo();
		}
		if (redo) {
            redo.elem.querySelector("button").disabled = !undoMgr.canRedo();
		}
    }

   	this._buildBar = function(className, items) {
   		var bar = addClass(document.createElement('UL'), className);
		for (var i=0,len=items.length; i<len; i++) {
			var data = items[i];
			var item = createItem(this, data);
			bar.appendChild(item.elem);
			if (data.name) {
				this.tbarItems[data.name] = item;
			}
		}
		return bar;
	}

    function disableToolbarItems(items, disable) {
        for (var prop in items) {
            if (items.hasOwnProperty(prop)) {
                var child = items[prop].elem.firstElementChild;
                if (child) {
                    var action = child.getAttribute('data-action');
                    if (action !== 'preview') {
                        child.disabled = disable;
                    }
                }
            }
        }
    }

	function findActionBtn(elem) {		
		var p = elem;
		while (p && !hasClass(p, 'qed-toolbar') && !p.getAttribute('data-action')) {
			p = p.parentNode;
		}
		return p;
	}

	function renderItem(container, parent, name, label, title) {        
    	parent.innerHTML = "<button type='button' title='"+(title || '')+"' data-action='"+name+"' class='qed-toolbar-action'>"+label+"</button>";
	}


	 function createItem(container, data) {
	 	var className = 'qed-toolbar-item';
	 	var li = document.createElement('LI');
	 	var item;
	 	if (data === '|') {
	 		className = 'qed-toolbar-separator';
    		item = new SeparatorItem();
	 	} else if (typeof data === 'string') {
	 		className = 'qed-toolbar-text';
	 		item = new RawItem(data);
	 	} else {
		 	var name = data.name;
		 	var action = Qed.actions[name];
		 	if (action) { // a registered editor action
		 		if (data.title) {
			 		var hkTitle = HOT_KEYS[name];
			 		if (hkTitle)  {
			 			data.title+=" ("+hkTitle+")";
			 		}
			 	}
			 	item = new ActionItem(data);
	 		} else if (name === 'fullscreen') {
		 		item = new ToggleItem(data, 
		 			function(container) {
		 				return container.isFullScreen();
		 			},
		 			function(container) {
		 				return container._toggleFullScreen();
		 			}
		 		);
		 	} else if ( name === 'preview') {
		 		item = new ToggleItem(data, 
		 			function(container) {
		 				return container.isPreviewMode();
		 			},
		 			function(container) {
		 				return container._togglePreview();
		 			}
		 		);
		 	} else { // custom action
		 		item = data; // assuming a custom item
		 		if (!item.create) {
		 			item.create = function(container, elem) {
		 				renderItem(container, elem, this.name, this.label, this.title);
		 				this.elem = elem;
		 			}
		 		}
		 	}
	 	}
	 	item.create(container, addClass(li, className));
	 	return item;
	 }

	function SeparatorItem() {
		this.exec = noop;
		this.create = function(container, elem) {
			this.elem = elem;
		}
	}

	function RawItem(html) {
		this.elem = null;
		this.html = html;
		this.create = function(container, elem) {
			elem.innerHTML = this.html;
			this.elem = elem;
		}
		this.exec = noop;		
	}

	function ActionItem(data) {
		this.elem = null;
		this.data = data;
		this.create = function(container, elem) {
			renderItem(container, elem, this.data.name, this.data.label, this.data.title);
			this.elem = elem;
		}
		this.exec = function(container) {
			container.editor.exec(this.data.name);
		}
	}

	function ToggleItem(data, isOn, exec) {
		this.elem = null;
		this.data = data;
		this.getLabel = function(container) {
			return (this.isOn(container) ? this.data.labelOn : this.data.labelOff) || this.data.label;
		}
		this.create = function(container, elem) {
			renderItem(container, elem, this.data.name, this.getLabel(container), this.data.title);
			this.elem = elem;
		}		
		this.isOn = isOn;
		this.exec = exec;
		/*
		this.exec = function(container) {
			exec(container);
			// update label fof needed
			this.elem.firstElementChild.innerHTML = this.getLabel(container);
		}
		*/
		this.refresh= function(container) {
			this.elem.firstElementChild.innerHTML = this.getLabel(container);
		}
	}

}

Qed.EditorContainer = EditorContainer;



// optional modules

(function(Qed) {


function Proxy(context, fn) {
  this.ctx = context || null;
  this.fn = fn;
  var self = this;
  return function() {
    var args = arguments.length > 0 ? Array.prototype.slice.call(arguments) : null;
    self.fn.apply(self.ctx, args);
  }
}

function CallOnce(context, fn, delay) {  
  this.ctx = context || null;
  this.fn = fn;
  this.delay = delay || 300;
  this.args = null;
  this.timer = null;

  this.deferCall = function() {
      var ctx = this.ctx;
      var fn = this.fn;
      var args = this.args;
      this.timer = window.setTimeout(function() {
        fn.apply(ctx, args);
      }, this.delay);
  }

  var self = this;
  return function() {
    if (self.timer) {      
      window.clearTimeout(self.timer);
      self.timer = null;
    }
    self.args = arguments.length > 0 ? Array.prototype.slice.call(arguments) : null;    
    //console.log('call defered');
    self.deferCall();
  }

}


function Popup(impl) {
  this.impl = impl;
  this.elt = null;
  this.term = null;
  this.fetching = false;
  //this.cache = {}; not yet impl

  this._create = function() {
  	var impl = this.impl;
    var elt = document.createElement('DIV');
    var className = 'qed-suggest-popup';
    if (impl.popupClass) {
    	className += ' '+impl.popupClass;
    }
    elt.className = className;
    var s = elt.style;
    s.position = 'absolute';
    s.overflowY = "scroll";

    var self = this;
    elt.addEventListener('click', function(e) {
      e.__suggestPopup = self;
      // find the clicked item
      var li = selectParent(e.target, elt, function(node) {
        return !!node.__suggestItem;
      });
      if (li) {
        var prevActive = elt.querySelector('li.active');
        if (li !== prevActive) {
          removeClass(prevActive, 'active');
          addClass(li, 'active');
        }
        self.complete();
      }
    });
    elt.addEventListener('mouseover', function(e) {
      var li = selectParent(e.target, elt, function(node) {
        return !!node.__suggestItem;
      });
      if (li) {
        var prevActive = elt.querySelector('li.active');
        if (li !== prevActive) {
          removeClass(prevActive, 'active');
          addClass(li, 'active');
        }
      }
    });
    document.addEventListener("click", function(e) {
      if (e.__suggestPopup !== self) {
        self.close();
      }
    });

    this.elt = elt;

    if (impl.render) {
    	this._renderItem = impl.render;
    }
  }

  this._renderItem = function(item) {
  	var impl = this.impl;
    var li = document.createElement('LI');
    li.appendChild(document.createTextNode(impl.text(item)));
    li.__suggestItem = item;
    return li;
  }

  this._render = function(data) {
    if (!data || !data.length) {
      return null;
    }
    var ul = document.createElement('UL');
    for (var i=0,len=data.length; i<len; i++) {
      ul.appendChild(this._renderItem(data[i]));
    }
    addClass(ul.firstChild, 'active');
    return ul;
  }

  this._setContent = function(contentElt) {
    if (contentElt) {
      // remove existing content
      var elt = this.elt;
      while (elt.firstChild) elt.removeChild(elt.firstChild);
      elt.appendChild(contentElt);
    } else {
      this.close();
    }
  }

  this.refresh = function(data) {
    this._setContent(this._render(data));
  }

  this.show = function(data, term) {
  	if (!data || !data.length) {
  		this.close();
  	} else if (this.isOpened()) {
      this.refresh(data);
    } else {
      var xy = term.range.getCaretXY();
	  var x = xy[0], y = xy[1];
      this.refresh(data);
      var s = this.elt.style;

      s.left = x+'px';
      s.top = y+'px';      

      document.body.appendChild(this.elt);    
    } // else if no data do nothing
  }

  this.isOpened = function() {
    return !!this.elt.parentNode;
  }

  this.open = function(term) {
    if (term == null || (this.term && this.term.value === term.value) ) {
      return;
    }
    if (this.fetching) {
    	return;
    }
    this.fetching = true;
    this.term = term;
    var self = this;
    this.impl.fetch(term.value, function(data) {
    	try {
	      	if (data instanceof Error) {
	        	console.error('Open Suggest : Server Error :', data.message);
	      	} else {
	        	self.show(data, term);
	      	}
	    } finally {
	      	self.fetching = false;
	    }
    });
  }

  // insert the selected suggestion and complete
  this.complete = function() {
  	if (this.term) {
	  	var value = this.getSelectionValue();
	  	if (value) {
	  		this.term.replace(value);
	  	}
  	}
  	this.close();
  }

  this.close = function() {
    var elt = this.elt;
    if (!elt.parentNode) return;
    document.body.removeChild(elt);    
    while (elt.firstChild) elt.removeChild(elt.firstChild);
    this.term = null;
  }

  this.getSelectedItem = function() {
  	return this.elt.querySelector('li.active');
  }

  this.selectNextItem = function(backwards) {
  	var activeItem = this.getSelectedItem();
  	if (!activeItem) return;
    var siblingKey, childKey;
  	if (backwards) {
  		siblingKey = 'previousElementSibling';
  		childKey = 'lastElementChild';
  	} else {
  		siblingKey = 'nextElementSibling';
  		childKey = 'firstElementChild';
  	}
  	var next = activeItem[siblingKey];
  	if (!next) {
  		next = activeItem.parentNode[childKey];
  	}
	  if (next !== activeItem) {
		  addClass(next, 'active');
		  removeClass(activeItem, 'active');
	  }      
	  return next;
  }

  this.getSelection = function() {
  	var item = this.getSelectedItem();
  	return item ? item.__suggestItem : null;
  }

  this.getSelectionValue = function() {
  	var item = this.getSelectedItem();
  	return item ? this.impl.value(item.__suggestItem) : null;
  }

  this._create();
}


function SuggestTerm(range, term, offset) {
	this.range = range;
	this.value = term;
	this.offset = offset;
	this.replace = function(value) {
		range.anchorOffset = this.offset;
		range.insertText(value).select();
	}
}

/**
 impl {
 	popupClass
 	term(range)
	fetch(term, callback(resultOrError))
	*id(item)
	*text(item)
	*value(item)
	*render(item)
	
 }
 */
function Suggest(editor, impl) {
  this.editor = editor;
  this.impl = impl;
  this.popup = new Popup(impl);
  this.delay = impl.delay === undefined ? 300 : (impl.delay > 0 ? impl.delay : null);

  this.suggest = function(range, term, offset) {
    //console.log('DO SUGGEST', term);
	  this.popup.open(new SuggestTerm(range, term, offset));
  };

  this.trySuggest = function() {
    var range = this.editor.doc.getFocusRange();
    if (range.isValid()) {
      var termRef = this.impl.term(range);
      if (termRef != null) {
        this.suggest(range, termRef[0], termRef[1]);
      } else {
          this.popup.close();
        }
    }
  }

  var suggestOnce = this.delay ? new CallOnce(this, this.trySuggest, this.delay) : new Proxy(this, this.trySuggest);

  this.keydown = function(e) {
  	var popup = this.popup;
    if (popup.isOpened()) {
      switch (e.which) {
        case 13:
        case 9:
        popup.complete();
        return true;
        case 27:
        popup.close();
        return true;
        case 38: // up
        popup.selectNextItem(true);
        return true;
        case 40: // down
        popup.selectNextItem(false);
        return true;
      }
    }
    return false;    
  };
  this.keypress = function(range) {
    suggestOnce();
  };


  // check impl
  if (!impl.term || !impl.fetch) {
  	throw new Error('Suggest implementation should provide a "term" and a "fetch" function');
  }
  if (!impl.text) {
  	impl.text = function (item) { return item; }
  }
  if (!impl.id) {
  	impl.id = impl.text;
  }
  if (!impl.value) {
  	impl.value = impl.text;
  }
}

Qed.Suggest = Suggest;

})(Qed);

(function(host) {
'use strict';

var blocks = {
  'html':true, 'body':true, 'p':true, 'div':true, 'pre':true, 'blockquote':true, 'h1':true, 'h2':true, 'h3':true, 'h4':true,'h5':true, 'h6':true, 'ol':true, 'ul':true, 'li':true, 'table':true, 'tbody':true, 'td':true, 'tfoot':true, 'th':true, 'thead':true, 'tr':true,
  'address':true, 'article':true, 'aside':true, 'audio':true, 'canvas':true, 'center':true, 'dd':true, 'dir':true, 'dl':true, 'dt':true, 'fieldset':true, 'figcaption':true, 'figure':true, 'footer':true, 'form':true, 'frameset':true, 'header':true, 'hgroup':true, 'isindex':true, 'main':true, 'menu':true, 'nav':true, 'noframes':true, 'noscript':true, 'output':true, 'section':true
};

function isBlock(lowercaseTagName) {
  return !!blocks[lowercaseTagName];
}

function canParseHtml() {
  // Firefox/Opera/IE throw errors on unsupported types
  try {
    // WebKit returns null on unsupported types
    if ((new DOMParser()).parseFromString("", "text/html")) {
      // text/html parsing is natively supported
      return true;
    }
  } catch (ex) {}
  return false;
}

var parseHTML = canParseHtml() ? function(html) {  
  return new DOMParser().parseFromString(html.trim(), "text/html");
} : function(html) {
  html = html.trim();
  var doc = document.implementation.createHTMLDocument("");
  if (html.substring(0, '<!doctype'.length).toLowerCase() === '<!doctype') {
    doc.documentElement.innerHTML = html;
  }
  else {
    doc.body.innerHTML = html;
  }
  return doc;
}


//=======================================

function noop() {}

function isEmptyTextNode(node) {
  return node.nodeType === 3 && /^\s*$/.test(node.nodeValue);
}

function printHeader(elt, prefix) {
    this.flushln().print(prefix).convertContent(elt).flushln().println();
}

function printPara(elt) {
    this.flushln().convertContent(elt).flushln().println();
}

function printBlock(elt) {
    this.flushln().convertContent(elt).flushln();
}

function printSpan(elt, styleMarker) {
    this.print(styleMarker).convertContent(elt).print(styleMarker);
}

function printList(elt, firstIndex) {
    var list = this.pushList(firstIndex || 0);
    if (list.parent) {
      printBlock.call(this, elt);
    } else {
      printPara.call(this, elt);
    }
    this.popList();
}

/**
 * Return an object {header: tr, rows: [tr ...]}. header is null if no header was found
 */
function getTableRows(tableElt) {
  var result = {header: null, rows: []};
  var elt = tableElt.firstElementChild;
  var i = 0;
  while (elt) {
    var tag = elt.tagName.toLowerCase();
    if (tag === 'tr') {
      result.rows.push(elt);
    } else if (tag === 'thead') {
      var trElt = elt.firstElementChild;
      if (trElt.tagName.toLowerCase() === 'tr') {
        result.header = trElt;
      }
    } else if (tag === 'tbody') {
      var trElt = elt.firstElementChild;
      while (trElt) {
        if (trElt.tagName.toLowerCase() === 'tr') {
          result.rows.push(trElt);
        }
        trElt = trElt.nextElementSibling;
      }
    }
    elt = elt.nextElementSibling;
  }
  if (!result.rows.length) {
    return null;
  }
  if (!result.header) {
    var firstRow = result.rows[0];
    if (firstRow.tagName.toLowerCase() === 'th') {
      result.header = result.rows.shift();  
      if (!result.rows.length) {
        return null;
      }
    }    
  }
  return result;
}

var tagConverters = {
  "script": noop, "style": noop, "link": noop, "head": noop, "template": noop, "frame": noop, "iframe": noop,
  "br": function(elt) {
    this.println('  \n');
  }, 
  "hr": function() {
    this.print('---').println();
  },
  "i": function(elt) {
    printSpan.call(this, elt, "_");
  },
  "b": function(elt) {
    printSpan.call(this, elt, "**");
  },
  "del": function(elt) {
    printSpan.call(this, elt, "~~");
  },
  "a": function(elt) {
    var href = elt.getAttribute('href');
    var text = elt.textContent;
    var title = elt.getAttribute('title');
    if (title) {
      href += ' "'+title+'"';
    }
    this.print('['+text+']('+href+')');
  },
  "img": function(elt) {
    var href = elt.getAttribute('src');
    var text = elt.getAttribute('alt');
    var title = elt.getAttribute('title');
    if (title) {
      href += ' "'+title+'"';
    }
    this.print('!['+text+']('+href+')');
  },
  "p": function(elt) {
    printPara.call(this, elt);
  }, 
  "ol": function(elt) {
    printList.call(this, elt, 1);
  }, 
  "ul": function(elt) {
    printList.call(this, elt, 0);
  }, 
  "li": function(elt) {
    var item = elt.textContent;
    var list = this.currentList;
    // flush previous line and write prefix
    this.printRawText(list ? list.prefix : ''); 
    if (list && list.index > 0) {
      var index = list.index++;
      this.print(index+'. ').convertContent(elt).flushln();
    } else {
      this.print("* ").convertContent(elt).flushln();  
    }
  },
  "h1": function(elt) {
    printHeader.call(this, elt, "# ");    
  },
  "h2": function(elt) {
    printHeader.call(this, elt, "## ");
  },
  "h3": function(elt) {
    printHeader.call(this, elt, "### ");
  },
  "h4": function(elt) {
    printHeader.call(this, elt, "#### ");
  },
  "h5": function(elt) {
    printHeader.call(this, elt, "##### ");
  },
  "h6": function(elt) {
    printHeader.call(this, elt, "###### ");
  },
  "blockquote": function(elt) {
    this.flushln().push("> ").convertContent(elt).pop("> ").flushln().println();
  },  
  "code": function(elt) {
    this.print('`'+elt.textContent+'`');
  },  
  "pre": function(elt) {
    var text, lang ='';
    var first = elt.firstElementChild;
    var last = elt.lastElementChild;
    if (first === last && first.tagName.toLowerCase() === 'code') {
      var klasses = first.className;
      if (klasses) {
        var i = klasses.indexOf(' ');
        lang = i > -1 ? klasses.substring(0, i) : klasses;
      }
      text = first.textContent;
    } else {
      text = elt.textContent;
    }
    this.flushln().print("```"+lang).printRawBlock(text).print("```").println().println();
  }/*,
  "table": function(elt) {
    this.flushln();
    var table = getTableRows(elt);
    if (!table) {
      return;
    }
    var thead = [];
    var border = [];
    var tbody = [];
    if (table.header) {
      var tr = table.header;
      for (var i=0,len=tr.length; i<len; i++) { 
        var th = tr[i].textContent;
        thead.push(th);
        border.push(Array(th.length+1).join("-"));
      }      
    } else {
      var tr = table.rows[0];
      for (var i=0,len=tr.length; i<len; i++) { 
        thead.push(Array(tr[i].length+1).join(" "));
        border.push(Array(tr[i].length+1).join("-"));
      }
    }

    this.print('| '+thead.join(' | ')+' |').println();
    this.print('| '+border.join(' | ')+' |').println();
    var rows = table.rows;
    for (var i=0,len=rows.length; i<len; i++) {
      var row = [], tr = rows[i];
      for (var j=0,cols=tr.length; j<cols; j++) {
        row.push(tr[j].textContent);
      }
      this.print('| '+row.join(' | ')+' |').println();
    }
    this.println();
  }*/
};



function MdConverter(converters) {
  this.text = '';
  this.line = '';
  this.converters = converters || null;
  this.prefix = '';
  this.currentList = null;


  this.println = function(crlf) {
    // normalize whitespaces first
    var line = this.line.trim().replace(/\s+/g, ' ');
    this.text += this.prefix+line+(crlf || '\n');
    this.line = '';
    return this;
  }

  this.flushln = function() {
    if (this.line) {
      this.println();
    }
    return this;
  }

  this.print = function(text) {
    this.line += text;
    return this;
  }

  this.printRawBlock = function(text) {    
    this.flushln();
    this.text += text;
    if (text.charCodeAt(text.length-1) > 32) {
      this.text += '\n';
    }
    return this;
  }

  this.printRawText = function(text) {    
    this.flushln();
    this.text += text;
    return this;
  }

  this.push = function(prefix) {
    this.prefix += prefix;
    return this;
  }

  this.pop = function(prefix) {
    var p = this.prefix;
    this.prefix = p.length > prefix.length ? p.substring(0, p.length-prefix.length) : '';
    return this;
  }

  this.pushList = function(index) {
    var parentList = this.currentList;
    var prefix = parentList ? parentList.prefix+'    ' : '';
    this.currentList = {"parent": parentList, "prefix": prefix, "index": index || 0};
    return this.currentList;
  }

  this.popList = function() {
    if (!this.currentList) {
      return null;
    }
    var list = this.currentList;
    this.currentList = list.parent;
    return list;
  }

  this.convert = function(elementOrHtml) {    
    var elt;
    if (typeof elementOrHtml === 'string') {
      elt = parseHTML(elementOrHtml).body;
    } else if (elementOrHtml.tagName) { // ensure a DOM element
      elt = elementOrHtml;
    } else {
      throw new Error('Expecting a string or DOM element');      
    }
    this.convertElement(elt, this);
    this.flushln();
    return this.text;
  }

  this.convertElement = function(elt) {    
    var tag = elt.tagName.toLowerCase();
    var convert = null;
    if (this.converters) {
      convert = this.converters[tag];
    }
    if (!convert) {
      convert = tagConverters[tag]; 
    }
    if (convert) {
      convert.call(this, elt);
    } else {
      // the default
      this.convertContent(elt);
      if (isBlock(tag)) {
        this.flushln();
        if (this.text.charCodeAt(this.text.lemgth-1) <= 32) {
          this.text += '\n';
        }
      }
    }    
  }

  this.convertContent = function(elt) {
    var node = elt.firstChild;
    if (!node) { // no children
      return this;
    }
    // trim node if a block node
    var first = node, end = null;
    var tagName = elt.tagName.toLowerCase();
    if (isBlock(tagName)) {
      // skip first and last node if they contains only empty spaces
      if (isEmptyTextNode(first)) {
        first = first.nextSibling;
        if (!first) { // empty node
          return this;
        }
      }
      node = elt.lastChild;
      if (isEmptyTextNode(node)) {
        end = node;
      }
    }

    node = first;
    while (node !== end) {
      var nodeType = node.nodeType;
      if (nodeType === 3) { // text
        this.print(node.nodeValue);
      } else if (nodeType === 1) { // element
        this.convertElement(node);
      } // else ignore
      node = node.nextSibling;
    }
    return this;
  }

}

host.MdConverter = MdConverter;
host.parseHTML = parseHTML;
host.toMarkdown = function(elementOrHtml) {
  return new MdConverter().convert(elementOrHtml);
};

})(Qed);


return Qed;

}));
