require('./helper');
Q = require('q');

var fs = require('fs');
var path = require('path');
var _files = path.join(__dirname, '_qfiles');
var getTest = require('./utils').getTest;

// You can put the name of a specific test to run in the TEST environment
// variable (e.g. TEST=backslashes vows test/render-test.js)
var testToRun = process.env.TEST;

var testNames;
if (testToRun) {
  testNames = [testToRun];
} else {
  testNames = fs.readdirSync(_files).filter(function (file) {
    return (/\.js$/).test(file);
  }).map(function (file) {
    return path.basename(file).replace(/\.js$/, '');
  });
}

describe('Mustache.render', function () {
  beforeEach(function () {
    Mustache.clearCache();
  });

  testNames.forEach(function (testName) {
    var test = getTest(_files, testName);

    it('knows how to render ' + testName, function (done) {
      var output;
      if (test.partial) {
        output = Mustache.render(test.template, test.view, { partial: test.partial });
      } else {
        output = Mustache.render(test.template, test.view);
      }
      Q.when(output, function(output) {
        assert.equal(output, test.expect);
        done();
      }, function(e) { done(e); }).done();
    });
  });
});

describe('Mustache.streamRender', function () {
  beforeEach(function () {
    Mustache.clearCache();
  });

  testNames.forEach(function (testName) {
    var test = getTest(_files, testName),
        chunks = [],
        write = function(chunk) {
          chunks.push(chunk);
          return Q.delay(1);
        };

    it('knows how to render ' + testName, function (done) {
      var output, promise;
      if (test.partial) {
        output = Mustache.streamRender(test.template, test.view, { partial: test.partial });
      } else {
        output = Mustache.streamRender(test.template, test.view);
      }
      promise = output.forEach(write);
      Q.when(promise, function() {
        assert.equal(chunks.join(''), test.expect);
        done();
      }, function(e) { done(e); }).done();
    });
  });
});
