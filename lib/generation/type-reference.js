'use strict';

module.exports = class TypeReference {
  constructor(scope, name) {
    this.scope = scope;
    this.name = name;
  }

  serialize(options = {}) {
    if (options.qualified) {
      return `${this.scope.serializeFullName()}.${this.name}`;
    } else {
      return this.name;
    }
  }
}
