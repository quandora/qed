
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
