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
});
