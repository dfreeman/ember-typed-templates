'use strict';

const inflector = require('inflected');
const MapWithDefault = require('../utils/map-with-default');
const { indent } = require('../utils/formatting');
const TypeResolution = require('./type-resolution');
const TypeReference = require('./type-reference');
const BlockParam = require('./block-param');
const Assert = require('./assert');
const Locals = require('./locals');

class Scope {
  constructor() {
    this.assertions = [];
    this.children = new Map();
    this.references = new MapWithDefault(() => new Map());
  }

  createChild(name, locals) {
    let camelized = inflector.camelize(inflector.underscore(name), false) + 'Block';
    let iteration = 0;
    let candidateName;
    do {
      candidateName = `${camelized}${iteration++ || ''}`;
    } while (this.children.has(candidateName));

    let child = new ChildScope(this, candidateName, new Locals(locals));
    this.children.set(candidateName, child);
    return child;
  }

  resolve(name, types) {
    let references = this.references.get(name);
    if (references.has(types)) {
      return references.get(types).ref;
    }

    let refName = `ref${inflector.camelize(inflector.underscore(`${name}${references.size || ''}`))}`;
    let ref = new TypeReference(this, refName);
    let type = new TypeResolution(name, types);
    references.set(types, { ref, type });
    return ref;
  }

  resolveBlockParam(ref, index) {
    return new BlockParam(ref, index);
  }

  assertHasBlockParam(message, location, ref, index) {
    this.assertions.push(Assert.hasBlockParam(message, location, ref, index));
  }

  assertExists(message, location, type) {
    this.assertions.push(Assert.exists(message, location, type));
  }

  serialize(options) {
    let chunks = [];
    chunks.push(`namespace ${this.serializeShortName()} {`);
    chunks.push(`  type scope = ${this.serializeDefinition({ indentation: options.indentation + 1 })};`);

    if (this.references.size) {
      chunks.push('');
      for (let map of this.references.values()) {
        for (let { ref, type } of map.values()) {
          chunks.push(`  type ${ref.serialize()} = ${type.serialize({ indentation: options.indentation + 1 })};`);
        }
      }
    }

    if (this.assertions.length) {
      chunks.push('');
      chunks.push(`  type assertions =`);
      for (let assertion of this.assertions) {
        chunks.push(`    & ${assertion.serialize({ indentation: options.indentation + 2 })}`);
      }
      chunks[chunks.length - 1] += ';';
    }

    for (let child of this.children.values()) {
      chunks.push('');
      chunks.push(`  ${child.serialize({ indentation: options.indentation + 1 })}`);
    }

    chunks.push(`}`);

    return indent(options.indentation, chunks);
  }
}

class ChildScope extends Scope {
  constructor(parent, name, locals) {
    super();
    this.parent = parent;
    this.name = name;
    this.locals = locals;
  }

  resolve(name, types) {
    if (this.locals.has(name)) {
      return super.resolve(name, types);
    } else {
      return this.parent.resolve(name, types);
    }
  }

  recordYield(index, type) {
    this.parent.recordYield(index, type);
  }

  serializeShortName() {
    return this.name;
  }

  serializeFullName() {
    return `${this.parent.serializeFullName()}.${this.name}`;
  }

  serializeDefinition(options) {
    let scope = `${this.parent.serializeFullName()}.scope`;
    let locals = this.locals.serialize(options);
    return `extendScope<${scope}, ${locals}>`;
  }
}

module.exports = class RootScope extends Scope {
  constructor() {
    super();
    this.yields = [];
  }

  serialize({ name, modulePrefix }) {
    let serialized = super.serialize({ indentation: 0 });
    let chunks = [
      `import { TemplateFactory } from 'htmlbars-inline-precompile';`,
      `import { ControllerRegistry, ComponentRegistry, HelperRegistry, TemplateRegistry } from '${modulePrefix}/type-registries';`,
      `import { findHost, resolve, makeScope, extendScope, blockParam } from 'ember-typed-templates';`,
      `import { Local, Component, Helper, Property } from 'ember-typed-templates';`,
      `import { assert, exists, hasBlockParam } from 'ember-typed-templates/assertions';`,
      ``,
      `// The component or controller (if any) associated to this template`,
      `type host = findHost<${JSON.stringify(name)}, ComponentRegistry, ControllerRegistry>;`,
      ``,
      `// The root scope of this template, including all globally available components and helpers`,
      `declare ${serialized}`,
      ``,
      `type template = TemplateFactory & {`,
      `  yields: ${this.serializeYields({ qualified: true, indentation: 1 })}`,
      `};`,
      ``,
      `declare const template: template;`,
      `export default template;`,
    ];

    return `${chunks.join('\n')}\n`;
  }

  recordYield(index, type) {
    let yields = this.yields[index];
    if (!yields) {
      yields = this.yields[index] = new Set();
    }
    yields.add(type);
  }

  serializeYields(options) {
    if (!this.yields.length) {
      return 'void';
    }

    let chunks = [];
    let childOptions = Object.assign({}, options, {
      indentation: options.indentation + 1
    });

    chunks.push('[');
    for (let [index, yieldTypes] of this.yields.entries()) {
      if (yieldTypes.size === 1) {
        chunks.push(`  ${[...yieldTypes][0].serialize(childOptions)}`);
      } else {
        for (let yieldType of yieldTypes) {
          chunks.push(`  | ${yieldType.serialize(childOptions)}`);
        }
      }

      if (index < this.yields.length - 1) {
        chunks[chunks.length - 1] += ',';
      }
    }
    chunks.push(']');

    return indent(options.indentation, chunks);
  }

  serializeShortName() {
    return 'root';
  }

  serializeFullName() {
    return 'root';
  }

  serializeDefinition() {
    return `makeScope<host, ComponentRegistry, TemplateRegistry, ControllerRegistry>`;
  }
}
