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
* Markdown syntax highlighting and HTML apercu or hints when possible.
* Markdown syntax autocompletion.
* Live preview (requires marked.js dependency)
* Native spellcheck (uses the browser *content editable* capability).
* Copy / Paste and customizable drag / drop. 
* HTML pasted content is converted to markdown (not supported on IE)
* Fully configurable suggest / autocompletion support.
* Extensibility through custom actions.
* Optional toolbar extensible thorugh custom actions.
* Customizable stylesheet

**Not yet implemented**:
* find/replace

**To be implemented**:
* Automatic reference-style management: keep link definitions and references in sync.
This will make possible to insert *human friendly* links by inserting link references and automatically managing the link definitions.

## Distribution files

The editor is distributed as one default css file and a javascript file that comes in 3 different flavors depending on your needs:

* Default CSS file: `src/editor.css`
* JS files:
  * `build/qed-all.js` - include the editor code and all dependencies (marked.js and MutationObserver.js)
  * `build/qed-core.js` - include the editor code and the MutationObserver.js dependency
  * `build/qed.js`- include only the editor code. No dependencies are included.

The minified versions of these files are ending in `.min.js`.

The `build/qed.min.js` file is about **57K** and gziped is about **15K**.

## Building 

To build the editor you need [Grunt](http://gruntjs.com/). To install grunt and get started with, see http://gruntjs.com/getting-started

You need first to install the project build dependencies before running the build. 
Go to the project directory and run: (you should do this only the once to locally download dependencies)

```shell
npm install
```

Then to build simply run:

```shell
grunt
```

## Usage


For more details look into the sources and in the `demo` directory.

## Demo

You can see a live demo [here]()
