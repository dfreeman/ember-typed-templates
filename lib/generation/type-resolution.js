'use strict';

module.exports = class TypeResolution {
  constructor(name, resolutionTypes) {
    this.name = name;
    this.resolutionTypes = resolutionTypes;
  }

  serialize() {
    let name = JSON.stringify(this.name);
    let resolutionTypes = this.serializeResolutionTypes();
    return `resolve<scope, ${name}, ${resolutionTypes}>`;
  }

  serializeResolutionTypes() {
    let types = [];
    for (let type of ['Local', 'Component', 'Helper', 'Property']) {
      if (this.resolutionTypes & TypeResolution[type]) {
        types.push(type);
      }
    }
    return types.join(' | ');
  }
}

module.exports.Local = 0b0001;
module.exports.Component = 0b0010;
module.exports.Helper = 0b0100;
module.exports.Property = 0b1000;
