/*!
 * mustache.js - Logic-less {{mustache}} templates with JavaScript
 * http://github.com/janl/mustache.js
 */

/*global define: false*/

(function (root, factory) {
  if (typeof exports === "object" && exports) {
    module.exports = factory; // CommonJS
  } else if (typeof define === "function" && define.amd) {
    define(factory); // AMD
  } else {
    root.Mustache = factory; // <script>
  }
}(this, (function () {

  var exports = {};

  exports.name = "mustache.js";
  exports.version = "0.7.2";
  exports.tags = ["{{", "}}"];

  exports.Scanner = Scanner;
  exports.Context = Context;
  exports.Writer = Writer;

  var whiteRe = /\s*/;
  var spaceRe = /\s+/;
  var nonSpaceRe = /\S/;
  var eqRe = /\s*=/;
  var curlyRe = /\s*\}/;
  var tagRe = /#|\^|\/|>|\{|&|=|!/;

  var _test = RegExp.prototype.test;
  var _toString = Object.prototype.toString;

  // Workaround for https://issues.apache.org/jira/browse/COUCHDB-577
  // See https://github.com/janl/mustache.js/issues/189
  function testRe(re, string) {
    return _test.call(re, string);
  }

  function isWhitespace(string) {
    return !testRe(nonSpaceRe, string);
  }

  var isArray = Array.isArray || function (obj) {
    return _toString.call(obj) === '[object Array]';
  };

  function escapeRe(string) {
    return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");
  }

  var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
  };

  function escapeHtml(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
      return entityMap[s];
    });
  }

  function isPromise(object) {
    return object && typeof object.then === "function";
  }

  function when(value, fulfilled) {
    if (isPromise(value))
      return value.then(fulfilled);
    else
      return fulfilled(value);
  }

  /*
   * Iterates sequentialy over an array `array`, applying a function `fn` on each element.
   * If the result of a function application on an element is a promise, the application on the
   * next element will wait until the promise is fullfilled. If any of the function apllications
   * return a promise, `sequentialEach` will return a promise that resolves when the processing
   * of the array is finished.
   */
  function sequentialEach(array, fn) {
    var i = 0, len = array.length;
    function slurp() {
      var promise;
      while (i < len && !isPromise(promise = fn(array[i++]))) // iterate to next promise
        ;
      if (i < len) // defer the rest of the iteration if there are elements left
        promise = promise.then(function() { return slurp(); });
      return promise;
    }
    return slurp();
  }

  // Export the escaping function so that the user may override it.
  // See https://github.com/janl/mustache.js/issues/244
  exports.escape = escapeHtml;

  function Scanner(string) {
    this.string = string;
    this.tail = string;
    this.pos = 0;
  }

  /**
   * Returns `true` if the tail is empty (end of string).
   */
  Scanner.prototype.eos = function () {
    return this.tail === "";
  };

  /**
   * Tries to match the given regular expression at the current position.
   * Returns the matched text if it can match, the empty string otherwise.
   */
  Scanner.prototype.scan = function (re) {
    var match = this.tail.match(re);

    if (match && match.index === 0) {
      this.tail = this.tail.substring(match[0].length);
      this.pos += match[0].length;
      return match[0];
    }

    return "";
  };

  /**
   * Skips all text until the given regular expression can be matched. Returns
   * the skipped string, which is the entire tail if no match can be made.
   */
  Scanner.prototype.scanUntil = function (re) {
    var match, pos = this.tail.search(re);

    switch (pos) {
    case -1:
      match = this.tail;
      this.pos += this.tail.length;
      this.tail = "";
      break;
    case 0:
      match = "";
      break;
    default:
      match = this.tail.substring(0, pos);
      this.tail = this.tail.substring(pos);
      this.pos += pos;
    }

    return match;
  };

  function Context(view, parent) {
    this.view = view;
    this.parent = parent;
    this._cache = {};
  }

  Context.make = function (view) {
    return (view instanceof Context) ? view : new Context(view);
  };

  Context.prototype.push = function (view) {
    return new Context(view, this);
  };

  Context.prototype.lookup = function (name) {
    var self = this, value = self._cache[name];

    if (!value) {
      value = name == '.' ? self.view : lookupAux(self.view, self, name, name);
      self._cache[name] = value;
    }

    value = when(value, function(value) {
      return typeof value === 'function' ? value.call(self.view) : value;
    });

    return value;
  };

  function lookupAux(value, context, name, origName) {
    while (context) {
      var names = name.split('.'), i = 0, j;
      while (value && i < names.length) {
        j = i++;
        value = when(value, function(value) {
          return value[names[j]];
        });
        if (isPromise(value) && i < names.length) {
          value = value.then(function(value) {
            return lookupAux(value, context, names.slice(j + 1).join('.'), origName);
          });
          break;
        }
      }

      if (isPromise(value)) {
        value = value.then(function(value) {
          if (value != null) {
            return value;
          } else if ((context = context.parent)) {
            return lookupAux(context.view, context, origName, origName);
          } else
            return null;
        });
        break;
      } else {
        if (value != null) break;

        context = context.parent;
        if (context) value = context.view;
      }
    }
    return value;
  }

  function Writer() {
    this.clearCache();
  }

  Writer.prototype.clearCache = function () {
    this._cache = {};
    this._partialCache = {};
  };

  Writer.prototype.compile = function (template, tags) {
    var fn = this._cache[template];

    if (!fn) {
      var tokens = exports.parse(template, tags);
      fn = this._cache[template] = this.compileTokens(tokens, template);
    }

    return fn;
  };

  Writer.prototype.compilePartial = function (name, template, tags) {
    var fn = this.compile(template, tags);
    this._partialCache[name] = fn;
    return fn;
  };

  Writer.prototype.getPartial = function (name) {
    if (!(name in this._partialCache) && this._loadPartial) {
      this.compilePartial(name, this._loadPartial(name));
    }

    return this._partialCache[name];
  };

  Writer.prototype.compileTokens = function (tokens, template) {
    var self = this;
    return function (view, partials, write) {
      var chunks, promise;

      if (partials) {
        if (typeof partials === 'function') {
          self._loadPartial = partials;
        } else {
          for (var name in partials) {
            self.compilePartial(name, partials[name]);
          }
        }
      }

      if (!write) {
        chunks = [];
        write = function(chunk) { chunks.push(chunk); };
      }

      promise = renderTokens(tokens, self, Context.make(view), template, write);
      return when(promise, function() {
        return chunks ? chunks.join('') : undefined;
      });
    };
  };

  Writer.prototype.streamRender = function (template, view, partials) {
    var compiled = this.compile(template);
    return {
      forEach: function(write) { return compiled(view, partials, write); },
      read: function() { return compiled(view, partials); }
    };
  };

  Writer.prototype.render = function (template, view, partials) {
    return this.streamRender(template, view, partials).read();
  };

  /**
   * Low-level function that renders the given `tokens` using the given `writer`
   * and `context`. The `template` string is only needed for templates that use
   * higher-order sections to extract the portion of the original template that
   * was contained in that section.
   */
  function renderTokens(tokens, writer, context, template, write) {
    return sequentialEach(tokens, function(token) {
      var tokenValue, value;
      tokenValue = token[1];

      switch (token[0]) {
      case '#':
      case '^':
      case '&':
      case 'name':
        value = context.lookup(tokenValue);
        break;
      case '>':
        value = writer.getPartial(tokenValue);
        break;
      case 'text':
        value = tokenValue;
        break;
      }

      return when(value, function(value) {
        return renderToken(token, value, writer, context, template, write);
      });
    });
  }

  function renderToken(token, value, writer, context, template, write) {
    var promise;
    switch (token[0]) {
    case '#':
      if (typeof value === 'object') {
        if (isArray(value)) {
          promise = arrayRenderToken(token, value, writer, context, template, write);
        } else if (value && value.forEach) {
          var innerPromise;
          promise = value.forEach(function(value) {
            innerPromise = when(innerPromise, function() {
              return renderTokens(token[4], writer, context.push(value), template, write);
            });
          });
          promise = when(promise, function() { return innerPromise; });
        } else if (value) {
          promise = renderTokens(token[4], writer, context.push(value), template, write);
        }
      } else if (typeof value === 'function') {
        var text = template == null ? null : template.slice(token[3], token[5]);
        value = value.call(context.view, text, function (template) {
          return writer.render(template, context);
        });
        promise = when(value, function(value) {
          if (value != null) promise = write(value);
          return promise;
        });
      } else if (value) {
        promise = renderTokens(token[4], writer, context, template, write);
      }
      break;
    case '^':
      // Use JavaScript's definition of falsy. Include empty arrays.
      // See https://github.com/janl/mustache.js/issues/186
      if (!value || (isArray(value) && value.length === 0)) {
        promise = renderTokens(token[4], writer, context, template, write);
      }
      break;
    case '>':
      if (typeof value === 'function') promise = write(value(context));
      break;
    case '&':
      if (value != null) promise = write(value);
      break;
    case 'name':
      if (value != null) promise = write(exports.escape(value));
      break;
    case 'text':
      promise = write(value);
      break;
    }

    return promise;
  }

  function arrayRenderToken(token, values, writer, context, template, write) {
    return sequentialEach(values, function(value) {
      return when(value, function(value) {
        return renderTokens(token[4], writer, context.push(value), template, write);
      });
    });
  }

  /**
   * Forms the given array of `tokens` into a nested tree structure where
   * tokens that represent a section have two additional items: 1) an array of
   * all tokens that appear in that section and 2) the index in the original
   * template that represents the end of that section.
   */
  function nestTokens(tokens) {
    var tree = [];
    var collector = tree;
    var sections = [];

    var token;
    for (var i = 0, len = tokens.length; i < len; ++i) {
      token = tokens[i];
      switch (token[0]) {
      case '#':
      case '^':
        sections.push(token);
        collector.push(token);
        collector = token[4] = [];
        break;
      case '/':
        var section = sections.pop();
        section[5] = token[2];
        collector = sections.length > 0 ? sections[sections.length - 1][4] : tree;
        break;
      default:
        collector.push(token);
      }
    }

    return tree;
  }

  /**
   * Combines the values of consecutive text tokens in the given `tokens` array
   * to a single token.
   */
  function squashTokens(tokens) {
    var squashedTokens = [];

    var token, lastToken;
    for (var i = 0, len = tokens.length; i < len; ++i) {
      token = tokens[i];
      if (token) {
        if (token[0] === 'text' && lastToken && lastToken[0] === 'text') {
          lastToken[1] += token[1];
          lastToken[3] = token[3];
        } else {
          lastToken = token;
          squashedTokens.push(token);
        }
      }
    }

    return squashedTokens;
  }

  function escapeTags(tags) {
    return [
      new RegExp(escapeRe(tags[0]) + "\\s*"),
      new RegExp("\\s*" + escapeRe(tags[1]))
    ];
  }

  /**
   * Breaks up the given `template` string into a tree of token objects. If
   * `tags` is given here it must be an array with two string values: the
   * opening and closing tags used in the template (e.g. ["<%", "%>"]). Of
   * course, the default is to use mustaches (i.e. Mustache.tags).
   */
  exports.parse = function (template, tags) {
    template = template || '';
    tags = tags || exports.tags;

    if (typeof tags === 'string') tags = tags.split(spaceRe);
    if (tags.length !== 2) throw new Error('Invalid tags: ' + tags.join(', '));

    var tagRes = escapeTags(tags);
    var scanner = new Scanner(template);

    var sections = [];     // Stack to hold section tokens
    var tokens = [];       // Buffer to hold the tokens
    var spaces = [];       // Indices of whitespace tokens on the current line
    var hasTag = false;    // Is there a {{tag}} on the current line?
    var nonSpace = false;  // Is there a non-space char on the current line?

    // Strips all whitespace tokens array for the current line
    // if there was a {{#tag}} on it and otherwise only space.
    function stripSpace() {
      if (hasTag && !nonSpace) {
        while (spaces.length) {
          delete tokens[spaces.pop()];
        }
      } else {
        spaces = [];
      }

      hasTag = false;
      nonSpace = false;
    }

    var start, type, value, chr, token;
    while (!scanner.eos()) {
      start = scanner.pos;

      // Match any text between tags.
      value = scanner.scanUntil(tagRes[0]);
      if (value) {
        for (var i = 0, len = value.length; i < len; ++i) {
          chr = value.charAt(i);

          if (isWhitespace(chr)) {
            spaces.push(tokens.length);
          } else {
            nonSpace = true;
          }

          tokens.push(['text', chr, start, start + 1]);
          start += 1;

          // Check for whitespace on the current line.
          if (chr == '\n') stripSpace();
        }
      }

      // Match the opening tag.
      if (!scanner.scan(tagRes[0])) break;
      hasTag = true;

      // Get the tag type.
      type = scanner.scan(tagRe) || 'name';
      scanner.scan(whiteRe);

      // Get the tag value.
      if (type === '=') {
        value = scanner.scanUntil(eqRe);
        scanner.scan(eqRe);
        scanner.scanUntil(tagRes[1]);
      } else if (type === '{') {
        value = scanner.scanUntil(new RegExp('\\s*' + escapeRe('}' + tags[1])));
        scanner.scan(curlyRe);
        scanner.scanUntil(tagRes[1]);
        type = '&';
      } else {
        value = scanner.scanUntil(tagRes[1]);
      }

      // Match the closing tag.
      if (!scanner.scan(tagRes[1])) throw new Error('Unclosed tag at ' + scanner.pos);

      token = [type, value, start, scanner.pos];
      tokens.push(token);

      if (type === '#' || type === '^') {
        sections.push(token);
      } else if (type === '/') {
        // Check section nesting.
        if (sections.length === 0) throw new Error('Unopened section "' + value + '" at ' + start);
        var openSection = sections.pop();
        if (openSection[1] !== value) throw new Error('Unclosed section "' + openSection[1] + '" at ' + start);
      } else if (type === 'name' || type === '{' || type === '&') {
        nonSpace = true;
      } else if (type === '=') {
        // Set the tags for the next time around.
        tags = value.split(spaceRe);
        if (tags.length !== 2) throw new Error('Invalid tags at ' + start + ': ' + tags.join(', '));
        tagRes = escapeTags(tags);
      }
    }

    // Make sure there are no open sections when we're done.
    var openSection = sections.pop();
    if (openSection) throw new Error('Unclosed section "' + openSection[1] + '" at ' + scanner.pos);

    tokens = squashTokens(tokens);

    return nestTokens(tokens);
  };

  // All Mustache.* functions use this writer.
  var _writer = new Writer();

  /**
   * Clears all cached templates and partials in the default writer.
   */
  exports.clearCache = function () {
    return _writer.clearCache();
  };

  /**
   * Compiles the given `template` to a reusable function using the default
   * writer.
   */
  exports.compile = function (template, tags) {
    return _writer.compile(template, tags);
  };

  /**
   * Compiles the partial with the given `name` and `template` to a reusable
   * function using the default writer.
   */
  exports.compilePartial = function (name, template, tags) {
    return _writer.compilePartial(name, template, tags);
  };

  /**
   * Compiles the given array of tokens (the output of a parse) to a reusable
   * function using the default writer.
   */
  exports.compileTokens = function (tokens, template) {
    return _writer.compileTokens(tokens, template);
  };

  /**
   * Creates a reader object with a `forEach(callback)` and a `read()`
   * method for the `template` with the given `view` and `partials`
   * using the default writer. See
   * http://documentup.com/kriskowal/q-io#streams/reader.
   */
  exports.streamRender = function (template, view, partials) {
    return _writer.streamRender(template, view, partials);
  };

  /**
   * Renders the `template` with the given `view` and `partials` using the
   * default writer.
   */
  exports.render = function (template, view, partials) {
    return _writer.render(template, view, partials);
  };

  // This is here for backwards compatibility with 0.4.x.
  exports.to_html = function (template, view, partials, send) {
    var result = exports.render(template, view, partials);

    if (typeof send === "function") {
      send(result);
    } else {
      return result;
    }
  };

  return exports;

}())));
