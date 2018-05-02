export type assert<
  info extends string,
  loc extends { line: number, column: number },
  T extends info | loc
> = T;

type Ok = any;
type Failed = 'assertion failed';

export type exists<T>
  = T extends object | string | symbol | number | boolean | null | undefined
    ? Ok
    : Failed;

export type assignable<target, actual>
  = actual extends target
    ? Ok
    : Failed;
