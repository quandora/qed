
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
