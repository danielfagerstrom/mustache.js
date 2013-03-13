Q.resolve({
  a: Q.resolve({
    b: function() {
      return Q.resolve({
        c: Q.resolve(function() { return Q.resolve(1); }),
        d: 2
      });
    },
    e: function() { return 3; }
  }),
  f: 4
})