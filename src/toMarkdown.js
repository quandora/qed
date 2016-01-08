(function(host) {
'use strict';

var blocks = {
  'html':true, 'body':true, 'p':true, 'div':true, 'pre':true, 'blockquote':true, 'h1':true, 'h2':true, 'h3':true, 'h4':true,'h5':true, 'h6':true, 'ol':true, 'ul':true, 'li':true, 'table':true, 'tbody':true, 'td':true, 'tfoot':true, 'th':true, 'thead':true, 'tr':true,
  'address':true, 'article':true, 'aside':true, 'audio':true, 'canvas':true, 'center':true, 'dd':true, 'dir':true, 'dl':true, 'dt':true, 'fieldset':true, 'figcaption':true, 'figure':true, 'footer':true, 'form':true, 'frameset':true, 'header':true, 'hgroup':true, 'isindex':true, 'main':true, 'menu':true, 'nav':true, 'noframes':true, 'noscript':true, 'output':true, 'section':true
};

function isBlock(lowercaseTagName) {
  return !!blocks[lowercaseTagName];
}

function canParseHtml() {
  // Firefox/Opera/IE throw errors on unsupported types
  try {
    // WebKit returns null on unsupported types
    if ((new DOMParser()).parseFromString("", "text/html")) {
      // text/html parsing is natively supported
      return true;
    }
  } catch (ex) {}
  return false;
}

var parseHTML = canParseHtml() ? function(html) {  
  return new DOMParser().parseFromString(html.trim(), "text/html");
} : function(html) {
  html = html.trim();
  var doc = document.implementation.createHTMLDocument("");
  if (html.substring(0, '<!doctype'.length).toLowerCase() === '<!doctype') {
    doc.documentElement.innerHTML = html;
  }
  else {
    doc.body.innerHTML = html;
  }
  return doc;
}


//=======================================

function noop() {}

function isEmptyTextNode(node) {
  return node.nodeType === 3 && /^\s*$/.test(node.nodeValue);
}

function printHeader(elt, prefix) {
    this.flushln().print(prefix).convertContent(elt).flushln().println();
}

function printPara(elt) {
    this.flushln().convertContent(elt).flushln().println();
}

function printBlock(elt) {
    this.flushln().convertContent(elt).flushln();
}

function printSpan(elt, styleMarker) {
    this.print(styleMarker).convertContent(elt).print(styleMarker);
}

function printList(elt, firstIndex) {
    var list = this.pushList(firstIndex || 0);
    if (list.parent) {
      printBlock.call(this, elt);
    } else {
      printPara.call(this, elt);
    }
    this.popList();
}

/**
 * Return an object {header: tr, rows: [tr ...]}. header is null if no header was found
 */
function getTableRows(tableElt) {
  var result = {header: null, rows: []};
  var elt = tableElt.firstElementChild;
  var i = 0;
  while (elt) {
    var tag = elt.tagName.toLowerCase();
    if (tag === 'tr') {
      result.rows.push(elt);
    } else if (tag === 'thead') {
      var trElt = elt.firstElementChild;
      if (trElt.tagName.toLowerCase() === 'tr') {
        result.header = trElt;
      }
    } else if (tag === 'tbody') {
      var trElt = elt.firstElementChild;
      while (trElt) {
        if (trElt.tagName.toLowerCase() === 'tr') {
          result.rows.push(trElt);
        }
        trElt = trElt.nextElementSibling;
      }
    }
    elt = elt.nextElementSibling;
  }
  if (!result.rows.length) {
    return null;
  }
  if (!result.header) {
    var firstRow = result.rows[0];
    if (firstRow.tagName.toLowerCase() === 'th') {
      result.header = result.rows.shift();  
      if (!result.rows.length) {
        return null;
      }
    }    
  }
  return result;
}

var tagConverters = {
  "script": noop, "style": noop, "link": noop, "head": noop, "template": noop, "frame": noop, "iframe": noop,
  "br": function(elt) {
    this.println('  \n');
  }, 
  "hr": function() {
    this.print('---').println();
  },
  "i": function(elt) {
    printSpan.call(this, elt, "_");
  },
  "b": function(elt) {
    printSpan.call(this, elt, "**");
  },
  "del": function(elt) {
    printSpan.call(this, elt, "~~");
  },
  "a": function(elt) {
    var href = elt.getAttribute('href');
    var text = elt.textContent;
    var title = elt.getAttribute('title');
    if (title) {
      href += ' "'+title+'"';
    }
    this.print('['+text+']('+href+')');
  },
  "img": function(elt) {
    var href = elt.getAttribute('src');
    var text = elt.getAttribute('alt');
    var title = elt.getAttribute('title');
    if (title) {
      href += ' "'+title+'"';
    }
    this.print('!['+text+']('+href+')');
  },
  "p": function(elt) {
    printPara.call(this, elt);
  }, 
  "ol": function(elt) {
    printList.call(this, elt, 1);
  }, 
  "ul": function(elt) {
    printList.call(this, elt, 0);
  }, 
  "li": function(elt) {
    var item = elt.textContent;
    var list = this.currentList;
    // flush previous line and write prefix
    this.printRawText(list ? list.prefix : ''); 
    if (list && list.index > 0) {
      var index = list.index++;
      this.print(index+'. ').convertContent(elt).flushln();
    } else {
      this.print("* ").convertContent(elt).flushln();  
    }
  },
  "h1": function(elt) {
    printHeader.call(this, elt, "# ");    
  },
  "h2": function(elt) {
    printHeader.call(this, elt, "## ");
  },
  "h3": function(elt) {
    printHeader.call(this, elt, "### ");
  },
  "h4": function(elt) {
    printHeader.call(this, elt, "#### ");
  },
  "h5": function(elt) {
    printHeader.call(this, elt, "##### ");
  },
  "h6": function(elt) {
    printHeader.call(this, elt, "###### ");
  },
  "blockquote": function(elt) {
    this.flushln().push("> ").convertContent(elt).pop("> ").flushln().println();
  },  
  "code": function(elt) {
    this.print('`'+elt.textContent+'`');
  },  
  "pre": function(elt) {
    var text, lang ='';
    var first = elt.firstElementChild;
    var last = elt.lastElementChild;
    if (first === last && first.tagName.toLowerCase() === 'code') {
      var klasses = first.className;
      if (klasses) {
        var i = klasses.indexOf(' ');
        lang = i > -1 ? klasses.substring(0, i) : klasses;
      }
      text = first.textContent;
    } else {
      text = elt.textContent;
    }
    this.flushln().print("```"+lang).printRawBlock(text).print("```").println().println();
  }/*,
  "table": function(elt) {
    this.flushln();
    var table = getTableRows(elt);
    if (!table) {
      return;
    }
    var thead = [];
    var border = [];
    var tbody = [];
    if (table.header) {
      var tr = table.header;
      for (var i=0,len=tr.length; i<len; i++) { 
        var th = tr[i].textContent;
        thead.push(th);
        border.push(Array(th.length+1).join("-"));
      }      
    } else {
      var tr = table.rows[0];
      for (var i=0,len=tr.length; i<len; i++) { 
        thead.push(Array(tr[i].length+1).join(" "));
        border.push(Array(tr[i].length+1).join("-"));
      }
    }

    this.print('| '+thead.join(' | ')+' |').println();
    this.print('| '+border.join(' | ')+' |').println();
    var rows = table.rows;
    for (var i=0,len=rows.length; i<len; i++) {
      var row = [], tr = rows[i];
      for (var j=0,cols=tr.length; j<cols; j++) {
        row.push(tr[j].textContent);
      }
      this.print('| '+row.join(' | ')+' |').println();
    }
    this.println();
  }*/
};



function MdConverter(converters) {
  this.text = '';
  this.line = '';
  this.converters = converters || null;
  this.prefix = '';
  this.currentList = null;


  this.println = function(crlf) {
    // normalize whitespaces first
    var line = this.line.trim().replace(/\s+/g, ' ');
    this.text += this.prefix+line+(crlf || '\n');
    this.line = '';
    return this;
  }

  this.flushln = function() {
    if (this.line) {
      this.println();
    }
    return this;
  }

  this.print = function(text) {
    this.line += text;
    return this;
  }

  this.printRawBlock = function(text) {    
    this.flushln();
    this.text += text;
    if (text.charCodeAt(text.length-1) > 32) {
      this.text += '\n';
    }
    return this;
  }

  this.printRawText = function(text) {    
    this.flushln();
    this.text += text;
    return this;
  }

  this.push = function(prefix) {
    this.prefix += prefix;
    return this;
  }

  this.pop = function(prefix) {
    var p = this.prefix;
    this.prefix = p.length > prefix.length ? p.substring(0, p.length-prefix.length) : '';
    return this;
  }

  this.pushList = function(index) {
    var parentList = this.currentList;
    var prefix = parentList ? parentList.prefix+'    ' : '';
    this.currentList = {"parent": parentList, "prefix": prefix, "index": index || 0};
    return this.currentList;
  }

  this.popList = function() {
    if (!this.currentList) {
      return null;
    }
    var list = this.currentList;
    this.currentList = list.parent;
    return list;
  }

  this.convert = function(elementOrHtml) {    
    var elt;
    if (typeof elementOrHtml === 'string') {
      elt = parseHTML(elementOrHtml).body;
    } else if (elementOrHtml.tagName) { // ensure a DOM element
      elt = elementOrHtml;
    } else {
      throw new Error('Expecting a string or DOM element');      
    }
    this.convertElement(elt, this);
    this.flushln();
    return this.text;
  }

  this.convertElement = function(elt) {    
    var tag = elt.tagName.toLowerCase();
    var convert = null;
    if (this.converters) {
      convert = this.converters[tag];
    }
    if (!convert) {
      convert = tagConverters[tag]; 
    }
    if (convert) {
      convert.call(this, elt);
    } else {
      // the default
      this.convertContent(elt);
      if (isBlock(tag)) {
        this.flushln();
        if (this.text.charCodeAt(this.text.lemgth-1) <= 32) {
          this.text += '\n';
        }
      }
    }    
  }

  this.convertContent = function(elt) {
    var node = elt.firstChild;
    if (!node) { // no children
      return this;
    }
    // trim node if a block node
    var first = node, end = null;
    var tagName = elt.tagName.toLowerCase();
    if (isBlock(tagName)) {
      // skip first and last node if they contains only empty spaces
      if (isEmptyTextNode(first)) {
        first = first.nextSibling;
        if (!first) { // empty node
          return this;
        }
      }
      node = elt.lastChild;
      if (isEmptyTextNode(node)) {
        end = node;
      }
    }

    node = first;
    while (node !== end) {
      var nodeType = node.nodeType;
      if (nodeType === 3) { // text
        this.print(node.nodeValue);
      } else if (nodeType === 1) { // element
        this.convertElement(node);
      } // else ignore
      node = node.nextSibling;
    }
    return this;
  }

}

host.MdConverter = MdConverter;
host.parseHTML = parseHTML;
host.toMarkdown = function(elementOrHtml) {
  return new MdConverter().convert(elementOrHtml);
};

})(Qed);
