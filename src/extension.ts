import { Context } from 'aws-lambda';
import * as cloneDeep from 'lodash.clonedeep';
import {
  Headers,
  LambdaLogger,
  contextSerializer,
  errorSerializer,
} from '@mttrbit/bunyan-logger';

function child(fields) {
  const newContext = cloneDeep(this);
  const log = this.log.child(fields);

  return Object.assign(newContext, { log });
}

const serializers = {
  context: contextSerializer,
  error: errorSerializer,
};

export function extend(headers: Headers, context: Context) {
  const newContext = cloneDeep(context);
  const log = LambdaLogger.create(headers, context);
  return Object.assign(newContext, { log, child });
}

export { serializers };
