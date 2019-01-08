import { NotFound } from 'ember-typed-templates';

export type assert<
  info extends string,
  loc extends [number, number],
  T extends [info, { line: loc[0], column: loc[1] }]
> = T;

type Ok = any;
type Failed = void;

export type exists<T>
  = T extends NotFound
    ? Failed
    : Ok;

export type hasBlockParam<T, index>
  = T extends { yields: any }
    ? index extends keyof T['yields']
      ? Ok
      : Failed
    : Failed;

export type assignable<target, actual extends target>
  = actual extends target
    ? Ok
    : Failed;
