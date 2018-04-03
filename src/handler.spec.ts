import * as bunyan from 'bunyan';
import * as chai from 'chai';
import { Context, APIGatewayEvent } from 'aws-lambda';
import 'mocha';
import { extend, serializers } from './extension';
import { handle } from './handler';

const expect = chai.expect;

const testContext = {
  functionName: 'testFunction',
  awsRequestId: '00112233445566778899',
  functionVersion: '$LATEST',
};

const testHeader = {
  'X-Flow-ID': '123456789',
};

describe('lambda-handle-as-promised', () => {
  describe('handle', () => {
    it('should throw when handle is not provided', () => {
      expect(handle).to.throw(Error, /^handler is not a function$/);
    });

    it('should throw when handle is not a function', () => {
      expect(() => handle({})).to.throw(Error, /^handler is not a function$/);
    });

    it('should wrap handle correctly', () => {
      const wrappedHandle = handle(() => true);
      expect(wrappedHandle).to.be.a('function');
      expect(wrappedHandle).to.have.length(3);
    });

    it('wrapped handle should return promise', () => {
      const fixture = handle(() => true);
      expect(fixture({}, testContext, () => { })).to.be.an.instanceof(Promise);
    });

    it('wrapped handle should call success callback when plain value is returned', done => {
      const testResult = true;
      const fixture = handle(() => testResult);

      fixture({}, testContext, (err, result) => {
        try {
          expect(err).to.not.exist;
          expect(result).to.equal(testResult);
          done();
        } catch (assertErr) {
          done(assertErr);
        }
      });
    });

    it('wrapped handle should call success callback when resolved promise is returned', done => {
      const testResult = true;
      const fixture = handle(() => Promise.resolve(testResult));

      fixture({}, testContext, (err, result) => {
        try {
          expect(err).to.not.exist;
          expect(result).to.equal(testResult);
          done();
        } catch (assertErr) {
          done(assertErr);
        }
      });
    });

    it('wrapped handle should call success callback when success callback is called by handle', done => {
      const testResult = true;
      const fixture = handle((event, context, callback) =>
        callback(null, testResult),
      );

      fixture({}, testContext, (err, result) => {
        try {
          expect(err).to.not.exist;
          expect(result).to.equal(testResult);
          done();
        } catch (assertErr) {
          done(assertErr);
        }
      });
    });

    it('wrapped handle should call error callback when rejected promise is returned', done => {
      const testError = new Error('Winter is coming!');
      const fixture = handle(() => Promise.reject(testError));

      fixture({}, testContext, (err, result) => {
        try {
          expect(err).to.deep.equal(testError);
          expect(result).to.not.exist;
          done();
        } catch (assertErr) {
          done(assertErr);
        }
      });
    });

    it('wrapped handle should call error callback when exception is thrown', done => {
      const testError = new Error('Winter is coming!');
      const fixture = handle(() => {
        throw testError;
      });

      fixture({}, testContext, (err, result) => {
        try {
          expect(err).to.deep.equal(testError);
          expect(result).to.not.exist;
          done();
        } catch (assertErr) {
          done(assertErr);
        }
      });
    });

    it('wrapped handle should call error callback when error callback is called by handle', done => {
      const testError = new Error('Winter is coming!');
      const fixture = handle((event, context, callback) => callback(testError));

      fixture({}, testContext, (err, result) => {
        try {
          expect(err).to.have.property('message', testError.message);
          expect(result).to.not.exist;
          done();
        } catch (assertErr) {
          done(assertErr);
        }
      });
    });

    it('wrapped handle should use callback val when both callback is called and val is returned', done => {
      const testResult1 = true;
      const testResult2 = false;
      const fixture = handle((event, context, callback) => {
        callback(null, testResult1);
        return testResult2;
      });

      fixture({}, testContext, (err, result) => {
        try {
          expect(err).to.not.exist;
          expect(result).to.be.equal(testResult1);
          done();
        } catch (assertErr) {
          done(assertErr);
        }
      });
    });
  });

  describe('options', () => {
    describe('hooks', () => {
      describe('onBefore', () => {
        it('should throw when "onBefore" is not a function', () => {
          expect(() => handle(() => { }, { onBefore: {} })).to.throw(
            Error,
            /^options.onBefore must be a function when present$/,
          );
        });

        it('should call "onBefore" hook when passed', done => {
          const testEvent = { data: 'some extremely important data' };
          const fixture = handle(() => true, {
            onBefore: (event, context) => {
              expect(event).to.be.deep.equal(testEvent);
              expect(context).to.have.property(
                'awsRequestId',
                testContext.awsRequestId,
              );
              expect(context).to.have.property('log');
            },
          });

          fixture(testEvent, testContext, done);
        });

        it('should call "onError" hook when error is thrown in "onBefore"', done => {
          let errHookCallCount = 0;
          const testError = new Error('Winter is coming!');
          const fixture = handle(() => true, {
            onBefore: () => {
              throw testError;
            },
            onError: err => {
              expect(err).to.be.deep.equal(testError);
              errHookCallCount += 1;
              throw err;
            },
          });

          fixture({}, testContext, err => {
            try {
              expect(err).to.be.deep.equal(testError);
              expect(errHookCallCount).to.equal(1);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });
      });

      describe('onAfter', () => {
        it('should throw when "onAfter" is not a function', () => {
          expect(() => handle(() => { }, { onAfter: {} })).to.throw(
            Error,
            /^options.onAfter must be a function when present$/,
          );
        });

        it('should call "onAfter" hook when passed', done => {
          const testEvent = { data: 'some extremely important data' };
          const testResult = { response: 'some useful info' };
          const fixture = handle(() => testResult, {
            onAfter: (result, event, context) => {
              expect(result).to.be.deep.equal(testResult);
              expect(event).to.be.deep.equal(testEvent);
              expect(context).to.have.property(
                'awsRequestId',
                testContext.awsRequestId,
              );
              expect(context).to.have.property('log');
            },
          });

          fixture(testEvent, testContext, done);
        });

        it('should use value returned by "onAfter" as a result', done => {
          const modifiedResult = { modifiedResponse: 'some modified info' };
          const fixture = handle(() => true, { onAfter: () => modifiedResult });

          fixture({}, testContext, (err, result) => {
            try {
              expect(result).to.deep.equal(modifiedResult);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });

        it('should use value returned by "onAfter" as a result when value is falsy', done => {
          const modifiedResult = false;
          const fixture = handle(() => true, { onAfter: () => modifiedResult });

          fixture({}, testContext, (err, result) => {
            try {
              expect(result).to.deep.equal(modifiedResult);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });

        it('should use original result when "onAfter" does not return any value', done => {
          const testResult = { response: 'some useful info' };
          const fixture = handle(() => testResult, { onAfter: () => { } });

          fixture({}, testContext, (err, result) => {
            try {
              expect(result).to.deep.equal(testResult);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });

        it('should call "onError" hook when error is thrown in "onAfter"', done => {
          let errHookCallCount = 0;
          const testError = new Error('Winter is coming!');
          const fixture = handle(() => true, {
            onAfter: () => {
              throw testError;
            },
            onError: err => {
              expect(err).to.be.deep.equal(testError);
              errHookCallCount += 1;
              throw err;
            },
          });

          fixture({}, testContext, err => {
            try {
              expect(err).to.be.deep.equal(testError);
              expect(errHookCallCount).to.equal(1);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });
      });

      describe('onError', () => {
        it('should throw when "onError" is not a function', () => {
          expect(() => handle(() => { }, { onError: {} })).to.throw(
            Error,
            /^options.onError must be a function when present$/,
          );
        });

        it('should call "onError" hook when passed', done => {
          const testEvent = { data: 'some extremely important data' };
          const testError = new Error('Winter is coming!');
          const fixture = handle(
            () => {
              throw testError;
            },
            {
              onError: (err, event, context) => {
                expect(err).to.be.deep.equal(err);
                expect(event).to.be.deep.equal(testEvent);
                expect(context).to.have.property(
                  'awsRequestId',
                  testContext.awsRequestId,
                );
                expect(context).to.have.property('log');
              },
            },
          );

          fixture(testEvent, testContext, done);
        });

        it('should use error thrown by "onError" as an error', done => {
          const testError = new Error('Winter is coming!');
          const fixture = handle(
            () => {
              throw new Error();
            },
            {
              onError: () => {
                throw testError;
              },
            },
          );

          fixture({}, testContext, err => {
            try {
              expect(err).to.deep.equal(testError);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });

        it('should use value returned by "onError" as a result', done => {
          const testResult = { testResponse: 'some useful info' };
          const fixture = handle(
            () => {
              throw new Error();
            },
            { onError: () => testResult },
          );

          fixture({}, testContext, (err, result) => {
            try {
              expect(err).to.be.equal(null);
              expect(result).to.deep.equal(testResult);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });

        it('should use value returned by "onError" as a result when value is falsy', done => {
          const testResult = false;
          const fixture = handle(
            () => {
              throw new Error();
            },
            { onError: () => testResult },
          );

          fixture({}, testContext, (err, result) => {
            try {
              expect(err).to.be.equal(null);
              expect(result).to.deep.equal(testResult);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });

        it('should return orig. error when "onError" does not return any value and does not throw', done => {
          const testError = new Error('Winter is coming!');
          const fixture = handle(
            () => {
              throw testError;
            },
            { onError: () => { } },
          );

          fixture({}, testContext, (err, result) => {
            try {
              expect(err).to.be.equal(null);
              expect(result).to.deep.equal(testError);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });

        it('should call "onAfter" hook when result is returned in "onError"', done => {
          let resultHookCallCount = 0;
          const testResult = { testResponse: 'some useful info' };
          const fixture = handle(
            () => {
              throw new Error();
            },
            {
              onError: () => testResult,
              onAfter: result => {
                expect(result).to.be.deep.equal(testResult);
                resultHookCallCount += 1;
              },
            },
          );

          fixture({}, testContext, (err, result) => {
            try {
              expect(err).to.be.equal(null);
              expect(resultHookCallCount).to.equal(1);
              expect(result).to.be.deep.equal(testResult);
              done();
            } catch (assertErr) {
              done(assertErr);
            }
          });
        });
      });
    });

    describe('errorStack', () => {
      it('should throw when "errorStack" is not boolean', () => {
        expect(() => handle(() => { }, { errorStack: 'yes' })).to.throw(
          Error,
          /^options.errorStack must be a boolean when present$/,
        );
      });

      it('should return error stack by default', done => {
        const testError = new Error('Winter is coming!');
        const fixture = handle(() => {
          throw testError;
        });

        fixture({}, testContext, err => {
          try {
            expect(err).to.have.property('message', testError.message);
            expect(err).to.have.property('stack', testError.stack);
            done();
          } catch (assertErr) {
            done(assertErr);
          }
        });
      });

      it('should return error stack when "errorStack" is set to true', done => {
        const testError = new Error('Winter is coming!');
        const fixture = handle(
          () => {
            throw testError;
          },
          {
            errorStack: true,
          },
        );

        fixture({}, testContext, err => {
          try {
            expect(err).to.have.property('message', testError.message);
            expect(err).to.have.property('stack', testError.stack);
            done();
          } catch (assertErr) {
            done(assertErr);
          }
        });
      });

      it('should sanitize error stack when "errorStack" is set to false', done => {
        const testError = new Error('Winter is coming!');
        const fixture = handle(
          () => {
            throw testError;
          },
          {
            errorStack: false,
          },
        );

        fixture({}, testContext, err => {
          try {
            expect(err).to.have.property('message', testError.message);
            expect(err).to.have.property('stack', '');
            done();
          } catch (assertErr) {
            done(assertErr);
          }
        });
      });

      it('should handle case when "errorStack" is set to false, but "stack" field missing in error', done => {
        const testError = { message: 'Winter is coming!' };
        const fixture = handle(
          () => {
            throw testError;
          },
          {
            errorStack: false,
          },
        );

        fixture({}, testContext, err => {
          try {
            expect(err).to.have.property('message', testError.message);
            expect(err).not.to.have.property('stack');
            done();
          } catch (assertErr) {
            done(assertErr);
          }
        });
      });
    });
  });

  describe('context', () => {
    it('should have log property defined', done => {
      const fixture = handle((event, context) => {
        expect(context).to.have.property('log');
        expect(context.log).to.be.an.instanceof(bunyan);
      });

      fixture({}, testContext, done);
    });

    it('should have child property defined', done => {
      const fixture = handle((event, context) => {
        expect(context).to.have.property('child');
        expect(context.child).to.be.a('function');
      });

      fixture({}, testContext, done);
    });
  });
});
