import * as _ from 'lodash';
import { Context } from 'aws-lambda';
import {
  Headers,
  LambdaLogger,
  contextSerializer,
  errorSerializer,
} from '@mttrbit/bunyan-logger';

function child(fields) {
  const newContext = _.cloneDeep(this);
  const log = this.log.child(fields);

  return Object.assign(newContext, { log });
}

const serializers = {
  context: contextSerializer,
  error: errorSerializer,
};

export function extend(headers: Headers, context: Context) {
  const newContext = _.cloneDeep(context);
  const log = LambdaLogger.create(headers, context);
  return Object.assign(newContext, { log, child });
}

export { serializers };
