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

