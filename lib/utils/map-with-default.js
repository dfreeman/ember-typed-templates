'use strict';

module.exports = class MapWithDefault extends Map {
  constructor(iterable, defaultFn) {
    if (typeof iterable === 'function' && !defaultFn) {
      defaultFn = iterable;
      iterable = undefined;
    }

    super(iterable);
    this._defaultFn = defaultFn;
  }

  get(key) {
    if (!this.has(key)) {
      this.set(key, this._defaultFn(key));
    }

    return super.get(key);
  }
}
