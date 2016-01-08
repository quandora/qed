

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
