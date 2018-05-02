type diff<T, U> = T extends U ? never : T;
type assign<dest, src> =
  & { [key in keyof src]: src[key] }
  & { [key in diff<keyof dest, keyof src>]: dest[key] };

export type Scope = { locals: any, components: any, helpers: any, host: any };

export type findHost<name, components, controllers>
  = name extends keyof components
    ? components[name]
    : name extends keyof controllers
      ? controllers[name]
      : never;

export type extendScope<scope, newLocals> = scope extends { locals: infer oldLocals }
  ? assign<scope, { locals: assign<oldLocals, newLocals> }>
  : never;

export type resolve<scope extends Scope, name, sources extends keyof Scope> =
  resolveOr<scope, name, sources, 'locals',
  resolveOr<scope, name, sources, 'components',
  resolveOr<scope, name, sources, 'helpers',
  resolveOr<scope, name, sources, 'host',
  void>>>>;

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
