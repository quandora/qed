# qed

> Quandora markdown editor

The editor aim is to provide an easy to use markdown editor for both developers and regular users. It still remainins a code source editor but it tries to give an apercu of the final HTML rendering while typing. For more demanding users there is also a live HTML preview available with scroll synchronization. 

Its primary goal is to write comments or small / medium documents. It is not especially designed to deal with large markdown documents.

The editor is implemented in pure javascript and it is based on the [Content Editable](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Content_Editable) browsers capability. 

## Dependencies

There are no dependencies for the core part of the editor. 
Only two optional dependencies are needed when using the preview and live preview feature:

* [marked.js](https://github.com/chjj/marked) - a Markdown parser which is needed to generate the HTML preview (only needed when using the preview feature)
* [MutationObserver.js](https://github.com/polymer/MutationObservers) - A Mutation Observers Polyfill which is needed for the live preview preview feature on IE9

## Requirements:
Any "evergreen" browser (i.e. Chrome, Safari, Firefox, IE10+). To work in IE 9 it requires the MutationObserver.js dependency.

## Features
* markdown syntax highlighting and HTML apercu or hints when possible.
* markdown syntax autocompletion.
* live preview (requires marked.js dependency)
* native spellcheck (uses the browser *content editable* capability).
* Copy / Paste and customizable drag / drop. 
* HTML pasted content is converted to markdown (not supported on IE)
* Fully configurable suggest / autocompletion support.
* Extensibility through custom actions.
* Customizable stylesheet

**Not yet implemented**
* find/replace

**To be implemented**

* Automatic reference-style management: keep link definitions and references in sync.

## Distribution
The editor consist of one css file and a javascript file that comes in 3 different falvors depending on your needs:
*

## Building 

```shell
npm install grunt-umd-wrapper --save-dev
```


## Usage


