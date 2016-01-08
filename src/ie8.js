// polyfills for ie8 -  not yet used 


var _testElement = document.createElement('DIV');
// from https://github.com/termi/ES5-DOM-SHIM/blob/0.8/__SRC/a.ie8.js
//[IE lt 9, old browsers] Traversal for IE < 9 and other
if(_testElement.childElementCount == void 0) {
	Object.defineProperties(_Element_prototype, {
		"firstElementChild" : {//https://developer.mozilla.org/en/DOM/Element.firstElementChild
			"get" : function() {
			    var node = this;
			    node = node.firstChild;
			    while(node && node.nodeType != 1) node = node.nextSibling;
			    return node;
			}
		},
		"lastElementChild" : {//https://developer.mozilla.org/En/DOM/Element.lastElementChild
			"get" : function() {
			    var node = this;
			    node = node.lastChild;
			    while(node && node.nodeType != 1) node = node.previousSibling;
			    return node;
			}
		},
		"nextElementSibling" : {//https://developer.mozilla.org/En/DOM/Element.nextElementSibling
			"get" : function() {
			    var node = this;
			    while(node = node.nextSibling) if(node.nodeType == 1) break;
			    return node;
			}
		},
		"previousElementSibling" : {//https://developer.mozilla.org/En/DOM/Element.previousElementSibling
			"get" : function() {
			    var node = this;
			    while(node = node.previousSibling) if(node.nodeType == 1) break;
	    		return node;
			}
		}
	});
}

// addEventListener
(function() {
  if (!Event.prototype.preventDefault) {
    Event.prototype.preventDefault=function() {
      this.returnValue=false;
    };
  }
  if (!Event.prototype.stopPropagation) {
    Event.prototype.stopPropagation=function() {
      this.cancelBubble=true;
    };
  }
  if (!Element.prototype.addEventListener) {
    var eventListeners=[];
    
    var addEventListener=function(type,listener /*, useCapture (will be ignored) */) {
      var self=this;
      var wrapper=function(e) {
        e.target=e.srcElement;
        e.currentTarget=self;
        if (listener.handleEvent) {
          listener.handleEvent(e);
        } else {
          listener.call(self,e);
        }
      };
      if (type=="DOMContentLoaded") {
        var wrapper2=function(e) {
          if (document.readyState=="complete") {
            wrapper(e);
          }
        };
        document.attachEvent("onreadystatechange",wrapper2);
        eventListeners.push({object:this,type:type,listener:listener,wrapper:wrapper2});
        
        if (document.readyState=="complete") {
          var e=new Event();
          e.srcElement=window;
          wrapper2(e);
        }
      } else {
        this.attachEvent("on"+type,wrapper);
        eventListeners.push({object:this,type:type,listener:listener,wrapper:wrapper});
      }
    };
    var removeEventListener=function(type,listener /*, useCapture (will be ignored) */) {
      var counter=0;
      while (counter<eventListeners.length) {
        var eventListener=eventListeners[counter];
        if (eventListener.object==this && eventListener.type==type && eventListener.listener==listener) {
          if (type=="DOMContentLoaded") {
            this.detachEvent("onreadystatechange",eventListener.wrapper);
          } else {
            this.detachEvent("on"+type,eventListener.wrapper);
          }
          eventListeners.splice(counter, 1);
          break;
        }
        ++counter;
      }
    };
    Element.prototype.addEventListener=addEventListener;
    Element.prototype.removeEventListener=removeEventListener;
    if (HTMLDocument) {
      HTMLDocument.prototype.addEventListener=addEventListener;
      HTMLDocument.prototype.removeEventListener=removeEventListener;
    }
    if (Window) {
      Window.prototype.addEventListener=addEventListener;
      Window.prototype.removeEventListener=removeEventListener;
    }
  }
})();

//TODO: classlist?
