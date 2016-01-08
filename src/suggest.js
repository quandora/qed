
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
