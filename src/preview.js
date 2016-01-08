
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
