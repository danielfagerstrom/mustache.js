var fs = require('fs');
var path = require('path');

function getContents(files, testName, ext) {
  return fs.readFileSync(path.join(files, testName + '.' + ext), 'utf8');
}

function getView(files, testName) {
  var view = getContents(files, testName, 'js');
  if (!view) throw new Error('Cannot find view for test "' + testName + '"');
  return eval(view);
}

function getPartial(files, testName) {
  try {
    return getContents(files, testName, 'partial');
  } catch (e) {
    // No big deal. Not all tests need to test partial support.
  }
}

function getTest(files, testName) {
  var test = {};
  test.view = getView(files, testName);
  test.template = getContents(files, testName, 'mustache');
  test.partial = getPartial(files, testName);
  test.expect = getContents(files, testName, 'txt');
  return test;
}

exports.getTest = getTest;
