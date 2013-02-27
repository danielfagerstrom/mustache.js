# Promise aware and streaming mustache.js 

This is a fork of [mustache.js](http://github.com/janl/mustache.js) that is (hopefully) completely back compatible and add:

* handling of deferred/promises in views
* streaming output

The only requirement on the promises is that they have the `.then` method from the [Promises/A+ proposal](http://promises-aplus.github.com/promises-spec/). But I have only tested it with the [Q library](http://documentup.com/kriskowal/q), so there might be problems with other promise libraries.

## Promises

Promises can be used anywhere in a view, a small example using promises from the [Q library](http://documentup.com/kriskowal/q):

    var view = {
      title: Q.delay("Joe", 100),
      calc: function () {
        return Q.delay(2 + 4, 200);
      }
    };

    var output = Mustache.render("{{title}} spends {{calc}}", view);
    
    Q.when(output, function(output) {
      console.log(output);
    }).done();

In this example `Q.delay("Joe", 100)` returns a deferred that resolve to the value `"Joe"` after 100 ms. When using promises in a view `Mustache.reder` _might_ return a promise for a string instead of a string. The result therefore need to be normalized using e.g. `Q.when`. At least while using the Q library it is important to end the promise chain using a failure handler or the `.done()` method, otherwise errors will be swallowed without reports.

### Section functions

Ordinary section functions like:

    {
      "bold": function () {
        return function (text, render) {
          return "<b>" + render(text) + "</b>";
        }
      }
    }

will *not* work if there are promises in the view as the `render` function might return a promise for a string instead of a string. A promise aware section function would look like:

    {
      "bold": function () {
        return function (text, render) {
          Q.when(render(text), function(rendered) {
            return "<b>" + rendered + "</b>";
          });
        }
      }
    }

## Streaming output

There is a `Mustache.streamRender(template, view, partials).forEach(write)` method that can be used for streaming rendering, the `write(chunk)` function render a chunk of the total output and can optionaly return a promise that resolves when the writing of the chuk is completed:

    Mustache.streamRender(template, view).forEach(function(chunk) {
      return FS.append(filePath, chunk);
    });

Here `FS.append` is from [q-io](http://documentup.com/kriskowal/q-io) and return a promise. The `streamRender` method can be used for creating a HTTP response body for [JSGI applications](http://documentup.com/kriskowal/q-io#http/body).


# Original documentation
* * *
# mustache.js - Logic-less {{mustache}} templates with JavaScript

> What could be more logical awesome than no logic at all?

[mustache.js](http://github.com/janl/mustache.js) is an implementation of the [mustache](http://mustache.github.com/) template system in JavaScript.

[Mustache](http://mustache.github.com/) is a logic-less template syntax. It can be used for HTML, config files, source code - anything. It works by expanding tags in a template using values provided in a hash or object.

We call it "logic-less" because there are no if statements, else clauses, or for loops. Instead there are only tags. Some tags are replaced with a value, some nothing, and others a series of values.

For a language-agnostic overview of mustache's template syntax, see the `mustache(5)` [manpage](http://mustache.github.com/mustache.5.html).

## Where to use mustache.js?

You can use mustache.js to render mustache templates anywhere you can use JavaScript. This includes web browsers, server-side environments such as [node](http://nodejs.org/), and [CouchDB](http://couchdb.apache.org/) views.

mustache.js ships with support for both the [CommonJS](http://www.commonjs.org/) module API and the [Asynchronous Module Definition](https://github.com/amdjs/amdjs-api/wiki/AMD) API, or AMD.

## Who uses mustache.js?

An updated list of mustache.js users is kept [on the Github wiki](http://wiki.github.com/janl/mustache.js/beard-competition). Add yourself or your company if you use mustache.js!

## Usage

Below is quick example how to use mustache.js:

    var view = {
      title: "Joe",
      calc: function () {
        return 2 + 4;
      }
    };

    var output = Mustache.render("{{title}} spends {{calc}}", view);

In this example, the `Mustache.render` function takes two parameters: 1) the [mustache](http://mustache.github.com/) template and 2) a `view` object that contains the data and code needed to render the template.

## Templates

A [mustache](http://mustache.github.com/) template is a string that contains any number of mustache tags. Tags are indicated by the double mustaches that surround them. `{{person}}` is a tag, as is `{{#person}}`. In both examples we refer to `person` as the tag's key.

There are several types of tags available in mustache.js.

### Variables

The most basic tag type is a simple variable. A `{{name}}` tag renders the value of the `name` key in the current context. If there is no such key, nothing is rendered.

All variables are HTML-escaped by default. If you want to render unescaped HTML, use the triple mustache: `{{{name}}}`. You can also use `&` to unescape a variable.

View:

    {
      "name": "Chris",
      "company": "<b>GitHub</b>"
    }

Template:

    * {{name}}
    * {{age}}
    * {{company}}
    * {{{company}}}
    * {{&company}}

Output:

    * Chris
    *
    * &lt;b&gt;GitHub&lt;/b&gt;
    * <b>GitHub</b>
    * <b>GitHub</b>

JavaScript's dot notation may be used to access keys that are properties of objects in a view.

View:

    {
      "name": {
        "first": "Michael",
        "last": "Jackson"
      },
      "age": "RIP"
    }

Template:

    * {{name.first}} {{name.last}}
    * {{age}}

Output:

    * Michael Jackson
    * RIP

### Sections

Sections render blocks of text one or more times, depending on the value of the key in the current context.

A section begins with a pound and ends with a slash. That is, `{{#person}}` begins a `person` section, while `{{/person}}` ends it. The text between the two tags is referred to as that section's "block".

The behavior of the section is determined by the value of the key.

#### False Values or Empty Lists

If the `person` key does not exist, or exists and has a value of `null`, `undefined`, or `false`, or is an empty list, the block will not be rendered.

View:

    {
      "person": false
    }

Template:

    Shown.
    {{#person}}
    Never shown!
    {{/person}}

Output:

    Shown.

#### Non-Empty Lists

If the `person` key exists and is not `null`, `undefined`, or `false`, and is not an empty list the block will be rendered one or more times.

When the value is a list, the block is rendered once for each item in the list. The context of the block is set to the current item in the list for each iteration. In this way we can loop over collections.

View:

    {
      "stooges": [
        { "name": "Moe" },
        { "name": "Larry" },
        { "name": "Curly" }
      ]
    }

Template:

    {{#stooges}}
    <b>{{name}}</b>
    {{/stooges}}

Output:

    <b>Moe</b>
    <b>Larry</b>
    <b>Curly</b>

When looping over an array of strings, a `.` can be used to refer to the current item in the list.

View:

    {
      "musketeers": ["Athos", "Aramis", "Porthos", "D'Artagnan"]
    }

Template:

    {{#musketeers}}
    * {{.}}
    {{/musketeers}}

Output:

    * Athos
    * Aramis
    * Porthos
    * D'Artagnan

If the value of a section variable is a function, it will be called in the context of the current item in the list on each iteration.

View:

    {
      "beatles": [
        { "firstName": "John", "lastName": "Lennon" },
        { "firstName": "Paul", "lastName": "McCartney" },
        { "firstName": "George", "lastName": "Harrison" },
        { "firstName": "Ringo", "lastName": "Starr" }
      ],
      "name": function () {
        return this.firstName + " " + this.lastName;
      }
    }

Template:

    {{#beatles}}
    * {{name}}
    {{/beatles}}

Output:

    * John Lennon
    * Paul McCartney
    * George Harrison
    * Ringo Starr

#### Functions

If the value of a section key is a function, it is called with the section's literal block of text, un-rendered, as its first argument. The second argument is a special rendering function that uses the current view as its view argument. It is called in the context of the current view object.

View:

    {
      "name": "Tater",
      "bold": function () {
        return function (text, render) {
          return "<b>" + render(text) + "</b>";
        }
      }
    }

Template:

    {{#bold}}Hi {{name}}.{{/bold}}

Output:

    <b>Hi Tater.</b>

### Inverted Sections

An inverted section opens with `{{^section}}` instead of `{{#section}}`. The block of an inverted section is rendered only if the value of that section's tag is `null`, `undefined`, `false`, or an empty list.

View:

    {
      "repos": []
    }

Template:

    {{#repos}}<b>{{name}}</b>{{/repos}}
    {{^repos}}No repos :({{/repos}}

Output:

    No repos :(

### Comments

Comments begin with a bang and are ignored. The following template:

    <h1>Today{{! ignore me }}.</h1>

Will render as follows:

    <h1>Today.</h1>

Comments may contain newlines.

### Partials

Partials begin with a greater than sign, like {{> box}}.

Partials are rendered at runtime (as opposed to compile time), so recursive partials are possible. Just avoid infinite loops.

They also inherit the calling context. Whereas in ERB you may have this:

    <%= partial :next_more, :start => start, :size => size %>

Mustache requires only this:

    {{> next_more}}

Why? Because the `next_more.mustache` file will inherit the `size` and `start` variables from the calling context. In this way you may want to think of partials as includes, or template expansion, even though it's not literally true.

For example, this template and partial:

    base.mustache:
    <h2>Names</h2>
    {{#names}}
      {{> user}}
    {{/names}}

    user.mustache:
    <strong>{{name}}</strong>

Can be thought of as a single, expanded template:

    <h2>Names</h2>
    {{#names}}
      <strong>{{name}}</strong>
    {{/names}}

In mustache.js an object of partials may be passed as the third argument to `Mustache.render`. The object should be keyed by the name of the partial, and its value should be the partial text.

### Set Delimiter

Set Delimiter tags start with an equals sign and change the tag delimiters from `{{` and `}}` to custom strings.

Consider the following contrived example:

    * {{ default_tags }}
    {{=<% %>=}}
    * <% erb_style_tags %>
    <%={{ }}=%>
    * {{ default_tags_again }}

Here we have a list with three items. The first item uses the default tag style, the second uses ERB style as defined by the Set Delimiter tag, and the third returns to the default style after yet another Set Delimiter declaration.

According to [ctemplates](http://google-ctemplate.googlecode.com/svn/trunk/doc/howto.html), this "is useful for languages like TeX, where double-braces may occur in the text and are awkward to use for markup."

Custom delimiters may not contain whitespace or the equals sign.

### Compiled Templates

Mustache templates can be compiled into JavaScript functions using `Mustache.compile` for improved rendering performance.

If you have template views that are rendered multiple times, compiling your template into a JavaScript function will minimise the amount of work required for each re-render.

Pre-compiled templates can also be generated server-side, for delivery to the browser as ready to use JavaScript functions, further reducing the amount of client side processing required for initialising templates.

**Mustache.compile**

Use `Mustache.compile` to compile standard Mustache string templates into reusable Mustache template functions.

    var compiledTemplate = Mustache.compile(stringTemplate);

The function returned from `Mustache.compile` can then be called directly, passing in the template data as an argument (with an object of partials as an optional second parameter), to generate the final output.

    var templateOutput = compiledTemplate(templateData);

**Mustache.compilePartial**

Template partials can also be compiled using the `Mustache.compilePartial` function. The first parameter of this function, is the name of the partial as it appears within parent templates.

    Mustache.compilePartial('partial-name', stringTemplate);

Compiled partials are then available to both `Mustache.render` and `Mustache.compile`.

## Plugins for JavaScript Libraries

mustache.js may be built specifically for several different client libraries, including the following:

  - [jQuery](http://jquery.com/)
  - [MooTools](http://mootools.net/)
  - [Dojo](http://www.dojotoolkit.org/)
  - [YUI](http://developer.yahoo.com/yui/)
  - [qooxdoo](http://qooxdoo.org/)

These may be built using [Rake](http://rake.rubyforge.org/) and one of the following commands:

    $ rake jquery
    $ rake mootools
    $ rake dojo
    $ rake yui
    $ rake qooxdoo

## Testing

The mustache.js test suite uses the [mocha](http://visionmedia.github.com/mocha/) testing framework. In order to run the tests you'll need to install [node](http://nodejs.org/). Once that's done you can install mocha using [npm](http://npmjs.org/).

    $ npm install -g mocha

Then run the tests.

    $ mocha test

The test suite consists of both unit and integration tests. If a template isn't rendering correctly for you, you can make a test for it by doing the following:

  1. Create a template file named `mytest.mustache` in the `test/_files`
     directory. Replace `mytest` with the name of your test.
  2. Create a corresponding view file named `mytest.js` in the same directory.
     This file should contain a JavaScript object literal enclosed in
     parentheses. See any of the other view files for an example.
  3. Create a file with the expected output in `mytest.txt` in the same
     directory.

Then, you can run the test with:

    $ TEST=mytest mocha test/render_test.js

## Thanks

mustache.js wouldn't kick ass if it weren't for these fine souls:

  * Chris Wanstrath / defunkt
  * Alexander Lang / langalex
  * Sebastian Cohnen / tisba
  * J Chris Anderson / jchris
  * Tom Robinson / tlrobinson
  * Aaron Quint / quirkey
  * Douglas Crockford
  * Nikita Vasilyev / NV
  * Elise Wood / glytch
  * Damien Mathieu / dmathieu
  * Jakub Kuźma / qoobaa
  * Will Leinweber / will
  * dpree
  * Jason Smith / jhs
  * Aaron Gibralter / agibralter
  * Ross Boucher / boucher
  * Matt Sanford / mzsanford
  * Ben Cherry / bcherry
  * Michael Jackson / mjijackson
