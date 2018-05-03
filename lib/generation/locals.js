'use strict';

const { indent } = require('../utils/formatting');

module.exports = class Locals {
  constructor(types) {
    this.types = types;
  }

  has(type) {
    return this.types.hasOwnProperty(type);
  }

  serialize(options) {
    let chunks = [];
    let childOptions = Object.assign({}, options, {
      indentation: options.indentation + 1,
    });

    chunks.push('{');
    for (let key of Object.keys(this.types)) {
      chunks.push(`  ${key}: ${this.types[key].serialize(childOptions)};`);
    }
    chunks.push('}');

    return indent(options.indentation, chunks);
  }
}
