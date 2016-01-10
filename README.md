# qed

> Quandora markdown editor

The editor aim is to provide an easy to use markdown editor for both developers and regular users. It still remains a code source editor but it tries to give an apercu of the final HTML rendering while typing. For more demanding users there is also a live HTML preview available with scroll synchronization. 

Its primary goal is to write comments or small / medium documents. It is not especially designed to deal with large markdown documents.

The editor is implemented in pure javascript and it is based on the [Content Editable](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Content_Editable) browsers capability. 

**Here is a [Live Editor Demo](http://quandora.github.io/qed/demo.html) that will open this Readme file in full size mode**.

## Dependencies

There are no dependencies for the core part of the editor. 
Only two optional dependencies are needed when using the preview and live preview feature:

* [marked.js](https://github.com/chjj/marked) - a Markdown parser which is needed to generate the HTML preview (only needed when using the preview feature)
* [MutationObserver.js](https://github.com/polymer/MutationObservers) - A Mutation Observers Polyfill which is needed for the live preview feature on IE9

## Requirements:
Any *evergreen* browser (i.e. Chrome, Safari, Firefox, IE10+). To work in IE 9 it requires the `MutationObserver.js` dependency.

## Features
* Markdown syntax highlighting and HTML apercu or hints when possible.
* Markdown syntax autocompletion.
* Live preview (requires marked.js dependency)
* Native spellcheck (uses the browser *content editable* capability).
* Copy / Paste and customizable drag / drop. 
* HTML pasted content is converted to markdown (not supported on IE where the HTML is pasted as plain text).
* Fully configurable suggest / autocompletion support.
* Extensibility through custom actions.
* Minimal mode for inline editing (with no toolbar).
* Editor mode with a customizable toolbar (you can remove or add custom actions as you want).
* Full Page mode - maximize to the size of the browser client area.
* Customizable stylesheet for both toolbar and editor content.

**To be implemented**:
* Automatic reference-style management: keep link definitions and references in sync.
This will make possible to insert *human friendly* links by inserting link references and automatically manage the link definitions.

## Distribution files

The editor is distributed as one default css file and a javascript file that comes in 3 different flavors depending on your needs:

* Default CSS file: `src/editor.css`
* JS files:
  * `build/qed-all.js` - include the editor code and all dependencies (marked.js and MutationObserver.js).
  * `build/qed-core.js` - include the editor code and the MutationObserver.js dependency.
  * `build/qed.js`- include only the editor code. No dependencies are included.
  
The minified versions of these files are ending in `.min.js`.  
The `build/qed.min.js` file is about **57K** and gziped is about **15K**.

**Note**: Usually when using the markdown editor you will want to use the preview too - in that case it is better to define a custom stylesheet for the preview - otherwise you will end up with the browser defaults which are not very pretty.
We have an example of such a stylesheet in `demo/preview.css` that you can use - it is not the best one - but surely better than the browser defaults.

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

To use the editor you should include in your HTML page the editor javascript file (which one depends on your needs) and a stylesheet to configure the editor and optionally a stylesheet for the preview.  
You can use the default stylesheets from `src/editor.css` and `demo/preview.css`.  
For the example below we will use the complete qed build (containing all the dependencies): `build/qed-all.min.js`.

### Including the required scripts and sylesheets

First you need to declare the editor and the stylesheets in your page.  
Put this in the page `head`:

```html
<link rel="stylesheet" href="path/to/editor.css">
<link rel="stylesheet" href="path/to/preview.css">
<script type='text/javascript' src='path/to/qed-all.min.js'></script>
```

### Attach the editor to a `textarea` element

The simplest method to use the editor is to attach it to an existing `textarea` element:

Given a textarea input with an id of `qed-demo` you can attach an editor to it by using the following code:

```javascript
var qed = Qed.create("#qed-demo");
```

This is the minimal code required to instantiate an editor.

By default the editor height wil grow to display the entire content.  
If you want to use a fixed height (with a scrollbar) then you must specify the height in the editor settings at creation.

Example:

```javascript
var qed = Qed.create("#qed-demo", { height: 300 });
```

**Note** that by default no toolbar is displayed. See below in the "Defining the editor toolbar" section on how to enable the toolbar.

### Editor settings.

Here is a list with all the supported settings:

* **height** - *integer*. Use a fixed height (the height is expressed in pixels and must be a positive integer).
* **autofocus** - *boolean*. If true the editor will request the focus at creation time. The default is false.
* **confirmOnLeave** - *string*. If defined a confirmation prompt will be displayed when the user is leaving the page and the editor is dirty (i.e. content was not save). The *string* value of this setting will be used as the prompt message.
* **submittingClass** - *string*. The class that should be set on the containing form while the form is submited to be able to ignore the `confirmOnLeave` prompt when submitting. The default is 'submitting'. You can also set the `submitting` property on the editor container instance to achieve the same.
* **fullscreen** - *boolean*. If true the editor is created in full page mode. The default is false. (You can switch later in "fullscreen" mode by invoking the appropiate editor action.
* **leftBar** - *array*. Defined the content of the action bar which will be aligned on the left of the toolbar. The default is no toolbar. The action bar is defined as an array obj action objects.
* **rightBar** - *array*. Defined the content of the action bar which will be aligned on the right of the toolbar. The default is no toolbar. The action bar is defined as an array obj action objects.
* **suggest** - *object*. Define a suggestion implementation. No suggestion implementation is defined by default. See "Defining Editor Suggestions" section for more details.
* **insertImage** - *function*. Define an action to insert an image. By default no insert image action is provided.
This function should open a dialog to let the user upload or choose an image from an external service and when done to insert the image code at the current caret position.
* **dropFiles** - *function*. Define a drop action. The function is called on browser `drop` event with two arguments: `files` and `event` where files is `event.dataTransfer.files`. This function is responsible to modify the editor content and to upload the dropped file if needed. By default no drop logi is provided.
* **previewTransforms** - *array*. Define an array of tranformation functions to apply after the preview was generated. A transformation function will be called with two arguments: `element` and `focusOnCaret` where element is the preview element anf focusOnCaret is a boolean indicating if focus synchronization is enabled or not.

### Defining the editor toolbar.

The toolbar is made of two action bars. The first bar (the main one) aligned on the left and a second one is aligned on the right. The irght action bar can be used for actons like help etc.

To enable the toolbar you must define at least one action bar. To define the left action bar you must specify a `leftBar` in the editor settings and to define the right bar you must specify a `rightBar` in the ditor settings. Both bars have the same format - an array of action objects.  
An action is an objectin the following format:

```javascript
{name: "the_action_id", label: "A label for this action", title: "A tooltip for the action", exec: function(qed) {...}}
```

For the toggle like actions you can define to different labels - one to be displaued when the toggle is on the other one when it is off:

```javascript
{name: "the_action_id", labelOn: "A label for this action when toggle is ON", labelOff: "A label for this action when toggle is OFF", title: "A tooltip for the action", exec: function(qed) {...}}
```

if the `the_action_id` is a built-in action then you don't need to specify an `exec` function since built-in exec function bound to that action will be used. The `exec` must be defined only when there is not a built-in execution fucntion bound to the action ID.

Usually you want to have an **icon** instead of a label. To do so you should use a HTML label which will insert a font icon. You can freely use [Font Awesome](https://fortawesome.github.io/Font-Awesome/) to do this.

In order to use **Font Awesome** font icons include this in the document head:

```html
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/4.4.0/css/font-awesome.min.css">
```

Here is an example for the built-in `bold` action by using the **bold** font icon defined by Font Awesome:

```javascript
{name: "bold", label: "<i class='fa fa-bold'></i>", title: "Bold"}
```

Most of the built-in actions already have shortcuts. For custom actions, to define a shortcut you must specify it in the `title` property at the end. Example:

```javascript
{name: "preview", labelOff: "<i class='fa fa-eye'></i>", labelOn: "<i class='fa fa-edit'></i>", title: 'Toggle Preview Mode (Ctrl+F)'}
```

The `title`ends in (Ctrl+F) which is defining the shortcut.

To define a **separator** between two actions just use the string `"|"` as the action definition.

Here is a complete  toolbar with all the built-in actions (this is using **Font Awesome** for the labels)

```javascript
...
leftBar: [
  {name: "undo", label: "<i class='fa fa-undo'></i>", title: "Undo"},
  {name: "redo", label: "<i class='fa fa-repeat'></i>", title: "Redo"},
  "|",        
  {name: "bold", label: "<i class='fa fa-bold'></i>", title: "Bold"},
  {name: "italic", label: "<i class='fa fa-italic'></i>", title: "Italic"},
  {name: "strike", label: "<i class='fa fa-strikethrough'></i>", title: "Strikethrough", },
  "|",
  {name: "h1", label: "H1", title: "Heading 1"},
  {name: "h2", label: "H2", title: "Heading 2"},
  {name: "h3", label: "H3", title: "Heading 3"},
  "|",
  {name: "code", label: "<i class='fa fa-code'></i>", title: "Insert Code"},
  {name: "quote", label: "<i class='fa fa-quote-right'></i>", title: "Block Quotes"},
  "|",
  {name: "ul", label: "<i class='fa fa-list-ul'></i>", title: "Unordered List"},
  {name: "ol", label: "<i class='fa fa-list-ol'></i>", title: "Ordered List"},
  "|",
  {name: "link", label: "<i class='fa fa-link'></i>", title: "Insert Link"},
  {name: "image", label: "<i class='fa fa-picture-o'></i>", title: "Insert Image"}
],        
rightBar: [
  {name: "help", label: "<i class='fa fa-support'></i>", title: 'Markdown Cheatsheet', exec: function(container) { window.open("https://github.com/adam-p/markdown-here/wiki/Markdown-Cheatsheet"); }},
  {name: "preview", labelOff: "<i class='fa fa-eye'></i>", labelOn: "<i class='fa fa-edit'></i>", title: 'Toggle Preview Mode (Ctrl+F)'},
  {name: "fullscreen", labelOff: "<i class='fa fa-external-link'></i>", labelOn: "<i class='fa fa-remove'></i>", title:'Toggle Fullscreen Mode (Shift+Ctrl+F)'}
]
...
```
**Note** that the `image` action requires an `insertImage` fucntion to be defined in the editor settings.

### Defining custom themes.

You can define your own themes using custom stylesheets. Here is an example of defining a **blue** toolbar theme for the editor toolbar:

```
.qed-container {
    border: 1px solid #54ADE3;
}
.qed-toolbar {
  background-color: #71BBE8;
  color: white;
}
.qed-toolbar button {
  color: white;
}
.qed-toolbar-item:hover {
  background-color: #54ADE3;
}
```

You can also customize the editor content styles.

### Defining Custom Actions.

Here is a naive example of a custom action:

```
{name: "myaction", label: "Ping!", title:'Ping (Alt+Ctrl+P)', exec: function(container) { alert('Pong!'); }}
```

Usually we will want to modify the editor content when executing an action. Modifying the markdown content is always done through a **Range** object. Any action you want to perform on the content will require you to interact with qed Range API. 

To do a more sofisticated action we will have to use this *range* object to modify the content. 
The current focus range is fetched using:

```javascript
var range = editor.getOrInitFocusRange();
```

where editor is the `editor instance` (and **not** the `editor container`!).
When creating an editor using:

```javascript
var qed = Qed.create("#qed-demo");
```

the `qed` variable will be an instance of the editor container. You can get the editor instance by using:

```
var editor = qed.editor;
```

The **editor container** instance manages the toolbar, the custom actions and the editor instance. The **editor** instance manage the markdown content and provide an API to modify this content.

We will modify our action to insert the 'Pong!' at the cursor position instead of displaying an alert message.

Our action `exec` function is called with a `container` argument which is the editor container. We should thus retrieve the editor instance  through `container.editor` to write into the marlkdon document.

First we need to get the current editor selection range:

```javascript
function myAction(container) {
  var editor = container.editor;
  var range = editor.getOrInitFocusRange();
  range.insertText('Pong!').select();
  editor.takeSnapshot(range);
}
```

Let's explain what we've done here:

1. `editor.getOrInitFocusRange()` just return the focus (i.e. selection) range of the editor. If the editor doesn't have the focus it will request the focus (and will place the caret to the begining of the markdown document).
2. `range.insertText('Pong!').select()` is inserting the text "Pong!" at the caret position (removing selected text if any) then will refresh the caret (through `.select()` call).
3. `editor.takeSnapshot(range)` will push our changes into the **Undo/Redo** stack. If we don't call this - the **Undo manager** will ignore the changes we've made.

Now that we just defined our "more sofisticated" action we can add it like this to the editor:

```javascript
var qed = Qed.create("#qed-demo", {
  height: 300,
  leftBar: [
    {name: "myaction", label: "Ping!", title:'Ping (Alt+Ctrl+P)', exec: myAction}
  ]
});
```

If you want to see more examples on how to use the range API just look in the sources for the built-in actions.


### Defining Editor Suggestions.


### More?

For more details look into the sources and in the `demo` directory.  

## Live Examples

1. [Readme Page Demo](http://quandora.github.io/qed/demo.html) - See this README page in the editor.
The default toolbar theme and actions are used. The editor is opened in **full page** mode. 
2. [Minimal Editor Setup](http://quandora.github.io/qed/example1.html).
The minimal code required to instantiated an ediyor on an existing textarea.
3. [Custom Action](http://quandora.github.io/qed/example2.html).
Implementing a custom action (the PING/PONG action from above). The Toolbar is using the default style.
4. [Custom Action](http://quandora.github.io/qed/example3.html).
Implementing a custom action (the PING/PONG action from above). The Toolbar is using a "blue" theme.
5. [Suggest Feature](http://quandora.github.io/qed/example4.html).
Providing a suggest implementation to suggest country names. Just type `@` followed by a country name to see suggestions popping up.

