'use strict';

module.exports = class BlockParam {
  constructor(ref, index) {
    this.ref = ref;
    this.index = index;
  }

  serialize(options) {
    let childOptions = Object.assign({}, options, {
      qualified: true
    });

    let fullRef = this.ref.serialize(childOptions);
    let index = JSON.stringify(`${this.index}`);
    return `blockParam<${fullRef}, ${index}>`;
  }
}
