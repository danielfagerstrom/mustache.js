require('./helper');
var Q = require('q');

describe('Mustache.render with deferred templates', function() {
  beforeEach(function() {
    Mustache.clearCache();
  });

  it('knows how to render using a deferred template', function(done) {
    var template = Q.resolve("-- {{title}} --"),
       view = { title: "Test" };
    Q.when(Mustache.render(template, view), function(result) {
      assert.equal(result, "-- Test --");
      done();
    }).done();
  });

  it('knows how to render using a deferred partial (object)', function(done) {
    var template = Q.resolve("-- {{title}} --\n{{>subtemplate}}"),
       partials = { subtemplate: Q.resolve("* {{content}} *") },
       view = { title: "Test", content: "A text" };
    Q.when(Mustache.render(template, view, partials), function(result) {
      assert.equal(result, "-- Test --\n* A text *");
      done();
    }).done();
  });

  it('knows how to render using a deferred partial (function)', function(done) {
    var template = Q.resolve("-- {{title}} --\n{{>subtemplate}}"),
       partials = function(name) {
         return name === 'subtemplate' ? Q.resolve("* {{content}} *"): null;
       },
       view = { title: "Test", content: "A text" };
    Q.when(Mustache.render(template, view, partials), function(result) {
      assert.equal(result, "-- Test --\n* A text *");
      done();
    }).done();
  });
});
