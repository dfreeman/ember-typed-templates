type diff<T, U> = T extends U ? never : T;
type assign<dest, src> =
  & { [key in keyof src]: src[key] }
  & { [key in diff<keyof dest, keyof src>]: dest[key] };

export type NonVoid = object | string | number | boolean | symbol | undefined | null;

export type Scope = { locals: any, templates: any, components: any, helpers: any, host: any };
export type makeScope<host, components, templates, helpers> = {
  locals: {};
  host: host;
  components: components;
  templates: templates;
  helpers: helpers;
}

// Where to look up each type of entity
export type Local = 'locals';
export type Component = 'components' | 'templates';
export type Helper = 'helpers';
export type Property = 'host';

export type findHost<name, components, controllers>
  = name extends keyof components
    ? components[name]
    : name extends keyof controllers
      ? controllers[name]
      : never;

export type extendScope<scope, newLocals> = scope extends { locals: infer oldLocals }
  ? assign<scope, { locals: assign<oldLocals, newLocals> }>
  : never;

export type blockParam<template, index>
  = template extends { yields: any }
    ? index extends keyof template['yields']
      ? template['yields'][index]
      : void
    : void;

export type resolve<scope extends Scope, name, sources extends keyof Scope> =
  resolveOr<scope, name, sources, 'locals',
  resolveOr<scope, name, sources, 'templates',
  resolveOr<scope, name, sources, 'components',
  resolveOr<scope, name, sources, 'helpers',
  resolveOr<scope, name, sources, 'host',
  void>>>>>;

type resolveOr<
  scope extends Scope,
  name,
  sources extends keyof Scope,
  source extends keyof Scope,
  fallback
>
  = source extends sources
    ? name extends keyof scope[source]
      ? scope[source][name]
      : fallback
    : fallback;
