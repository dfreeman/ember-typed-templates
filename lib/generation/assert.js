'use strict';

module.exports = class Assert {
  static exists(message, location, type) {
    return new Assert(message, location, new Exists(type));
  }

  static hasBlockParam(message, location, ref, index) {
    return new Assert(message, location, new HasBlockParam(ref, index));
  }

  constructor(message, location, assertion) {
    this.message = message;
    this.location = location;
    this.assertion = assertion;
  }

  serialize(options) {
    let childOptions = Object.assign({}, options, {
      indentation: options.indentation + 1
    });

    let message = JSON.stringify(this.message);
    let location = `[${this.location.line}, ${this.location.column}]`;
    let assertion = this.assertion.serialize(childOptions);
    return `assert<${message}, ${location}, ${assertion}>`;
  }
}

class Exists {
  constructor(type) {
    this.type = type;
  }

  serialize(options) {
    return `exists<${this.type.serialize(options)}>`;
  }
}

class HasBlockParam {
  constructor(ref, index) {
    this.ref = ref;
    this.index = index;
  }

  serialize(options) {
    let ref = this.ref.serialize(options);
    let index = JSON.stringify(`${this.index}`);
    return `hasBlockParam<${ref}, ${index}>`;
  }
}
