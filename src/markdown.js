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
