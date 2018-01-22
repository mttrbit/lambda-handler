import * as bunyan from 'bunyan';
import * as chai from 'chai';
import { Context } from 'aws-lambda';
import 'mocha';
import * as _ from 'lodash';
import { extend, serializers } from './extension';

const expect = chai.expect;

const testContext = {
  functionName: 'testFunction',
  awsRequestId: '00112233445566778899',
  functionVersion: '$LATEST',
};

const testHeader = {
  'X-Flow-ID': '123456789',
};

describe('extension', () => {

  it('should add log property to context', () => {
    expect(testContext).not.to.have.property('log');

    const fixture = extend(testHeader, testContext as Context);

    expect(fixture)
      .to.have.property('log')
      .that.is.an.instanceof(bunyan);
  });

  it('should add child property to context', () => {
    expect(testContext).not.to.have.property('child');

    const fixture = extend(testHeader, testContext as Context);

    expect(fixture)
      .to.have.property('child')
      .that.is.a('function');
  });

  it('should have default fields added to each log record', () => {
    const fixture = extend(testHeader, testContext as Context);

    expect(fixture).to.have.property('log');
    expect(fixture.log).to.have.deep.property(
      'fields.name',
      testContext.functionName,
    );
    expect(fixture.log).to.have.deep.property(
      'fields.awsRequestId',
      testContext.awsRequestId,
    );
    expect(fixture.log).to.have.deep.property(
      'fields.functionVersion',
      testContext.functionVersion,
    );
  });

  describe('#child', () => {
    it('should create child context', () => {
      const testField = 'testField';
      const fixture = extend(testHeader, testContext as Context);
      const fixtureClone = _.cloneDeep(fixture);

      const newContext = fixture.child({ testField });
      expect(fixture).deep.equals(fixtureClone, 'fixture should not be mutated');
      expect(newContext).not.to.deep.equal(fixture);
      expect(newContext).to.have.deep.property('log.fields.testField', testField);
    });
  });

  describe('serializers', () => {
    it('should have serializers set', () => {
      const fixture = extend(testHeader, testContext as Context);

      expect(fixture)
        .to.have.property('log')
        .that.has.property('serializers')
        .that.deep.equals({
          err: serializers.error,
          error: serializers.error,
          context: serializers.context,
        });
    });

    describe('contextSerializer', () => {
      it('should omit "log" and "child" properties', () => {
        const initialContext = {
          log: 'log',
          child: 'child',
          meaningOfLife: 42,
        };

        const sanitizedContext = serializers.context(initialContext);
        expect(sanitizedContext).to.deep.equal({
          meaningOfLife: initialContext.meaningOfLife,
        });
      });
    });

    describe('errorSerializer', () => {
      it('should not do anything if error is not an object', () => {
        const testError = 'error';
        const sanitizedError = serializers.error(testError);
        expect(sanitizedError).to.deep.equal(testError);
      });

      it('should handle case when error is not an instance of the Error class', () => {
        const testError = {
          message: 'Winter is coming!',
          details: {
            temperature: -1,
          },
        };

        const sanitizedError = serializers.error(testError);
        expect(sanitizedError).to.deep.equal(testError);
      });

      it(
        'should handle case when error is an instance of the Error class w/o additional fields',
        () => {
          const testError = new Error('Winter is coming!');

          const sanitizedError = serializers.error(testError);
          expect(sanitizedError).to.have.property('message', testError.message);
          expect(sanitizedError).to.have.property('name');
          expect(sanitizedError).to.have.property('stack');
        });

      it(
        'should handle case when error is an instance of the Error class with additional fields',
        () => {
          const testError = new Error('Winter is coming!');
          testError['details'] = {
            temperature: -1,
          };

          const sanitizedError = serializers.error(testError);
          expect(sanitizedError).to.have.property('message', testError.message);
          expect(sanitizedError).to.have.property('name');
          expect(sanitizedError).to.have.property('stack');
          expect(sanitizedError)
            .to.have.property('details')
            .that.deep.equals(testError['details']);
        });
    });
  });
});
