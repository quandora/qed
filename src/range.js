
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
