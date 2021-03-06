var expect = require('chai').expect;
var util = require('./util');

var Connection = require('../lib/protocol/connection').Connection;

var settings = {
  SETTINGS_MAX_CONCURRENT_STREAMS: 100,
  SETTINGS_INITIAL_WINDOW_SIZE: 100000
};

var MAX_PRIORITY = Math.pow(2, 31) - 1;
var MAX_RANDOM_PRIORITY = 10;

function randomPriority() {
  return Math.floor(Math.random() * (MAX_RANDOM_PRIORITY + 1));
}

function expectPriorityOrder(priorities) {
  priorities.forEach(function(bucket, priority) {
    bucket.forEach(function(stream) {
      expect(stream._priority).to.be.equal(priority);
    });
  });
}

describe('connection.js', function() {
  describe('Connection class', function() {
    describe('method ._insert(stream)', function() {
      // 具体点不好吗？非要弄一堆随机。随机控嘛。
      it('should insert the stream in _streamPriorities in a place determined by stream._priority', function() {
        var streams = [];
        var connection = Object.create(Connection.prototype, { _streamPriorities: { value: streams }});
        var streamCount = 10;

        for (var i = 0; i < streamCount; i++) {
          var stream = { _priority: randomPriority() };
          connection._insert(stream, stream._priority);
          expect(connection._streamPriorities[stream._priority]).to.include(stream);
        }

        expectPriorityOrder(connection._streamPriorities);
      });
    });
     describe('nontrial priority', function() {
      it('should eject and then insert the stream in _streamPriorities in a place determined by stream._priority', function() {
        var streams = [];        
        var connection = Object.create(Connection.prototype, { _streamPriorities: { value: streams }});
        var streamCount = 8;
        var oldPriority, newPriority, stream;
        var prioritys = [1,2,3,1,2,3,3,2];
        for (var i = 0; i < streamCount-1; i++) {
          newPriority = prioritys[(i+1)]
          oldPriority = prioritys[i]
          stream = { _priority: oldPriority};
          connection._insert(stream, oldPriority);
          // console.log("connection._streamPriorities:")
          // console.log(connection._streamPriorities)
          
          // stream._priority = newPriority;

          // expect(connection._streamPriorities[newPriority]).to.include(stream);
          // expect(connection._streamPriorities[oldPriority] || []).to.not.include(stream);
        }
        expectPriorityOrder(streams);
        console.log(connection._streamPriorities)
        /*
          [ ,
            [ { _priority: 1 }, { _priority: 1 } ],
            [ { _priority: 2 }, { _priority: 2 } ],
            [ { _priority: 3 }, { _priority: 3 }, { _priority: 3 } ] 
          ]
        */
      });
    });
    describe('nontrial1 priority', function() {
      it('should eject and then insert the stream in _streamPriorities in a place determined by stream._priority', function() {
        var streams = [];        
        var connection = Object.create(Connection.prototype, { _streamPriorities: { value: streams }});
        // var streamCount = 7;
        var oldPriority, newPriority, stream;
        var prioritys = [1,2,3,1,2,3,3];
        for (var i = 0; i < prioritys.length; i++) {
          oldPriority = prioritys[i]
          stream = { _priority: oldPriority};
          connection._insert(stream, oldPriority);        
        }
        /* FROM 
          [ ,
            [ { _priority: 1 }, { _priority: 1 } ],
            [ { _priority: 2 }, { _priority: 2 } ],
            [ { _priority: 3 }, { _priority: 3 }, { _priority: 3 } ] 
          ]
        */
        expect(connection._streamPriorities[1].length ).to.equal(2)
        expect(connection._streamPriorities[3].length ).to.equal(3)
        // 把最后一个流（优先级为3）重设为1 
        newPriority = 1
        connection._reprioritize(stream,newPriority)
        stream._priority = newPriority
        // console.log(connection._streamPriorities)        
        expect(connection._streamPriorities[1].length ).to.equal(3)
        expect(connection._streamPriorities[3].length ).to.equal(2)
        /* CONVERT TO 
          [ ,
            [ { _priority: 1 }, { _priority: 1 } ], //Bucket Named
            [ { _priority: 2 }, { _priority: 2 } ],
            [ { _priority: 3 }, { _priority: 3 }] 
          ]
        */ 
        // _streamPriorities 是一个大数组，以priority为下表。就是说，如果priority最大为100，那么数组的长度就是101（还有一个0，数组从0开始）
        newPriority = 100
        connection._reprioritize(stream,newPriority)
        stream._priority = newPriority
        expect(connection._streamPriorities.length).to.equal(101)
      });
    });
    describe('method ._reprioritize(stream)', function() {
      it('should eject and then insert the stream in _streamPriorities in a place determined by stream._priority', function() {
        var streams = [];
        //  Object.create() is an excellent choice for creating an object without going through its constructor 
        // 
        //      http://www.htmlgoodies.com/beyond/javascript/object.create-the-new-way-to-create-objects-in-javascript.html
        /*
                        var Car2 = Object.create(null); //this is an empty object, like {}
                Car2.prototype = {
                  getInfo: function() {
                    return 'A ' + this.color + ' ' + this.desc + '.';
                  }
                };
                 
                var car2 = Object.create(Car2.prototype, {
                  //value properties
                  color:   { writable: true,  configurable:true, value: 'red' },
                  //concrete desc value
                  rawDesc: { writable: false, configurable:true, value: 'Porsche boxter' },
                  // data properties (assigned using getters and setters)
                  desc: { 
                    configurable:true, 
                    get: function ()      { return this.rawDesc.toUpperCase();  },
                    set: function (value) { this.rawDesc = value.toLowerCase(); }  
                  }
                }); 
                car2.color = 'blue';
                alert(car2.getInfo()); //displays 'A RED PORSCHE BOXTER.'
          */
          //http://stackoverflow.com/questions/13040684/javascript-inheritance-object-create-vs-new
        var connection = Object.create(Connection.prototype, { _streamPriorities: { value: streams }});
        var streamCount = 10;
        var oldPriority, newPriority, stream;

        for (var i = 0; i < streamCount; i++) {
          oldPriority = randomPriority();
          while ((newPriority = randomPriority()) === oldPriority);
          stream = { _priority: oldPriority };
          connection._insert(stream, oldPriority);
          connection._reprioritize(stream, newPriority);
          stream._priority = newPriority;

          expect(connection._streamPriorities[newPriority]).to.include(stream);
          expect(connection._streamPriorities[oldPriority] || []).to.not.include(stream);
        }

        expectPriorityOrder(streams);
      });
    });
    describe('invalid operation', function() {
      //unsolicited :未被恳求的，主动提供的
      describe('unsolicited ping answer', function() {
        it('should be ignored', function() {
          var connection = new Connection(util.log, 1, settings);

          connection._receivePing({
            stream: 0,
            type: 'PING',
            flags: {
              'PONG': true
            },
            data: new Buffer(8)
          });
        });
      });
    });
  });
  describe('test scenario', function() {
    var c, s;
    beforeEach(function() {
      c = new Connection(util.log.child({ role: 'client' }), 1, settings);
      s = new Connection(util.log.child({ role: 'server' }), 2, settings);
      // 双向管道：c发的，直接到s，反过来也是。
      // 两个connection的流直接连接起来，不必搞什么网络通信即可测试。
      // 至此，这里无需看到 server.listen(1234, function() {}) 之类的网络侦听和连接发起的代码
      // 这样的松耦合代码（测试connection，无需启动server,client 的网络）令人愉快！
      c.pipe(s).pipe(c);
    });
    //  mocha的testcase 结构是这样的： {describe ,it ,done }  。要求正确完成调用done，是因为异步结构，作为mocha的框架，无法确知代码何时完成。如果调用了done，那么其他的分支就不必执行了。
    // 比如代码以下，两个异步分支，要是不调用done来通知mocha，鬼才知道是否应该都执行完才算完？
    /*
    describe('do sth', function() {
      it('expected', function(done) {
        setTimeout(function() {
          // branch 1
          done();
        }, 10);
        setTimeout(function() {
          // branch 2
          done();
        }, 10);
      });
    });
    */
    describe('connection setup', function() {
      it('should work as expected', function(done) {
        setTimeout(function() {
          // If there are no exception until this, then we're done
          done();
        }, 10);
      });
    });
    // 1000copy eye on here 
    describe('connection_pipe_request', function() {
      it('callNTimes1', function(done) {
        done = util.callNTimes(2, done);
        // Request and response data
        var request_headers = {
          ':method': 'GET',
          ':path': '/'
        };
        var request_data = new Buffer(0);
        var response_headers = {
          ':status': '200'
        };
        var response_data = new Buffer('12345678', 'hex');

        // Setting up server
        s.on('stream', function(server_stream) {
          
          console.log(new Error().stack)
          server_stream.on('headers', function(headers) {
            expect(headers).to.deep.equal(request_headers);
            server_stream.headers(response_headers);
            server_stream.end(response_data);
          });
        });

        // Sending request
        var client_stream = c.createStream();
        client_stream.headers(request_headers);
        client_stream.end(request_data);

        // Waiting for answer
        // done被替换为新函数，新函数包装原来的done，要求调用两次后才真的执行。这样1号位，2号位两个done被调用才不会被mocha抱怨
        //          Error: done() called multiple times
        // done = util.callNTimes(2, done);
        client_stream.on('headers', function(headers) {
          expect(headers).to.deep.equal(response_headers);
          // 1 号位
          done();
        });
        client_stream.on('data', function(data) {
          expect(data).to.deep.equal(response_data);
          // 2 号位
          done();
        })
;      });
    });
    describe('server push', function() {
      it('should work as expected', function(done) {
        var request_headers = { ':method': 'get', ':path': '/' };
        var response_headers = { ':status': '200' };
        var push_request_headers = { ':method': 'get', ':path': '/x' };
        var push_response_headers = { ':status': '200' };
        var response_content = new Buffer(10);
        var push_content = new Buffer(10);

        done = util.callNTimes(5, done);

        s.on('stream', function(response) {
          response.headers(response_headers);

          var pushed = response.promise(push_request_headers);
          pushed.headers(push_response_headers);
          pushed.end(push_content);

          response.end(response_content);
        });

        var request = c.createStream();
        request.headers(request_headers);
        request.end();
        request.on('headers', function(headers) {
          expect(headers).to.deep.equal(response_headers);
          done();
        });
        request.on('data', function(data) {
          expect(data).to.deep.equal(response_content);
          done();
        });
        request.on('promise', function(pushed, headers) {
          expect(headers).to.deep.equal(push_request_headers);
          pushed.on('headers', function(headers) {
            expect(headers).to.deep.equal(response_headers);
            done();
          });
          pushed.on('data', function(data) {
            expect(data).to.deep.equal(push_content);
            done();
          });
          pushed.on('end', done);
        });
      });
    });
    describe('ping from client', function() {
      it('should work as expected', function(done) {
        c.ping(function() {
          done();
        });
      });
    });
    describe('ping from server', function() {
      it('should work as expected', function(done) {
        s.ping(function() {
          done();
        });
      });
    });
    describe('no-expect creating two streams and then using them in reverse order', function() {
      it('should not result in non-monotonous local ID ordering', function() {
        //  没有expect的unittest有点让人不高兴
        var s1 = c.createStream();
        var s2 = c.createStream();
        s2.headers({ ':method': 'get', ':path': '/' });
        s1.headers({ ':method': 'get', ':path': '/' });        
      });
    });
    describe('PROMISE1:creating two promises and then using them in reverse order', function() {
      // monotonous - 单调的
      // it('should not result in non-monotonous local ID ordering', function(done) {
      //   done = util.callNTimes(2, done);
      //   s.on('stream', function(response) {
      //     response.headers({ ':status': '200' });

      //     var p1 = s.createStream();
      //     var p2 = s.createStream();
      //     response.promise(p2, { ':method': 'get', ':path': '/p2' });
      //     response.promise(p1, { ':method': 'get', ':path': '/p1' });
      //     p2.headers({ ':status': '200' });
      //     p1.headers({ ':status': '200' });          
      //     done();
      //   });

      //   var request = c.createStream();
      //   request.headers({ ':method': 'get', ':path': '/' });

        
        
      //   request.on('promise', function(stream,headers) {
      //      console.log(headers.id);
      //      console.log(headers.constructor.name);
      //      console.log(headers);
      //      done();
      //   });

      // });
    });
    describe('closing the connection on one end', function() {
      it('should result in closed streams on both ends', function(done) {
        done = util.callNTimes(2, done);
        c.on('end', done);
        s.on('end', done);
        c.close();
      });
    });
  });
});
