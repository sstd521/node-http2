var expect = require('chai').expect;

var Stream = require('../lib/stream').Stream;

var log = process.env.DEBUG ? require('bunyan').createLogger({ name: 'http2', level: 'trace' })
                            : undefined;

// Execute a list of commands and assertions
function execute_sequence(sequence, done) {
  var stream = new Stream(log);

  var outgoing_frames = [];
  stream.upstream.on('sending', outgoing_frames.push.bind(outgoing_frames));

  var emit = stream.emit, events = [];
  stream.emit = function(name, data) {
    if (name === 'state' || name === 'error' || name === 'window_update') {
      events.push({ name: name, data: data });
    }
    return emit.apply(this, arguments);
  };

  var commands = [], checks = [];
  sequence.forEach(function(step) {
    if ('method' in step || 'incoming' in step || 'wait' in step) {
      commands.push(step);
    } else {
      checks.push(step);
    }
  });

  function execute(callback) {
    var command = commands.shift();
    if (command) {
      if ('method' in command) {
        stream[command.method.name].apply(stream, command.method.arguments);
        execute(callback);
      } else if ('incoming' in command) {
        stream.upstream.write(command.incoming);
        execute(callback);
      } else if ('wait' in command) {
        setTimeout(execute.bind(null, callback), command.wait);
      } else {
        throw new Error('Invalid command', command);
      }
    } else {
      setTimeout(callback, 5);
    }
  }

  function check() {
    checks.forEach(function(check) {
      if ('outgoing' in check) {
        expect(outgoing_frames.shift()).to.deep.equal(check.outgoing);
      } else if ('event' in check) {
        expect(events.shift()).to.deep.equal(check.event);
      } else {
        throw new Error('Invalid check', check);
      }
    });
    done();
  }

  execute(check);
}

describe('stream.js', function() {
  describe('test scenario', function() {
    describe('sending request', function() {
      it('should trigger the appropriate state transitions and outgoing frames', function(done) {
        execute_sequence([
          { method  : { name: 'open', arguments: [{ ':path': '/' }] } },
          { method  : { name: 'end', arguments: [] } },
          { outgoing: { type: 'HEADERS', flags: { END_STREAM: true  }, headers: { ':path': '/' }, priority: undefined } },
          { event   : { name: 'state', data: 'OPEN' } },
          { event   : { name: 'state', data: 'HALF_CLOSED_LOCAL' } },

          { wait    : 10 },
          { incoming: { type: 'HEADERS', flags: { }, headers: { ':status': 200 } } },
          { incoming: { type: 'DATA'   , flags: { END_STREAM: true  }, data: new Buffer(5) } },
          { event   : { name: 'state', data: 'CLOSED' } }
        ], done);
      });
    });
    describe('answering request', function() {
      it('should trigger the appropriate state transitions and outgoing frames', function(done) {
        var payload = new Buffer(5);
        execute_sequence([
          { incoming: { type: 'HEADERS', flags: { }, headers: { ':path': '/' } } },
          { event   : { name: 'state', data: 'OPEN' } },

          { wait    : 5 },
          { incoming: { type: 'DATA', flags: { }, data: new Buffer(5) } },
          { incoming: { type: 'DATA', flags: { END_STREAM: true  }, data: new Buffer(10) } },
          { event   : { name: 'state', data: 'HALF_CLOSED_REMOTE' } },

          { wait    : 5 },
          { method  : { name: 'open', arguments: [{ ':status': 200 }] } },
          { outgoing: { type: 'HEADERS', flags: { }, headers: { ':status': 200 }, priority: undefined } },

          { wait    : 5 },
          { method  : { name: 'end', arguments: [payload] } },
          { outgoing: { type: 'DATA', flags: { END_STREAM: true  }, data: payload } },
          { event   : { name: 'state', data: 'CLOSED' } }
        ], done);
      });
    });
    describe('sending push stream', function() {
      it('should trigger the appropriate state transitions and outgoing frames', function(done) {
        var payload = new Buffer(5);
        execute_sequence([
          { method  : { name: 'promise', arguments: [{ ':path': '/' }] } },
          { outgoing: { type: 'PUSH_PROMISE', flags: { }, headers: { ':path': '/' } } },
          { event   : { name: 'state', data: 'RESERVED_LOCAL' } },

          { method  : { name: 'open', arguments: [{ ':status': '200' }] } },
          { outgoing: { type: 'HEADERS', flags: { }, headers: { ':status': '200' }, priority: undefined } },
          { event   : { name: 'state', data: 'HALF_CLOSED_REMOTE' } },

          { method  : { name: 'end', arguments: [payload] } },
          { outgoing: { type: 'DATA', flags: { END_STREAM: true  }, data: payload } },
          { event   : { name: 'state', data: 'CLOSED' } }
        ], done);
      });
    });
    describe('receiving push stream', function() {
      it('should trigger the appropriate state transitions and outgoing frames', function(done) {
        execute_sequence([
          { incoming: { type: 'PUSH_PROMISE', flags: { END_STREAM: false }, headers: { ':path': '/' } } },
          { event   : { name: 'state', data: 'RESERVED_REMOTE' } },

          { wait    : 10 },
          { incoming: { type: 'HEADERS', flags: { END_STREAM: false }, headers: { ':status': 200 } } },
          { event   : { name: 'state', data: 'HALF_CLOSED_LOCAL' } },

          { wait    : 10 },
          { incoming: { type: 'DATA', flags: { END_STREAM: true  }, data: new Buffer(5) } },
          { event   : { name: 'state', data: 'CLOSED' } }
        ], done);
      });
    });
  });
});