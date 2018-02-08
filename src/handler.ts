import { Callback } from 'aws-lambda';
import { Headers } from '@mttrbit/bunyan-logger';
import { extend } from './extension';
import * as utils from './utils';

export type Options = {
  errorStack?: string | boolean;
  onBefore?: any;
  onAfter?: any;
  onError?: any;
};

export function handle(handler, options: Options = {}) {
  if (typeof handler !== 'function') {
    throw new Error('handler is not a function');
  }

  ['onBefore', 'onAfter', 'onError'].forEach(hookMethod => {
    if (options[hookMethod] && typeof options[hookMethod] !== 'function') {
      throw new Error(`options.${hookMethod} must be a function when present`);
    }
  });

  if (options.errorStack && typeof options.errorStack !== 'boolean') {
    throw new Error('options.errorStack must be a boolean when present');
  }

  return (event, context, callback: Callback) => {
    const newContext = extend(event.headers as Headers, context);
    return Promise.resolve(
      new Promise((resolve, reject) => {
        if (options.onBefore) {
          options.onBefore(event, newContext);
        }

        if (handler.length < 3) {
          resolve(handler(event, newContext));
        } else {
          handler(event, newContext, (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        }
      })
        .then(result =>
          utils.callHook(options.onAfter, result, event, newContext),
      )
        .then(result => callback(null, result))
        .catch(err => {
          const result = utils.sanitizeError(err, options);
          const onError = result =>
            utils.callErrorHook(options.onError, result, event, newContext);
          return Promise.resolve(onError(result)).then(result =>
            callback(null, result),
          );
        }),
    ).catch(err => callback(utils.sanitizeError(err, options)));
  };
}
