

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

