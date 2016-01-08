@export Qed

"use strict";

var MACOS = navigator.userAgent.indexOf('Mac OS X') != -1;
var ID_GEN=0; // increment used by components who eneed to generate ids
var noop = function(){}

var Qed = {
    resolve: function(selectorOrElem) {
        if (typeof selectorOrElem === 'string') {
            return document.querySelector(selectorOrElem);
        } else {
            return selectorOrElem;
        }
    },
    create: function(selector, settings) {
        return new EditorContainer().create(Qed.resolve(selector), settings);
    }
};

//@include ie8.js
@include dom.js
@include listeners.js
@include range.js
@include markdown.js
@include model.js
@include undo.js
@include actions.js
@include editor.js
@include preview.js
@include container.js

// optional modules
@include suggest.js
@include toMarkdown.js

return Qed;
