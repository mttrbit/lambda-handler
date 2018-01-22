import { extend } from './extension';
export * from './handler';

const extension = {
  logger: extend,
};

export { extension };
