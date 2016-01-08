
// =========== prefix and suffix matching extracted from https://code.google.com/p/google-diff-match-patch ==============
//TODO Snapshot.apply must make diff to update only the impacted range and not the whole document

/**
 * Determine the common prefix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the start of each
 *     string.
 */
function diff_commonPrefix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 || text1.charAt(0) != text2.charAt(0)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerstart = 0;
  while (pointermin < pointermid) {
    if (text1.substring(pointerstart, pointermid) ==
        text2.substring(pointerstart, pointermid)) {
      pointermin = pointermid;
      pointerstart = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


/**
 * Determine the common suffix of two strings.
 * @param {string} text1 First string.
 * @param {string} text2 Second string.
 * @return {number} The number of characters common to the end of each string.
 */
function diff_commonSuffix(text1, text2) {
  // Quick check for common null cases.
  if (!text1 || !text2 ||
      text1.charAt(text1.length - 1) != text2.charAt(text2.length - 1)) {
    return 0;
  }
  // Binary search.
  // Performance analysis: http://neil.fraser.name/news/2007/10/09/
  var pointermin = 0;
  var pointermax = Math.min(text1.length, text2.length);
  var pointermid = pointermax;
  var pointerend = 0;
  while (pointermin < pointermid) {
    if (text1.substring(text1.length - pointermid, text1.length - pointerend) ==
        text2.substring(text2.length - pointermid, text2.length - pointerend)) {
      pointermin = pointermid;
      pointerend = pointermin;
    } else {
      pointermax = pointermid;
    }
    pointermid = Math.floor((pointermax - pointermin) / 2 + pointermin);
  }
  return pointermid;
};


function mergeSnapshot(previousSnapshot, snapshot) {
  if (!previousSnapshot) {
  	return false;
  }
  if (previousSnapshot.text === snapshot.text) {
    return true;
  }
  return false;
}


function UndoManager(editor, size) {
  this.editor = editor;
  this.undoStack = [];
  this.redoStack = [];
  this.size = size || 50;
  this.listeners = new ListenerRegistry(this);
  this.kcnt = 0; // the keystrokes count since the last snapshot

  this.addListener = function(undoRedoListener) {
    return this.listeners.add(undoRedoListener);
  }

  this.canUndo = function() {
    return this.undoStack.length > 1;
  }

  this.canRedo = function() {
    return this.redoStack.length > 0;
  }

  this.undo = function() { 
    if (!this.canUndo()) {
      return null;
    }

    // in case of a first undo - take a snapshot if current state is dirty and put it in the redo stack
    if (this.redoStack.length === 0) { // first undo
        // take a snapshot and put it on the redo stack
        var range = this.editor.doc.getFocusRange();
        if (range.isValid()) { //TODO when hiting undo button is the range valid?
          this.push(range.takeSnapshot());
        }      
    }

    // the undo stack contains on the top the snapshot as it is diplayed to the user.
    var snapshot = this.undoStack.pop();
    // move current state into the redo stack
    this.redoStack.push(snapshot);      
    // now apply the top snapshot if any
    var top = this.undoStack.length-1;
    this.undoStack[top].apply(this.editor.doc); 
    this.listeners.fire();
    return snapshot;
  }

  this.redo = function() {
    var snapshot = this.redoStack.pop();
    if (!snapshot) {
      return null;
    }
    snapshot.apply(this.editor.doc);
    this.undoStack.push(snapshot);
    this.listeners.fire();
    return snapshot;
  }  

  this.push = function(snapshot) {
    var stack = this.undoStack;
    var lastSnapshot = stack.length > 0 ? stack[stack.length-1] : null;

    this.kcnt = 0; // reset keystroke counter    
    this.redoStack.length = 0; // clear redo stack on push
    
    if (!mergeSnapshot(lastSnapshot, snapshot)) {
      if (stack.length > this.size) {
        stack.shift();
      }
      stack.push(snapshot);
    }

    this.listeners.fire();
  }

  this.init = function(text) {
    this.redoStack.length = 0;
    var s = new Snapshot();
    s.text = text || "\n";
    s.focus = [0,0,0,0];
    this.undoStack.length = 0;
    this.undoStack.push(s);
    this.listeners.fire();
  }

  /**
   * Decide whether or not a keystroke should trigger a snapshot.
   */
  this.shouldTakeSnapshot = function(charCode) {
    if (this.redoStack.length) {
      this.redoStack.length = 0; // clear redo stack on keypress
      this.listeners.fire();
    }
    this.kcnt++;
    return this.undoStack.length <=1 || this.kcnt > 32 || !charCode.trim() || " .,;!?".indexOf(charCode) > -1;
  }

}


