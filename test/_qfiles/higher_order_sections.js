({
  name: Q.resolve("Tater"),
  helper: "To tinker?",
  bolder: function () {
    return function (text, render) {
      var self = this;
      return Q.when(render(text), function(rendered) {
        return text + ' => <b>' + rendered + '</b> ' + self.helper;
      });
    }
  }
})
