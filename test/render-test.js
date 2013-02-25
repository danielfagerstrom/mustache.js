require('./helper');

var fs = require('fs');
var path = require('path');
var _files = path.join(__dirname, '_files');
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

    it('knows how to render ' + testName, function () {
      var output;
      if (test.partial) {
        output = Mustache.render(test.template, test.view, { partial: test.partial });
      } else {
        output = Mustache.render(test.template, test.view);
      }

      assert.equal(output, test.expect);
    });
  });
});
