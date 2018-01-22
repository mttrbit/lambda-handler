export function callHook(hook, value, event, context) {
  let updatedValue;
  if (hook) {
    updatedValue = hook(value, event, context);
  }

  return updatedValue !== undefined ? updatedValue : value;
}

export function callErrorHook(hook, err, event, context) {
  if (!hook) {
    throw err;
  }

  return module.exports.callHook(hook, err, event, context);
}

export function sanitizeError(err, options) {
  err.httpStatus = err.statusCode || err.httpStatus || 500;
  err.errorType = err.name;

  if (options.errorStack) {
    return err;
  }

  if (err && err.stack) {
    err.stack = ''; // eslint-disable-line no-param-reassign
  }

  return err;
}
